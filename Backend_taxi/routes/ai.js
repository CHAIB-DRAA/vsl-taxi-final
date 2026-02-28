const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const authMiddleware = require('../middleware/auth');
const Patient = require('../models/Patient'); 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.use(authMiddleware);

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
router.post('/parse-ride', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Texte manquant" });

  try {
    // Calcul de la date de DEMAIN pour la référence
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // Format YYYY-MM-DD

    // A. PROMPT SPÉCIAL FORMAT "PEC HDJ"
    const prompt = `
      Tu es un assistant dispatch. Analyse ce message de courses VSL/Taxi.
      
      TEXTE REÇU : "${text}"
      
      CONTEXTE TEMPOREL :
      - Nous sommes le : ${today.toISOString()}
      - Par défaut, les courses sont pour DEMAIN (${tomorrowStr}), sauf si une date précise est écrite.

      FORMAT A DÉCODER ("Pec Hdj..."):
      1. "Pec Hdj" ou "Pec" = Début de course.
      2. L'heure suit immédiatement (ex: 9h15).
      3. "Me" = Madame / "Mr" = Monsieur. LE MOT QUI SUIT EST LE NOM DU PATIENT.
      4. Le symbole ">" sépare le Départ de l'Arrivée (Départ > Arrivée).
      5. Si pas de ">", c'est une adresse simple.

      RÈGLES CRUCIALES :
      - "Hdj" signifie Hôpital de Jour -> CE N'EST PAS UN NOM DE FAMILLE.
      - "Estela", "Basso", "Candy", "SMR" -> CE SONT DES LIEUX, pas des patients.
      - Si tu vois "Me Bouteraa", le patient est "Mme Bouteraa".
      - Ne confonds jamais le chauffeur (toi) avec le patient.

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
            
            const dbPatient = await Patient.findOne({
                fullName: { $regex: new RegExp(cleanSearchName, 'i') }
            });

            if (dbPatient) {
                console.log(`✅ Patient reconnu BDD : ${dbPatient.fullName}`);
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

    res.json(enrichedRides);

  } catch (error) {
    console.error("⚠️ Erreur IA:", error.message);
    res.json([]);
  }
});

module.exports = router;