import moment from 'moment';
import 'moment/locale/fr';

// --- CONFIGURATION HAUTE-GARONNE (Convention 2025) ---
const CONFIG = {
    FORFAIT_BASE: 13.00,        // Inclut la prise en charge + 4 km
    KM_INCLUS: 4,               // Kilomètres inclus dans le forfait base
    PRIX_KM: 1.10,              // Prix du km supplémentaire
    FORFAIT_METROPOLE: 15.00,   // Bonus Aire Métropolitaine
    
    // Seuils pour retour à vide (basé sur tes exemples)
    SEUIL_KM_RETOUR_VIDE: 40,   // En dessous de 40km facturés = 25%, au dessus = 50%
    MAJORATION_RETOUR_COURT: 0.25,
    MAJORATION_RETOUR_LONG: 0.50,

    MAJORATION_NUIT_WE: 0.50    // +50% sur le total
};

// Jours fériés fixes en France (A compléter pour les dates mobiles comme Pâques si besoin)
const FIXED_HOLIDAYS = [
    '01-01', '01-05', '08-05', '14-07', '15-08', '01-11', '11-11', '25-12'
];

// --- DÉTECTION NUIT / WEEK-END / FÉRIÉ ---
const isNightOrWeekend = (dateObj) => {
    const date = moment(dateObj);
    const day = date.day(); // 0 = Dimanche, 6 = Samedi
    const hour = date.hour();
    const dateStr = date.format('DD-MM');

    // 1. Jours Fériés
    if (FIXED_HOLIDAYS.includes(dateStr)) return true;

    // 2. Dimanche (Toute la journée)
    if (day === 0) return true;

    // 3. Samedi (À partir de 12h00) ⚠️ Règle Spéciale Toulouse
    if (day === 6 && hour >= 12) return true;

    // 4. Nuit (19h00 à 07h00)
    if (hour >= 19 || hour < 7) return true;

    return false;
};

// --- DÉTECTION AIRE MÉTROPOLITAINE ---
// Vérifie si l'adresse contient Toulouse ou un code postal 31xxx proche
const isMetropole = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    // Liste simple des villes/lieux clés
    if (lower.includes('toulouse') || lower.includes('31000') || lower.includes('31100') || 
        lower.includes('31200') || lower.includes('31300') || lower.includes('31400') || 
        lower.includes('31500') || lower.includes('blagnac') || lower.includes('colomiers') ||
        lower.includes('tournefeuille') || lower.includes('balma') || lower.includes('oncopole') ||
        lower.includes('purpan') || lower.includes('rangueil')) {
        return true;
    }
    return false;
};

// --- FONCTION PRINCIPALE DE CALCUL ---
export const calculatePrice = (ride) => {
    if (!ride) return "0.00";

    // 1. Récupération des données
    // On priorise la distance réelle saisie, sinon l'estimation
    let totalKm = parseFloat(ride.realDistance || ride.distance || 0);
    const tolls = parseFloat(ride.tolls || 0);
    
    if (totalKm <= 0) return "0.00";

    // 2. Calcul des Kilomètres Facturables (Total - 4km inclus)
    let billableKm = totalKm - CONFIG.KM_INCLUS;
    if (billableKm < 0) billableKm = 0;

    // 3. Coût Kilométrique
    const kmCost = billableKm * CONFIG.PRIX_KM;

    // 4. Gestion du "Retour à vide" (Majoration sur la part KM)
    // Si c'est un Aller Simple (!isRoundTrip), on applique la majoration
    let emptyReturnBonus = 0;
    if (!ride.isRoundTrip) {
        // Logique déduite de tes exemples :
        // 26km facturés -> 25%
        // 46km facturés -> 50%
        if (billableKm >= CONFIG.SEUIL_KM_RETOUR_VIDE) {
            emptyReturnBonus = kmCost * CONFIG.MAJORATION_RETOUR_LONG;
        } else {
            emptyReturnBonus = kmCost * CONFIG.MAJORATION_RETOUR_COURT;
        }
    }

    // 5. Calcul du Sous-Total "Base"
    // Forfait (13€) + Métropole (15€ si applicable) + Km + Retour Vide
    let baseTotal = CONFIG.FORFAIT_BASE;
    
    // Détection automatique Métropole (Si départ OU arrivée est dans la zone)
    if (isMetropole(ride.startLocation) || isMetropole(ride.endLocation)) {
        baseTotal += CONFIG.FORFAIT_METROPOLE;
    }

    baseTotal += kmCost + emptyReturnBonus;

    // 6. Application Nuit / Week-end (+50% sur le tout)
    let finalTotal = baseTotal;
    if (isNightOrWeekend(ride.date)) {
        finalTotal = baseTotal * (1 + CONFIG.MAJORATION_NUIT_WE);
    }

    // 7. Ajout des Péages (Toujours ajoutés à la fin, non majorés)
    finalTotal += tolls;

    // 8. Arrondi 2 décimales
    return finalTotal.toFixed(2);
};