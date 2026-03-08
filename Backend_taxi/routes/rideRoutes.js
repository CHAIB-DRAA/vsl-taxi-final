const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const authMiddleware = require('../middleware/auth');

// 1. Récupération
router.get('/', authMiddleware, rideController.getRides);
// 2. Création
router.post('/', authMiddleware, rideController.createRide);

// 3. MISE À JOUR (C'est ICI la correction)
// On utilise PATCH car le frontend envoie une requête PATCH maintenant.
router.patch('/:id', authMiddleware, rideController.updateRide);

// (On garde PUT pour compatibilité si tu as d'anciens bouts de code qui traînent)
router.put('/:id', authMiddleware, rideController.updateRide);

// 4. Suppression
router.delete('/:id', authMiddleware, rideController.deleteRide);
// 5. Partage & Réponse
router.post('/:rideId/share', authMiddleware,rideController.shareRide); // La route de partage
router.post('/respond-share', authMiddleware, rideController.respondRideShare);
router.put('/:id/facturation', authMiddleware, rideController.updateRideFacturation);
// 6. Anciennes routes (Tu peux les garder pour l'instant)
//router.post('/:id/start', authMiddleware, rideController.startRide);
//router.post('/:id/end', authMiddleware, rideController.endRide);
// --- POST: Recevoir une demande de réservation Web ---
router.post('/web-booking', async (req, res) => {
  try {
    const { patientName, patientPhone, startLocation, endLocation, date, time, type, notes } = req.body;

    // 1. Validation basique
    if (!patientName || !startLocation || !endLocation || !date || !time) {
      return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires." });
    }

    // 2. Formatage de la date et de l'heure
    // On combine la date (YYYY-MM-DD) et l'heure (HH:mm)
    const combinedDateTime = new Date(`${date}T${time}:00`).toISOString();

    // 3. Création de la course avec un statut "En attente"
    const newRide = new Ride({
      patientName,
      patientPhone,
      startLocation,
      endLocation,
      date: combinedDateTime,
      type: type || 'Aller',
      notes: notes ? `[WEB] ${notes}` : '[WEB] Demande en ligne',
      status: 'En attente', // 👈 Statut crucial pour ton application
      source: 'Web',        // 👈 Pour tes statistiques futures
      statuFacturation: 'Non facturé',
      isRoundTrip: false
    });

    await newRide.save();

    res.status(201).json({ success: true, message: "Votre demande a bien été envoyée. Le chauffeur vous confirmera l'horaire par SMS." });

  } catch (error) {
    console.error("Erreur Web Booking:", error);
    res.status(500).json({ error: "Erreur serveur, veuillez réessayer plus tard." });
  }
});
module.exports = router;