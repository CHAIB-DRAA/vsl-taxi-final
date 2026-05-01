const Ride = require('../models/Ride');
const User = require('../models/User');
const RideShare = require('../models/RideShare');
const { Expo } = require('expo-server-sdk');

const expo = new Expo();

// --- 1. CRÉATION ---
exports.createRide = async (req, res) => {
  try {
    const chauffeurId = req.user.id;
    const { date, patientPhone, ...rest } = req.body;

    if (!date) return res.status(400).json({ message: 'Date manquante' });
    
    const ride = new Ride({
      ...rest,
      date: new Date(date),
      chauffeurId,
      patientPhone: patientPhone || '', 
      status: 'En attente'
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
    const { patientName, patientPhone, startLocation, endLocation, date, time, type, notes } = req.body;

    if (!patientName || !startLocation || !endLocation || !date || !time) {
      return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires." });
    }

    const combinedDateTime = new Date(`${date}T${time}:00`).toISOString();

    const newRide = new Ride({
      patientName,
      patientPhone,
      startLocation,
      endLocation,
      date: combinedDateTime,
      type: type || 'Aller',
      notes: notes ? `[WEB] ${notes}` : '[WEB] Demande en ligne',
      status: 'En attente', 
      source: 'Web',        
      statuFacturation: 'Non facturé',
      isRoundTrip: false
    });

    await newRide.save();

    // 🚨 NOUVEAU : ENVOI DE LA NOTIFICATION PUSH AUX CHAUFFEURS
    // On cherche tous les utilisateurs qui ont activé les notifications
    const allDrivers = await User.find({ pushToken: { $exists: true, $ne: null } });
    
    let messages = [];
    for (let driver of allDrivers) {
      if (Expo.isExpoPushToken(driver.pushToken)) {
        messages.push({
          to: driver.pushToken,
          sound: 'default', // Fait sonner le téléphone !
          title: '🚨 NOUVELLE DEMANDE WEB !',
          body: `${patientName} demande un transport le ${date} à ${time}. Ouvrez l'appli !`,
          data: { type: 'new_web_booking' },
        });
      }
    }
    
    // Si on a trouvé des chauffeurs, on tire la sonnette
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


const Patient = require('../models/Patient'); // Assure-toi d'importer ton modèle Patient/Contact en haut du fichier

// --- 10. IMPORTATION MASSIVE & CRÉATION AUTO DES CONTACTS ---
exports.importMassRides = async (req, res) => {
  try {
    const { rides } = req.body;
    const chauffeurId = req.user.id;
    let addedRidesCount = 0;
    let newContactsCount = 0;

    if (!rides || !Array.isArray(rides)) {
      return res.status(400).json({ message: "Aucune course fournie." });
    }

    for (const rideData of rides) {
      // 1. Vérifier si le patient existe déjà dans ton répertoire
      // (On cherche par nom, en ignorant les majuscules/minuscules)
      let patient = await Patient.findOne({ 
        name: { $regex: new RegExp('^' + rideData.patientName + '$', "i") },
        chauffeurId: chauffeurId
      });

      // 2. S'il n'existe pas, ON LE CRÉE AUTOMATIQUEMENT !
      if (!patient && rideData.patientName) {
        patient = new Patient({
          name: rideData.patientName,
          phone: rideData.patientPhone || '',
          chauffeurId: chauffeurId
        });
        await patient.save();
        newContactsCount++;
      }

      // 3. On crée la course
      const newRide = new Ride({
        ...rideData,
        chauffeurId: chauffeurId,
        status: 'À venir',
        source: 'App'
      });
      await newRide.save();
      addedRidesCount++;
    }

    res.status(200).json({ 
      message: "Importation réussie", 
      addedRidesCount, 
      newContactsCount 
    });

  } catch (error) {
    console.error("Erreur Import Massif:", error);
    res.status(500).json({ message: "Erreur lors de l'importation." });
  }
};