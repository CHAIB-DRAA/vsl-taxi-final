const mongoose = require('mongoose');

const dispatchSchema = mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Target peut être un Groupe OU un User
  targetGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// 👇 SÉCURITÉ : On vérifie si le modèle existe déjà pour éviter l'erreur "OverwriteModelError"
module.exports = mongoose.models.Dispatch || mongoose.model('Dispatch', dispatchSchema);