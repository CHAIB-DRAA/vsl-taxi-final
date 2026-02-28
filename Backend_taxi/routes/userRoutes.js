const express = require('express');
const router = express.Router();
const crypto = require('crypto'); // Pour générer le token aléatoire
const bcrypt = require('bcrypt'); // 👈 AJOUTÉ : Pour hacher le mot de passe lors du reset
const User = require('../models/User'); // Import du modèle User
const sendEmail = require('../utils/emailService'); // Import du service Email
const authMiddleware = require('../middleware/auth');

// Import de tous vos contrôleurs (y compris le nouveau getMyContacts)
const { 
    signupUser, 
    loginUser, 
    addContact,
    getMyContacts, // 👈 AJOUTÉ : Import indispensable
    searchUsers,
    getProfile,
    updateProfile,
    getUsers
} = require('../controllers/userController');

// ==========================================
// 1. ROUTES D'AUTHENTIFICATION & USER
// ==========================================

router.post('/signup', signupUser);
router.post('/login', loginUser);

// --- Routes Protégées (Token requis) ---

// Récupérer tous les users (pour dev ou admin)
router.get('/users', authMiddleware, getUsers);

// Contacts
router.post('/addContact', authMiddleware, addContact);
router.get('/contacts', authMiddleware, getMyContacts); // 👈 AJOUTÉ : La route qui manquait (Erreur 404)

// Recherche & Profil
router.get('/search', authMiddleware, searchUsers);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);


// ==========================================
// 2. SÉCURITÉ : MOT DE PASSE OUBLIÉ
// ==========================================

// --- DEMANDE (Envoi Email) ---
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log("📨 Demande Reset pour :", email);

    try {
        // Recherche insensible à la casse
        const user = await User.findOne({ 
            email: { $regex: new RegExp(`^${email}$`, 'i') } 
        });

        if (!user) {
            return res.status(404).json({ message: "Aucun compte avec cet email." });
        }

        // Générer le token
        const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase();

        // Sauvegarder le token + expiration (1h)
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
            // Nettoyage si erreur email
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            return res.status(500).json({ message: "Erreur lors de l'envoi de l'email." });
        }

    } catch (error) {
        console.error("Erreur Forgot:", error);
        res.status(500).json({ message: error.message });
    }
});

// --- VALIDATION (Changement du mot de passe) ---
router.post('/reset-password', async (req, res) => {
    const { resetToken, newPassword } = req.body;

    try {
        // Chercher l'utilisateur avec ce token ET date valide
        const user = await User.findOne({
            resetPasswordToken: resetToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Code invalide ou expiré.' });
        }

        // 🔒 CRYPTAGE MANUEL DU MOT DE PASSE
        // Comme nous n'avons plus le "pre('save')" dans le modèle, 
        // nous devons le faire ici, sinon le mot de passe sera en clair.
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        
        // Nettoyage des tokens
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ message: 'Mot de passe modifié avec succès ! Connectez-vous.' });

    } catch (error) {
        console.error("Erreur Reset:", error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;