const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Ride = require('../models/Ride');
const User = require('../models/User');
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
    const [totalRides, totalUsers, webBookings, billedRides] = await Promise.all([
      Ride.countDocuments(),
      User.countDocuments(),
      Ride.countDocuments({ source: 'Web' }),
      Ride.countDocuments({ statuFacturation: 'Facturé' }),
    ]);
    res.json({ totalRides, totalUsers, webBookings, billedRides });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
