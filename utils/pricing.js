import moment from 'moment';
import 'moment/locale/fr';

// --- CONVENTION TAXI 2025-2029 — DÉPARTEMENT 31 (Haute-Garonne) ---
// Source officielle : Convention CPAM reçue, applicable au 1er novembre 2025
const CONFIG = {
  FORFAIT_BASE: 13.00,       // Prise en charge + 4 km inclus
  KM_INCLUS: 4,              // km offerts dans le forfait
  PRIX_KM: 1.10,             // €/km au-delà des 4 premiers (dept 31)
  FORFAIT_METROPOLE: 15.00,  // Supplément Grande Ville Toulouse
  SUPPLEMENT_TPMR: 30.00,    // Supplément TPMR (véhicule adapté PMR)
  SEUIL_RETOUR_VIDE: 50,     // Seuil en km TOTAUX pour taux retour à vide
  TAUX_RETOUR_COURT: 0.25,   // +25% sur coût km si distance totale < 50 km
  TAUX_RETOUR_LONG: 0.50,    // +50% sur coût km si distance totale >= 50 km
  MAJORATION_NUIT_WE: 0.50,  // +50% sur tarif socle (hors péages et TPMR)
};

// Abattements transport partagé (appliqués sur tarif socle + majorations, hors péages et TPMR)
const ABATTEMENT_PARTAGE = { 1: 1.00, 2: 0.77, 3: 0.65 };
const ABATTEMENT_4PLUS = 0.63;
// Exception longue distance : patient seul 30km+ dans le véhicule → abattement réduit à 5%
const ABATTEMENT_LONGUE_PORTION = 0.95;

// ─── JOURS FÉRIÉS ────────────────────────────────────────────────────────────

const FERIES_FIXES = [
  '01-01', // Jour de l'An
  '05-01', // Fête du Travail
  '05-08', // Victoire 1945
  '07-14', // Fête Nationale
  '08-15', // Assomption
  '11-01', // Toussaint
  '11-11', // Armistice
  '12-25', // Noël
];

// Algorithme de Gauss pour le calcul de Pâques
const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const toMMDD = (date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getMobileFeries = (year) => {
  const easter = getEasterDate(year);
  const add = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  return [
    add(easter, 1),   // Lundi de Pâques
    add(easter, 39),  // Ascension (Jeudi)
    add(easter, 50),  // Lundi de Pentecôte
  ].map(toMMDD);
};

const isHoliday = (dateObj) => {
  const d = moment(dateObj);
  const mmdd = d.format('MM-DD');
  return FERIES_FIXES.includes(mmdd) || getMobileFeries(d.year()).includes(mmdd);
};

// ─── DÉTECTION NUIT / WEEK-END / FÉRIÉ ───────────────────────────────────────
// Source CPAM : nuit = 20h00 → 08h00, samedi dès 12h, dimanche toute la journée

const isNightOrWeekend = (dateObj) => {
  if (!dateObj) return false;
  const d = moment(dateObj);
  const day = d.day();
  const hour = d.hour();
  if (isHoliday(dateObj)) return true;
  if (day === 0) return true;                  // Dimanche
  if (day === 6 && hour >= 12) return true;   // Samedi à partir de 12h
  if (hour >= 20 || hour < 8) return true;    // Nuit : 20h→8h (source CPAM)
  return false;
};

// ─── DÉTECTION FORFAIT GRANDE VILLE TOULOUSE (+15€) ─────────────────────────
// Source CPAM : +15€ si prise en charge OU dépose dans Toulouse
// ou dans les cliniques spécifiques : Croix du Sud, l'Union

const TOULOUSE_VILLE = [
  'toulouse',
  'oncopole', 'purpan', 'rangueil', 'pasteur', 'larrey',
  '31000', '31100', '31200', '31300', '31400', '31500',
];

// Établissements hors Toulouse explicitement validés CPAM
const ETABLISSEMENTS_FRONTIERES = [
  // Clinique de l'Union — Saint-Jean (31240)
  "clinique de l'union", "clinique de l union", "l'union", "l union", "saint-jean", "31240",
  // Clinique de la Croix du Sud — Quint-Fonsegrives (31130 partagé avec Balma → pas de CP seul)
  'croix du sud', 'quint-fonsegrives', 'quint fonsegrives',
];

const isMetropole = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    TOULOUSE_VILLE.some((kw) => lower.includes(kw)) ||
    ETABLISSEMENTS_FRONTIERES.some((kw) => lower.includes(kw))
  );
};

