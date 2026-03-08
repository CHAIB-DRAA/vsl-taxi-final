const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs'); // 👈 NOUVEAU : Pour lire les dossiers

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// 🕵️‍♂️ ZONE DE DEBUGGING AVANCÉE
// ==========================================
const publicPath = path.join(__dirname, 'public');
console.log('🔍 [DEBUG] Chemin absolu attendu pour public :', publicPath);
console.log('🔍 [DEBUG] Le dossier public existe-t-il physiquement ? :', fs.existsSync(publicPath));

if (fs.existsSync(publicPath)) {
    console.log('🔍 [DEBUG] Contenu du dossier public :', fs.readdirSync(publicPath));
} else {
    console.log('❌ [ALERTE] Le dossier public est INTROUVABLE à cet emplacement !');
}

// Dire à Express d'utiliser ce dossier
app.use(express.static(publicPath));

// ==========================================
// 🔗 ROUTES
// ==========================================

// 1. La route secrète pour diagnostiquer en ligne
app.get('/debug', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    res.status(200).json({
        message: "Analyse des dossiers du serveur",
        repertoireCourant_CWD: process.cwd(),
        repertoireScript_DIRNAME: __dirname,
        cheminDossierPublic: publicPath,
        dossierPublicExiste: fs.existsSync(publicPath),
        fichierIndexExiste: fs.existsSync(indexPath),
        fichiersTrouves: fs.existsSync(publicPath) ? fs.readdirSync(publicPath) : "Aucun dossier public"
    });
});

// 2. Route pour forcer l'affichage de l'accueil (Au cas où static échoue)
app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("❌ ERREUR 404 : Le fichier index.html est introuvable sur le serveur.");
    }
});

// 3. Ping API
app.get('/ping', (req, res) => res.status(200).send('Pong! Server is alive 🤖'));

// Import de tes routes API habituelles
const rideRoutes = require('./routes/rideRoutes');
const userRoutes = require('./routes/userRoutes');
const contactRoutes = require('./routes/contactRoutes');
const docRoutes = require('./routes/docRoutes');
const patientRoutes = require('./routes/patientRoutes');
const shareRoutes = require('./routes/shareRoutes'); 
const dispatchRoutes = require('./routes/dispatch'); 
const groupRoutes = require('./routes/groups');      
const aiRoutes = require('./routes/ai'); 

app.use('/api/rides', rideRoutes);
app.use('/api/user', userRoutes);
app.use('/api/documents', docRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/ai', aiRoutes); 

// ==========================================
// 🚀 DÉMARRAGE
// ==========================================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ Connecté à MongoDB'))
.catch((err) => console.error('❌ Erreur de connexion MongoDB :', err));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});