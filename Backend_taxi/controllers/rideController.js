const Ride = require('../models/Ride');
const User = require('../models/User');
const RideShare = require('../models/RideShare');
const { Expo } = require('expo-server-sdk');

// ── Tarification taxi conventionné (tarifs moyens France, ajustables) ──
const TARIFS = {
  priseEnCharge: 2.60,  // Fixe au départ
  kmTarifA: 0.99,       // Lundi-Samedi 7h00-19h00
  kmTarifB: 1.20,       // Nuit (19h-7h), Dimanche, Jours fériés
  minPerception: 8.50,  // Minimum de perception
};

const FERIES = new Set([
  '2025-01-01','2025-04-21','2025-05-01','2025-05-08','2025-05-29',
  '2025-06-09','2025-07-14','2025-08-15','2025-11-01','2025-11-11','2025-12-25',
  '2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14',
  '2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25',
]);

function calculerPrix(rideDate, km, tolls = 0) {
  const d = new Date(rideDate);
  const h = d.getHours();
  const isNuit  = h >= 19 || h < 7;
  const isDim   = d.getDay() === 0;
  const isFerie = FERIES.has(d.toISOString().split('T')[0]);
  const tarifKm = (isNuit || isDim || isFerie) ? TARIFS.kmTarifB : TARIFS.kmTarifA;
  const total   = TARIFS.priseEnCharge + km * tarifKm + tolls;
  return Math.round(Math.max(total, TARIFS.minPerception) * 100) / 100;
}

const expo = new Expo();

// --- 1. CRÉATION ---
exports.createRide = async (req, res) => {
  try {
    const chauffeurId = req.user.id;
    const { date, patientPhone, startLocation, endLocation, ...rest } = req.body;

    if (!date) return res.status(400).json({ message: 'Date manquante' });
    if (!startLocation || !endLocation) return res.status(400).json({ message: 'Adresses manquantes' });

    const rideDate = new Date(date);
    if (isNaN(rideDate.getTime())) return res.status(400).json({ message: 'Date invalide' });

    const ride = new Ride({
      ...rest,
      startLocation,
      endLocation,
      date: rideDate,
      chauffeurId,
      patientPhone: patientPhone || '',
      status: 'À venir'
    });

    await ride.save();
    res.status(201).json(ride);
  } catch (err) {
    console.error('Erreur création:', err);
    res.status(500).json({ error: err.message });
  }
};

