import React, { useState, useEffect } from 'react';
import { 
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, FlatList, Keyboard, TouchableWithoutFeedback 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import api from '../services/api'; // Assure-toi que l'import est bon pour appeler le backend

// 🏥 LISTE DES HÔPITAUX (Raccourcis)
const HOSPITALS = [
  { name: 'Oncopole', address: '1 Avenue Irène Joliot-Curie, 31100 Toulouse' },
  { name: 'Purpan', address: 'Place du Dr Baylac, 31300 Toulouse' },
  { name: 'Rangueil', address: '1 Avenue du Professeur Jean Poulhès, 31400 Toulouse' },
  { name: 'Pasteur', address: '45 Avenue de Lombez, 31300 Toulouse' },
  { name: 'Cèdres', address: 'Château d\'Alliez, 31700 Cornebarrieu' },
  { name: 'Estela', address: 'Clinique Estela, Route de Revel, Toulouse' },
  { name: 'Ducuing', address: '15 Rue de Varsovie, 31300 Toulouse' },
  { name: 'Gare', address: 'Gare Matabiau, 31000 Toulouse' },
  { name: 'Aéroport', address: 'Aéroport Toulouse-Blagnac, 31700 Blagnac' },
];

export default function RideCreatorModal({ visible, onClose, initialData, onSave }) {
  const [formData, setFormData] = useState({
    patientName: '', patientPhone: '', startLocation: '', endLocation: '', 
    date: new Date(), type: 'Aller', _id: null
  });
  
  const [showPicker, setShowPicker] = useState(false);
  
  // États pour l'autocomplétion Patient
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFieldForHospital, setActiveFieldForHospital] = useState(null); // 'start' ou 'end'

  // Chargement initial
  useEffect(() => {
    if (initialData) {
        const dateString = initialData.date || initialData.startTime;
        const dateObject = dateString ? new Date(dateString) : new Date();

        setFormData({
            _id: initialData._id || null, // Important pour la modification
            patientName: initialData.patientName || '',
            patientPhone: initialData.patientPhone || '',
            startLocation: initialData.startLocation || '',
            endLocation: initialData.endLocation || '',
            type: initialData.type || 'Aller',
            date: dateObject
        });
        setSuggestions([]); // Reset suggestions
    }
  }, [initialData]);

  // 🔍 RECHERCHE PATIENT DYNAMIQUE
  const handleNameChange = async (text) => {
    setFormData(prev => ({ ...prev, patientName: text }));
    
    if (text.length > 1) {
        try {
            const res = await api.get(`/patients/search?query=${text}`);
            if (res.data && res.data.length > 0) {
                setSuggestions(res.data);
                setShowSuggestions(true);
            } else {
                setShowSuggestions(false);
            }
        } catch (e) {
            console.log("Erreur recherche patient", e);
        }
    } else {
        setShowSuggestions(false);
    }
  };

  // QUAND ON CLIQUE SUR UN PATIENT SUGGÉRÉ
  const selectPatient = (patient) => {
      setFormData(prev => ({
          ...prev,
          patientName: patient.fullName,
          patientPhone: patient.phone || prev.patientPhone,
          // Optionnel : Si c'est un départ domicile, on peut pré-remplir l'adresse
          startLocation: (prev.type === 'Aller' && !prev.startLocation) ? patient.address : prev.startLocation,
          endLocation: (prev.type === 'Retour' && !prev.endLocation) ? patient.address : prev.endLocation
      }));
      setShowSuggestions(false);
      Keyboard.dismiss();
  };

  // QUAND ON CLIQUE SUR UN HÔPITAL
  const insertAddress = (address) => {
      if (activeFieldForHospital === 'start') {
          setFormData(prev => ({ ...prev, startLocation: address }));
      } else if (activeFieldForHospital === 'end') {
          setFormData(prev => ({ ...prev, endLocation: address }));
      } else {
          // Par défaut, si aucun champ focus, on remplit selon le type
          if (formData.type === 'Aller') setFormData(prev => ({ ...prev, endLocation: address }));
          else setFormData(prev => ({ ...prev, startLocation: address }));
      }
  };

  const handleSave = () => {
    if (!formData.patientName || !formData.startLocation) {
        return Alert.alert("Erreur", "Nom et Départ obligatoires.");
    }
    onSave(formData);
    // On ne ferme pas ici, c'est le parent qui gère
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>{formData._id ? "Modifier Course ✏️" : "Nouvelle Course 🚕"}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color="#666"/></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{paddingBottom: 40}} keyboardShouldPersistTaps="handled">
            
            {/* --- CHAMP NOM (AVEC AUTOCOMPLETE) --- */}
            <Text style={styles.label}>Patient</Text>
            <View style={{ zIndex: 10 }}> 
                <TextInput 
                    style={styles.input} 
                    placeholder="Nom du patient" 
                    value={formData.patientName} 
                    onChangeText={handleNameChange} 
                />
                {/* LISTE DÉROULANTE SUGGESTIONS */}
                {showSuggestions && (
                    <View style={styles.suggestionsContainer}>
                        {suggestions.map((p) => (
                            <TouchableOpacity key={p._id} style={styles.suggestionItem} onPress={() => selectPatient(p)}>
                                <Text style={styles.suggestionText}>{p.fullName}</Text>
                                <Text style={styles.suggestionSubText}>{p.address}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <Text style={styles.label}>Téléphone</Text>
            <TextInput 
                style={styles.input} 
                placeholder="06..." 
                keyboardType="phone-pad" 
                value={formData.patientPhone} 
                onChangeText={t => setFormData({...formData, patientPhone: t})} 
            />

            <Text style={styles.label}>Heure</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
                <Text style={styles.dateText}>
                    {moment(formData.date).format('DD/MM à HH:mm')}
                </Text>
                <Ionicons name="time" size={20} color="#333"/>
            </TouchableOpacity>
            
            {showPicker && (
                <DateTimePicker 
                    value={formData.date} 
                    mode="datetime" 
                    is24Hour={true} 
                    display="spinner"
                    onChange={(e, d) => { setShowPicker(false); if(d) setFormData({...formData, date: d}); }}
                />
            )}

            {/* --- ADRESSES AVEC RACCOURCIS HÔPITAUX --- */}
            <Text style={styles.label}>Départ 🏠</Text>
            <TextInput 
                style={[styles.input, activeFieldForHospital === 'start' && styles.inputActive]} 
                placeholder="Adresse de départ" 
                value={formData.startLocation} 
                onFocus={() => setActiveFieldForHospital('start')}
                onChangeText={t => setFormData({...formData, startLocation: t})} 
                multiline 
            />

            <Text style={styles.label}>Destination 🏥</Text>
            <TextInput 
                style={[styles.input, activeFieldForHospital === 'end' && styles.inputActive]} 
                placeholder="Adresse d'arrivée" 
                value={formData.endLocation} 
                onFocus={() => setActiveFieldForHospital('end')}
                onChangeText={t => setFormData({...formData, endLocation: t})} 
                multiline 
            />

            {/* BARRE DE RACCOURCIS HÔPITAUX */}
            <View style={styles.hospitalsContainer}>
                <Text style={styles.quickLabel}>Raccourcis Lieux :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 5}}>
                    {HOSPITALS.map((h, index) => (
                        <TouchableOpacity key={index} style={styles.hospitalChip} onPress={() => insertAddress(h.address)}>
                            <Text style={styles.hospitalText}>{h.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
            
            {/* TYPE DE COURSE */}
            <View style={styles.typeContainer}>
                {['Aller', 'Retour', 'Consultation'].map(type => (
                    <TouchableOpacity 
                        key={type} 
                        style={[styles.typeBtn, formData.type === type && styles.typeBtnActive]} 
                        onPress={() => setFormData({...formData, type})}
                    >
                        <Text style={[styles.typeText, formData.type === type && {color: '#FFF'}]}>{type}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{formData._id ? "ENREGISTRER MODIFICATION" : "VALIDER LA COURSE"}</Text>
            </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 20, paddingTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 13, fontWeight: 'bold', color: '#666', marginTop: 12, marginBottom: 5 },
  input: { backgroundColor: '#F5F5F5', padding: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#EEE' },
  inputActive: { borderColor: '#2196F3', backgroundColor: '#E3F2FD' }, // Effet visuel focus
  
  dateBtn: { backgroundColor: '#F5F5F5', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 18, fontWeight: 'bold' },
  
  // SUGGESTIONS FLOTTANTES
  suggestionsContainer: {
      position: 'absolute', top: 50, left: 0, right: 0,
      backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#DDD',
      elevation: 5, zIndex: 100, maxHeight: 150
  },
  suggestionItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  suggestionText: { fontWeight: 'bold', fontSize: 16 },
  suggestionSubText: { color: '#666', fontSize: 12 },

  // RACCOURCIS HÔPITAUX
  hospitalsContainer: { marginTop: 10, marginBottom: 5 },
  quickLabel: { fontSize: 12, color: '#999', fontWeight: 'bold' },
  hospitalChip: { backgroundColor: '#E0E0E0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginRight: 8 },
  hospitalText: { fontSize: 12, fontWeight: '600', color: '#333' },

  typeContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  typeBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#EEE' },
  typeBtnActive: { backgroundColor: '#FF6B00' },
  typeText: { fontWeight: 'bold', color: '#333' },
  
  saveBtn: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});