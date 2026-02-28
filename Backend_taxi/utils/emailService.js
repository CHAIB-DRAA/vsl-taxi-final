const axios = require('axios');

const sendEmail = async (options) => {
  // On vérifie que la clé est bien là
  if (!process.env.BREVO_API_KEY) {
    throw new Error("Clé API Brevo manquante dans les variables d'environnement.");
  }

  // URL de l'API Brevo
  const url = 'https://api.brevo.com/v3/smtp/email';

  // Préparation des données
  const data = {
    sender: { 
      name: "Taxi App Support", 
      email: process.env.EMAIL_USER // Doit être l'email validé dans Brevo
    },
    to: [
      { email: options.email, name: options.email }
    ],
    subject: options.subject,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #FF6B00;">${options.subject}</h2>
        <p>${options.message}</p>
        ${options.token ? `<h1 style="background: #eee; padding: 10px; display: inline-block; border-radius: 5px;">${options.token}</h1>` : ''}
        <p style="font-size: 12px; color: #777; margin-top: 20px;">Ceci est un message automatique.</p>
      </div>
    `
  };

  // Configuration de la requête
  const config = {
    headers: {
      'accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY, // La clé xkeysib-...
      'content-type': 'application/json'
    }
  };

  console.log(`🔌 Envoi via BREVO API vers ${options.email}...`);

  try {
    const response = await axios.post(url, data, config);
    console.log("✅ Email envoyé avec succès ! ID Message:", response.data.messageId);
  } catch (error) {
    console.error("❌ ERREUR BREVO :", error.response ? error.response.data : error.message);
    throw new Error("Erreur lors de l'envoi de l'email via Brevo.");
  }
};

module.exports = sendEmail;