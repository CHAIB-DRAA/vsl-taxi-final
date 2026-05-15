const express = require('express');
const router = express.Router();
// 👇 CORRECTION 1 : L'import manquant est ajouté ici
const Patient = require('../models/Patient'); 
const patientController = require('../controllers/patientController');
const authMiddleware = require('../middleware/auth');

// Toutes les routes sont protégées
router.use(authMiddleware);

// ==========================================
// 1. ROUTE SEARCH (Doit être AVANT /:id)
// ==========================================
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) return res.json([]);
    if (query.length > 100) return res.status(400).json({ message: 'Requête trop longue' });

    const patients = await Patient.find({
      chauffeurId: req.user.id,
      fullName: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    })
      .select('fullName phone address')
      .limit(10);

    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la recherche' });
  }
});

// ==========================================
// 2. ROUTE GET ALL
// ==========================================
router.get('/', patientController.getPatients);

// ==========================================
// 3. ROUTE GET ONE (Par ID)
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.id,
      $or: [{ chauffeurId: req.user.id }, { sharedWith: req.user.id }],
    });
    if (!patient) return res.status(404).json({ message: 'Patient introuvable' });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 4. AUTRES ROUTES (Création / Modif / Suppr)
// ==========================================
// On garde le contrôleur pour celles-ci car tu n'as pas écrit le code manuel ici
router.post('/', patientController.createPatient);
router.put('/:id', patientController.updatePatient);   
router.delete('/:id', patientController.deletePatient);

// ⚠️ J'ai supprimé la ligne en doublon : router.get('/', patientController.getPatients);

module.exports = router;