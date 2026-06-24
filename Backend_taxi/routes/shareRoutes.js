const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Patient = require('../models/Patient');

// POST /api/share/transfert-patient
router.post('/transfert-patient', auth, async (req, res) => {
  try {
    const { patientId, targetUserId } = req.body;
    if (!patientId || !targetUserId) {
      return res.status(400).json({ error: "patientId et targetUserId requis" });
    }

    // Vérification de propriété : seul le propriétaire peut partager son patient (anti-IDOR)
    const patient = await Patient.findOne({ _id: patientId, chauffeurId: req.user.id });
    if (!patient) {
      return res.status(403).json({ error: "Accès refusé ou patient introuvable" });
    }

    await Patient.findByIdAndUpdate(patientId, {
      $addToSet: { sharedWith: targetUserId }
    });

    res.status(200).json({ message: "Dossier partagé avec succès" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur lors du partage" });
  }
});

module.exports = router;