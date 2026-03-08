const Ride = require('../models/Ride');
const User = require('../models/User');
const RideShare = require('../models/RideShare'); // <--- IMPORTANT : INDISPENSABLE POUR LE PARTAGE
const { Expo } = require('expo-server-sdk');

const expo = new Expo();

// --- 1. CRÉATION ---
exports.createRide = async (req, res) => {
  try {
    const chauffeurId = req.user.id; // On utilise chauffeurId
    const { date, patientPhone, ...rest } = req.body;

    if (!date) return res.status(400).json({ message: 'Date manquante' });
    
    const ride = new Ride({
      ...rest,
      date: new Date(date),
      chauffeurId, // Enregistré sous chauffeurId
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

    // A. Récupérer MES courses (créées par moi)
    // Attention : On utilise 'chauffeurId' ici aussi
const myRides = await Ride.find({ 
      $or: [
        { chauffeurId: myId }, 
        { source: 'Web', status: 'En attente' } // 👈 Aspire les demandes du site !
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
          isShared: true, // Marqueur visuel
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
    
    // On vérifie chauffeurId
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
    // On vérifie chauffeurId
    const ride = await Ride.findOneAndDelete({ _id: req.params.id, chauffeurId: req.user.id });
    if (!ride) return res.status(404).json({ message: "Introuvable" });
    res.json({ message: "Course supprimée" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 5. PARTAGE (CORRIGÉ) ---
// Assure-toi d'avoir ces imports en haut

// ...

// 🚀 5. PARTAGE AVEC NOTIFICATION PUSH
exports.shareRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { targetUserId, note } = req.body;
    const myId = req.user.id;

    // 1. Vérif Chauffeur
    const ride = await Ride.findOne({ _id: rideId, chauffeurId: myId });
    if (!ride) return res.status(404).json({ message: "Course introuvable ou non autorisée" });

    // 2. Vérif Doublon
    const existing = await RideShare.findOne({ rideId, toUserId: targetUserId });
    if (existing) return res.status(400).json({ message: "Déjà partagée" });

    // 3. Créer le partage (En attente)
    const share = new RideShare({
      rideId,
      fromUserId: myId,
      toUserId: targetUserId,
      sharedNote: note,
      statusPartage: 'pending' 
    });
    await share.save();

    // 4. --- ENVOI DE LA NOTIFICATION ---
    const targetUser = await User.findById(targetUserId);
    
    // Si le collègue a un token Expo enregistré
    if (targetUser && Expo.isExpoPushToken(targetUser.pushToken)) {
      await expo.sendPushNotificationsAsync([{
        to: targetUser.pushToken,
        sound: 'default',
        title: '🚕 Nouvelle course partagée',
        body: `Un collègue vous propose une course pour ${ride.patientName}.`,
        data: { rideId: rideId, type: 'share_request' }, // Pour ouvrir l'app au bon endroit
      }]);
      console.log("Notification envoyée à", targetUser.fullName);
    }

    res.json({ message: "Invitation envoyée !" });

  } catch (err) {
    console.error("Erreur Share:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🚀 6. RÉPONSE (ACCEPTER / REFUSER)
// 🚀 6. RÉPONSE : TRANSFERT DE PROPRIÉTÉ (VRAI REMPLACEMENT ID)
exports.respondRideShare = async (req, res) => {
  try {
    const { rideId, action } = req.body; // 'accepted' ou 'refused'
    const myId = req.user.id; // MOI (Celui qui accepte)

    // 1. On cherche l'invitation
    const share = await RideShare.findOne({ rideId: rideId, toUserId: myId })
      .populate('fromUserId', 'fullName'); // On récupère le nom de l'expéditeur pour l'historique

    if (!share) {
      return res.status(404).json({ message: "Invitation introuvable ou expirée" });
    }

    if (action === 'refused') {
      // Si refusé, on supprime juste l'invitation. La course reste chez l'expéditeur.
      await RideShare.findByIdAndDelete(share._id);
      return res.json({ message: "Invitation refusée" });
    } 
    
    if (action === 'accepted') {
      // 🔥 C'EST ICI QUE LE TRANSFERT SE FAIT 🔥
      
      // 1. On met à jour la course originale : 
      // - On remplace le chauffeurId par le TIEN (myId)
      // - On note qu'elle vient d'un partage (pour afficher le badge orange)
      await Ride.findByIdAndUpdate(rideId, {
        chauffeurId: myId, // <--- CHANGEMENT DE PROPRIÉTAIRE
        isShared: true,
        // Optionnel : On peut stocker le nom de l'ancien chauffeur dans une note ou un champ
        shareNote: share.sharedNote || `Transféré par ${share.fromUserId?.fullName}` 
      });

      // 2. On supprime l'invitation RideShare car le transfert est terminé
      // (La course est maintenant une course "normale" qui t'appartient)
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
      { _id: req.params.id, chauffeurId: req.user.id }, // Utilisation de chauffeurId
      { $set: { statuFacturation } },
      { new: true }
    );

    if (!ride) return res.status(404).json({ message: "Course introuvable" });

    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 8. RÉSERVATION WEB (Sans chauffeur attribué) ---
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
      // On NE MET PAS de chauffeurId ici, c'est une demande libre !
    });

    await newRide.save();
    res.status(201).json({ success: true, message: "Votre demande a bien été envoyée. Le chauffeur vous confirmera l'horaire par SMS." });

  } catch (error) {
    console.error("Erreur Web Booking:", error);
    res.status(500).json({ error: "Erreur serveur, veuillez réessayer plus tard." });
  }
};