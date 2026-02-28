import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api, { getRides, getContacts } from '../services/api'; // Assure-toi d'importer getContacts
import { Alert } from 'react-native';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [allRides, setAllRides] = useState([]);
  const [contacts, setContacts] = useState([]); // 👇 C'est ici que sont stockés les contacts
  const [loading, setLoading] = useState(true);

  // --- FONCTION DE CHARGEMENT GLOBALE ---
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      console.log("🔄 Chargement des données...");

      // 1. Charger les Courses
      const ridesRes = await getRides();
      setAllRides(ridesRes);

      // 2. Charger les Contacts (C'est ce qui te manquait peut-être)
      try {
        const contactsRes = await api.get('/contacts'); // Appel direct à la route
        console.log("✅ Contacts chargés :", contactsRes.data.length);
        setContacts(contactsRes.data);
      } catch (err) {
        console.log("⚠️ Erreur chargement contacts :", err);
        // On ne bloque pas l'app si les contacts échouent, on met juste un tableau vide
        setContacts([]);
      }

    } catch (error) {
      console.error("❌ Erreur chargement global :", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // --- ACTIONS ---
  const handleGlobalRespond = async (rideId, status) => {
    try {
      await api.put(`/rides/${rideId}/respond`, { status });
      await loadData(false); // Recharge sans spinner
    } catch (e) {
      Alert.alert("Erreur", "Impossible de répondre.");
    }
  };

  // Chargement initial au lancement de l'app
  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <DataContext.Provider value={{ 
      allRides, 
      contacts, // On partage les contacts avec toute l'app
      loading, 
      loadData, 
      handleGlobalRespond 
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);