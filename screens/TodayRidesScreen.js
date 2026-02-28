// TodayRidesScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  UIManager,
  FlatList,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { getRides, startRideById, finishRideById } from '../services/api';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental &&
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function TodayRidesScreen() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRideId, setCurrentRideId] = useState(null);
  const [distance, setDistance] = useState('');

  const fetchRides = async () => {
    try {
      setLoading(true);
      const data = await getRides();
      const today = new Date().toDateString();

      const visibleRides = data.filter(ride => {
        const rideDate = new Date(ride.date).toDateString();
        const isToday = rideDate === today;
        const isOwn = !ride.isShared;
        const isSharedAccepted = ride.isShared && ride.statusPartage === 'accepted';
        return isToday && (isOwn || isSharedAccepted);
      }).sort((a, b) => (!a.startTime ? -1 : 0));

      setRides(visibleRides);
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur', 'Impossible de récupérer les courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRides(); }, []);

  const handleStartRide = async id => {
    try {
      await startRideById(id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      fetchRides();
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur', 'Impossible de démarrer la course.');
    }
  };

  const handleFinishRide = id => {
    setCurrentRideId(id);
    setDistance('');
    setModalVisible(true);
  };

  const submitDistance = async () => {
    const parsedDistance = parseFloat(distance?.trim());
    if (!parsedDistance || isNaN(parsedDistance)) {
      Alert.alert('Erreur', 'Veuillez entrer une distance valide.');
      return;
    }
    try {
      await finishRideById(currentRideId, parsedDistance);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setModalVisible(false);
      setCurrentRideId(null);
      setDistance('');
      fetchRides();
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur', 'Impossible de terminer la course.');
    }
  };

  const renderRightActions = item => {
    if (!item.startTime || item.endTime) return null;
    return (
      <TouchableOpacity
        style={styles.swipeButton}
        onPress={() => handleFinishRide(item._id)}
      >
        <Text style={styles.swipeButtonText}>Terminer</Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    let statusText = 'Non démarrée';
    let buttonLabel = 'Démarrer';
    let buttonAction = () => handleStartRide(item._id);
    let cardBackground = '#e3f2fd';
    let buttonColor = '#007bff';
    let textColor = '#000';

    if (item.startTime && !item.endTime) {
      statusText = 'En cours';
      buttonLabel = 'Terminer';
      buttonAction = () => handleFinishRide(item._id);
      cardBackground = '#ffe0b2';
      buttonColor = '#FF9800';
    } else if (item.endTime) {
      statusText = 'Terminée';
      buttonLabel = '✓';
      buttonAction = null;
      cardBackground = '#eeeeee';
      textColor = '#777';
      buttonColor = '#9E9E9E';
    }

    return (
      <Swipeable renderRightActions={() => renderRightActions(item)}>
        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          {item.endTime && (
            <View style={styles.finishedBadge}>
              <Text style={styles.finishedText}>Terminée</Text>
            </View>
          )}
          <Text style={[styles.title, { color: textColor }]}>{item.patientName}</Text>
          <Text style={{ color: textColor }}>Date : {new Date(item.date).toLocaleDateString()}</Text>
          <Text style={{ color: textColor }}>Départ : {item.startLocation}</Text>
          <Text style={{ color: textColor }}>Arrivée : {item.endLocation}</Text>
          <Text style={{ color: textColor }}>Statut : {statusText}</Text>

          {buttonAction && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonColor }]}
              onPress={buttonAction}
            >
              <Text style={styles.buttonText}>{buttonLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Swipeable>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rides}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.container}
        ListEmptyComponent={() => (
          <View style={styles.center}>
            <Text>Aucune course pour aujourd'hui.</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.floatingButton} onPress={fetchRides}>
        <Text style={styles.floatingButtonText}>Actualiser</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Distance parcourue (km)</Text>
            <TextInput
              value={distance}
              onChangeText={setDistance}
              placeholder="Ex: 10"
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.button, { backgroundColor: '#9E9E9E', flex: 0.45 }]}
              >
                <Text style={styles.buttonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitDistance}
                style={[styles.button, { backgroundColor: '#4CAF50', flex: 0.45 }]}
              >
                <Text style={styles.buttonText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { padding: 15, marginVertical: 8, borderRadius: 12, elevation: 3, position: 'relative', shadowColor: "#000", shadowOffset: { width:0, height:2 }, shadowOpacity:0.1, shadowRadius:4 },
  title: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  button: { marginTop: 10, padding: 12, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  floatingButton: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#FF6B00', padding: 15, borderRadius: 50, elevation: 5 },
  floatingButtonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  finishedBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, zIndex: 10 },
  finishedText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  swipeButton: { backgroundColor: '#FF9800', justifyContent: 'center', alignItems: 'center', width: 90, marginVertical: 8, borderRadius: 8 },
  swipeButtonText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { width: '80%', backgroundColor: '#fff', padding: 20, borderRadius: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 12, marginBottom: 10 },
});
