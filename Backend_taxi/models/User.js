const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // Champs supplémentaires
  pushToken: { type: String, default: '' },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Champs pour le reset de mot de passe
  resetPasswordToken: String,
  resetPasswordExpires: Date

}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);