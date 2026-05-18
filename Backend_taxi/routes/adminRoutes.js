const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const jwt = require('jsonwebtoken');
const { createLimiter } = require('../middleware/rateLimiter');

const adminLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 5, message: 'Trop de tentatives. Réessayez dans 15 minutes.' });

const adminAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Accès refusé' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (verified.role !== 'admin') throw new Error('Rôle insuffisant');
    next();
  } catch {
    res.status(401).json({ message: 'Session expirée ou invalide' });
  }
};

router.get('/status',  adminController.getStatus);
router.post('/setup',  adminLimiter, adminController.setup);
router.post('/login',  adminLimiter, adminController.login);
router.get('/rides',   adminAuth,    adminController.getAllRides);
router.get('/stats',   adminAuth,    adminController.getStats);

module.exports = router;
