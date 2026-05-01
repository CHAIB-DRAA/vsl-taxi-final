import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import ScreenWrapper from '../components/ScreenWrapper';
import api from '../services/api';

export default function EditRideScreen({ navigation, route }) {
  // On récupère la course transmise par l'Agenda
  const { ride } = route.params;

  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // États pré-remplis avec les données de la course existante
  const [form, setForm] = useState({
    patientName: ride.patientName,
    patientPhone: ride.patientPhone || '',
    startLocation: ride.startLocation,
    endLocation: ride.endLocation,
    date: new Date(ride.date),
    type: ride.type,
    notes: ride.notes || '',
  });

  const handleUpdate = async () => {
    if (!form.patientName || !form.startLocation || !form.endLocation) {
      return Alert.alert("Champs requis", "Le nom et l'itinéraire sont obligatoires.");
    }

    setLoading(true);
    try {
      // 🔄 On utilise l'ID de la course pour faire le PUT
      await api.put(`/rides/${ride._id}`, {
        ...form,
        date: form.date.toISOString()
      });
      
      Vibration.vibrate(50);
      Alert.alert("Succès", "La course a été mise à jour.");
      navigation.goBack(); // Retour automatique à l'agenda
    } catch (error) {
      Alert.alert("Erreur", "Impossible de modifier la course.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper style={{backgroundColor: '#F3F4F6'}}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={{padding: 20}}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.title}>Modifier la course</Text>
            <View style={{width: 28}} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>PATIENT</Text>
            <TextInput 
              style={styles.input} 
              value={form.patientName} 
              onChangeText={(t) => setForm({...form, patientName: t})} 
            />

            <Text style={styles.label}>PRISE EN CHARGE</Text>
            <TextInput 
              style={styles.input} 
              value={form.startLocation} 
              onChangeText={(t) => setForm({...form, startLocation: t})} 
            />

            <Text style={styles.label}>DESTINATION</Text>
            <TextInput 
              style={styles.input} 
              value={form.endLocation} 
              onChangeText={(t) => setForm({...form, endLocation: t})} 
            />

            <Text style={styles.label}>DATE & HEURE</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color="#FF6B00" />
              <Text style={styles.dateText}>{moment(form.date).format('LLLL')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>ENREGISTRER</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker 
          value={form.date} 
          mode="datetime" 
          display="default" 
          onChange={(e, d) => { setShowDatePicker(false); if(d) setForm({...form, date: d}); }} 
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  label: { fontSize: 11, fontWeight: '900', color: '#9CA3AF', marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 15, marginBottom: 20, fontSize: 16, fontWeight: '600', color: '#111' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 15, borderRadius: 12 },
  dateText: { marginLeft: 10, fontSize: 16, fontWeight: '600', color: '#111' },
  saveBtn: { backgroundColor: '#111', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 30 },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 }
});