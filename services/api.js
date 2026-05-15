import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Ton URL Backend
const API_URL = 'https://vsl-taxi.onrender.com/api';

// 1. Création de l'instance Axios
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// 🔐 LE FIX EST ICI : L'INTERCEPTEUR (Pour l'erreur 401)
// ============================================================
// Avant chaque requête, on va chercher le token dans le téléphone
// et on l'attache à la requête.
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log("Erreur token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// 📦 TES FONCTIONS API (Adaptées pour utiliser l'instance sécurisée)
// ============================================================

// --- COURSES (RIDES) ---
export const getRides = async () => {
  const response = await api.get('/rides');
  return response.data;
};

export const createRide = async (rideData) => {
  const response = await api.post('/rides', rideData);
  return response.data;
};

export const updateRide = async (id, updates) => {
  const response = await api.put(`/rides/${id}`, updates);
  return response.data;
};

export const deleteRide = async (id) => {
  const response = await api.delete(`/rides/${id}`);
  return response.data;
};

export const shareRide = async (rideId, contactId, note) => {
  const response = await api.post(`/rides/${rideId}/share`, { targetUserId: contactId, note });
  return response.data;
};

export const startRideById = async (id) => {
  const response = await api.patch(`/rides/${id}/start`);
  return response.data;
};

export const finishRideById = async (id, realDistance, tolls = 0) => {
  const response = await api.patch(`/rides/${id}/finish`, { realDistance, tolls });
  return response.data;
};

export const cancelRideById = async (id, reason = '') => {
  const response = await api.patch(`/rides/${id}/cancel`, { reason });
  return response.data;
};

export const getTodayRides = async () => {
  const response = await api.get('/rides/today');
  return response.data;
};

export const acceptWebBooking = async (id) => {
  const response = await api.post(`/rides/${id}/accept-web`);
  return response.data;
};

export const rejectWebBooking = async (id) => {
  const response = await api.delete(`/rides/${id}/reject-web`);
  return response.data;
};

export const getRideStats = async (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const response = await api.get('/rides/stats', { params });
  return response.data;
};

// --- PATIENTS ---
export const getPatients = async () => {
  // L'erreur 401 venait souvent d'ici car cette route est protégée
  const response = await api.get('/patients');
  return response.data;
};

export const createPatient = async (patientData) => {
  const response = await api.post('/patients', patientData);
  return response.data;
};

export const updatePatient = async (id, updates) => {
  const response = await api.put(`/patients/${id}`, updates);
  return response.data;
};

export const deletePatient = async (id) => {
  const response = await api.delete(`/patients/${id}`);
  return response.data;
};

// --- GROUPES & CONTACTS ---
export const getGroups = async () => {
  const response = await api.get('/groups');
  return response.data;
};

// Pour récupérer la liste des collègues/contacts (utilisé dans le partage)
export const getContacts = async () => {
  const response = await api.get('/contacts');
  return response.data;
};

// --- IA (MAGIC PASTE) ---
export const parseRideWithAI = async (text) => {
  // Note: Pas besoin de token ici techniquement, mais ça ne gêne pas
  const response = await api.post('/ai/parse-ride', { text });
  return response.data;
};

// --- DOCUMENTS (UPLOAD) ---
export const uploadDocument = async (formData) => {
  // Pour l'upload, on doit laisser Axios gérer le Content-Type automatiquement
  const response = await api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    transformRequest: (data) => data, // Empêche Axios de casser le format fichier
  });
  return response.data;
};

export default api;