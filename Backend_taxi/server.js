const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); // Ajout pour gérer les chemins de fichiers proprement

// 1. Configuration des variables d'environnement
dotenv.config();

// 2. CRÉATION DE L'APPLICATION EXPRESS (Toujours en premier !)
const app = express();

// 3. Middlewares (Les réglages)
app.use(cors());
app.use(express.json());

// 🌟 LE DOSSIER PUBLIC (Pour ta page Web de réservation)
// Express va servir automatiquement tous les fichiers placés dans le dossier "public"
app.use(express.static(path.join(__dirname, 'public')));

// Import des routes
const rideRoutes = require('./routes/rideRoutes');
const userRoutes = require('./routes/userRoutes');
const contactRoutes = require('./routes/contactRoutes');
const docRoutes = require('./routes/docRoutes');
const patientRoutes = require('./routes/patientRoutes');
const shareRoutes = require('./routes/shareRoutes'); 
const dispatchRoutes = require('./routes/dispatch'); 
const groupRoutes = require('./routes/groups');      
const aiRoutes = require('./routes/ai'); 

// 4. Connexion à la Base de données
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ Connecté à MongoDB'))
.catch((err) => console.error('❌ Erreur de connexion à MongoDB :', err));

// ==========================================
// 5. DÉFINITION DES ROUTES
// ==========================================

// Route de test API (Ping) - Toujours utile pour vérifier que le moteur tourne
app.get('/ping', (req, res) => {
    res.status(200).send('Pong! Server is alive 🤖');
});

// Tes routes API
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
// 6. DÉMARRAGE DU SERVEUR
// ==========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});