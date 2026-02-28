// controllers/userController.js
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Temps d'expiration du token
const TOKEN_EXPIRATION = '7d';

// ==========================================
// 1. AUTHENTIFICATION
// ==========================================

// Inscription
exports.signupUser = async (req, res) => {
  try {
    const { email, fullName, password } = req.body;
    
    // Validation stricte
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email déjà utilisé' });

    // Hachage manuel (Compatible avec ton modèle User simple)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({ 
        email, 
        fullName, 
        password: hashedPassword 
    });
    
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });

    res.status(201).json({ 
      message: 'Utilisateur créé', 
      user: { id: user._id, email: user.email, fullName: user.fullName },
      token
    });
  } catch (err) {
    console.error("Erreur Signup:", err);
    res.status(500).json({ error: err.message });
  }
};

// Connexion
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Mot de passe incorrect' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });

    res.json({ 
      message: 'Connexion réussie', 
      user: { id: user._id, email: user.email, fullName: user.fullName },
      token
    });
  } catch (err) {
    console.error("Erreur Login:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 2. GESTION DES CONTACTS (C'est ici que tu avais le bug)
// ==========================================

// Ajouter un contact
exports.addContact = async (req, res) => {
  try {
    // Note : Idéalement, on utilise req.user.id venant du token pour identifier "moi"
    // Mais je garde ta logique actuelle pour ne pas tout casser.
    const { userId, contactId } = req.body;

    const user = await User.findById(userId);
    const contact = await User.findById(contactId);

    if (!user || !contact) return res.status(404).json({ message: 'Utilisateur introuvable' });

    // On évite les doublons
    if (!user.contacts.includes(contact._id)) {
      user.contacts.push(contact._id);
      await user.save();
    }

    // On renvoie la liste à jour
    res.json({ message: 'Contact ajouté', contacts: user.contacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 👇 LA FONCTION QUI MANQUAIT (Celle qui corrige l'erreur 404)
exports.getMyContacts = async (req, res) => {
  try {
    // req.user.id est injecté par le middleware d'authentification
    const user = await User.findById(req.user.id)
      .populate('contacts', 'fullName email phone pushToken'); // On récupère les infos utiles

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    // On renvoie le tableau, ou un tableau vide si null
    res.json(user.contacts || []);
  } catch (err) {
    console.error("Erreur getMyContacts:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 3. UTILITAIRES & PROFIL
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

    const regex = new RegExp(query, 'i');
    const users = await User.find({
      $or: [
        { email: regex },
        { fullName: regex }
      ]
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
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password; // Sécurité

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Erreur mise à jour" });
  }
};