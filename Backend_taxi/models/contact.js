const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Celui qui ajoute
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Celui qui est ajouté
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);