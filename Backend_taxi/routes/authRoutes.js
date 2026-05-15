const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const authController = require('../controllers/authController');

// Mise à jour du token de notifications push (appelé depuis l'app au démarrage)
router.put('/push-token', authMiddleware, authController.updatePushToken);

module.exports = router;
