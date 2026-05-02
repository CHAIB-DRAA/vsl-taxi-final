const express = require('express');
const router = express.Router();
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');

// On importe ton nouveau modèle !
const DocumentsTaxi = require('../models/DocumentsTaxi'); 
const { protect } = require('../middleware/auth'); 

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10 Mo par sécurité
});

// INITIALISATION GOOGLE DRIVE
// /!\ ATTENTION: Pour l'instant on lit un fichier JSON local. 
// Pour Render, il faudra passer par process.env.GOOGLE_CREDENTIALS
const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json', 
    scopes: ['https://www.googleapis.com/auth/drive.file']
});
const drive = google.drive({ version: 'v3', auth });

const FOLDER_ID = 'https://drive.google.com/drive/u/0/folders/103faHxrnFczNiVZijaDWfJyLv5zF1xqg'; 

// ROUTE POST : /api/documents/upload
router.post('/upload', protect, upload.single('file'), async (req, res) => {
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
            uploaderId: req.user._id, // Récupéré via ton middleware 'protect'
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
router.get('/', protect, async (req, res) => {
    try {
        // On récupère tous les docs et on populate l'auteur si possible
        const docs = await DocumentsTaxi.find()
            .populate('uploaderId', 'name email') // Optionnel: pour afficher qui a uploadé
            .sort({ createdAt: -1 });
        res.json(docs);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des documents" });
    }
});

module.exports = router;