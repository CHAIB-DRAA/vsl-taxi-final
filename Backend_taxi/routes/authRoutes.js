const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Pour générer le token aléatoire
const User = require('../models/User');
const sendEmail = require('../utils/emailService'); // Import du service mail

// Si tu utilises ces fichiers, décommente les lignes :
// const authMiddleware = require('../middleware/auth');
// const authController = require('../controllers/authController');

// router.put('/push-token', authMiddleware, authController.updatePushToken);

// ==========================================
// 1. INSCRIPTION (Register)
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: 'Email déjà utilisé' });
    }

    // Hashage du mot de passe (Sécurité)
    // Note : Si tu as mis "pre('save')" dans ton modèle User, tu peux enlever cette ligne
    // Sinon, on le garde ici pour être sûr :
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ 
        name, 
        email, 
        password: hashedPassword 
    });
    
    await user.save();

    // Création du token JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ 
        token, 
        user: { id: user._id, name: user.name, email: user.email } 
    });

  } catch (err) {
    console.error("Erreur Register:", err);
    res.status(500).json({ message: "Erreur serveur lors de l'inscription" });
  }
});

// ==========================================
// 2. CONNEXION (Login)
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérifier l'email
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Mot de passe incorrect' });
    }

    // Création du token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({ 
        token, 
        user: { id: user._id, name: user.name, email: user.email } 
    });

  } catch (err) {
    console.error("Erreur Login:", err);
    res.status(500).json({ message: "Erreur serveur lors de la connexion" });
  }
});

// ==========================================
// 3. MOT DE PASSE OUBLIÉ (Demande)
// ==========================================
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) {
          // Pour la sécurité, on renvoie une 404, ou on fait semblant que ça a marché
          return res.status(404).json({ message: "Aucun compte avec cet email." });
      }
  
      // Générer un code hexadécimal sécurisé (ex: F4A2B9)
      const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase();
  
      // Sauvegarder le token dans la BDD (Expire dans 1 heure)
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000; 
      await user.save();
  
      // Envoyer l'email
      try {
        await sendEmail({
          email: user.email,
          subject: 'Code de réinitialisation Taxi App',
          message: `Votre code est : ${resetToken}`,
          token: resetToken
        });
        res.json({ message: 'Email envoyé ! Vérifiez vos spams.' });
      } catch (err) {
        // Si l'envoi échoue, on nettoie l'utilisateur
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        return res.status(500).json({ message: "Erreur lors de l'envoi de l'email." });
      }
  
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
});
  
// ==========================================
// 4. RÉINITIALISER LE MOT DE PASSE (Validation)
// ==========================================
router.post('/reset-password', async (req, res) => {
    const { resetToken, newPassword } = req.body; // newPassword vient du frontend
  
    try {
      // Chercher l'utilisateur avec ce token ET si la date n'est pas expirée
      const user = await User.findOne({
        resetPasswordToken: resetToken,
        resetPasswordExpires: { $gt: Date.now() } // $gt = greater than (plus grand que maintenant)
      });
  
      if (!user) {
        return res.status(400).json({ message: 'Code invalide ou expiré.' });
      }
  
      // Hasher le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
  
      // Nettoyer les tokens
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      
      await user.save();
  
      res.json({ message: 'Mot de passe modifié avec succès ! Connectez-vous.' });
  
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
});

module.exports = router;