const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Ride = require('../models/Ride');
const User = require('../models/User');
const Patient = require('../models/Patient');
const AdminConfig = require('../models/AdminConfig');

// ─── STATUS ───────────────────────────────────────────────────────────────────
// Returns whether admin has been configured (DB or env var)
exports.getStatus = async (req, res) => {
  try {
    const dbConfig = await AdminConfig.findOne().lean();
    const hasEnvPassword = !!process.env.ADMIN_PASSWORD;
    res.json({ configured: !!(dbConfig || hasEnvPassword) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── SETUP ────────────────────────────────────────────────────────────────────
// First-time admin password creation — only works if no admin is configured yet
exports.setup = async (req, res) => {
  try {
    const existing = await AdminConfig.findOne().lean();
    if (existing) {
      return res.status(403).json({ message: 'Un compte admin existe déjà en base.' });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit faire au moins 6 caractères.' });
    }

    const hash = await bcrypt.hash(password, 12);
    await AdminConfig.create({ passwordHash: hash });

    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { password } = req.body;

    // Check DB-stored password first
    const dbConfig = await AdminConfig.findOne().lean();
    if (dbConfig) {
      const match = await bcrypt.compare(password, dbConfig.passwordHash);
      if (!match) return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
      const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
      return res.json({ success: true, token });
    }

    // Fallback: env var
    if (!process.env.ADMIN_PASSWORD) {
      return res.status(500).json({ success: false, message: 'Configuration admin manquante.' });
    }
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
    }

    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── RIDES ────────────────────────────────────────────────────────────────────
exports.getAllRides = async (req, res) => {
  try {
    const rides = await Ride.find()
      .populate('chauffeurId', 'fullName email')
      .sort({ date: -1 })
      .lean();
    res.json(rides);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── STATS ────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalRides, totalUsers, webBookings, billedRides, pendingWeb, monthRides, finishedRides] = await Promise.all([
      Ride.countDocuments(),
      User.countDocuments(),
      Ride.countDocuments({ source: 'Web' }),
      Ride.countDocuments({ statuFacturation: 'Facturé' }),
      Ride.countDocuments({ source: 'Web', status: 'En attente' }),
      Ride.countDocuments({ date: { $gte: startOfMonth } }),
      Ride.find({ status: 'Terminée' }).select('price').lean(),
    ]);

    const totalRevenue = finishedRides.reduce((s, r) => s + (r.price || 0), 0);

    // Last 7 days ride counts
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 6);
    const dailyRides = await Ride.aggregate([
      { $match: { date: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    res.json({ totalRides, totalUsers, webBookings, billedRides, pendingWeb, monthRides, totalRevenue: Math.round(totalRevenue * 100) / 100, dailyRides });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── USERS (CHAUFFEURS) ───────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'fullName email createdAt').lean();
    const ridesPerUser = await Ride.aggregate([
      { $group: { _id: '$chauffeurId', count: { $sum: 1 }, lastDate: { $max: '$date' }, finishedCount: { $sum: { $cond: [{ $eq: ['$status', 'Terminée'] }, 1, 0] } } } }
    ]);
    const rideMap = Object.fromEntries(ridesPerUser.map(r => [r._id?.toString(), r]));
    const result = users.map(u => ({
      ...u,
      rideCount: rideMap[u._id?.toString()]?.count || 0,
      finishedCount: rideMap[u._id?.toString()]?.finishedCount || 0,
      lastRide: rideMap[u._id?.toString()]?.lastDate || null,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── PATIENTS ─────────────────────────────────────────────────────────────────
exports.getPatients = async (req, res) => {
  try {
    const patients = await Patient.find({}).populate('chauffeurId', 'fullName').lean();
    const ridesPerPatient = await Ride.aggregate([
      { $group: { _id: '$patientName', count: { $sum: 1 } } }
    ]);
    const rideMap = Object.fromEntries(ridesPerPatient.map(r => [r._id, r.count]));
    const result = patients.map(p => ({ ...p, rideCount: rideMap[p.fullName] || 0 }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── UPDATE RIDE STATUS ───────────────────────────────────────────────────────
exports.updateRideStatus = async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    const valid = ['En attente', 'À venir', 'En cours', 'Terminée', 'Annulée'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Statut invalide' });
    const update = { status };
    if (status === 'Annulée' && cancelReason) update.cancelReason = cancelReason;
    const ride = await Ride.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).populate('chauffeurId', 'fullName email');
    if (!ride) return res.status(404).json({ message: 'Course introuvable' });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── ACCEPT WEB RIDE ──────────────────────────────────────────────────────────
exports.acceptWebRide = async (req, res) => {
  try {
    const { chauffeurId } = req.body;
    const update = { status: 'À venir' };
    if (chauffeurId) update.chauffeurId = chauffeurId;
    const ride = await Ride.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).populate('chauffeurId', 'fullName');
    if (!ride) return res.status(404).json({ message: 'Course introuvable' });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── REJECT WEB RIDE ──────────────────────────────────────────────────────────
exports.rejectWebRide = async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'Annulée', cancelReason: "Refusée par l'administrateur" } },
      { new: true }
    );
    if (!ride) return res.status(404).json({ message: 'Course introuvable' });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── CREATE RIDE (ADMIN) ──────────────────────────────────────────────────────
exports.createRide = async (req, res) => {
  try {
    const ride = new Ride({ ...req.body, source: req.body.source || 'Web', status: req.body.status || 'À venir' });
    await ride.save();
    const populated = await Ride.findById(ride._id).populate('chauffeurId', 'fullName email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── DELETE RIDE ──────────────────────────────────────────────────────────────
exports.deleteRide = async (req, res) => {
  try {
    const ride = await Ride.findByIdAndDelete(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Course introuvable' });
    res.json({ message: 'Course supprimée' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── BILLING REPORT ───────────────────────────────────────────────────────────
exports.getBillingReport = async (req, res) => {
  try {
    const { from, to, statuFacturation } = req.query;
    const query = { status: 'Terminée' };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to)   query.date.$lte = new Date(to);
    }
    if (statuFacturation) query.statuFacturation = statuFacturation;
    const rides = await Ride.find(query).populate('chauffeurId', 'fullName').sort({ date: -1 }).lean();
    const totalKm     = rides.reduce((s, r) => s + (r.realDistance || 0), 0);
    const totalAmount = rides.reduce((s, r) => s + (r.price || 0), 0);
    const totalTolls  = rides.reduce((s, r) => s + (r.tolls || 0), 0);
    res.json({ rides, summary: { count: rides.length, totalKm: Math.round(totalKm * 10) / 10, totalAmount: Math.round(totalAmount * 100) / 100, totalTolls: Math.round(totalTolls * 100) / 100 } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── UPDATE BILLING STATUS ────────────────────────────────────────────────────
exports.updateBillingStatus = async (req, res) => {
  try {
    const { statuFacturation } = req.body;
    if (!['Non facturé', 'Facturé'].includes(statuFacturation)) return res.status(400).json({ message: 'Statut invalide' });
    const ride = await Ride.findByIdAndUpdate(req.params.id, { $set: { statuFacturation } }, { new: true });
    if (!ride) return res.status(404).json({ message: 'Course introuvable' });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── SEND REVIEW SMS ──────────────────────────────────────────────────────────
exports.sendReviewSms = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).lean();
    if (!ride) return res.status(404).json({ message: 'Course introuvable' });
    if (!ride.patientPhone) return res.status(400).json({ message: 'Numéro de téléphone manquant pour ce patient.' });

    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ message: 'Message requis.' });

    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN || !process.env.TWILIO_FROM) {
      return res.status(503).json({ message: 'SMS non configuré. Variables TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM manquantes sur Render.' });
    }

    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    const cleaned = ride.patientPhone.replace(/\s/g, '');
    const to = cleaned.startsWith('0') ? '+33' + cleaned.slice(1) : cleaned;

    await twilio.messages.create({ body: message.trim(), from: process.env.TWILIO_FROM, to });
    res.json({ success: true, sentTo: ride.patientPhone });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
