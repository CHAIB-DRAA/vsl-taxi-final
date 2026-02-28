// middleware/auth.js
require('dotenv').config();
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token manquant' });

    const token = authHeader.split(' ')[1];
    console.log('Mon token :', token);

    if (!token) return res.status(401).json({ error: 'Token invalide' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) return res.status(401).json({ error: 'Token invalide' });

    req.user = { id: decoded.id };
    next();
  } catch (err) {
    console.error('Erreur authMiddleware:', err.message);
    res.status(401).json({ error: 'Erreur d\'authentification' });
  }
};

module.exports = authMiddleware; // <-- export direct de la fonction
