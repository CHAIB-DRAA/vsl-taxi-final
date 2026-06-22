import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import api, { getRides, cancelRideById } from '../services/api';
import { Alert, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { updateNextRideNotification, syncAllReminders } from '../services/notificationService';
import { scheduleAllUpcomingAlerts } from '../services/geoAlertService';

const REFRESH_THROTTLE_MS = 30_000; // 30s minimum entre deux rechargements automatiques

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [allRides, setAllRides] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ridesError, setRidesError] = useState(null); // null | 'auth' | 'network'
  const lastLoadRef = useRef(0);
  const isLoadingRef = useRef(false);
  const authAlertShownRef = useRef(false);

  const loadData = useCallback(async (showLoading = true) => {
    const now = Date.now();
    if (!showLoading && now - lastLoadRef.current < REFRESH_THROTTLE_MS) return;
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    lastLoadRef.current = now;
    if (showLoading) setLoading(true);
    try {
      const [ridesRes, contactsRes] = await Promise.allSettled([
        getRides(),
        api.get('/contacts'),
      ]);

      if (ridesRes.status === 'fulfilled') {
        setAllRides(ridesRes.value);
        setRidesError(null);
        authAlertShownRef.current = false;
        updateNextRideNotification(ridesRes.value).catch(() => {});
        syncAllReminders(ridesRes.value).catch(() => {});
        scheduleAllUpcomingAlerts(ridesRes.value).catch(() => {});
      } else {
        const httpStatus = ridesRes.reason?.response?.status;
        if (httpStatus === 401 || httpStatus === 403) {
          setRidesError('auth');
          if (!authAlertShownRef.current) {
            authAlertShownRef.current = true;
            Alert.alert(
              'Session expirée',
              'Votre session a expiré. Allez dans Réglages → Déconnexion, puis reconnectez-vous.',
              [{ text: 'OK', onPress: () => { authAlertShownRef.current = false; } }]
            );
          }
        } else {
          setRidesError('network');
        }
      }
      setContacts(contactsRes.status === 'fulfilled' ? contactsRes.value.data : []);
    } catch (error) {
      console.error("Erreur chargement global :", error);
      setRidesError('network');
    } finally {
      isLoadingRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, []);

  // Ajout optimiste d'une course
  const addLocalRide = useCallback((newRide) => {
    setAllRides(prev => [...prev, newRide]);
  }, []);

  const updateLocalRide = useCallback((updatedRide) => {
    setAllRides(prev => {
      const next = prev.map(r => r._id === updatedRide._id ? updatedRide : r);
      updateNextRideNotification(next).catch(() => {});
      return next;
    });
  }, []);

  const removeLocalRide = useCallback((rideId) => {
    setAllRides(prev => {
      const next = prev.filter(r => r._id !== rideId);
      updateNextRideNotification(next).catch(() => {});
      return next;
    });
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

  // Recharge les données quand l'app repasse au premier plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        lastLoadRef.current = 0; // reset throttle pour forcer le rechargement
        loadData(false);
      }
    });
    return () => sub.remove();
  }, [loadData]);

  // Listener push : recharge immédiatement quand une nouvelle demande web arrive
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      const type = notification.request.content.data?.type;
      if (type === 'new_web_booking') {
        // Force le rechargement même si throttle pas encore expiré
        lastLoadRef.current = 0;
        loadData(false);
      }
    });
    return () => sub.remove();
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
      ridesError,
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