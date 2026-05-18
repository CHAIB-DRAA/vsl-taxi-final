const mongoose = require('mongoose');

const adminConfigSchema = new mongoose.Schema({
  passwordHash: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('AdminConfig', adminConfigSchema);
