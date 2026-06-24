// Design tokens — source unique. Tous les écrans importent d'ici.
// ─── PALETTE FUTURISTE 2026 ───────────────────────────────────────────────────

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/fr';
dayjs.extend(relativeTime);
dayjs.locale('fr');

export const colors = {
  // ── Light surface ───────────────────────────────────────────────────────────
  bg:      '#EAEDFF',   // fond bleu-nuit très clair (cosmic white)
  card:    '#FFFFFF',
  card2:   '#F0F3FF',   // teinté bleu froid
  border:  '#D0D8FF',   // bordure blue-tinted

  // ── Typographie ─────────────────────────────────────────────────────────────
  text:    '#040C1E',   // near-black bleu profond
  text2:   '#3D5070',   // bleu-gris medium
  text3:   '#7A90B2',   // bleu-gris light

  // ── Brand — orange électrique ────────────────────────────────────────────────
  brand:       '#FF5500',   // orange plus chaud/électrique
  brandGrad:   '#FF8800',   // dégradé fin brand
  brandDim:    'rgba(255,85,0,0.12)',
  brandBorder: 'rgba(255,85,0,0.30)',
  brandGlow:   'rgba(255,85,0,0.40)',   // pour shadow glow

  // ── Accent électrique cyan ────────────────────────────────────────────────────
  electric:    '#00CCFF',   // cyan électrique
  electricGrad:'#0099FF',   // vers bleu
  electricDim: 'rgba(0,204,255,0.12)',
  electricGlow:'rgba(0,204,255,0.35)',

  // ── Semantic ────────────────────────────────────────────────────────────────
  green:    '#00D68F',   // neon emerald
  greenGrad:'#00B87A',
  greenDim: 'rgba(0,214,143,0.12)',
  greenGlow:'rgba(0,214,143,0.35)',
  red:      '#FF3355',   // rouge plus vif
  redDim:   'rgba(255,51,85,0.12)',
  blue:     '#3D7FFF',   // bleu électrique
  blueDim:  'rgba(61,127,255,0.12)',
  purple:   '#9B5FFF',   // violet plasma
  purpleDim:'rgba(155,95,255,0.12)',
  amber:    '#FFB800',   // ambre plus saturé
  amberDim: 'rgba(255,184,0,0.12)',

  // ── Dark header — espace profond ────────────────────────────────────────────
  hBg1:    '#020710',   // near-black cosmique
  hBg2:    '#060E1E',   // bleu-nuit profond
  hBg3:    '#0D1A30',   // légèrement plus clair
  hCard:   'rgba(255,255,255,0.06)',
  hBorder: 'rgba(80,160,255,0.18)',   // bordure glass bleue
  hText:   '#E8F0FF',   // blanc légèrement bleuté
  hText2:  '#6A88B8',   // bleu-gris

  // ── Glow overlays ────────────────────────────────────────────────────────────
  glowBrand:    'rgba(255,85,0,0.08)',
  glowElectric: 'rgba(0,204,255,0.08)',
  glowGreen:    'rgba(0,214,143,0.08)',
};

// ── Échelle typographique ─────────────────────────────────────────────────────
export const fontSize = {
  xs:   11,
  sm:   13,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  28,
};

// ── Grille 8pt ────────────────────────────────────────────────────────────────
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
  tabBarClearance: 120,
};

// ── Rayons ────────────────────────────────────────────────────────────────────
export const radius = {
  sm:   10,
  md:   14,
  lg:   20,
  xl:   28,
};

// ── Ombres / Glows ────────────────────────────────────────────────────────────
export const shadow = {
  card: {
    shadowColor: '#1A2550',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHover: {
    shadowColor: '#1A2550',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  brandGlow: {
    shadowColor: '#FF5500',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  electricGlow: {
    shadowColor: '#00CCFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 14,
    elevation: 8,
  },
  greenGlow: {
    shadowColor: '#00D68F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 14,
    elevation: 8,
  },
};

// ── Gradients prédéfinis ──────────────────────────────────────────────────────
export const gradients = {
  header:    [colors.hBg1, colors.hBg2, colors.hBg3],
  brand:     [colors.brand, colors.brandGrad],
  electric:  [colors.electric, colors.electricGrad],
  green:     [colors.green, colors.greenGrad],
  dark:      ['#1A2550', '#0D1A30'],
  plasma:    ['#9B5FFF', '#5B2FBF'],
  fire:      ['#FF5500', '#FF0055'],
};

// ── Alias court (usage: import C from '../styles/tokens') ─────────────────────
const C = {
  ...colors,
  // gardés pour rétrocompatibilité
  hBg3: colors.hBg3,
  greenGrad: colors.greenGrad,
  brandDim: colors.brandDim,
  brandBorder: colors.brandBorder,
  electricDim: colors.electricDim,
  greenDim: colors.greenDim,
  redDim: colors.redDim,
  blueDim: colors.blueDim,
  purpleDim: colors.purpleDim,
  amberDim: colors.amberDim,
};

export default C;
