import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, Switch, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import 'moment/locale/fr';

// Composants & Services
import AddressAutocomplete from '../components/AddressAutocomplete'; 
import { createRide, getPatients, createPatient } from '../services/api';
import ScreenWrapper from '../components/ScreenWrapper';
import { useData } from '../contexts/DataContext'; 

const TOULOUSE_HOSPITALS = [
  "Purpan", "Rangueil", "Oncopole", 
  "Clinique Pasteur", "Cèdres", "Rive Gauche",
  "Médipôle", "St-Exupéry",
  "Clinique Estella", "Hôpital Larrey", 
  "Clinique Croix du Sud", "Clinique de l'Union"
];

export default function CreateRideScreen({ navigation, route }) {
  const { allRides } = useData();

  // --- STATES ---
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState(''); 
  const [patientAddressMem, setPatientAddressMem] = useState(''); 
  
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  
  const [notes, setNotes] = useState(''); 

  const [date, setDate] = useState(new Date()); 
  const [returnDate, setReturnDate] = useState(new Date()); 
  
  const [dateMode, setDateMode] = useState('start'); 
  const [pickerMode, setPickerMode] = useState('date'); 
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [type, setType] = useState('Aller');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  
  const [loading, setLoading] = useState(false); // Chargement global (sauvegarde)
  const [patientsLoading, setPatientsLoading] = useState(false); // Chargement liste patients
  const [errorLoading, setErrorLoading] = useState(false); // Erreur chargement patients

  const [allPatients, setAllPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [newPatient, setNewPatient] = useState({ fullName: '', phone: '', address: '' });

  // --- 1. CHARGEMENT INITIAL ---
  useEffect(() => { loadPatients(); }, []);
  
  // --- 2. RÉCEPTION DONNÉES IA (MAGIC PASTE) ---
  useEffect(() => {
    if (route.params?.importedData) {
        const data = route.params.importedData;
        console.log("📥 Données reçues du Magic Paste :", data);

        if (data.patientName) setPatientName(data.patientName);
        if (data.patientPhone) setPatientPhone(data.patientPhone);
        if (data.startLocation) setStartLocation(data.startLocation);
        if (data.endLocation) setEndLocation(data.endLocation);
        if (data.type) setType(data.type);
        if (data.notes) setNotes(data.notes);

        if (data.date) setDate(new Date(data.date));
        else if (data.startTime) setDate(new Date(data.startTime));

        navigation.setParams({ importedData: null });
    }
  }, [route.params]);

  // --- 3. FONCTIONS LOGIQUES ---

  // Chargement robuste des patients avec gestion d'erreur
  const loadPatients = async () => {
    setPatientsLoading(true);
    setErrorLoading(false);
    try {
      const data = await getPatients();
      setAllPatients(data || []);
    } catch (err) { 
      console.log("Erreur chargement patients:", err);
      setErrorLoading(true);
    } finally {
      setPatientsLoading(false);
    }
  };

  const recentDestinations = useMemo(() => {
    if (!patientName || patientName.length < 2) return [];
    const history = allRides.filter(r => 
      r.patientName && 
      r.patientName.toLowerCase().trim() === patientName.toLowerCase().trim()
    );
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    const uniqueLocs = [...new Set(history.map(r => r.endLocation))].filter(l => l);
    return uniqueLocs.slice(0, 3);
  }, [patientName, allRides]);

  const handleNameChange = (text) => {
    setPatientName(text);
    if (text.length > 0) {
      const filtered = allPatients.filter(p => p.fullName.toLowerCase().includes(text.toLowerCase()));
      setFilteredPatients(filtered);
      setShowSuggestions(true);
    } else { setShowSuggestions(false); }
  };

  const selectPatient = (patient) => {
    setPatientName(patient.fullName);
    setPatientPhone(patient.phone || '');
    setPatientAddressMem(patient.address || ''); 
    if (patient.address) {
      if (type === 'Retour') setEndLocation(patient.address);
      else setStartLocation(patient.address);
    }
    setShowSuggestions(false);
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    if (startLocation && endLocation) {
        const temp = startLocation; setStartLocation(endLocation); setEndLocation(temp);
    } else if (patientAddressMem) {
        if (newType === 'Retour') { setEndLocation(patientAddressMem); if (startLocation === patientAddressMem) setStartLocation(''); } 
        else { setStartLocation(patientAddressMem); if (endLocation === patientAddressMem) setEndLocation(''); }
    }
  };

  const selectHospital = (hospital) => {
    const fullHospitalAddress = hospital.includes("Toulouse") ? hospital : `${hospital}, Toulouse`;
    if (type === 'Retour') setStartLocation(fullHospitalAddress);
    else setEndLocation(fullHospitalAddress);
  };

  const swapAddresses = () => {
    const temp = startLocation; setStartLocation(endLocation); setEndLocation(temp);
  };

  const openDatePicker = (target) => {
    setDateMode(target);
    if (Platform.OS === 'ios') setPickerMode('datetime');
    else setPickerMode('date');
    setShowDatePicker(true);
  };

  const onChangeDate = (event, selectedDate) => {
    if (event.type === 'dismissed') { setShowDatePicker(false); return; }
    const currentDate = selectedDate || (dateMode === 'start' ? date : returnDate);
    if (Platform.OS === 'android') setShowDatePicker(false);

    if (dateMode === 'start') {
      setDate(currentDate);
      if (currentDate > returnDate) setReturnDate(currentDate);
    } else {
      if (currentDate < date) Alert.alert("Erreur", "Le retour ne peut pas être avant l'aller.");
      else setReturnDate(currentDate);
    }

    if (Platform.OS === 'android' && pickerMode === 'date') {
      setPickerMode('time');
      setTimeout(() => setShowDatePicker(true), 100);
    }
  };

  const saveNewPatient = async () => {
    if (!newPatient.fullName) return Alert.alert("Erreur", "Nom requis");
    try {
      const saved = await createPatient(newPatient);
      setAllPatients([...allPatients, saved]);
      selectPatient(saved);
      setModalVisible(false);
      setNewPatient({ fullName: '', phone: '', address: '' });
      Alert.alert("Succès", "Patient créé !");
    } catch (err) { Alert.alert("Erreur", "Impossible de créer le patient"); }
  };

  const handleCreate = async () => {
    if (!patientName || !startLocation || !endLocation) return Alert.alert('Attention', 'Veuillez remplir le patient et les adresses.');
    try {
      setLoading(true);
      const rideData = {
        patientName, patientPhone, startLocation, endLocation,
        date: date.toISOString(), returnDate: isRoundTrip ? returnDate.toISOString() : null, 
        type, isRoundTrip, notes
      };
      await createRide(rideData);
      Alert.alert('Succès', 'Course ajoutée au planning.');
      
      // Reset form
      setPatientName(''); setPatientPhone(''); setPatientAddressMem(''); 
      setStartLocation(''); setEndLocation(''); setIsRoundTrip(false); setNotes('');
      
      navigation.navigate('Agenda'); 
    } catch (error) { Alert.alert('Erreur', "Echec de l'enregistrement."); } 
    finally { setLoading(false); }
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={{paddingBottom: 160}} 
          keyboardShouldPersistTaps="handled" 
          showsVerticalScrollIndicator={false}
        >
          
          <Text style={styles.pageTitle}>Nouvelle Course</Text>

          {/* === 1. PATIENT === */}
          <View style={[styles.sectionContainer, { zIndex: 2000, elevation: 2000 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>1. LE PASSAGER</Text>
              <TouchableOpacity onPress={() => setModalVisible(true)}>
                <Text style={styles.linkText}>+ Nouveau</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputBox}>
              <Ionicons name="search" size={20} color="#666" style={{marginRight: 10}} />
              <TextInput 
                style={styles.inputField}
                placeholder="Nom du patient..."
                placeholderTextColor="#999" 
                value={patientName}
                onChangeText={handleNameChange}
              />
              
              {/* Loader discret à droite */}
              {patientsLoading && <ActivityIndicator size="small" color="#FF6B00" />}

              {!patientsLoading && patientName.length > 0 && (
                <TouchableOpacity onPress={() => {setPatientName(''); setShowSuggestions(false);}}>
                   <Ionicons name="close-circle" size={18} color="#CCC" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* BOUTON REESSAYER EN CAS D'ERREUR RÉSEAU */}
            {errorLoading && (
                <TouchableOpacity onPress={loadPatients} style={styles.retryButton}>
                    <Ionicons name="refresh" size={16} color="#D32F2F" />
                    <Text style={styles.retryText}>Erreur connexion. Tap pour réessayer.</Text>
                </TouchableOpacity>
            )}

            {patientPhone ? <Text style={styles.helperText}>📞 {patientPhone}</Text> : null}

            {/* LISTE DÉROULANTE (CORRIGÉE AVEC SCROLLVIEW + MAP) */}
            {showSuggestions && (
              <View style={styles.suggestionsDropdown}>
                <ScrollView 
                    keyboardShouldPersistTaps="handled" 
                    nestedScrollEnabled={true} 
                    style={{ maxHeight: 200 }}
                >
                  {filteredPatients.map((item, index) => (
                    <TouchableOpacity 
                        key={item._id || index} 
                        style={styles.suggestionRow} 
                        onPress={() => selectPatient(item)}
                    >
                      <Text style={styles.suggestionText}>{item.fullName}</Text>
                      {item.address && <Text style={styles.suggestionSubText}>{item.address}</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* === 2. TYPE === */}
          <View style={[styles.sectionContainer, { zIndex: 1 }]}>
            <Text style={styles.sectionTitle}>2. TYPE DE TRANSPORT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
              {['Aller', 'Retour', 'Consultation', 'Hospit', 'HDJ'].map((t) => (
                <TouchableOpacity 
                  key={t} 
                  style={[styles.typeButton, type === t && styles.typeButtonActive]} 
                  onPress={() => handleTypeChange(t)}
                >
                  <Text style={[styles.typeButtonText, type === t && {color: '#FFF'}]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* === 3. ITINÉRAIRE === */}
          <View style={[styles.sectionContainer, { zIndex: 1000, elevation: 1000 }]}>
            <Text style={styles.sectionTitle}>3. ITINÉRAIRE</Text>
            
            {recentDestinations.length > 0 && (
              <View style={styles.recentContainer}>
                <Text style={styles.recentLabel}>Habitudes :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {recentDestinations.map((loc, idx) => (
                    <TouchableOpacity key={idx} style={styles.recentChip} onPress={() => setEndLocation(loc)}>
                      <Ionicons name="reload-circle" size={14} color="#1565C0" style={{marginRight:4}}/>
                      <Text style={styles.recentChipText}>{loc}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.hospitalRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {TOULOUSE_HOSPITALS.map((h, i) => (
                  <TouchableOpacity key={i} style={styles.hospitalChip} onPress={() => selectHospital(h)}>
                    <Text style={styles.hospitalText}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.stackedInputContainer}>
              <View style={styles.timelineContainer}>
                 <View style={styles.timelineDotStart} />
                 <View style={styles.timelineLine} />
                 <View style={styles.timelineSquareEnd} />
              </View>

              <View style={styles.inputsColumn}>
                 <View style={[styles.inputRow, { zIndex: 50, elevation: 50 }]}>
                    <Text style={styles.inputLabelSmall}>DE</Text>
                    <View style={{flex:1, paddingRight: 40}}> 
                        <AddressAutocomplete 
                            placeholder="Lieu de prise en charge" 
                            placeholderTextColor="#999" 
                            value={startLocation} 
                            onSelect={setStartLocation} 
                            style={{ color: '#000000' }}
                            textInputProps={{ style: { color: '#000000' }, placeholderTextColor: "#999" }}
                        />
                    </View>
                 </View>

                 <View style={styles.separator} />

                 <View style={[styles.inputRow, { zIndex: 40, elevation: 40 }]}>
                    <Text style={styles.inputLabelSmall}>À</Text>
                    <View style={{flex:1, paddingRight: 40}}>
                        <AddressAutocomplete 
                            placeholder="Lieu de destination" 
                            placeholderTextColor="#999" 
                            value={endLocation} 
                            onSelect={setEndLocation} 
                            style={{ color: '#000000' }}
                            textInputProps={{ style: { color: '#000000' }, placeholderTextColor: "#999" }}
                        />
                    </View>
                 </View>
              </View>

              <TouchableOpacity style={styles.centeredSwapBtn} onPress={swapAddresses} activeOpacity={0.8}>
                  <Ionicons name="swap-vertical" size={20} color="#FF6B00" />
              </TouchableOpacity>
            </View>
          </View>

          {/* === 4. DATE === */}
          <View style={[styles.sectionContainer, { zIndex: 1 }]}>
            <View style={styles.sectionHeader}>
               <Text style={styles.sectionTitle}>4. DATE & HEURE</Text>
               <View style={styles.switchRow}>
                  <Text style={[styles.switchText, isRoundTrip && {color:'#FF6B00'}]}>Retour ?</Text>
                  <Switch value={isRoundTrip} onValueChange={setIsRoundTrip} trackColor={{ false: "#EEE", true: "#FF6B00" }} />
               </View>
            </View>

            <View style={styles.dateGrid}>
              <TouchableOpacity style={styles.dateCard} onPress={() => openDatePicker('start')}>
                 <Text style={styles.dateLabel}>ALLER</Text>
                 <Text style={styles.dateBig}>{moment(date).format('HH:mm')}</Text>
                 <Text style={styles.dateSmall}>{moment(date).format('DD MMM')}</Text>
              </TouchableOpacity>

              {isRoundTrip ? (
                <TouchableOpacity style={[styles.dateCard, styles.dateCardActive]} onPress={() => openDatePicker('return')}>
                   <Text style={[styles.dateLabel, {color: '#E65100'}]}>RETOUR</Text>
                   <Text style={styles.dateBig}>{moment(returnDate).format('HH:mm')}</Text>
                   <Text style={styles.dateSmall}>{moment(returnDate).format('DD MMM')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.dateCard, {opacity: 0.3, backgroundColor: '#F0F0F0'}]}>
                   <Text style={styles.dateLabel}>RETOUR</Text>
                   <Text style={styles.dateBig}>--:--</Text>
                   <Text style={styles.dateSmall}>Pas de retour</Text>
                </View>
              )}
            </View>
          </View>

          {/* === 5. NOTES === */}
          <View style={[styles.sectionContainer, { zIndex: 1 }]}>
            <Text style={styles.sectionTitle}>5. NOTES (OPTIONNEL)</Text>
            <View style={styles.notesBox}>
                <Ionicons name="document-text-outline" size={20} color="#999" style={{marginTop: 5, marginRight: 8}} />
                <TextInput 
                    style={styles.notesInput} 
                    placeholder="Ex: Patient en fauteuil, code porte 12A..." 
                    placeholderTextColor="#999"
                    multiline={true}
                    numberOfLines={3}
                    value={notes}
                    onChangeText={setNotes}
                    textAlignVertical="top"
                />
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.mainButton} onPress={handleCreate} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.mainButtonText}>VALIDER LA COURSE</Text>}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL AJOUT */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Nouveau Dossier</Text>
                <TextInput style={styles.modalField} placeholder="Nom & Prénom" placeholderTextColor="#999" autoFocus value={newPatient.fullName} onChangeText={t => setNewPatient({...newPatient, fullName: t})} />
                <TextInput style={styles.modalField} placeholder="Adresse (complète)" placeholderTextColor="#999" value={newPatient.address} onChangeText={t => setNewPatient({...newPatient, address: t})} />
                <TextInput style={styles.modalField} placeholder="Téléphone" placeholderTextColor="#999" keyboardType="phone-pad" value={newPatient.phone} onChangeText={t => setNewPatient({...newPatient, phone: t})} />
                <View style={styles.modalBtns}>
                   <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelTxt}>Annuler</Text></TouchableOpacity>
                   <TouchableOpacity onPress={saveNewPatient} style={styles.saveBtn}><Text style={styles.saveTxt}>Enregistrer</Text></TouchableOpacity>
                </View>
              </View>
            </View>
      </Modal>

      {showDatePicker && (
          <DateTimePicker 
              value={dateMode === 'start' ? date : returnDate} 
              mode={pickerMode} is24Hour={true} display="spinner" 
              onChange={onChangeDate} minimumDate={new Date()} 
          />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#111', marginTop: 20, marginBottom: 15, paddingHorizontal: 20 },

  sectionContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 15,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#B0BEC5', letterSpacing: 1 },
  linkText: { color: '#FF6B00', fontWeight: 'bold', fontSize: 14 },

  inputBox: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', 
    borderRadius: 12, height: 50, paddingHorizontal: 15, borderWidth: 1, borderColor: '#EEE'
  },
  inputField: { flex: 1, fontSize: 16, color: '#000', fontWeight: '600' },
  helperText: { marginTop: 8, color: '#2E7D32', fontSize: 12, fontWeight: '700' },

  // Bouton Réessayer
  retryButton: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 8, backgroundColor: '#FFEBEE', borderRadius: 8
  },
  retryText: { color: '#D32F2F', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },

  suggestionsDropdown: { 
    position: 'absolute', top: 85, left: 0, right: 0, 
    backgroundColor: '#FFF', borderRadius: 12, 
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 15, elevation: 10,
    zIndex: 9999, paddingVertical: 5
  },
  suggestionRow: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  suggestionText: { fontWeight: 'bold', fontSize: 15, color: '#333' },
  suggestionSubText: { fontSize: 12, color: '#888', marginTop: 2 },

  typeButton: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginRight: 10 },
  typeButtonActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  typeButtonText: { color: '#666', fontWeight: '600', fontSize: 14 },

  hospitalRow: { marginBottom: 15 },
  hospitalChip: { backgroundColor: '#F0F4C3', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
  hospitalText: { color: '#827717', fontWeight: '700', fontSize: 12 },

  recentContainer: { marginBottom: 10 },
  recentLabel: { fontSize: 12, color: '#1565C0', marginBottom: 5, fontWeight: 'bold', fontStyle: 'italic' },
  recentChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#90CAF9' },
  recentChipText: { color: '#1565C0', fontSize: 12, fontWeight: 'bold' },

  stackedInputContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 5, paddingHorizontal: 15,
    position: 'relative', borderWidth: 1, borderColor: '#E0E0E0',
  },
  timelineContainer: { position: 'absolute', left: 15, top: 25, bottom: 25, width: 20, alignItems: 'center', justifyContent: 'space-between' },
  timelineDotStart: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#DDD', marginVertical: 4 },
  timelineSquareEnd: { width: 10, height: 10, backgroundColor: '#212121' },

  inputsColumn: { marginLeft: 25 },
  inputRow: { height: 55, justifyContent: 'center', flexDirection:'row', alignItems:'center', backgroundColor: 'transparent' },
  inputLabelSmall: { fontSize: 10, fontWeight: 'bold', color:'#999', width: 25, marginRight: 5 },
  separator: { height: 1, backgroundColor: '#E0E0E0', width: '100%' },

  centeredSwapBtn: { 
    position: 'absolute', right: 15, top: '50%', marginTop: -20, 
    backgroundColor: '#FFF', width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 9999, elevation: 20, borderWidth: 1, borderColor: '#E0E0E0',
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }
  },

  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchText: { fontSize: 13, color: '#666', marginRight: 10, fontWeight: '600' },
  dateGrid: { flexDirection: 'row', gap: 15 },
  dateCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  dateCardActive: { borderColor: '#FFCCBC', backgroundColor: '#FFF3E0' },
  dateLabel: { fontSize: 10, fontWeight: '800', color: '#AAA', marginBottom: 5 },
  dateBig: { fontSize: 22, fontWeight: '800', color: '#333' },
  dateSmall: { fontSize: 12, color: '#666' },

  notesBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#F9FAFB', borderRadius: 12, 
    padding: 10, borderWidth: 1, borderColor: '#EEE',
    marginTop: 10
  },
  notesInput: {
    flex: 1, fontSize: 15, color: '#333', 
    minHeight: 60, textAlignVertical: 'top' 
  },

  footer: { padding: 20 },
  mainButton: { backgroundColor: '#111', borderRadius: 16, height: 60, justifyContent: 'center', alignItems: 'center', shadowColor: "#FF6B00", shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  mainButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 1 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 25 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  modalField: { backgroundColor: '#F5F5F5', height: 50, borderRadius: 10, paddingHorizontal: 15, marginBottom: 12, fontSize: 16, color: '#000' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { padding: 15, flex: 1, alignItems: 'center' },
  saveBtn: { backgroundColor: '#FF6B00', padding: 15, flex: 1, alignItems: 'center', borderRadius: 10 },
  cancelTxt: { color: '#888', fontWeight: 'bold' },
  saveTxt: { color: '#FFF', fontWeight: 'bold' },
});