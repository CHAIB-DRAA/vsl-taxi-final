const mongoose = require('mongoose');

const rideSchema = mongoose.Schema({
  // 1. Le chauffeur n'est plus "required" pour autoriser les demandes web sans chauffeur attribué
  chauffeurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

  // --- INFOS PATIENT & TRAJET ---
  patientName: { type: String, required: true },
  patientPhone: { type: String, default: '' }, 
  startLocation: { type: String, required: true },
  endLocation: { type: String, required: true },
  date: { type: Date, required: true },
  returnDate: { type: Date },
  type: { 
    type: String, 
    // J'ajoute 'VSL' et 'Ambulance' si jamais tu les utilises depuis le web ou l'app
    enum: ['Aller', 'Retour', 'Consultation', 'Hospit', 'HDJ', 'Dialyse', 'VSL', 'Ambulance'],
    default: 'Aller' 
  },
  isRoundTrip: { type: Boolean, default: false },
  
  // --- CYCLE DE VIE ---
  startTime: { type: Date }, 
  endTime: { type: Date },   
  // 'À venir' pour les courses normales, 'En attente' pour le web ou les partages non validés
  status: {
    type: String,
    enum: ['En attente', 'À venir', 'En cours', 'Terminée', 'Annulée'],
    default: 'En attente'
  },
  cancelReason: { type: String, default: '' },

  source: { type: String, enum: ['App', 'Web'], default: 'App' },

  notes: { type: String, default: '' },
  motif: {
    type: String,
    enum: ['Consultation', 'Traitement', 'Hospitalisation', 'HDJ', 'Urgence', 'Autre'],
    default: 'Consultation',
  },
  price: { type: Number, default: 0 },

  // --- DONNÉES CPAM (Facturation) ---
  realDistance: { type: Number },
  tolls: { type: Number, default: 0 },
  statuFacturation: { type: String, enum: ['Non facturé', 'Facturé'], default: 'Non facturé' },
  bonTransport: { type: String, default: '' },
  nbPassengers: { type: Number, default: 1 },
  isTpmr: { type: Boolean, default: false },
  // Forfait Grande Ville Toulouse détecté par geocodage INSEE (null = non déterminé → fallback keywords)
  isMetropole: { type: Boolean, default: null },
  // NIR du patient (numéro sécurité sociale, 13 chiffres)
  patientNIR: { type: String, default: '' },
  // Code prescripteur CPAM (NPPI du médecin qui a prescrit)
  prescriberCode: { type: String, default: '' },
  // Le chauffeur revient-il à vide ? (true = aller simple, false = aller-retour ou retour lié)
  hasEmptyReturn: { type: Boolean, default: true },
  // Patient seul 30+ km dans véhicule partagé (exception abattement CPAM)
  longuePortionSeule: { type: Boolean, default: false },
  // Type de PMT : isolé (1 trajet), série (quota fixe), longue_durée (1000+ trajets)
  pmtType: { type: String, enum: ['isolé', 'série', 'longue_durée', ''], default: '' },

  // --- GESTION DU PARTAGE ---
  isShared: { type: Boolean, default: false }, 
  sharedByName: { type: String }, 
  shareNote: { type: String, default: '' } 

}, { timestamps: true });

// Index composés pour les requêtes fréquentes (évite les full-collection scans)
rideSchema.index({ chauffeurId: 1, date: -1 });               // getTodayRides, getRides
rideSchema.index({ chauffeurId: 1, status: 1, date: -1 });    // getStats, filtres
rideSchema.index({ source: 1, status: 1 });                   // demandes web en attente
rideSchema.index({ chauffeurId: 1, statuFacturation: 1 });    // FacturationScreen

module.exports = mongoose.model('Ride', rideSchema);