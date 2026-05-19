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

// ── Données ────────────────────────────────────────────────────────────────
router.get('/stats',    adminAuth, adminController.getStats);
router.get('/rides',    adminAuth, adminController.getAllRides);
router.post('/rides',   adminAuth, adminController.createRide);
router.get('/users',    adminAuth, adminController.getUsers);
router.get('/patients', adminAuth, adminController.getPatients);
router.get('/billing',  adminAuth, adminController.getBillingReport);

// ── Actions sur une course ──────────────────────────────────────────────────
router.patch('/rides/:id/status',        adminAuth, adminController.updateRideStatus);
router.patch('/rides/:id/accept',        adminAuth, adminController.acceptWebRide);
router.patch('/rides/:id/reject',        adminAuth, adminController.rejectWebRide);
router.patch('/rides/:id/billing',       adminAuth, adminController.updateBillingStatus);
router.delete('/rides/:id',              adminAuth, adminController.deleteRide);

module.exports = router;
