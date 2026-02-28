import axios from 'axios';
const API_URL = 'https://vsl-taxi.onrender.com/api/rides';
export const signUp = async (email, fullName, password) => {
  const res = await axios.post(`${API_URL}/signup`, { email, fullName, password });
  return res.data;
};

export const signIn = async (email, password) => {
  const res = await axios.post(`${API_URL}/signin`, { email, password });
  return res.data.user; // renvoie user pour session
  token: res.data.token    // le token JWT renvoyé par le backend

};

export const getCurrentSession = async () => {
  const res = await axios.get(`${API_URL}/session`);
  return res.data.user || null;
};
