const express = require('express');
const router = express.Router();
const multer = require('multer');
const Document = require('../models/Document');
const Ride = require('../models/Ride'); 
const auth = require('../middleware/auth'); 

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 1. UPLOAD (MODIFIÉ POUR PMT) ---
router.post('/upload', auth, upload.single('photo'), async (req, res) => {
  try {
    // 👇 AJOUTE 'maxRides' DANS LA LISTE ICI 👇
    const { patientName, docType, rideId, patientId, maxRides } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ message: "Aucune image reçue" });

    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const newDoc = new Document({
      userId: req.user.id, 
      patientName: patientName || "Inconnu",
      rideId: rideId || null, 
      patientId: patientId || null,
      type: docType,
      
      // 👇 AJOUTE CETTE LIGNE POUR SAUVEGARDER LE NOMBRE 👇
      // Si maxRides existe, on le convertit en entier, sinon 0
      maxRides: maxRides ? parseInt(maxRides) : 0,
      
      imageData: base64Image
    });

    await newDoc.save();
    res.json({ message: "Document sauvegardé", doc: newDoc });

  } catch (err) {
    console.error("❌ Erreur Upload:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// ... LE RESTE DE TON CODE NE CHANGE PAS (GET, DELETE, ETC.) ...
// Copie-colle le reste de tes routes ici (GET /driver/me, GET /by-ride/:rideId, etc.)
// Elles n'ont pas besoin de modification.

// --- 2. RÉCUPÉRER MES DOCUMENTS ADMIN (Chauffeur) ---
router.get('/driver/me', auth, async (req, res) => {
    // ... (ton code existant)
    try {
        const docs = await Document.find({
          userId: req.user.id,
          patientName: "CHAUFFEUR"
        }).sort({ uploadDate: -1 });
        res.json(docs);
      } catch (err) {
        res.status(500).json({ message: "Erreur serveur" });
      }
});

// --- 3. RÉCUPÉRER PAR COURSE (Historique) ---
router.get('/by-ride/:rideId', auth, async (req, res) => {
    // ... (ton code existant)
    try {
        const { rideId } = req.params;
        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ message: "Course introuvable" });
    
        const docs = await Document.find({
          $or: [
            { rideId: rideId },
            { 
              patientName: ride.patientName, 
              type: { $in: ['CarteVitale', 'Mutuelle'] }
            }
          ]
        }).sort({ uploadDate: -1 });
        res.json(docs);
      } catch (err) {
        res.status(500).json({ message: "Erreur serveur" });
      }
});

// --- 4. RÉCUPÉRER PAR PATIENT (Dossier Patient) ---
router.get('/patient/:patientId', auth, async (req, res) => {
    // ... (ton code existant)
    try {
        const { patientId } = req.params;
        const rides = await Ride.find({ patientId: patientId }).select('_id');
        const rideIds = rides.map(r => r._id);
    
        const docs = await Document.find({
          $or: [
            { patientId: patientId }, 
            { rideId: { $in: rideIds } }
          ]
        }).sort({ uploadDate: -1 });
    
        res.json(docs);
      } catch (err) {
        res.status(500).json({ error: "Erreur récupération documents" });
      }
});

// --- 5. SUPPRIMER UN DOCUMENT ---
router.delete('/:id', auth, async (req, res) => {
    // ... (ton code existant)
    try {
        const doc = await Document.findOneAndDelete({ 
          _id: req.params.id, 
          userId: req.user.id 
        });
        if (!doc) return res.status(404).json({ message: "Document introuvable" });
        res.json({ message: "Supprimé" });
      } catch (err) {
        res.status(500).json({ message: "Erreur serveur" });
      }
});
// --- 6. RÉCUPÉRER TOUS LES PMT (Pour le calcul dans l'Agenda) ---
router.get('/pmts/all', auth, async (req, res) => {
  try {
    // On récupère uniquement les documents de type PMT créés par ce chauffeur
    const pmts = await Document.find({
      userId: req.user.id,
      type: 'PMT'
    }).select('patientName uploadDate maxRides'); // On prend juste ce qu'il faut pour calculer
    
    res.json(pmts);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});
module.exports = router;