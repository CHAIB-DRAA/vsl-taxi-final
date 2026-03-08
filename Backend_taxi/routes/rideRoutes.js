const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const authMiddleware = require('../middleware/auth');

// --- ROUTES PROTÉGÉES (Application Mobile) ---
router.get('/', authMiddleware, rideController.getRides);
router.post('/', authMiddleware, rideController.createRide);
router.patch('/:id', authMiddleware, rideController.updateRide);
router.put('/:id', authMiddleware, rideController.updateRide); // Compatibilité
router.delete('/:id', authMiddleware, rideController.deleteRide);
router.post('/:rideId/share', authMiddleware, rideController.shareRide);
router.post('/respond-share', authMiddleware, rideController.respondRideShare);
router.put('/:id/facturation', authMiddleware, rideController.updateRideFacturation);

// --- ROUTE PUBLIQUE (Site Web Patient) ---
// ⚠️ Pas de authMiddleware ici, car le patient n'a pas de compte !
router.post('/web-booking', rideController.createWebBooking);

module.exports = router;