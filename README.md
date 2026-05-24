# 🚖 VSL-Mobile

Application mobile React Native de gestion de courses médicales pour taxi VSL.

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)

## ✨ Fonctionnalités

- 📋 Gestion complète des courses (création, modification, suppression)
- 👤 Gestion des patients avec carte vitale
- 📍 Calcul automatique des distances via Mappy
- 💰 Facturation et suivi CPAM
- 📤 Partage de courses entre chauffeurs
- 🔔 Notifications push en temps réel
- 📅 Agenda avec vue calendrier
- 🌐 Portail web patient intégré

## 🏗️ Architecture

\`\`\`
Frontend (React Native / Expo)
        ↕ API REST (JWT)
Backend (Node.js / Express)
        ↕
MongoDB Atlas (Cloud)
\`\`\`

## 🚀 Installation

\`\`\`bash
# Cloner le repo
git clone https://github.com/CHAIB-DRAA/vsl-taxi-final.git
cd vsl-taxi-final

# Installer les dépendances frontend
npm install

# Installer les dépendances backend
cd Backend_taxi && npm install

# Configurer les variables denvironnement
cp .env.example .env
# Remplir MONGO_URI, JWT_SECRET

# Lancer
npm start
\`\`\`

## 📁 Structure

\`\`\`
vsl-taxi-final/
├── screens/          # Écrans de lapp
├── components/       # Composants réutilisables
├── services/         # Appels API
├── contexts/         # Contextes React
├── utils/            # Utilitaires (pricing, etc.)
└── Backend_taxi/     # Serveur Node.js
    ├── controllers/  # Logique métier
    ├── models/       # Schémas MongoDB
    ├── routes/       # Routes API
    └── middleware/   # Auth JWT
\`\`\`

## 🔗 Companion App

Voir [Cofidoc-Auto](https://github.com/CHAIB-DRAA/Cofidoc-auto) pour automatiser la facturation Cofidoc.

