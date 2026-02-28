import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Alert, Vibration 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import moment from 'moment';

// 👇 1. IMPORT AUDIO
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

export default function IncomingOfferToast({ onRideAccepted }) {
  const [offer, setOffer] = useState(null);
  const [ignoredIds, setIgnoredIds] = useState([]); 
  
  // Gestion du son
  const [sound, setSound] = useState();

  const offerRef = useRef(offer);
  const ignoredIdsRef = useRef(ignoredIds);
  const slideAnim = useRef(new Animated.Value(-200)).current; 

  useEffect(() => { offerRef.current = offer; }, [offer]);
  useEffect(() => { ignoredIdsRef.current = ignoredIds; }, [ignoredIds]);

  // 👇 2. FONCTION POUR JOUER LE SON ET VIBRER
  const triggerAlert = async () => {
    // A. Vibration (Pattern : attendre 0ms, vibrer 500ms, pause 200ms, vibrer 500ms)
    Vibration.vibrate([0, 500, 200, 500]);

    // B. Son
    try {
        const { sound } = await Audio.Sound.createAsync(
            require('../assets/notification.mp3') // ⚠️ Assure-toi d'avoir ce fichier !
        );
        setSound(sound);
        await sound.playAsync();
    } catch (error) {
        console.log("Erreur lecture son (fichier manquant ?)", error);
    }
  };

  // Nettoyage du son quand on quitte
  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  // POLLING
  useEffect(() => {
    let isMounted = true; 

    const checkOffers = async () => {
      try {
        const res = await api.get('/dispatch/my-offers');
        const currentIgnoredIds = ignoredIdsRef.current;
        const currentOffer = offerRef.current;
        const validOffers = res.data.filter(o => !currentIgnoredIds.includes(o._id));

        if (validOffers.length > 0) {
          const newOffer = validOffers[0];
          // Si c'est une nouvelle offre
          if (!currentOffer || currentOffer._id !== newOffer._id) {
            if (isMounted) {
                setOffer(newOffer);
                slideDown();
                
                // 👇 3. ON DÉCLENCHE L'ALERTE ICI !
                triggerAlert();
            }
          }
        } else {
            if (currentOffer) {
                slideUp(() => { if (isMounted) setOffer(null); });
            }
        }
      } catch (e) { }
    };

    checkOffers();
    const interval = setInterval(checkOffers, 10000); 
    return () => { isMounted = false; clearInterval(interval); };
  }, []); 

  // ANIMATIONS
  const slideDown = () => { Animated.spring(slideAnim, { toValue: 50, useNativeDriver: true }).start(); };
  const slideUp = (callback) => { Animated.timing(slideAnim, { toValue: -200, duration: 300, useNativeDriver: true }).start(callback); };

  // --- ACTIONS ---
  const handleAccept = async () => {
    if (!offer) return;
    try {
      const response = await api.post(`/dispatch/accept/${offer._id}`);
      
      const rideDate = response.data.ride ? response.data.ride.date : offer.rideId.date;
      const formattedDate = moment(rideDate).format('DD/MM');

      Alert.alert("✅ Course Acceptée !", `La course a été ajoutée à votre agenda pour le ${formattedDate}.`);
      
      setIgnoredIds(prev => [...prev, offer._id]);
      slideUp(() => setOffer(null));
      
      if (onRideAccepted) onRideAccepted(rideDate); 

    } catch (e) {
      console.error("Erreur Accept:", e);
      Alert.alert("Oups", "Erreur lors de l'acceptation (ou course déjà prise).");
      setIgnoredIds(prev => [...prev, offer._id]); 
      slideUp(() => setOffer(null));
    }
  };

  const handleRefuse = () => {
    if (!offer) return;
    setIgnoredIds(prev => [...prev, offer._id]);
    slideUp(() => setOffer(null));
  };

  if (!offer) return null;

  const isGroupOffer = !!offer.targetGroupId;
  const groupName = isGroupOffer ? offer.targetGroupId.name : "";

  return (
    <Animated.View style={[styles.toastContainer, { transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.header, isGroupOffer ? {backgroundColor: '#E65100'} : {backgroundColor: '#1565C0'}]}>
        <View style={styles.badgeContainer}>
            <Ionicons name={isGroupOffer ? "people" : "person"} size={16} color={isGroupOffer ? "#E65100" : "#1565C0"} />
            <Text style={[styles.badgeText, isGroupOffer ? {color: '#E65100'} : {color: '#1565C0'}]}>{isGroupOffer ? "GROUPE" : "PRIVÉ"}</Text>
        </View>
        <Text style={styles.sender}>{isGroupOffer ? groupName : offer.senderId?.fullName || "Inconnu"}</Text>
      </View>

      <View style={styles.content}>
        {isGroupOffer && <Text style={styles.senderSub}>De: {offer.senderId?.fullName}</Text>}
        <View style={styles.row}>
            <Ionicons name="calendar" size={16} color="#666" />
            <Text style={styles.time}> {moment(offer.rideId.date).format('DD/MM')} à <Text style={{fontWeight:'bold', color:'#000'}}>{moment(offer.rideId.date).format('HH:mm')}</Text></Text>
        </View>
        <View style={styles.routeContainer}>
            <Text style={styles.route} numberOfLines={1}>📍 {offer.rideId.startLocation}</Text>
            <Ionicons name="arrow-down" size={12} color="#999" style={{marginLeft: 5}}/>
            <Text style={styles.route} numberOfLines={1}>🏁 {offer.rideId.endLocation}</Text>
        </View>
        <View style={styles.typeTag}><Text style={styles.typeText}>{offer.rideId.type}</Text></View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.refuseBtn]} onPress={handleRefuse}>
            <Ionicons name="close-circle" size={20} color="#D32F2F" />
            <Text style={styles.refuseText}>REFUSER</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={handleAccept}>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={styles.acceptText}>ACCEPTER</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: { position: 'absolute', top: 50, left: 15, right: 15, backgroundColor: '#FFF', borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 10, zIndex: 9999, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE' },
  header: { padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontWeight: 'bold', fontSize: 10, marginLeft: 4 },
  sender: { color: '#FFF', fontWeight: 'bold', fontSize: 13, flex: 1, textAlign: 'right' },
  senderSub: { fontSize: 11, color: '#888', marginBottom: 5, fontStyle: 'italic' },
  content: { padding: 15, paddingBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  time: { fontSize: 15, color: '#333', marginLeft: 5 },
  routeContainer: { paddingLeft: 5, borderLeftWidth: 2, borderLeftColor: '#DDD', marginLeft: 7, paddingVertical: 5 },
  route: { fontSize: 14, color: '#333', marginVertical: 2, fontWeight: '500' },
  typeTag: { position: 'absolute', top: 15, right: 15, backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  typeText: { fontSize: 10, color: '#666', fontWeight: 'bold', textTransform: 'uppercase' },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#F0F0F0' },
  btn: { flex: 1, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  refuseBtn: { backgroundColor: '#FFF' },
  refuseText: { color: '#D32F2F', fontWeight: 'bold', marginLeft: 8, fontSize: 13 },
  acceptBtn: { backgroundColor: '#4CAF50' },
  acceptText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8, fontSize: 13 }
});