require('dotenv').config();
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token manquant' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token invalide' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ error: 'Token invalide' });

    req.user = { id: decoded.id };
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée ou invalide' });
  }
};

module.exports = authMiddleware;
