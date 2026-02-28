const mongoose = require('mongoose');

const rideShareSchema = new mongoose.Schema({
  rideId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ride', 
    required: true 
  }, // La course originale
  fromUserId: { 
    type: mongoose.Schema.Types.ObjectId, // <--- CHANGÉ (était String)
    ref: 'User',                           // <--- AJOUTÉ
    required: true 
  }, 
  toUserId: { 
    type: mongoose.Schema.Types.ObjectId, // <--- CHANGÉ (était String)
    ref: 'User',                          // <--- AJOUTÉ
    required: true 
  }, 
  sharedNote: { type: String }, // <--- AJOUTÉ (Pour stocker le petit message)
  statusPartage: { 
    type: String, 
    enum: ['pending', 'accepted', 'refused'], 
    default: 'pending' 
  }
}, {
  timestamps: true 
});

module.exports = mongoose.model('RideShare', rideShareSchema);