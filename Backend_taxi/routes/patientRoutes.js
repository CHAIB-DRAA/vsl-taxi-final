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
      console.log("🔍 Recherche Patient reçue :", query); 
  
      if (!query || query.length < 2) {
          return res.json([]);
      }
  
      const patients = await Patient.find({
        fullName: { $regex: query, $options: 'i' }
      })
      .select('fullName phone address email') 
      .limit(10); 
  
      res.json(patients);
  
    } catch (error) {
      console.error("❌ Erreur Search:", error);
      res.status(500).json({ message: "Erreur lors de la recherche" });
    }
});
  
// ==========================================
// 2. ROUTE GET ALL (Chargement de la liste)
// ==========================================
// 👇 C'est celle-ci que l'on garde (avec les logs pour debug)
router.get('/', async (req, res) => {
    try {
      console.log("📥 Chargement liste patients...");
      const patients = await Patient.find().sort({ fullName: 1 });
      console.log(`✅ ${patients.length} patients trouvés.`);
      res.json(patients);
    } catch (error) {
      console.error("❌ Erreur chargement patients:", error);
      res.status(500).json({ message: error.message });
    }
});
  
// ==========================================
// 3. ROUTE GET ONE (Par ID)
// ==========================================
router.get('/:id', async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id);
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