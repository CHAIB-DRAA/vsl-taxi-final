const express = require('express');
const router = express.Router();
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');

// IMPORT CORRIGÉ : On calque ton architecture exacte
const authMiddleware = require('../middleware/auth'); 
const DocumentsTaxi = require('../models/DocumentsTaxi'); 

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10 Mo max
});

// INITIALISATION GOOGLE DRIVE
// (À remplacer plus tard par les variables d'environnement sur Render)
const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json', 
    scopes: ['https://www.googleapis.com/auth/drive.file']
});
const drive = google.drive({ version: 'v3', auth });

const FOLDER_ID = 'https://drive.google.com/drive/u/0/folders/103faHxrnFczNiVZijaDWfJyLv5zF1xqg'; 

// ROUTE POST : /api/documents/upload
// UTILISATION CORRIGÉE : authMiddleware
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);

        // Upload vers Drive
        const driveRes = await drive.files.create({
            requestBody: {
                name: req.file.originalname,
                parents: [FOLDER_ID]
            },
            media: {
                mimeType: req.file.mimetype,
                body: bufferStream
            },
            fields: 'id, webViewLink'
        });

        // Sauvegarde dans la collection DocumentsTaxi
        const newDoc = new DocumentsTaxi({
            name: req.file.originalname,
            category: req.body.category,
            description: req.body.description,
            uploaderId: req.user._id, // Assure-toi que ton authMiddleware attache bien 'req.user'
            driveFileId: driveRes.data.id,
            viewLink: driveRes.data.webViewLink,
            size: req.file.size,
            mimeType: req.file.mimetype
        });

        await newDoc.save();
        res.status(201).json(newDoc);

    } catch (error) {
        console.error("Erreur Upload Drive :", error);
        res.status(500).json({ error: "Échec de l'envoi du document vers Google Drive" });
    }
});

// ROUTE GET : /api/documents (Pour afficher la liste)
// UTILISATION CORRIGÉE : authMiddleware
router.get('/', authMiddleware, async (req, res) => {
    try {
        const docs = await DocumentsTaxi.find()
            .populate('uploaderId', 'name email') // Optionnel si tu veux le nom de l'expéditeur
            .sort({ createdAt: -1 });
        res.json(docs);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des documents" });
    }
});

module.exports = router;