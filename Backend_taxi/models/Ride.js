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
  status: { type: String, default: 'En attente' }, 

  // --- NOUVEAU : ORIGINE DE LA COURSE ---
  // Permet de savoir si ça vient de l'application ou du site internet (Formulaire patient)
  source: { type: String, enum: ['App', 'Web'], default: 'App' },
  
  // NOUVEAU : Notes additionnelles (pratique pour les infos du formulaire Web)
  notes: { type: String, default: '' },

  // --- DONNÉES CPAM (Facturation) ---
  realDistance: { type: Number }, 
  tolls: { type: Number, default: 0 }, 
  statuFacturation: { type: String, enum: ['Non facturé', 'Facturé'], default: 'Non facturé' },

  // --- GESTION DU PARTAGE ---
  isShared: { type: Boolean, default: false }, 
  sharedByName: { type: String }, 
  shareNote: { type: String, default: '' } 

}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);