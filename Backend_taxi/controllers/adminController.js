const jwt = require('jsonwebtoken');
const Ride = require('../models/Ride');
const User = require('../models/User');

exports.login = (req, res) => {
  const { password } = req.body;

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ success: false, message: 'Configuration admin manquante.' });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
  }

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token });
};

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
