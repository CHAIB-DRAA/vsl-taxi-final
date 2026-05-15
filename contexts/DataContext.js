import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import api, { getRides, cancelRideById } from '../services/api';
import { Alert } from 'react-native';

const REFRESH_THROTTLE_MS = 30_000; // 30s minimum entre deux rechargements automatiques

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [allRides, setAllRides] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastLoadRef = useRef(0);
  const isLoadingRef = useRef(false); // garde contre les appels concurrents

  const loadData = useCallback(async (showLoading = true) => {
    const now = Date.now();
    // Throttle : si ce n'est pas un rechargement explicite (showLoading=false)
    // et qu'on a chargé il y a moins de 30s, on ignore
    if (!showLoading && now - lastLoadRef.current < REFRESH_THROTTLE_MS) return;
    // Garde contre les appels parallèles
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    lastLoadRef.current = now;
    if (showLoading) setLoading(true);
    try {
      // Les deux requêtes en parallèle
      const [ridesRes, contactsRes] = await Promise.allSettled([
        getRides(),
        api.get('/contacts'),
      ]);

      if (ridesRes.status === 'fulfilled') setAllRides(ridesRes.value);
      setContacts(contactsRes.status === 'fulfilled' ? contactsRes.value.data : []);
    } catch (error) {
      console.error("Erreur chargement global :", error);
    } finally {
      isLoadingRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, []);

  // Ajout optimiste d'une course
  const addLocalRide = useCallback((newRide) => {
    setAllRides(prev => [...prev, newRide]);
  }, []);

  // Mise à jour optimiste d'une course dans la liste locale
  const updateLocalRide = useCallback((updatedRide) => {
    setAllRides(prev => prev.map(r => r._id === updatedRide._id ? updatedRide : r));
  }, []);

  // Suppression optimiste d'une course
  const removeLocalRide = useCallback((rideId) => {
    setAllRides(prev => prev.filter(r => r._id !== rideId));
  }, []);

  // Répondre à une invitation de partage (accepter/refuser)
  const handleGlobalRespond = async (rideId, action) => {
    try {
      await api.post('/rides/respond-share', { rideId, action });
      await loadData(false);
    } catch {
      Alert.alert("Erreur", "Impossible de répondre à l'invitation.");
    }
  };

  // Annuler une course
  const handleCancelRide = async (rideId, reason = '') => {
    try {
      const updated = await cancelRideById(rideId, reason);
      updateLocalRide(updated);
    } catch {
      Alert.alert("Erreur", "Impossible d'annuler la course.");
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Première invitation en attente de réponse
  const pendingInvitation = allRides.find(
    r => r.isShared && (r.shareStatus === 'pending' || r.statusPartage === 'pending')
  ) || null;

  return (
    <DataContext.Provider value={{
      allRides,
      contacts,
      loading,
      loadData,
      addLocalRide,
      updateLocalRide,
      removeLocalRide,
      handleGlobalRespond,
      handleCancelRide,
      pendingInvitation,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);