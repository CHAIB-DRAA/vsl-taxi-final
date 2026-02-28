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
  
  // Liste des collègues qui ont le droit de voir ce patient
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] 
}, { 
  timestamps: true // 👇 Pour ravoir createdAt et updatedAt automatiquement
});

module.exports = mongoose.model('Patient', PatientSchema);