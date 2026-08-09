require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token manquant' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token invalide' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!decoded?.id) return res.status(401).json({ error: 'Token invalide' });

    // Vérifier que le compte existe toujours (révocation d'accès effective)
    const exists = await User.exists({ _id: decoded.id });
    if (!exists) return res.status(401).json({ error: 'Compte introuvable' });

    req.user = { id: decoded.id };
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée ou invalide' });
  }
};

module.exports = authMiddleware;
