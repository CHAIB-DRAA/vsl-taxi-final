const Contact = require('../models/contact');
const User = require('../models/User');

// 1. Rechercher un utilisateur (Par email ou nom)
exports.searchUsers = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);

    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: 'i' } }, // Recherche Email (insensible casse)
        { fullName: { $regex: query, $options: 'i' } } // Recherche Nom
      ]
    })
    .select('fullName email _id') // On ne renvoie que l'essentiel
    .limit(10);

    // On retire l'utilisateur lui-même des résultats
    const filtered = users.filter(u => String(u._id) !== req.user.id);

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 2. Ajouter un contact
exports.addContact = async (req, res) => {
  try {
    const { contactId } = req.body;
    const userId = req.user.id;

    // Vérif 1: Pas soi-même
    if (contactId === userId) {
      return res.status(400).json({ message: "Vous ne pouvez pas vous ajouter." });
    }

    // Vérif 2: Pas de doublon
    const existing = await Contact.findOne({ userId, contactId });
    if (existing) {
      return res.status(400).json({ message: "Ce contact est déjà dans votre liste." });
    }

    // Création
    const newContact = new Contact({ userId, contactId });
    await newContact.save();
    
    res.status(201).json(newContact);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// 3. Récupérer ma liste (Avec Populate pour avoir les infos)
exports.getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user.id })
      .populate('contactId', 'fullName email') // On remplit les infos du contact
      .sort({ createdAt: -1 });
    
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 4. Supprimer
exports.deleteContact = async (req, res) => {
  try {
    await Contact.findOneAndDelete({ userId: req.user.id, _id: req.params.id });
    res.json({ message: "Contact supprimé" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};