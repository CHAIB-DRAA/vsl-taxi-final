import TextRecognition from '@react-native-ml-kit/text-recognition';

// --- 1. FONCTION POUR LE NUMÉRO DE SÉCU (NIR) ---
export const extractSecuNumber = async (imageUri) => {
  try {
    const result = await TextRecognition.recognize(imageUri);
    const blocks = result.blocks;

    if (blocks.length === 0) return null;

    // On parcourt chaque bloc de texte trouvé sur la carte
    for (let block of blocks) {
      for (let line of block.lines) {
        const rawLine = line.text;

        // 1. NETTOYAGE AGRESSIF
        const correctedLine = rawLine
          .toUpperCase()
          .replace(/O/g, '0')
          .replace(/Q/g, '0')
          .replace(/D/g, '0')
          .replace(/B/g, '8')
          .replace(/S/g, '5')
          .replace(/Z/g, '2')
          .replace(/I/g, '1')
          .replace(/L/g, '1');

        // 2. ON GARDE UNIQUEMENT LES CHIFFRES
        const digitsOnly = correctedLine.replace(/[^0-9]/g, '');

        // 3. ANALYSE DU RÉSULTAT
        // Cas parfait : 13 ou 15 chiffres, commence par 1 ou 2
        if ((digitsOnly.length === 13 || digitsOnly.length === 15) && (digitsOnly.startsWith('1') || digitsOnly.startsWith('2'))) {
           return digitsOnly.substring(0, 13);
        }

        // Cas difficile (bruit autour) : on cherche la séquence à l'intérieur
        if (digitsOnly.length > 13) {
           const match = digitsOnly.match(/[12]\d{12}/);
           if (match) {
             return match[0];
           }
        }
      }
    }

    // SI RIEN TROUVÉ LIGNE PAR LIGNE : Approche globale
    const fullTextDigits = result.text.replace(/[^0-9]/g, '');
    const fullMatch = fullTextDigits.match(/[12]\d{12}/);
    
    if (fullMatch) {
      return fullMatch[0];
    }

    return null;

  } catch (error) {
    console.error("Erreur OCR NIR:", error);
    return null;
  }
};

// --- 2. FONCTION POUR LE NOM ET PRÉNOM ---
export const extractName = async (imageUri) => {
  try {
    const result = await TextRecognition.recognize(imageUri);
    const blocks = result.blocks;
    
    // Mots à ignorer (qui sont sur toutes les cartes)
    const blacklist = ['CARTE', 'VITALE', 'ASSURANCE', 'MALADIE', 'FRANCE', 'EMISE', 'DATE', 'PHOTO'];

    for (let block of blocks) {
      for (let line of block.lines) {
        const text = line.text.trim().toUpperCase();

        // Critères pour être un Nom :
        // 1. Au moins 3 lettres
        // 2. Que des lettres, espaces ou tirets (pas de chiffres)
        // 3. Pas dans la blacklist
        if (text.length > 3 && /^[A-Z\s-]+$/.test(text)) {
          
          let isBlacklisted = false;
          blacklist.forEach(word => {
            if (text.includes(word)) isBlacklisted = true;
          });

          if (!isBlacklisted) {
            // C'est probablement le nom (ex: "DUPONT JEAN")
            return text; 
          }
        }
      }
    }
    return ""; // Rien trouvé
  } catch (e) {
    console.error("Erreur OCR NOM:", e);
    return "";
  }
};