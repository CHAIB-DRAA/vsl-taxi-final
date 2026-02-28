import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, Alert, Platform, Switch, StyleSheet, 
  Modal, FlatList 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

// Assure-toi que ces fonctions existent dans ton api.js (même vides pour tester)
import { getPatients, createPatient } from '../services/api';

const RideForm = ({ onCreate }) => {
  // --- STATES FORMULAIRE ---
  const [patientName, setPatientName] = useState('');
  const [dateTime, setDateTime] = useState(null);
  const [returnDateTime, setReturnDateTime] = useState(null);
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);

  // --- STATES PICKER DATE ---
  const [showPicker, setShowPicker] = useState(false);
  const [mode, setMode] = useState('date');
  const [isReturn, setIsReturn] = useState(false);

  // --- STATES PATIENTS (NOUVEAU) ---
  const [allPatients, setAllPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // --- STATES MODAL CRÉATION ---
  const [modalVisible, setModalVisible] = useState(false);
  const [newPatient, setNewPatient] = useState({ fullName: '', phone: '', address: '' });

  // 1. CHARGEMENT INITIAL
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await getPatients();
      setAllPatients(data || []);
    } catch (err) {
      console.log("Erreur chargement patients", err);
    }
  };

  // 2. GESTION NOM + AUTO-COMPLÉTION
  const handleNameChange = (text) => {
    setPatientName(text);
    if (text.length > 1) {
      const filtered = allPatients.filter(p => 
        p.fullName && p.fullName.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredPatients(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectPatient = (patient) => {
    setPatientName(patient.fullName);
    if (patient.address) setStartLocation(patient.address);
    setShowSuggestions(false);
  };

  // 3. SAUVEGARDE NOUVEAU PATIENT
  const saveNewPatient = async () => {
    if (!newPatient.fullName) return Alert.alert("Erreur", "Nom requis");
    
    try {
      // Simulation appel API
      const saved = await createPatient(newPatient);
      // Mise à jour locale
      setAllPatients([...allPatients, saved]);
      
      // Sélection automatique
      setPatientName(saved.fullName);
      setStartLocation(saved.address);
      
      setModalVisible(false);
      setNewPatient({ fullName: '', phone: '', address: '' }); // Reset
      Alert.alert("Succès", "Fiche créée et sélectionnée !");
    } catch (err) {
      Alert.alert("Erreur", "Création impossible");
    }
  };

  // 4. CRÉATION COURSE
  const handleCreateRide = () => {
    if (!patientName.trim() || !dateTime || !startLocation.trim() || !endLocation.trim()) {
      return Alert.alert('Erreur', 'Remplissez tous les champs obligatoires');
    }
    if (isRoundTrip && !returnDateTime) {
      return Alert.alert('Erreur', 'Date retour manquante');
    }

    onCreate({
      patientName: patientName.trim(),
      startLocation: startLocation.trim(),
      endLocation: endLocation.trim(),
      date: dateTime.toISOString(),
      returnDate: isRoundTrip ? returnDateTime.toISOString() : null,
      isRoundTrip,
    });

    // Reset complet
    setPatientName(''); setDateTime(null); setReturnDateTime(null);
    setStartLocation(''); setEndLocation(''); setIsRoundTrip(false);
  };

  // --- LOGIQUE DATES ---
  const showMode = (currentMode, returnTrip = false) => {
    setIsReturn(returnTrip);
    setMode(currentMode);
    setShowPicker(true);
  };

  const onChange = (event, selectedDate) => {
    if (!selectedDate) { setShowPicker(false); return; }
    if (isReturn) setReturnDateTime(selectedDate);
    else setDateTime(selectedDate);
    
    if (mode === 'date') setMode('time');
    else setShowPicker(Platform.OS === 'ios');
  };

  return (
    <View style={styles.formContainer}>
      
      {/* --- SECTION 1 : PATIENT --- */}
      <View style={styles.section}>
        
        {/* HEADER MODIFIÉ POUR ÊTRE BIEN VISIBLE */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>PATIENT</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.createBtn}>
            <Ionicons name="add-circle" size={16} color="#FF6B00" />
            <Text style={styles.createBtnText}>Nouveau Patient</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons name="person-outline" size={20} color="#666" style={styles.icon} />
          <TextInput 
            style={styles.textInput} 
            value={patientName} 
            onChangeText={handleNameChange} 
            placeholder="Rechercher ou saisir nom..."
            placeholderTextColor="#999"
          />
          {patientName.length > 0 && (
            <TouchableOpacity onPress={() => {setPatientName(''); setShowSuggestions(false);}}>
              <Ionicons name="close-circle" size={18} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>

        {/* LISTE SUGGESTIONS */}
        {showSuggestions && (
          <View style={styles.suggestionsBox}>
            <FlatList
              data={filteredPatients}
              keyExtractor={(item, index) => item._id || index.toString()}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.suggestionItem} onPress={() => selectPatient(item)}>
                  <Text style={{fontWeight:'bold', color:'#333'}}>{item.fullName}</Text>
                  {item.address ? <Text style={{fontSize:11, color:'#666'}}>{item.address}</Text> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* --- SECTION 2 : TRAJET --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TRAJET</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="location-outline" size={20} color="#FF6B00" style={styles.icon} />
          <TextInput 
            style={styles.textInput} 
            value={startLocation} 
            onChangeText={setStartLocation} 
            placeholder="Lieu de départ (Auto-rempli)" 
          />
        </View>
        <View style={styles.inputWrapper}>
          <Ionicons name="flag-outline" size={20} color="#4CAF50" style={styles.icon} />
          <TextInput 
            style={styles.textInput} 
            value={endLocation} 
            onChangeText={setEndLocation} 
            placeholder="Destination" 
          />
        </View>
      </View>

      {/* --- SECTION 3 : DATE & HEURE --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PLANIFICATION</Text>
        
        <TouchableOpacity onPress={() => showMode('date', false)} style={styles.dateTimeButton}>
          <Ionicons name="calendar-outline" size={20} color="#666" />
          <Text style={styles.dateTimeText}>
            {dateTime
              ? dateTime.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : 'Choisir date de départ'}
          </Text>
        </TouchableOpacity>

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Aller-Retour ?</Text>
          <Switch 
            value={isRoundTrip} 
            onValueChange={setIsRoundTrip}
            trackColor={{ false: "#D1D1D1", true: "#FF6B00" }}
            thumbColor="#FFF"
          />
        </View>

        {isRoundTrip && (
          <TouchableOpacity onPress={() => showMode('date', true)} style={[styles.dateTimeButton, styles.returnButton]}>
            <Ionicons name="calendar" size={20} color="#666" />
            <Text style={styles.dateTimeText}>
              {returnDateTime
                ? returnDateTime.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : 'Choisir date de retour'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* PICKER DATE (Invisible sauf quand actif) */}
      {showPicker && (
        <DateTimePicker
          value={isReturn ? (returnDateTime || new Date()) : (dateTime || new Date())}
          mode={mode}
          is24Hour={true}
          onChange={onChange}
        />
      )}

      {/* BOUTON VALIDER */}
      <TouchableOpacity onPress={handleCreateRide} style={styles.submitButton}>
        <Text style={styles.submitButtonText}>VALIDER LA COURSE</Text>
        <Ionicons name="checkmark-circle" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* --- MODAL CRÉATION PATIENT --- */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouveau Patient</Text>
            
            <View style={styles.modalField}>
              <Text style={styles.label}>Nom Complet *</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Ex: Mme Dupont" 
                value={newPatient.fullName}
                onChangeText={t => setNewPatient({...newPatient, fullName: t})}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.label}>Adresse (Départ par défaut)</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Ex: 12 Rue des Lilas..." 
                value={newPatient.address}
                onChangeText={t => setNewPatient({...newPatient, address: t})}
              />
            </View>
            
            <View style={styles.modalField}>
              <Text style={styles.label}>Téléphone</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Ex: 06 12 34 56 78" 
                keyboardType="phone-pad"
                value={newPatient.phone}
                onChangeText={t => setNewPatient({...newPatient, phone: t})}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtnCancel}>
                <Text style={styles.modalBtnTextCancel}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNewPatient} style={styles.modalBtnSave}>
                <Text style={styles.modalBtnTextSave}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  formContainer: { backgroundColor: '#F8F9FA', borderRadius: 20, paddingBottom: 20 },
  section: { marginBottom: 20 },
  
  // HEADER DE SECTION (TITRE + BOUTON CRÉER)
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 5
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0', // Fond orange très clair
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFE0B2'
  },
  createBtnText: {
    color: '#FF6B00',
    fontWeight: 'bold',
    fontSize: 11,
    marginLeft: 5
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEE',
    elevation: 2,
  },
  icon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 16, color: '#333' },
  
  // SUGGESTIONS
  suggestionsBox: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    maxHeight: 180,
    elevation: 5,
    marginTop: -5,
    zIndex: 1000 // Important pour passer au-dessus
  },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },

  // DATES
  dateTimeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#EEE', marginBottom: 10 },
  dateTimeText: { marginLeft: 10, fontSize: 15, color: '#333', fontWeight: '500' },
  returnButton: { borderLeftWidth: 4, borderLeftColor: '#FF6B00' },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5 },
  switchLabel: { fontSize: 16, fontWeight: '600', color: '#444' },
  
  // BOUTON VALIDER
  submitButton: { backgroundColor: '#FF6B00', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 15, marginTop: 10, elevation: 5, shadowColor:'#FF6B00', shadowOpacity:0.3, shadowOffset:{width:0,height:4} },
  submitButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginRight: 10 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 25, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
  modalField: { marginBottom: 15 },
  label: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight: '600' },
  modalInput: { backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtnCancel: { padding: 15, flex: 1, alignItems: 'center' },
  modalBtnSave: { backgroundColor: '#FF6B00', padding: 15, borderRadius: 10, flex: 1, alignItems: 'center', marginLeft: 10 },
  modalBtnTextCancel: { color: '#666', fontWeight: 'bold' },
  modalBtnTextSave: { color: '#FFF', fontWeight: 'bold' }
});

export default RideForm;