const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Patient = require('../models/Patient');

// POST /api/share/transfert-patient
router.post('/transfert-patient', auth, async (req, res) => {
  try {
    const { patientId, targetUserId } = req.body;

    // 1. Mettre à jour le Patient pour donner l'accès au collègue
    await Patient.findByIdAndUpdate(patientId, {
      $addToSet: { sharedWith: targetUserId } // $addToSet évite les doublons
    });

    res.status(200).json({ message: "Dossier partagé avec succès" });
  } catch (err) {
    console.error("Erreur share:", err);
    res.status(500).json({ error: "Erreur serveur lors du partage" });
  }
});

module.exports = router;