const mongoose = require('mongoose');

const documentsTaxiSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    driveFileId: { type: String, required: true }, // L'ID du fichier chez Google
    viewLink: { type: String }, // Le lien pour l'ouvrir
    size: { type: Number }, // Taille en octets
    mimeType: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DocumentsTaxi', documentsTaxiSchema);