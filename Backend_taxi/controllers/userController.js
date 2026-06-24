const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const TOKEN_EXPIRATION = '30d';

const PROFILE_WHITELIST = ['fullName', 'phone', 'pushToken'];

// ==========================================
// AUTHENTIFICATION
// ==========================================

exports.signupUser = async (req, res) => {
  try {
    const { email, fullName, password } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, nom et mot de passe requis' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) return res.status(400).json({ error: 'Email déjà utilisé' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ email: email.toLowerCase().trim(), fullName: fullName.trim(), password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });

    res.status(201).json({
      message: 'Compte créé avec succès',
      user: { id: user._id, email: user.email, fullName: user.fullName },
      token
    });
  } catch (err) {
    console.error("Erreur Signup:", err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Message générique pour éviter l'énumération de comptes
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });

    res.json({
      message: 'Connexion réussie',
      user: { id: user._id, email: user.email, fullName: user.fullName },
      token
    });
  } catch (err) {
    console.error("Erreur Login:", err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ==========================================
// CONTACTS
// ==========================================

exports.addContact = async (req, res) => {
  try {
    const myId = req.user.id;
    const { contactId } = req.body;

    if (!contactId) return res.status(400).json({ message: 'contactId requis' });
    if (contactId === myId) return res.status(400).json({ message: 'Vous ne pouvez pas vous ajouter vous-même' });

    const [me, contact] = await Promise.all([
      User.findById(myId),
      User.findById(contactId)
    ]);

    if (!me || !contact) return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (!me.contacts.some(id => id.toString() === contactId)) {
      me.contacts.push(contact._id);
      await me.save();
    }

    res.json({ message: 'Contact ajouté' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyContacts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('contacts', 'fullName email');  // pushToken exclu : usage serveur uniquement

    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    res.json(user.contacts || []);
  } catch (err) {
    console.error("Erreur getMyContacts:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// PROFIL & RECHERCHE
// ==========================================

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'fullName email');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const query = req.query.q?.trim();
    if (!query || query.length < 3) return res.json([]);

    // Échapper les métacaractères regex (protection ReDoS)
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const users = await User.find({
      $or: [{ email: regex }, { fullName: regex }]
    })
      .limit(10)
      .select('_id fullName email');

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = {};
    for (const key of PROFILE_WHITELIST) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires');

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Erreur mise à jour" });
  }
};