// --- 2. RÉCUPÉRATION (GET) - FUSIONNÉE ---
exports.getRides = async (req, res) => {
  try {
    const myId = req.user.id;

    // A. Récupérer MES courses OU les demandes WEB en attente
    const myRides = await Ride.find({ 
      $or: [
        { chauffeurId: myId }, 
        { source: 'Web', status: 'En attente' }
      ] 
    }).lean();

    // B. Récupérer les courses PARTAGÉES avec moi
    let formattedSharedRides = [];
    try {
      const sharedShares = await RideShare.find({ toUserId: myId })
        .populate('rideId')
        .populate('fromUserId', 'fullName')
        .lean();

      formattedSharedRides = sharedShares.map(share => {
        if (!share.rideId) return null;
        return {
          ...share.rideId,
          _id: share.rideId._id,
          isShared: true,
          sharedByName: share.fromUserId ? share.fromUserId.fullName : 'Inconnu',
          shareStatus: share.statusPartage,
          shareNote: share.sharedNote
        };
      }).filter(r => r !== null);
    } catch (e) { console.log("Pas de partages ou erreur mineure"); }

    // C. Fusionner et Trier
    const allRides = [...myRides, ...formattedSharedRides];
    allRides.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.json(allRides);
  } catch (err) {
    console.error('Erreur getRides:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// --- 3. MISE À JOUR (PATCH) ---
exports.updateRide = async (req, res) => {
  try {
    const updates = req.body;
    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, chauffeurId: req.user.id },
      { $set: updates },
      { new: true }
    );

    if (!ride) return res.status(404).json({ message: "Course introuvable" });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 4. SUPPRESSION ---
exports.deleteRide = async (req, res) => {
  try {
    const ride = await Ride.findOneAndDelete({ _id: req.params.id, chauffeurId: req.user.id });
    if (!ride) return res.status(404).json({ message: "Introuvable" });
    res.json({ message: "Course supprimée" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 5. PARTAGE ---
exports.shareRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { targetUserId, note } = req.body;
    const myId = req.user.id;

    const ride = await Ride.findOne({ _id: rideId, chauffeurId: myId });
    if (!ride) return res.status(404).json({ message: "Course introuvable ou non autorisée" });

    const existing = await RideShare.findOne({ rideId, toUserId: targetUserId });
    if (existing) return res.status(400).json({ message: "Déjà partagée" });

    const share = new RideShare({
      rideId,
      fromUserId: myId,
      toUserId: targetUserId,
      sharedNote: note,
      statusPartage: 'pending' 
    });
    await share.save();

    const targetUser = await User.findById(targetUserId);
    if (targetUser && Expo.isExpoPushToken(targetUser.pushToken)) {
      await expo.sendPushNotificationsAsync([{
        to: targetUser.pushToken,
        sound: 'default',
        title: '🚕 Nouvelle course partagée',
        body: `Un collègue vous propose une course pour ${ride.patientName}.`,
        data: { rideId: rideId, type: 'share_request' },
      }]);
    }

    res.json({ message: "Invitation envoyée !" });
  } catch (err) {
    console.error("Erreur Share:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// --- 6. RÉPONSE (ACCEPTER / REFUSER) ---
exports.respondRideShare = async (req, res) => {
  try {
    const { rideId, action } = req.body;
    const myId = req.user.id;

    const share = await RideShare.findOne({ rideId: rideId, toUserId: myId })
      .populate('fromUserId', 'fullName');

    if (!share) return res.status(404).json({ message: "Invitation introuvable ou expirée" });

    if (action === 'refused') {
      await RideShare.findByIdAndDelete(share._id);
      return res.json({ message: "Invitation refusée" });
    } 
    
    if (action === 'accepted') {
      await Ride.findByIdAndUpdate(rideId, {
        chauffeurId: myId,
        isShared: true,
        shareNote: share.sharedNote || `Transféré par ${share.fromUserId?.fullName}` 
      });

      await RideShare.findByIdAndDelete(share._id);
      return res.json({ message: "Course acceptée et transférée sur votre compte !" });
    }

    res.status(400).json({ message: "Action inconnue" });
  } catch (err) {
    console.error("Erreur respond:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// --- 7. FACTURATION ---
exports.updateRideFacturation = async (req, res) => {
  try {
    const { statuFacturation } = req.body;
    if (!['Non facturé', 'Facturé'].includes(statuFacturation)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }

    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, chauffeurId: req.user.id },
      { $set: { statuFacturation } },
      { new: true }
    );

    if (!ride) return res.status(404).json({ message: "Course introuvable" });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 8. RÉSERVATION WEB ---
exports.createWebBooking = async (req, res) => {
  try {
    // 1. AJOUT DE btStatus DANS LA RÉCUPÉRATION DES DONNÉES
    const { patientName, patientPhone, startLocation, endLocation, date, time, type, notes, btStatus } = req.body;

    if (!patientName || !startLocation || !date || !time) {
      return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires." });
    }

    const combinedDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(combinedDateTime.getTime())) {
      return res.status(400).json({ error: "Date ou heure invalide." });
    }

    // 2. INJECTION DE TON ID MONGODB
    // Le serveur lit la variable Render, ou utilise ton ID par défaut en sécurité
    const chauffeurId = process.env.DEFAULT_CHAUFFEUR_ID || "69557bbc48dc1447f5f5140e";

    const newRide = new Ride({
      patientName,
      patientPhone,
      startLocation,
      endLocation: endLocation || 'À préciser',
      date: combinedDateTime,
      type: type || 'Aller',
      
      // 3. SAUVEGARDE DU PMT ET DU CHAUFFEUR
      btStatus: btStatus || 'Non renseigné',
      chauffeurId: chauffeurId, 

      notes: notes ? `[WEB] ${notes}` : '[WEB] Demande en ligne',
      status: 'En attente', 
      source: 'Web',        
      statuFacturation: 'Non facturé',
      isRoundTrip: false
    });

    await newRide.save();

    // Envoi push : seulement le token, sans charger tout le document User
    const drivers = await User.find(
      { pushToken: { $exists: true, $ne: null } },
      { pushToken: 1, _id: 0 }
    ).lean();

    const messages = drivers
      .filter(d => Expo.isExpoPushToken(d.pushToken))
      .map(d => ({
        to: d.pushToken,
        sound: 'default',
        title: '🚨 NOUVELLE DEMANDE WEB !',
        body: `${patientName} demande un transport le ${date} à ${time}. Ouvrez l'appli !`,
        data: { type: 'new_web_booking' },
      }));

    if (messages.length > 0) {
      await expo.sendPushNotificationsAsync(messages);
    }

    res.status(201).json({ success: true, message: "Votre demande a bien été envoyée. Le chauffeur vous confirmera l'horaire par SMS." });
  } catch (error) {
    console.error("Erreur Web Booking:", error);
    res.status(500).json({ error: "Erreur serveur, veuillez réessayer plus tard." });
  }
};
// --- 9. ACCEPTER / REFUSER UNE DEMANDE WEB ---
exports.acceptWebBooking = async (req, res) => {
  try {
    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, source: 'Web', status: 'En attente' },
      { $set: { chauffeurId: req.user.id, status: 'À venir' } },
      { new: true }
    );

    if (!ride) return res.status(404).json({ message: "Réservation introuvable ou déjà acceptée." });
    res.json({ message: "Course acceptée avec succès !", ride });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.rejectWebBooking = async (req, res) => {
  try {
    const ride = await Ride.findOneAndDelete({ _id: req.params.id, source: 'Web', status: 'En attente' });
    if (!ride) return res.status(404).json({ message: "Réservation introuvable." });
    res.json({ message: "Réservation refusée et supprimée." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// --- 11. DÉMARRER ---
exports.startRide = async (req, res) => {
  try {
    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, chauffeurId: req.user.id, status: { $in: ['À venir', 'En attente'] } },
      { $set: { startTime: new Date(), status: 'En cours' } },
      { new: true }
    );
    if (!ride) return res.status(404).json({ message: "Course introuvable ou déjà démarrée." });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 12. TERMINER ---
exports.finishRide = async (req, res) => {
  try {
    const { realDistance, tolls } = req.body;
    const km  = parseFloat(realDistance) || 0;
    const tls = parseFloat(tolls) || 0;

    const existing = await Ride.findOne({ _id: req.params.id, chauffeurId: req.user.id, status: 'En cours' });
    if (!existing) return res.status(404).json({ message: "Course introuvable ou non démarrée." });

    const price = calculerPrix(existing.date, km, tls);

    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { $set: { endTime: new Date(), status: 'Terminée', realDistance: km, tolls: tls, price } },
      { new: true }
    );
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 13. ANNULER ---
exports.cancelRide = async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, chauffeurId: req.user.id, status: { $nin: ['Terminée', 'Annulée'] } },
      { $set: { status: 'Annulée', cancelReason: reason || '' } },
      { new: true }
    );
    if (!ride) return res.status(404).json({ message: "Course introuvable ou déjà terminée." });
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 14. COURSES DU JOUR ---
exports.getTodayRides = async (req, res) => {
  try {
    const myId = req.user.id;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const rides = await Ride.find({
      $or: [
        { chauffeurId: myId, date: { $gte: startOfDay, $lte: endOfDay }, status: { $nin: ['Annulée'] } },
        { source: 'Web', status: 'En attente' }
      ]
    }).sort({ date: 1 }).lean();

    res.json(rides);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 15. STATISTIQUES ---
exports.getStats = async (req, res) => {
  try {
    const myId = req.user.id;
    const { from, to } = req.query;
    const now = new Date();
    const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = to ? new Date(to) : now;

    const rides = await Ride.find({
      chauffeurId: myId,
      status: 'Terminée',
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    const totalRides = rides.length;
    const totalKm = rides.reduce((sum, r) => sum + (r.realDistance || 0), 0);
    const totalTolls = rides.reduce((sum, r) => sum + (r.tolls || 0), 0);
    const billed = rides.filter(r => r.statuFacturation === 'Facturé').length;
    const unbilled = totalRides - billed;

    res.json({ totalRides, totalKm: Math.round(totalKm * 10) / 10, totalTolls, billed, unbilled });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 16. RÉCAPITULATIF FACTURATION CPAM ---
exports.getBillingSummary = async (req, res) => {
  try {
    const { from, to, statuFacturation } = req.query;
    const query = { chauffeurId: req.user.id, status: 'Terminée' };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to)   query.date.$lte = new Date(to);
    }
    if (statuFacturation) query.statuFacturation = statuFacturation;

    const rides = await Ride.find(query)
      .select('patientName date type motif startLocation endLocation realDistance tolls price statuFacturation')
      .sort({ date: 1 })
      .lean();

    const totalKm     = rides.reduce((s, r) => s + (r.realDistance || 0), 0);
    const totalTolls  = rides.reduce((s, r) => s + (r.tolls || 0), 0);
    const totalAmount = rides.reduce((s, r) => s + (r.price || 0), 0);

    res.json({
      rides,
      summary: {
        count: rides.length,
        totalKm:     Math.round(totalKm * 10) / 10,
        totalTolls:  Math.round(totalTolls * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const Patient = require('../models/Patient');

// --- 10. IMPORTATION MASSIVE & CRÉATION AUTO DES CONTACTS ---
exports.importMassRides = async (req, res) => {
  try {
    const { rides } = req.body;
    const chauffeurId = req.user.id;

    if (!rides || !Array.isArray(rides) || rides.length === 0) {
      return res.status(400).json({ message: "Aucune course fournie." });
    }

    // Validation basique : garder seulement les courses avec les champs requis
    const validRides = rides.filter(r => r.patientName && r.startLocation && r.endLocation && r.date);
    if (validRides.length === 0) {
      return res.status(400).json({ message: "Aucune course valide (patientName, startLocation, endLocation, date requis)." });
    }

    // 1. Récupérer tous les patients existants en UNE seule requête
    const patientNames = [...new Set(validRides.map(r => r.patientName).filter(Boolean))];
    const existingPatients = await Patient.find({
      name: { $in: patientNames },
      chauffeurId
    }, { name: 1 }).lean();
    const existingNames = new Set(existingPatients.map(p => p.name.toLowerCase()));

    // 2. Créer seulement les patients manquants, en une seule insertion
    const newPatientDocs = patientNames
      .filter(n => !existingNames.has(n.toLowerCase()))
      .map(name => ({
        name,
        phone: validRides.find(r => r.patientName === name)?.patientPhone || '',
        chauffeurId,
      }));
    if (newPatientDocs.length > 0) {
      await Patient.insertMany(newPatientDocs, { ordered: false });
    }

    // 3. Insérer toutes les courses en une seule requête
    const rideDocs = validRides.map(({ _id, ...rideData }) => ({
      ...rideData,
      chauffeurId,
      status: 'À venir',
      source: 'App',
    }));
    await Ride.insertMany(rideDocs, { ordered: false });

    res.status(200).json({
      message: "Importation réussie",
      addedRidesCount: rideDocs.length,
      newContactsCount: newPatientDocs.length,
    });

  } catch (error) {
    console.error("Erreur Import Massif:", error);
    res.status(500).json({ message: "Erreur lors de l'importation." });
  }
};