const User = require('../models/User');

// Mettre à jour le Push Token (seule fonction réellement utilisée — cf authRoutes)
// L'inscription/connexion sont gérées par userController (JWT 8h + validation de type).
exports.updatePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (typeof pushToken !== 'string') {
      return res.status(400).json({ message: 'Format invalide' });
    }
    await User.findByIdAndUpdate(req.user.id, { pushToken });
    res.status(200).json({ message: 'Token de notification mis à jour' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
