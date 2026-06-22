const mongoose = require('mongoose');

const siteConfigSchema = new mongoose.Schema({
  // Brand
  brandLegalName:   { type: String, default: 'OCCITANIE MEDI MOBILITY' },
  brandShortName:   { type: String, default: 'Taxi 31 Toulouse' },
  brandHighlight:   { type: String, default: '31' },
  brandTagline:     { type: String, default: 'Conventionné CPAM' },
  brandTaglineAlt:  { type: String, default: 'Conventionné CPAM & Privé' },
  brandCpamLabel:   { type: String, default: 'Agréé CPAM Haute-Garonne' },

  // Domain
  domain: { type: String, default: 'https://www.taxi-31-toulouse.fr' },

  // Contact
  phone:        { type: String, default: '0772339892' },
  phoneDisplay: { type: String, default: '07 72 33 98 92' },
  phoneE164:    { type: String, default: '+33772339892' },
  email:        { type: String, default: 'contact@taxi-31-toulouse.fr' },
  whatsapp:     { type: String, default: 'https://wa.me/33772339892' },
  smsBody:      { type: String, default: 'Bonjour, je souhaite réserver un taxi...' },

  // Address
  addressStreet:     { type: String, default: '6 rue Buissonnière Bat A' },
  addressCity:       { type: String, default: 'Fonbeauzard' },
  addressPostalCode: { type: String, default: '31140' },
  addressRegion:     { type: String, default: 'Haute-Garonne' },
  addressDisplay:    { type: String, default: 'Toulouse & Occitanie' },
  addressDisplaySub: { type: String, default: 'Haute-Garonne (31)' },

  // Geo
  geoLat:        { type: String, default: '43.6843' },
  geoLng:        { type: String, default: '1.4230' },
  geoMetaCity:   { type: String, default: 'Toulouse' },
  geoMetaRegion: { type: String, default: 'FR-OCC' },
  geoMetaPos:    { type: String, default: '43.6047;1.4442' },

  // Google
  googleAdsId:         { type: String, default: 'AW-17844653906' },
  googleSearchConsole: { type: String, default: 'ETCwhGEYjo9LoL4TK82q9VWvXsOc5TTg8gg0WJzOZI' },
  googleReviewUrl:     { type: String, default: 'https://g.page/r/Cbh2nxTvVS7cEBM/review' },
  googleMapsUrl:       { type: String, default: 'https://maps.google.com/?cid=15905025186406049849' },
  googleCid:           { type: String, default: '15905025186406049849' },
  googleSameAs:        { type: String, default: 'https://g.page/r/Cbh2nxTvVS7cEAE' },

  // SEO
  seoTitle:          { type: String, default: 'Taxi Conventionné CPAM Toulouse | Transport Médical & Courses Privées' },
  seoTitleTemplate:  { type: String, default: '%s | Taxi 31 Toulouse — Occitanie Médi Mobility' },
  seoDescription:    { type: String, default: 'Taxi VSL conventionné CPAM à Toulouse et en Occitanie. Transport médical (dialyse, chimiothérapie, ALD) avec tiers payant intégral — 0€ d\'avance. Courses privées : Aéroport Blagnac, Gare Matabiau, événements. Disponible 24h/24.' },
  seoOgTitle:        { type: String, default: 'Taxi Conventionné CPAM Toulouse — Occitanie Médi Mobility' },
  seoOgDescription:  { type: String, default: 'Transport médical VSL remboursé CPAM (dialyse, chimio, ALD) et courses privées (aéroport, gare, mariages) à Toulouse et en Occitanie. Tiers payant intégral — 0€ d\'avance.' },
  seoLocalBizName:   { type: String, default: 'Taxi Conventionné CPAM Toulouse — Occitanie Médi Mobility' },
  seoLocalBizDesc:   { type: String, default: 'Taxi conventionné CPAM et VSL en Occitanie. Transport médical assis (ALD, chimiothérapie, dialyse, radiothérapie) avec tiers payant intégral — 0€ d\'avance. Courses privées : aéroport Toulouse-Blagnac, gare Matabiau, mariages, événements. Disponible 24h/24.' },

  // Style
  styleAccentColor:  { type: String, default: '#eab308' },
  stylePrimaryColor: { type: String, default: '#2563eb' },
  styleDarkColor:    { type: String, default: '#0f172a' },

  // Deployment
  vercelDeployHook: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('SiteConfig', siteConfigSchema);
