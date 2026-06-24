/**
 * geocodingService.js
 * Détection "Grande Ville Toulouse" via l'API adresse.data.gouv.fr
 *
 * Convention CPAM Haute-Garonne — forfait +15 € si prise en charge
 * OU dépose dans la commune de Toulouse ou dans les établissements
 * conventionnés hors-commune (Croix du Sud, Clinique de l'Union).
 *
 * API utilisée : https://api-adresse.data.gouv.fr (gouvernement français,
 * gratuite, sans clé, 0 quota — retourne code INSEE précis).
 */

import axios from 'axios';

// ─── Communes CPAM "grande ville Toulouse" ────────────────────────────────────
// Source : Convention nationale CPAM Haute-Garonne 2025
// INSEE officiel : https://www.insee.fr/fr/metadonnees/cog/commune
const TOULOUSE_METRO_INSEE = new Set([
  '31555', // Toulouse (commune principale)
  '31449', // Quint-Fonsegrives → Clinique Croix du Sud (31130)
  '31497', // Saint-Jean → Clinique de l'Union (31240)
  '31069', // Blagnac (aéroport, certains établissements hospitaliers)
]);

// Codes postaux des communes CPAM hors liste INSEE stricte
// (ex: adresses reconnues via postcode quand INSEE indisponible)
const TOULOUSE_METRO_POSTCODES = new Set([
  '31000', '31100', '31200', '31300', '31400', '31500', // Toulouse intra-muros
  '31240', // Saint-Jean (Clinique de l'Union)
  '31130', // Quint-Fonsegrives (Clinique Croix du Sud)
  '31700', // Blagnac
]);

// ─── Cache mémoire — évite appels répétés pour la même adresse ───────────────
const _cache = new Map();

// ─── Geocode une adresse via l'API gouvernementale ───────────────────────────
const GEO_API = 'https://api-adresse.data.gouv.fr/search/';

export const geocodeAddress = async (address) => {
  if (!address || address.trim().length < 5) return null;
  try {
    const { data } = await axios.get(GEO_API, {
      params: {
        q:     address.trim(),
        limit: 1,
        lat:   43.6047,   // bias centré sur Toulouse
        lon:   1.4442,
      },
      timeout: 4000,
    });
    const feat = data.features?.[0];
    if (!feat) return null;
    const { citycode, postcode, city, label, score } = feat.properties;
    const [lon, lat] = feat.geometry.coordinates;
    return { citycode, postcode, city, label, lat, lon, score };
  } catch {
    return null;
  }
};

// ─── Détermine si un résultat de géocodage est en zone CPAM Toulouse ─────────
export const isGeoResultInMetropole = (geo) => {
  if (!geo) return null;                                 // indéterminé
  if (TOULOUSE_METRO_INSEE.has(geo.citycode)) return true;
  if (TOULOUSE_METRO_POSTCODES.has(geo.postcode)) return true;
  return false;
};

// ─── Point d'entrée principal avec cache ─────────────────────────────────────
/**
 * @param {string} address — adresse libre
 * @returns {Promise<boolean|null>}
 *   true  = zone CPAM Toulouse (forfait +15€)
 *   false = hors zone
 *   null  = impossible à déterminer (API indisponible, adresse trop courte)
 */
export const checkMetropole = async (address) => {
  if (!address || address.trim().length < 5) return null;
  const key = address.toLowerCase().trim();
  if (_cache.has(key)) return _cache.get(key);
  const geo = await geocodeAddress(address);
  const result = isGeoResultInMetropole(geo);
  if (result !== null) _cache.set(key, result);         // ne cache pas null
  return result;
};

// ─── Vérifie un objet ride complet (start ET end) ────────────────────────────
/**
 * @returns {Promise<boolean>} — true si l'une des deux adresses est en zone
 */
export const checkRideMetropole = async (startLocation, endLocation) => {
  const [start, end] = await Promise.all([
    checkMetropole(startLocation),
    checkMetropole(endLocation),
  ]);
  // true dès qu'une adresse est en zone ; false si les deux sont hors zone ;
  // null si toutes deux sont indéterminées
  if (start === true || end === true) return true;
  if (start === false || end === false) return false;
  return null;
};

// ─── Vide le cache (utile pour les tests) ────────────────────────────────────
export const clearGeoCache = () => _cache.clear();
