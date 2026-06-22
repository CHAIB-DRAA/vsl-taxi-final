/**
 * Parseur bons de transport CERFA 11574
 * Corrigé pour : NIR après "immatriculation", nom/prénom distincts, adresse réelle
 */

const FORM_BLACKLIST = [
  'PRESCRIPTION', 'MEDICALE', 'TRANSPORT', 'PERSONNE', 'BENEFICIAIRE',
  'ASSURE', 'ASSUREE', 'MEDECIN', 'CERFA', 'SECURITE', 'SOCIALE',
  'IMMATRICULATION', 'NAISSANCE', 'ADRESSE', 'DOMICILE', 'URGENCE',
  'SAMU', 'AMBULANCE', 'SANITAIRE', 'DECLARATION', 'SIGNATURE',
  'PRESCRIPTEUR', 'IDENTIFIANT', 'STRUCTURE', 'COMMENTAIRES',
  'BENEFICIAIRE', 'PRESCRIPTION', 'ORDONNANCE', 'CORRESPOND',
  'OBLIGATOIRE', 'COMPLETEE', 'ACCOMPAGNATEUR', 'INFIRMIER',
  'HOSPITALIER', 'ETABLISSEMENT', 'SUPERIEUR', 'INFERIEUR',
];

const isBlacklisted = (str) =>
  FORM_BLACKLIST.some(w => str.toUpperCase().includes(w));

const stripSpaces = (str) => str.replace(/[\s\-\.]/g, '');

