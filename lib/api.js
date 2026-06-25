import axios from 'axios';

const API_URL = 'https://vsl-taxi.onrender.com/api';

export const api = axios.create({
  baseURL: API_URL,
});

// Ajout automatique du token
export const setToken = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};
