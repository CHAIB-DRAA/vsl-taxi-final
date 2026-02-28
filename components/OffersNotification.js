import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import moment from 'moment';

export default function OffersNotification() {
  const [offers, setOffers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Vérifie les offres toutes les 30 secondes (Polling simple)
  useEffect(() => {
    checkOffers();
    const interval = setInterval(checkOffers, 30000); 
    return () => clearInterval(interval);
  }, []);

  const checkOffers = async () => {
    try {
      const res = await api.get('/dispatch/my-offers');
      setOffers(res.data);
    } catch (e) {
      console.log("Pas d'offres ou erreur réseau");
    }
  };

  const acceptOffer = async (dispatchId) => {
      try {
          await api.post(`/dispatch/accept/${dispatchId}`);
          Alert.alert("Bravo !", "La course est ajoutée à votre agenda.");
          setModalVisible(false);
          checkOffers(); // Rafraîchir
      } catch(e) {
          Alert.alert("Trop tard", "Course déjà prise par un autre.");
      }
  };

  return (
    <>
      {/* CLOCHE DE NOTIFICATION */}
      <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.bellBtn}>
        <Ionicons name="notifications" size={24} color="#333" />
        {offers.length > 0 && (
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{offers.length}</Text>
            </View>
        )}
      </TouchableOpacity>

      {/* MODAL LISTE DES OFFRES */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
            <Text style={styles.title}>Offres reçues 📡</Text>
            <FlatList 
                data={offers}
                keyExtractor={item => item._id}
                renderItem={({item}) => (
                    <View style={styles.offerCard}>
                        <Text style={styles.sender}>De : {item.senderId.fullName}</Text>
                        <Text style={styles.route}>{item.rideId.startLocation} ➔ {item.rideId.endLocation}</Text>
                        <Text style={styles.time}>📅 {moment(item.rideId.date).format('DD/MM à HH:mm')}</Text>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptOffer(item._id)}>
                            <Text style={styles.acceptText}>ACCEPTER LA COURSE</Text>
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={<Text style={{textAlign:'center', marginTop:50}}>Aucune offre en attente.</Text>}
            />
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={{color:'#FFF', fontWeight:'bold'}}>Fermer</Text>
            </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
    bellBtn: { marginRight: 15, position: 'relative' },
    badge: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    container: { flex: 1, padding: 20, backgroundColor: '#F5F5F5' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    offerCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, marginBottom: 15 },
    sender: { color: '#6200EE', fontWeight: 'bold', marginBottom: 5 },
    route: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
    time: { color: '#666', marginBottom: 15 },
    acceptBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center' },
    acceptText: { color: '#FFF', fontWeight: 'bold' },
    closeBtn: { backgroundColor: '#333', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 }
});