export const parseBonTransport = (rawText) => {
  if (!rawText) return null;

  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const flat = lines.join(' ');

  // ── 1. NIR / N° IMMATRICULATION ─────────────────────────────────────────
  // Format sécu : 1 ou 2, puis 12 chiffres, souvent avec espaces entre groupes
  // Ex : "2 59 05 13 062 029 16"  ou  "259051306202916"
  let nir = '';

  // Priorité : cherche directement après "immatriculation"
  const nirAfterLabel = flat.match(
    /(?:n[°o\.]\s*)?immatricul[a-z]*\s*[:\-]?\s*([12][\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*\d[\s\-\.]*(?:\d[\s\-\.]*\d)?)/i
  );
  if (nirAfterLabel) {
    nir = stripSpaces(nirAfterLabel[1]);
  }

  // Fallback 1 : format espacé typique  X XX XX XX XXX XXX XX
  if (!nir) {
    const m = flat.match(/\b([12])\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{3})\s+(\d{3})\s+(\d{2})\b/);
    if (m) nir = m.slice(1).join('');
  }

  // Fallback 2 : 15 chiffres collés commençant par 1 ou 2
  if (!nir) {
    const m = flat.match(/\b([12]\d{14})\b/);
    if (m) nir = m[1];
  }

  // Fallback 3 : 13 chiffres collés commençant par 1 ou 2
  if (!nir) {
    const m = flat.match(/\b([12]\d{12})\b/);
    if (m) nir = m[1];
  }

  // Garde les 13 premiers chiffres (sans la clé)
  if (nir.length === 15) nir = nir.substring(0, 13);
  if (nir.length < 13) nir = ''; // invalide

  // ── 2. DATE DE NAISSANCE ─────────────────────────────────────────────────
  let dateNaissance = '';

  // Après un label explicite
  const dateLabelM = flat.match(
    /(?:n[eé](?:e)?\s*le|date\s*(?:de\s*)?naissance|né\s*\(?e?\)?)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
  );
  if (dateLabelM) {
    dateNaissance = dateLabelM[1].replace(/-/g, '/');
  }

  // Fallback : la date la plus ancienne dans le document (= naissance, pas transport)
  if (!dateNaissance) {
    const allDates = [...flat.matchAll(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/g)].map(m => ({
      raw: m[1].replace(/-/g, '/'),
      year: parseInt(m[1].split(/[\/\-]/)[2]),
    }));
    const candidates = allDates.filter(d => d.year > 1900 && d.year < new Date().getFullYear() - 5);
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.year - b.year);
      dateNaissance = candidates[0].raw;
    }
  }

  // ── 3. NOM & PRÉNOM ───────────────────────────────────────────────────────
  // Sur un bon CERFA, le nom du patient est en MAJUSCULES
  // Stratégie : trouver les lignes tout-en-majuscules qui ne sont pas du texte de formulaire
  let nom = '';
  let prenom = '';

  for (const line of lines) {
    if (line.length < 2 || line.length > 55) continue;
    if (isBlacklisted(line)) continue;

    // Cas 1 : toute la ligne en MAJUSCULES — ex: "RADUCANESCU CLAUDIA"
    if (/^[A-ZÉÈÊËÀÂÙÛÜÏÎ\s\-']{3,}$/.test(line) && /[A-ZÉÈÊËÀÂÙÛÜÏÎ]{2,}/.test(line)) {
      const parts = line.trim().split(/\s+/);
      nom = parts[0];
      prenom = parts.slice(1).join(' ');
      break;
    }

    // Cas 2 : NOM majuscules + Prénom titre — ex: "RADUCANESCU Claudia"
    const mixedM = line.match(
      /^([A-ZÉÈÊËÀÂÙÛÜÏÎ\-']{2,})\s+([A-ZÉÈÊËÀÂÙÛÜÏÎa-zéèêëàâùûüïî\-']{2,}(?:\s+[A-ZÉÈÊËÀÂÙÛÜÏÎa-zéèêëàâùûüïî\-']{2,})*)$/
    );
    if (mixedM && !isBlacklisted(mixedM[1])) {
      nom = mixedM[1];
      prenom = mixedM[2];
      break;
    }
  }

  // Fallback : cherche après label "nom"
  if (!nom) {
    for (const line of lines) {
      const m = line.match(/^(?:nom|bénéficiaire)\s*[:\-]\s*([A-ZÉÈÊËÀÂÙÛÜÏÎ][^\n]{1,30})/i);
      if (m && !isBlacklisted(m[1])) {
        nom = m[1].trim();
        break;
      }
    }
  }

  // Sécurité : si prénom == nom, vide le prénom (doublon)
  if (prenom && prenom.toUpperCase() === nom.toUpperCase()) prenom = '';

  // ── 4. ADRESSE ────────────────────────────────────────────────────────────
  // Cherche un code postal (5 chiffres) + ville — pattern le plus fiable
  let adresse = '';

  for (const line of lines) {
    // Ligne avec un code postal valide (75xxx, 13xxx, 31xxx...)
    if (/\b[0-9]{5}\b/.test(line)) {
      // Exclure : dates, numéro cerfa, NIR, lignes trop courtes
      if (/\d{2}[\/\-]\d{2}/.test(line)) continue;
      if (/cerfa|n°\s*1157/i.test(line)) continue;
      if (line.replace(/[^0-9]/g, '').length > 6) continue; // trop de chiffres = NIR
      adresse = line.trim().replace(/^adresse\s+/i, '');
      break;
    }
  }

  // Fallback : ligne après label "adresse" (mais pas le texte d'instruction)
  if (!adresse) {
    let foundAdresseLabel = false;
    for (const line of lines) {
      if (foundAdresseLabel) {
        // La ligne suivante : doit ressembler à une adresse
        if (line.length > 5 && line.length < 80 && !isBlacklisted(line)) {
          adresse = line.trim();
        }
        break;
      }
      if (/^adresse\s*[:\-]?$/i.test(line)) foundAdresseLabel = true;
    }
  }

  // ── 5. FULLNAME ───────────────────────────────────────────────────────────
  const fullName = [nom, prenom].filter(Boolean).join(' ');

  return {
    nom: nom.toUpperCase(),
    prenom: prenom
      ? prenom.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      : '',
    fullName,
    dateNaissance,
    nir,
    adresse,
    rawText,
  };
};
