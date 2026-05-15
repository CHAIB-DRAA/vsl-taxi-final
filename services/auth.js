import axios from 'axios';

const BASE_URL = 'https://vsl-taxi.onrender.com/api/user';

export const signUp = async (email, fullName, password) => {
  const res = await axios.post(`${BASE_URL}/signup`, { email, fullName, password });
  return res.data;
};

export const signIn = async (email, password) => {
  const res = await axios.post(`${BASE_URL}/login`, { email, password });
  return { user: res.data.user, token: res.data.token };
};

export const getCurrentSession = async (token) => {
  const res = await axios.get(`${BASE_URL}/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};
