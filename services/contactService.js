import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://vsl-taxi.onrender.com/api';

const getConfig = async () => {
  const token = await AsyncStorage.getItem('token');
  if (!token) throw new Error('Token manquant');
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const getContacts = async () => {
  const config = await getConfig();
  const res = await axios.get(`${API_BASE}/contacts`, config);
  return res.data;
};

export const addContact = async (contactId) => {
  const config = await getConfig();
  const res = await axios.post(`${API_BASE}/contacts`, { contactId }, config);
  return res.data;
};

export const deleteContact = async (id) => {
  const config = await getConfig();
  const res = await axios.delete(`${API_BASE}/contacts/${id}`, config);
  return res.data;
};

export const searchUsers = async (query = '') => {
  const config = await getConfig();
  const res = await axios.get(`${API_BASE}/user/search?q=${encodeURIComponent(query)}`, config);
  return res.data;
};