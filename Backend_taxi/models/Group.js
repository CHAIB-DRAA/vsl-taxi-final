const mongoose = require('mongoose');

const groupSchema = mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

// 👇 LA CORRECTION EST ICI : On vérifie si le modèle existe avant de le créer
module.exports = mongoose.models.Group || mongoose.model('Group', groupSchema);