import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { updateRideStatus } from '../services/api';

const RideDetailScreen = ({ route, navigation }) => {
  const { ride } = route.params;

  const handleUpdateStatus = async () => {
    try {
      const newStatus = ride.status === 'facturé' ? 'non facturé' : 'facturé';
      await updateRideStatus(ride._id, newStatus);
      Alert.alert('Succès', `La course est maintenant "${newStatus}"`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Erreur mise à jour :', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{ride.patientName}</Text>
      <Text>Date : {new Date(ride.date).toLocaleDateString()}</Text>
      <Text>Départ : {ride.startLocation}</Text>
      <Text>Arrivée : {ride.endLocation}</Text>
      <Text>Type : {ride.type}</Text>
      <Text>Distance : {ride.distance} km</Text>
      <Text>Statut : {ride.status || 'non défini'}</Text>

      <TouchableOpacity style={styles.button} onPress={handleUpdateStatus}>
        <Text style={styles.buttonText}>Basculer statut</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontWeight: 'bold', fontSize: 20, marginBottom: 10 },
  button: {
    marginTop: 20,
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 6,
  },
  buttonText: { color: '#fff', textAlign: 'center', fontSize: 16 },
});

export default RideDetailScreen;
