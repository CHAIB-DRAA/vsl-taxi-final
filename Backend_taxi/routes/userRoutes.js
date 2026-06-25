const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const sendEmail = require('../utils/emailService');
const authMiddleware = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');

const {
  signupUser,
  loginUser,
  addContact,
  getMyContacts,
  searchUsers,
  getProfile,
  updateProfile,
  getUsers
} = require('../controllers/userController');

// Rate limiters
const authLimiter  = createLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' });
const resetLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: 5,  message: 'Trop de demandes de réinitialisation. Réessayez dans 1 heure.' });

// ==========================================
// AUTHENTIFICATION
// ==========================================

router.post('/signup', authLimiter, signupUser);
router.post('/login',  authLimiter, loginUser);

// ==========================================
// GESTION DES UTILISATEURS (protégées)
// ==========================================

router.get('/users',    authMiddleware, getUsers);
router.get('/contacts', authMiddleware, getMyContacts);
router.post('/addContact', authMiddleware, addContact);
router.get('/search',   authMiddleware, searchUsers);
router.get('/profile',  authMiddleware, getProfile);
router.put('/profile',  authMiddleware, updateProfile);

// ==========================================
// MOT DE PASSE OUBLIÉ
// ==========================================

router.post('/forgot-password', resetLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email requis." });

  try {
    // Recherche exacte insensible à la casse (toLowerCase évite l'injection regex)
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // On répond toujours avec le même message pour éviter l'énumération de comptes
    if (!user) {
      return res.json({ message: 'Si ce compte existe, un email a été envoyé.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = Date.now() + 3_600_000; // 1h
    await user.save();

    try {
      await sendEmail({
        email: user.email,
        subject: 'Code de réinitialisation – Taxi App',
        message: `Votre code de réinitialisation est :`,
        token: rawToken
      });
    } catch {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ message: "Erreur lors de l'envoi de l'email." });
    }

    res.json({ message: 'Si ce compte existe, un email a été envoyé.' });

  } catch (error) {
    console.error("Erreur forgot-password:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post('/reset-password', resetLimiter, async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res.status(400).json({ message: 'Code et nouveau mot de passe requis.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Code invalide ou expiré.' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Mot de passe modifié avec succès ! Connectez-vous.' });

  } catch (error) {
    console.error("Erreur reset-password:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
