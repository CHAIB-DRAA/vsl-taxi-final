const mongoose = require('mongoose');

const rideSchema = mongoose.Schema({
  // L'utilisateur (Chauffeur) à qui appartient la course
  chauffeurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // --- INFOS PATIENT & TRAJET ---
  patientName: { type: String, required: true },
  patientPhone: { type: String, default: '' }, // <--- AJOUTE CE CHAMP
  startLocation: { type: String, required: true },
  endLocation: { type: String, required: true },
  date: { type: Date, required: true },
  returnDate: { type: Date },
  // J'ai ajouté 'Ambulance' et 'VSL' pour que ça colle avec tes badges Frontend
  type: { 
    type: String, 
    enum: ['Aller', 'Retour', 'Consultation', 'Hospit','HDJ'], 
    default: 'Aller' 
  },
  isRoundTrip: { type: Boolean, default: false },
  
  // --- CYCLE DE VIE (Horodatage Réel) ---
  startTime: { type: Date }, // Clic sur "Démarrer"
  endTime: { type: Date },   // Clic sur "Terminer"
  status: { type: String, default: 'En attente' }, // 'En attente', 'En cours', 'Terminée'

  // --- DONNÉES CPAM (Facturation) ---
  realDistance: { type: Number }, // KM compteur
  tolls: { type: Number, default: 0 }, // Péages
  statuFacturation: { type: String, enum: ['Non facturé', 'Facturé'], default: 'Non facturé' },

  // --- GESTION DU PARTAGE (Les Nouveautés) ---
  isShared: { type: Boolean, default: false }, // Est-ce une course qu'on m'a envoyée ?
  
  // Qui me l'a envoyée ? (Ex: "Jean Dupont")
  sharedByName: { type: String }, 
  
  // La fameuse note (Ex: "Attention 4ème étage sans ascenseur")
  shareNote: { type: String, default: '' } 

}, { timestamps: true }); // Ajoute automatiquement createdAt et updatedAt

module.exports = mongoose.model('Ride', rideSchema);