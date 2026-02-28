import moment from 'moment';

export const parseRideFromText = (text) => {
  if (!text) return null;

  const result = {
    patientName: '',
    patientPhone: '',
    startLocation: '',
    endLocation: '',
    startTime: null,
    date: new Date(), // Par défaut aujourd'hui
    type: 'Aller', // Par défaut
    notes: text // On garde le texte original en note au cas où
  };

  // 1. DÉTECTION TÉLÉPHONE (Format 06... ou 07... ou +33...)
  const phoneRegex = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    result.patientPhone = phoneMatch[0].replace(/\s/g, '').replace(/\./g, '');
  }

  // 2. DÉTECTION HEURE (Format 14h30, 14:30, 14H30)
  const timeRegex = /(\d{1,2})[hH:](\d{2})/;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    
    const newDate = new Date();
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    newDate.setSeconds(0);
    result.startTime = newDate.toISOString();
  }

  // 3. ESSAI DE DÉTECTION NOM / ADRESSES (C'est le plus dur, c'est approximatif)
  // On découpe par ligne ou par tiret
  const parts = text.split(/[\n-]/).map(p => p.trim()).filter(p => p.length > 0);
  
  // Stratégie simple : 
  // Si on trouve "De" ou "Dep", c'est le départ.
  // Si on trouve "Vers", "A" ou "Dest", c'est l'arrivée.
  
  parts.forEach(part => {
    const lower = part.toLowerCase();
    
    if (lower.includes('dep') || lower.startsWith('de ')) {
        result.startLocation = part.replace(/dep[:.]?|de /i, '').trim();
    } else if (lower.includes('dest') || lower.includes('pour ') || lower.startsWith('à ') || lower.includes('vers ')) {
        result.endLocation = part.replace(/dest[:.]?|pour |vers |à /i, '').trim();
    } else if (!result.patientName && !part.match(/\d/) && part.length > 3) {
        // Si pas de chiffre et pas encore de nom, on suppose que c'est le nom
        result.patientName = part;
    }
  });

  return result;
};