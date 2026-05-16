const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');

dotenv.config();

// Validation des variables d'environnement au démarrage
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ Variables d'environnement manquantes : ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.warn("⚠️  JWT_SECRET trop court. Utilisez au moins 32 caractères.");
}

const app = express();

// ==========================================
// SÉCURITÉ & MIDDLEWARES
// ==========================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https:"],
      fontSrc:        ["'self'", "https:", "data:"],
      imgSrc:         ["'self'", "data:"],
      connectSrc:     ["'self'", "https:"],
      formAction:     ["'self'"],
      frameAncestors: ["'self'", "https://www.taxi-31-toulouse.fr"],
    },
  },
}));

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));

// Fichiers statiques (portail web patient) — no-cache sur les HTML
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath, {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// ==========================================
// ROUTES API
// ==========================================

const rideRoutes      = require('./routes/rideRoutes');
const userRoutes      = require('./routes/userRoutes');
const authRoutes      = require('./routes/authRoutes');
const docRoutes       = require('./routes/docRoutes');
const patientRoutes   = require('./routes/patientRoutes');
const contactRoutes   = require('./routes/contactRoutes');
const shareRoutes     = require('./routes/shareRoutes');
const dispatchRoutes  = require('./routes/dispatch');
const groupRoutes     = require('./routes/groups');
const aiRoutes        = require('./routes/ai');
const adminRoutes     = require('./routes/adminRoutes');
const documentsRoutes = require('./routes/documentsTaxi');

app.use('/api/rides',         rideRoutes);
app.use('/api/user',          userRoutes);
app.use('/api/auth',          authRoutes);
app.use('/api/documents',     docRoutes);
app.use('/api/patients',      patientRoutes);
app.use('/api/contacts',      contactRoutes);
app.use('/api/share',         shareRoutes);
app.use('/api/dispatch',      dispatchRoutes);
app.use('/api/groups',        groupRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/documentsTaxi', documentsRoutes);

// ==========================================
// ROUTES PAGES WEB
// ==========================================

app.get('/ping',    (_req, res) => res.status(200).send('Pong!'));
const noCache = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};
app.get('/',        noCache, (_req, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.get('/admin',   noCache, (_req, res) => res.sendFile(path.join(publicPath, 'admin.html')));
app.get('/portail', noCache, (_req, res) => res.sendFile(path.join(publicPath, 'portail.html')));

// ==========================================
// DÉMARRAGE
// ==========================================

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => {
    console.error('❌ Erreur MongoDB :', err.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));
