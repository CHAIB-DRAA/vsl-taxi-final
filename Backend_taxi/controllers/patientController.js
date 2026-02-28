const mongoose = require('mongoose'); // Import correct sans le '/' devant
const Patient = require('../models/Patient');

// 1. Récupérer tous mes patients (Créés PAR moi OU Partagés AVEC moi)
exports.getPatients = async (req, res) => {
  try {
    // Vérification de sécurité
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Utilisateur non connecté" });
    }

    // Conversion de l'ID en ObjectId MongoDB pour que la recherche fonctionne
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const patients = await Patient.find({
      $or: [
        { chauffeurId: userId },       // Cas 1 : C'est mon patient (je suis le créateur)
        { sharedWith: userId }         // Cas 2 : On me l'a partagé
      ]
    }).sort({ fullName: 1 });

    res.json(patients);

  } catch (err) {
    console.error("Erreur getPatients:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

// 2. Créer un nouveau patient
exports.createPatient = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Utilisateur non connecté" });
    }

    const { fullName, address, phone } = req.body;

    if (!fullName) return res.status(400).json({ message: "Le nom est obligatoire" });

    const newPatient = new Patient({
      chauffeurId: req.user.id, // On associe le patient au créateur
      fullName,
      address,
      phone,
      sharedWith: [] // On initialise le tableau de partage vide
    });

    await newPatient.save();
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. Modifier un patient
exports.updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id; // Pas besoin de convertir en ObjectId ici pour findOne, Mongoose gère souvent ça, mais userId est une string ici

    // On cherche le patient si on est le créateur OU si on a les droits de partage
    // Note: Pour update, souvent seul le créateur a le droit, mais si tu veux permettre aux collègues de modifier, garde le $or
    const patient = await Patient.findOne({
      _id: id,
      $or: [{ chauffeurId: userId }, { sharedWith: userId }]
    });

    if (!patient) return res.status(404).json({ message: "Patient introuvable ou accès refusé" });

    // Mise à jour
    Object.assign(patient, updates);
    await patient.save();

    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 4. Supprimer un patient
exports.deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    
    // IMPORTANT : Seul le propriétaire (chauffeurId) peut supprimer
    const patient = await Patient.findOneAndDelete({ 
      _id: id, 
      chauffeurId: req.user.id 
    });
    
    if (!patient) return res.status(403).json({ message: "Impossible de supprimer (Non trouvé ou non propriétaire)" });
    
    res.json({ message: "Patient supprimé" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};