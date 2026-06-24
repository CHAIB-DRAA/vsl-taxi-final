const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  // 👇 C'est ici le plus important : required: true
  chauffeurId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  fullName: { type: String, required: true },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  // NIR (Numéro de Sécurité Sociale) — 13 chiffres
  nir: { type: String, default: '' },
  // Code prescripteur CPAM principal du patient
  prescriberCode: { type: String, default: '' },
  prescriberName: { type: String, default: '' },
  // Mutuelle / complémentaire
  mutuelle: { type: String, default: '' },
  // Tiers payant activé
  tiersPayant: { type: Boolean, default: false },
  // Notes médicales (allergies, fauteuil, etc.)
  notesMedicales: { type: String, default: '' },
  // Données PMT en cours
  pmtActif: {
    numero:     { type: String, default: '' },
    type:       { type: String, enum: ['isolé', 'série', 'longue_durée', ''], default: '' },
    dateDebut:  { type: Date },
    quotaTotal: { type: Number, default: 0 },
  },

  // Liste des collègues qui ont le droit de voir ce patient
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] 
}, {
  timestamps: true
});

PatientSchema.index({ chauffeurId: 1 });
PatientSchema.index({ chauffeurId: 1, fullName: 1 });

module.exports = mongoose.model('Patient', PatientSchema);