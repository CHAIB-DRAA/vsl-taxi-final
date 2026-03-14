const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const authMiddleware = require('../middleware/auth');

// --- ROUTES PROTÉGÉES (Application Mobile) ---
router.get('/', authMiddleware, rideController.getRides);
router.post('/', authMiddleware, rideController.createRide);
router.patch('/:id', authMiddleware, rideController.updateRide);
router.put('/:id', authMiddleware, rideController.updateRide); 
router.delete('/:id', authMiddleware, rideController.deleteRide);

// --- PARTAGE ---
router.post('/:rideId/share', authMiddleware, rideController.shareRide);
router.post('/respond-share', authMiddleware, rideController.respondRideShare);

// --- FACTURATION ---
router.put('/:id/facturation', authMiddleware, rideController.updateRideFacturation);

// --- GESTION DES RÉSERVATIONS WEB (Depuis l'App) ---
router.post('/:id/accept-web', authMiddleware, rideController.acceptWebBooking);
router.delete('/:id/reject-web', authMiddleware, rideController.rejectWebBooking);

// --- ROUTE PUBLIQUE (Site Web Patient) ---
// Pas d'authMiddleware ici, car le patient n'a pas de compte
router.post('/web-booking', rideController.createWebBooking);

module.exports = router;