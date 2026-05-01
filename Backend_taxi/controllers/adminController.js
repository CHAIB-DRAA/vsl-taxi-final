const jwt = require('jsonwebtoken');
const Ride = require('../models/Ride');

// 1. Connexion de l'Administrateur
exports.login = (req, res) => {
    const { password } = req.body;
    
    // On vérifie le mot de passe avec une variable d'environnement
    if (password === process.env.ADMIN_PASSWORD) {
        // On crée un token spécial "admin" valable 24 heures
        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'secret_temporaire', { expiresIn: '24h' });
        return res.json({ success: true, token });
    }
    
    res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
};

// 2. Récupérer TOUTES les courses du système
exports.getAllRides = async (req, res) => {
    try {
        // On récupère toutes les courses, triées de la plus récente à la plus ancienne
        const rides = await Ride.find().sort({ date: -1 }).lean();
        res.json(rides);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};