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
    enum: ['Aller', 'Retour', 'Consultation', 'Hospit', 'HDJ', 'VSL', 'Ambulance'], 
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

  // --- GESTION DU PARTAGE ---
  isShared: { type: Boolean, default: false }, 
  sharedByName: { type: String }, 
  shareNote: { type: String, default: '' } 

}, { timestamps: true });

// Index composés pour les requêtes fréquentes (évite les full-collection scans)
rideSchema.index({ chauffeurId: 1, date: -1 });               // getTodayRides, getRides
rideSchema.index({ chauffeurId: 1, status: 1, date: -1 });    // getStats, filtres
rideSchema.index({ source: 1, status: 1 });                   // demandes web en attente

module.exports = mongoose.model('Ride', rideSchema);