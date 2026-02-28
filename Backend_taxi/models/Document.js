const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  type: { type: String, required: true }, 
  imageData: { type: String, required: true }, 
  uploadDate: { type: Date, default: Date.now },
  
  maxRides: { type: Number, default: 0 },
  // Infos flexibles
  patientName: { type: String }, 
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' }, 
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  
  // Ce champ servira pour tout le monde (Chauffeur créateur OU Chauffeur propriétaire)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Document', DocumentSchema);