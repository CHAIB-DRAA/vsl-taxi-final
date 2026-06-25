const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const authMiddleware = require('../middleware/auth');
const Patient = require('../models/Patient'); 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.use(authMiddleware);

const { createLimiter } = require('../middleware/rateLimiter');
const aiLimiter = createLimiter({ windowMs: 60 * 1000, max: 20, message: 'Trop de requêtes IA.' });

// --- 1. DICTIONNAIRE DES LIEUX (A compléter) ---
const KNOWN_LOCATIONS = {
    "estela": "Clinique Estela, Route de Revel, Toulouse",
    "basso": "Basso Cambo, Toulouse",
    "candy": "Clinique Candy, Toulouse",
    "smr": "SMR, Toulouse",
    "oncopole": "1 Avenue Irène Joliot-Curie, 31100 Toulouse",
    "purpan": "Place du Dr Baylac, 31300 Toulouse",
    "rangueil": "1 Avenue du Professeur Jean Poulhès, 31400 Toulouse",
    "pasteur": "45 Avenue de Lombez, 31300 Toulouse",
    "st simon": "Saint-Simon, Toulouse",
    "pl st etienne": "Place Saint-Étienne, Toulouse",
    "pont des demoiselles": "Pont des Demoiselles, Toulouse",
    "minimes": "Les Minimes, Toulouse",
    "les carmes": "Les Carmes, Toulouse",
    "clinique": "Clinique",
    "chu": "CHU Toulouse"
};

const findRealAddress = (input) => {
    if (!input) return "";
    const lower = input.toLowerCase();
    for (const [key, address] of Object.entries(KNOWN_LOCATIONS)) {
        if (lower.includes(key)) return address;
    }
    return input;
};

// --- 2. ROUTE PRINCIPALE ---
router.post('/parse-ride', aiLimiter, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Texte manquant" });
  if (text.length > 2000) return res.status(400).json({ error: "Texte trop long (max 2000 caractères)" });

  try {
    // Calcul de la date de DEMAIN pour la référence
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // Format YYYY-MM-DD

    const prompt = `
      Tu es un assistant dispatch. Analyse ce message de courses VSL/Taxi.

      TEXTE REÇU : "${text}"

      CONTEXTE TEMPOREL :
      - Nous sommes le : ${today.toISOString()}
      - Si une date est explicitement écrite dans le texte, utilise-la. Sinon, utilise DEMAIN (${tomorrowStr}).

      FORMATS POSSIBLES :
      A) Format simple adresse : "Départ >>> Arrivée DD/MM/YYYY HH:MM" ou "Départ > Arrivée"
         - ">" ou ">>>" sépare le Départ de l'Arrivée.
         - La date peut être en format DD/MM/YYYY (ex: 12/06/2026) ou DD/MM (ex: 12/06).
         - L'heure peut être HH:MM (ex: 10:00) ou HHhMM (ex: 10h00).
         - Le patientName peut être vide si non mentionné.
      B) Format "Pec Hdj..." :
         - "Pec Hdj" ou "Pec" = Début de course.
         - L'heure suit immédiatement (ex: 9h15).
         - "Me" = Madame / "Mr" = Monsieur. LE MOT QUI SUIT EST LE NOM DU PATIENT.

      RÈGLES CRUCIALES :
      - "Hdj" signifie Hôpital de Jour -> CE N'EST PAS UN NOM DE FAMILLE.
      - "Estela", "Basso", "Candy", "SMR", "Purpan", "Rangueil", "Oncopole" -> CE SONT DES LIEUX, pas des patients.
      - Si tu vois "Me Bouteraa", le patient est "Mme Bouteraa".
      - Ne confonds jamais le chauffeur (toi) avec le patient.
      - Si aucun nom de patient n'est présent, laisse patientName à "".
      - Pour la date : convertis DD/MM/YYYY en ISOString. Si seul DD/MM est écrit, utilise l'année en cours (${today.getFullYear()}).

      Réponds JSON : { "rides": [ { "patientName": "...", "patientPhone": "...", "startLocation": "...", "endLocation": "...", "date": "ISOString", "type": "Aller" } ] }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
          { role: "system", content: "Expert logistique." },
          { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    // B. TRAITEMENT & RECHERCHE BDD
    const enrichedRides = await Promise.all((result.rides || []).map(async (r) => {
        
        let finalName = r.patientName || "";
        
        // Sécurité anti-bruit (si l'IA remet Hdj en nom)
        if (finalName.match(/^(Hdj|Pec|Estela|SMR|Candy|Basso)$/i)) {
            finalName = "";
        }

        // Correction des lieux via le dictionnaire
        let start = findRealAddress(r.startLocation);
        let end = findRealAddress(r.endLocation);
        let finalPhone = r.patientPhone;

        // 3. RECHERCHE BDD INTELLIGENTE
        if (finalName.length > 2) {
            // Nettoyage pour recherche (enlève Me, Mr, Mme)
            const cleanSearchName = finalName.replace(/mme|mr|m\.|me |monsieur|madame/gi, '').trim();
            
            const escapedName = cleanSearchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const dbPatient = await Patient.findOne({
                chauffeurId: req.user.id,
                fullName: { $regex: new RegExp(escapedName, 'i') }
            });

            if (dbPatient) {
                finalName = dbPatient.fullName; 
                if (!finalPhone) finalPhone = dbPatient.phone;
                
                // Si l'adresse de départ ou arrivée est "Domicile" (ou vide dans le contexte >), on met l'adresse du patient
                // Ex: "Basso > Estela" -> Pas de domicile
                // Ex: "Chez lui > Estela" -> Domicile
                if (start && start.toLowerCase().includes("domicile")) start = dbPatient.address;
                if (end && end.toLowerCase().includes("domicile")) end = dbPatient.address;
            }
        }

        return {
            ...r,
            patientName: finalName,
            patientPhone: finalPhone,
            startLocation: start,
            endLocation: end,
            type: "Aller" // Par défaut
        };
    }));

    res.json({ rides: enrichedRides });

  } catch (error) {
    console.error("⚠️ Erreur IA:", error.message);
    res.json({ rides: [] });
  }
});

module.exports = router;