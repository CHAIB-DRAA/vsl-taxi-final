const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const jwt = require('jsonwebtoken');

// Middleware de sécurité strict pour l'Admin
const adminAuth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Accès refusé' });
    
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'secret_temporaire');
        if (verified.role !== 'admin') throw new Error();
        next();
    } catch (err) {
        res.status(400).json({ message: 'Session expirée ou invalide' });
    }
};

// Les routes API
router.post('/login', adminController.login);
router.get('/rides', adminAuth, adminController.getAllRides); // Protégé !

module.exports = router;