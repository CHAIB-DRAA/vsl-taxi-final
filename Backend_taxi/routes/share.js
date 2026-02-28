// POST /api/share/transfert-patient
router.post('/transfert-patient', auth, async (req, res) => {
    try {
      const { patientId, targetUserId } = req.body;
  
      // 1. Mettre à jour le Patient pour donner l'accès au collègue
      await Patient.findByIdAndUpdate(patientId, {
        $addToSet: { sharedWith: targetUserId } // $addToSet évite les doublons
      });
  
      // 2. (Optionnel) Créer une notification pour le collègue
      // ... code notification ...
  
      res.status(200).json({ message: "Dossier partagé avec succès" });
    } catch (err) {
      res.status(500).json({ error: "Erreur serveur lors du partage" });
    }
  });