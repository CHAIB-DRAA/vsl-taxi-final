const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Inscription
exports.registerUser = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'Nom, email et mot de passe requis' });
        }
        const userExist = await User.findOne({ email });
        if (userExist) return res.status(400).json({ message: 'Email déjà utilisé' });

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = new User({ fullName, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'Utilisateur créé avec succès' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Connexion
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(200).json({
            token,
            user: { id: user._id, email: user.email, fullName: user.fullName }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
// Mettre à jour le Push Token
exports.updatePushToken = async (req, res) => {
    try {
      const { pushToken } = req.body;
      // On met à jour l'utilisateur connecté
      await User.findByIdAndUpdate(req.user.id, { pushToken: pushToken });
      res.status(200).json({ message: "Token de notification mis à jour" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