// ─── CALCUL PRINCIPAL ─────────────────────────────────────────────────────────
//
// Ordre officiel CPAM :
//   1.  Forfait base 13 € (inclut 4 km)
//   2.  + Supplément Grande Ville 15 € si applicable
//   3.  + Coût km : (distance totale - 4) × 1,10 €
//   4.  + Retour à vide : 25% ou 50% sur le coût km (si entrée/sortie hospit aller simple)
//   5.  × 1,5 si nuit (20h→8h) / samedi ≥12h / dimanche / férié
//       = TARIF SOCLE
//   6.  × abattement partage (si transport partagé, sur tarif socle)
//       Exception : patient seul ≥30 km → abattement réduit à 5%
//   7.  + Supplément TPMR 30 € si véhicule adapté PMR (hors abattement)
//   8.  + Péages (hors abattement, divisés par nb patients si partagé)

export const calculatePriceDetailed = (ride) => {
  if (!ride) return null;

  const totalKm    = parseFloat(ride.realDistance || ride.distance || 0);
  const tollsTotal = parseFloat(ride.tolls || 0);
  const nbPass     = Math.max(1, parseInt(ride.nbPassengers || 1, 10));
  const isTpmr     = Boolean(ride.isTpmr);
  // Exception longue distance : ce patient a fait ≥30 km seul dans le véhicule partagé
  const longuePortionSeule = Boolean(ride.longuePortionSeule);

  if (totalKm <= 0) return null;

  // Étape 3 : km facturables et coût km
  const billableKm = Math.max(0, totalKm - CONFIG.KM_INCLUS);
  const kmCost     = billableKm * CONFIG.PRIX_KM;

  // Étape 2 : supplément grande ville
  const metropole     = isMetropole(ride.startLocation) || isMetropole(ride.endLocation);
  const metropoleCost = metropole ? CONFIG.FORFAIT_METROPOLE : 0;

  // Étape 4 : retour à vide (sur coût km, seuil sur distance TOTALE)
  const applyRetour = !ride.isRoundTrip;
  const tauxRetour  = totalKm < CONFIG.SEUIL_RETOUR_VIDE
    ? CONFIG.TAUX_RETOUR_COURT
    : CONFIG.TAUX_RETOUR_LONG;
  const retourCost = applyRetour ? parseFloat((kmCost * tauxRetour).toFixed(2)) : 0;

  // Étape 5 : tarif socle avant nuit
  let socle = CONFIG.FORFAIT_BASE + metropoleCost + kmCost + retourCost;

  // Majoration nuit / WE / férié (+50% sur tarif socle)
  const nuit         = isNightOrWeekend(ride.date);
  const socleAvecNuit = nuit ? socle * (1 + CONFIG.MAJORATION_NUIT_WE) : socle;

  // Étape 6 : abattement transport partagé (sur tarif socle majoré, hors TPMR et péages)
  let multiplicateurAbattement;
  if (nbPass > 1 && longuePortionSeule) {
    multiplicateurAbattement = ABATTEMENT_LONGUE_PORTION; // 5% d'abattement seulement
  } else {
    multiplicateurAbattement = nbPass >= 4
      ? ABATTEMENT_4PLUS
      : (ABATTEMENT_PARTAGE[nbPass] ?? 1.00);
  }
  const socleApresAbattement = socleAvecNuit * multiplicateurAbattement;

  // Étape 7 : supplément TPMR (hors abattement)
  const tpmrCost = isTpmr ? CONFIG.SUPPLEMENT_TPMR : 0;

  // Étape 8 : péages (hors abattement, divisés par nb patients si partagé)
  const tollsParPatient = nbPass > 1
    ? parseFloat((tollsTotal / nbPass).toFixed(2))
    : tollsTotal;

  const total = parseFloat((socleApresAbattement + tpmrCost + tollsParPatient).toFixed(2));

  return {
    totalKm,
    billableKm:           parseFloat(billableKm.toFixed(2)),
    kmCost:               parseFloat(kmCost.toFixed(2)),
    metropole,
    metropoleCost,
    retourVide:           applyRetour,
    tauxRetour,
    retourCost,
    nuit,
    socle:                parseFloat(socle.toFixed(2)),
    socleAvecNuit:        parseFloat(socleAvecNuit.toFixed(2)),
    nbPass,
    multiplicateurAbattement,
    longuePortionSeule,
    isTpmr,
    tpmrCost,
    tollsTotal,
    tollsParPatient,
    total,
  };
};

export const calculatePrice = (ride) => {
  const detail = calculatePriceDetailed(ride);
  if (!detail) return '0.00';
  return detail.total.toFixed(2);
};
