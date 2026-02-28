const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  try {
    console.log('🔄 Tentative de connexion à MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connexion à MongoDB réussie !');
    await mongoose.disconnect();
    console.log('🛑 Déconnexion terminée.');
  } catch (error) {
    console.error('❌ Erreur de connexion à MongoDB :', error);
  }
}

testConnection();
