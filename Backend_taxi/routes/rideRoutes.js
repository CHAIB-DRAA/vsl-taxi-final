const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const authMiddleware = require('../middleware/auth');

// --- ROUTES FIXES (doivent être avant /:id) ---
router.get('/today',           authMiddleware, rideController.getTodayRides);
router.get('/stats',           authMiddleware, rideController.getStats);
router.get('/billing-summary', authMiddleware, rideController.getBillingSummary);
router.post('/respond-share', authMiddleware, rideController.respondRideShare);
router.post('/web-booking', rideController.createWebBooking);
router.post('/mass-import', authMiddleware, rideController.importMassRides);

// --- ROUTES PROTÉGÉES (Application Mobile) ---
router.get('/',   authMiddleware, rideController.getRides);
router.post('/',  authMiddleware, rideController.createRide);

router.patch('/:id',             authMiddleware, rideController.updateRide);
router.put('/:id',               authMiddleware, rideController.updateRide);
router.delete('/:id',            authMiddleware, rideController.deleteRide);
router.patch('/:id/start',       authMiddleware, rideController.startRide);
router.patch('/:id/finish',      authMiddleware, rideController.finishRide);
router.patch('/:id/cancel',      authMiddleware, rideController.cancelRide);
router.post('/:rideId/share',    authMiddleware, rideController.shareRide);
router.put('/:id/facturation',   authMiddleware, rideController.updateRideFacturation);
router.post('/:id/accept-web',   authMiddleware, rideController.acceptWebBooking);
router.delete('/:id/reject-web', authMiddleware, rideController.rejectWebBooking);

module.exports = router;