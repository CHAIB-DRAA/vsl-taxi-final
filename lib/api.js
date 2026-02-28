import axios from 'axios';

const API_URL = 'http://10.0.2.2:5000/api'; // ou l'IP de ton serveur

export const api = axios.create({
  baseURL: API_URL,
});

// Ajout automatique du token
export const setToken = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};
