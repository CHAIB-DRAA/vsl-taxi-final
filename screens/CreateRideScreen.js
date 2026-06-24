import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch, KeyboardAvoidingView, Platform, Modal, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import BonTransportScannerModal from '../components/BonTransportScannerModal';

// Composants & Services
import AddressAutocomplete from '../components/AddressAutocomplete';
import { createRide, updateRide, getPatients, createPatient, importMassRides } from '../services/api';
import { scheduleRideReminder } from '../services/notificationService';
import ScreenWrapper from '../components/ScreenWrapper';
import { useData } from '../contexts/DataContext';
import C from '../styles/tokens';

const DAYS = [
  { label: 'Lu', day: 1 }, { label: 'Ma', day: 2 }, { label: 'Me', day: 3 },
  { label: 'Je', day: 4 }, { label: 'Ve', day: 5 }, { label: 'Sa', day: 6 }, { label: 'Di', day: 0 },
];

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
  const [editingRideId, setEditingRideId] = useState(null);
  const [showBonTransportScanner, setShowBonTransportScanner] = useState(false);

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

  const [patientNIR, setPatientNIR] = useState('');

  const [type, setType] = useState('Aller');
  const [motif, setMotif] = useState('Consultation');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [hasEmptyReturn, setHasEmptyReturn] = useState(true);

  const [loading, setLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [errorLoading, setErrorLoading] = useState(false);

  // Focus states
  const [focusName, setFocusName] = useState(false);
  const [focusNotes, setFocusNotes] = useState(false);
  const [focusModalFullName, setFocusModalFullName] = useState(false);
  const [focusModalAddress, setFocusModalAddress] = useState(false);
  const [focusModalPhone, setFocusModalPhone] = useState(false);

  // Récurrences
  const [isRecurring, setIsRecurring]     = useState(false);
  const [recurDays, setRecurDays]         = useState([]);
  const [recurEndDate, setRecurEndDate]   = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d;
  });

  const [allPatients, setAllPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [newPatient, setNewPatient] = useState({ fullName: '', phone: '', address: '' });

  // --- 1. CHARGEMENT INITIAL ---
  useEffect(() => { loadPatients(); }, []);

  // --- 2. RÉCEPTION DONNÉES (MAGIC PASTE OU MODIFICATION) ---
  useEffect(() => {
    const data = route.params?.rideToEdit || route.params?.importedData;

    if (data) {
        if (route.params?.rideToEdit) {
            setEditingRideId(data._id);
        }

        if (data.patientName) setPatientName(data.patientName);
        if (data.patientPhone) setPatientPhone(data.patientPhone);
        if (data.patientNIR) setPatientNIR(data.patientNIR);
        if (data.startLocation) setStartLocation(data.startLocation);
        if (data.endLocation) setEndLocation(data.endLocation);
        if (data.type) setType(data.type);
        if (data.motif) setMotif(data.motif);
        if (data.notes) setNotes(data.notes);

        if (data.date) setDate(new Date(data.date));
        else if (data.startTime) setDate(new Date(data.startTime));

        navigation.setParams({ importedData: null, rideToEdit: null });
    }
  }, [route.params]);

  // --- 3. FONCTIONS LOGIQUES ---

  const loadPatients = async () => {
    setPatientsLoading(true);
    setErrorLoading(false);
    try {
      const data = await getPatients();
      setAllPatients(data || []);
    } catch (err) {
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
    setHasEmptyReturn(newType !== 'Retour'); // Retour = pas de supplément retour à vide
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
    if (Platform.OS === 'ios') setPickerMode(target === 'recurEnd' ? 'date' : 'datetime');
    else setPickerMode('date');
    setShowDatePicker(true);
  };

  const onChangeDate = (event, selectedDate) => {
    if (event.type === 'dismissed') { setShowDatePicker(false); return; }
    const fallback = dateMode === 'start' ? date : dateMode === 'recurEnd' ? recurEndDate : returnDate;
    const currentDate = selectedDate || fallback;
    if (Platform.OS === 'android') setShowDatePicker(false);

    if (dateMode === 'start') {
      setDate(currentDate);
      if (currentDate > returnDate) setReturnDate(currentDate);
      if (currentDate > recurEndDate) setRecurEndDate(currentDate);
    } else if (dateMode === 'recurEnd') {
      if (currentDate < date) Alert.alert('Erreur', 'La date de fin doit être après la date de début.');
      else setRecurEndDate(currentDate);
    } else {
      if (currentDate < date) Alert.alert('Erreur', "Le retour ne peut pas être avant l'aller.");
      else setReturnDate(currentDate);
    }

    if (Platform.OS === 'android' && pickerMode === 'date' && dateMode !== 'recurEnd') {
      setPickerMode('time');
      setTimeout(() => setShowDatePicker(true), 100);
    }
  };

  const getRecurringDates = () => {
    if (recurDays.length === 0) return [];
    const dates = [];
    const end = new Date(recurEndDate);
    end.setHours(23, 59, 59);
    const current = new Date(date);
    while (current <= end && dates.length < 90) {
      if (recurDays.includes(current.getDay())) dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
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

  const resetForm = () => {
    setPatientName(''); setPatientPhone(''); setPatientNIR(''); setPatientAddressMem('');
    setStartLocation(''); setEndLocation(''); setIsRoundTrip(false); setNotes('');
    setEditingRideId(null); setIsRecurring(false); setRecurDays([]);
    setHasEmptyReturn(true);
  };

  const submitRide = async () => {
    try {
      setLoading(true);
      const rideData = {
        patientName, patientPhone, patientNIR, startLocation, endLocation,
        date: date.toISOString(), returnDate: isRoundTrip ? returnDate.toISOString() : null,
        type, motif, isRoundTrip, hasEmptyReturn, notes,
      };
      if (editingRideId) {
        await updateRide(editingRideId, rideData);
        Alert.alert('Succès', 'Course mise à jour avec succès.');
      } else {
        const created = await createRide(rideData);
        scheduleRideReminder(created).catch(() => {});
        Alert.alert('Succès', 'Course ajoutée au planning.');
      }
      resetForm();
      navigation.goBack();
    } catch {
      Alert.alert('Erreur', "Échec de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!patientName || !startLocation || !endLocation)
      return Alert.alert('Attention', 'Veuillez remplir le patient et les adresses.');

    if (isRecurring && !editingRideId) {
      if (recurDays.length === 0) return Alert.alert('Erreur', 'Sélectionne au moins un jour de la semaine.');
      const dates = getRecurringDates();
      if (dates.length === 0) return Alert.alert('Erreur', 'Aucune date dans cette période pour les jours sélectionnés.');

      Alert.alert(
        `Créer ${dates.length} courses ?`,
        `${patientName}\n${startLocation} → ${endLocation}\nDe ${dayjs(date).format('DD/MM')} au ${dayjs(recurEndDate).format('DD/MM/YYYY')}`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: `Créer ${dates.length} courses`, onPress: async () => {
              setLoading(true);
              try {
                const rides = dates.map(d => ({
                  patientName, patientPhone, patientNIR, startLocation, endLocation,
                  date: d.toISOString(), type, motif, isRoundTrip: false, hasEmptyReturn, notes,
                }));
                const res = await importMassRides(rides);
                Alert.alert('Série créée ✓', `${res.addedRidesCount} course${res.addedRidesCount > 1 ? 's' : ''} ajoutée${res.addedRidesCount > 1 ? 's' : ''} au planning.`);
                resetForm();
                navigation.goBack();
              } catch {
                Alert.alert('Erreur', 'Impossible de créer la série.');
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
      return;
    }

    // Vérification conflit horaire
    const newRideTime = date.getTime();
    const conflicts = allRides.filter(r => {
      if (r.status === 'Annulée') return false;
      if (editingRideId && r._id === editingRideId) return false;
      const diff = Math.abs(new Date(r.date).getTime() - newRideTime);
      return diff < 20 * 60 * 1000; // moins de 20 minutes
    });
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      Alert.alert(
        '⚠️ Conflit horaire',
        `Vous avez déjà une course à ${dayjs(conflict.date).format('HH:mm')} (${conflict.patientName}). Confirmer quand même ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Confirmer quand même', onPress: () => submitRide() }
        ]
      );
      return;
    }

    await submitRide();
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* ── HEADER DARK GRADIENT ── */}
        <LinearGradient
          colors={[C.hBg1, C.hBg2]}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={22} color={C.hText} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {editingRideId ? 'Modifier la course' : 'Nouvelle course'}
            </Text>
            <Text style={styles.headerSub}>
              {editingRideId ? 'Mise à jour des informations' : 'Remplissez les informations ci-dessous'}
            </Text>
          </View>
          {/* Magic Paste / Bon transport button */}
          <TouchableOpacity
            onPress={() => setShowBonTransportScanner(true)}
            style={styles.headerScanBtn}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#FF5500', C.brandGrad]} style={styles.headerScanGrad}>
              <Ionicons name="scan-outline" size={18} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 160, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* === 1. PASSAGER === */}
          <View style={[styles.sectionCard, { zIndex: 2000, elevation: 2000 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>PASSAGER</Text>
              <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.newPatientBtn}>
                <Ionicons name="person-add-outline" size={13} color={C.brand} />
                <Text style={styles.newPatientText}>Nouveau</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputBox, focusName && { borderColor: C.brand }]}>
              <Ionicons name="search" size={18} color={C.text3} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.inputField}
                placeholder="Nom du patient..."
                placeholderTextColor={C.text3}
                value={patientName}
                onChangeText={handleNameChange}
                onFocus={() => setFocusName(true)}
                onBlur={() => setFocusName(false)}
              />
              {patientsLoading && <ActivityIndicator size="small" color={C.brand} />}
              {!patientsLoading && patientName.length > 0 && (
                <TouchableOpacity onPress={() => { setPatientName(''); setShowSuggestions(false); }}>
                  <Ionicons name="close-circle" size={18} color={C.text3} />
                </TouchableOpacity>
              )}
            </View>

            {errorLoading && (
              <TouchableOpacity onPress={loadPatients} style={styles.retryButton}>
                <Ionicons name="refresh" size={16} color={C.red} />
                <Text style={styles.retryText}>Erreur connexion. Tap pour réessayer.</Text>
              </TouchableOpacity>
            )}

            {patientPhone ? (
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={13} color={C.green} />
                <Text style={styles.phoneText}>{patientPhone}</Text>
              </View>
            ) : null}

            <View style={[styles.inputBox, { marginTop: 10 }]}>
              <Ionicons name="card-outline" size={18} color={C.text3} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.inputField}
                placeholder="NIR (N° Sécu — optionnel)"
                placeholderTextColor={C.text3}
                value={patientNIR}
                onChangeText={setPatientNIR}
                keyboardType="numeric"
                maxLength={15}
              />
            </View>

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

          {/* === 2. TYPE DE TRANSPORT === */}
          <View style={[styles.sectionCard, { zIndex: 1 }]}>
            <Text style={styles.sectionTitle}>TYPE DE TRANSPORT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {['Aller', 'Retour', 'Consultation', 'Hospit', 'HDJ'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={styles.pillWrap}
                  onPress={() => handleTypeChange(t)}
                  activeOpacity={0.8}
                >
                  {type === t ? (
                    <LinearGradient colors={['#FF5500', C.brandGrad]} style={styles.pillActive}>
                      <Text style={styles.pillTextActive}>{t}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.pillInactive}>
                      <Text style={styles.pillTextInactive}>{t}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* === MOTIF CPAM === */}
          <View style={[styles.sectionCard, { zIndex: 1 }]}>
            <Text style={styles.sectionTitle}>MOTIF CPAM</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {['Consultation', 'Traitement', 'Hospitalisation', 'HDJ', 'Urgence'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={styles.pillWrap}
                  onPress={() => setMotif(m)}
                  activeOpacity={0.8}
                >
                  {motif === m ? (
                    <LinearGradient colors={['#FF5500', C.brandGrad]} style={styles.pillActive}>
                      <Text style={styles.pillTextActive}>{m}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.pillInactive}>
                      <Text style={styles.pillTextInactive}>{m}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* === 3. ITINÉRAIRE === */}
          <View style={[styles.sectionCard, { zIndex: 1000, elevation: 1000 }]}>
            <Text style={styles.sectionTitle}>ITINÉRAIRE</Text>

            {recentDestinations.length > 0 && (
              <View style={styles.recentContainer}>
                <Text style={styles.recentLabel}>Habitudes :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {recentDestinations.map((loc, idx) => (
                    <TouchableOpacity key={idx} style={styles.recentChip} onPress={() => setEndLocation(loc)}>
                      <Ionicons name="reload-circle" size={13} color={C.blue} style={{ marginRight: 4 }} />
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
                  <View style={{ flex: 1, paddingRight: 40 }}>
                    <AddressAutocomplete
                      placeholder="Lieu de prise en charge"
                      placeholderTextColor={C.text3}
                      value={startLocation}
                      onSelect={setStartLocation}
                      style={{ color: C.text }}
                      textInputProps={{ style: { color: C.text }, placeholderTextColor: C.text3 }}
                    />
                  </View>
                </View>

                <View style={styles.separator} />

                <View style={[styles.inputRow, { zIndex: 40, elevation: 40 }]}>
                  <Text style={styles.inputLabelSmall}>À</Text>
                  <View style={{ flex: 1, paddingRight: 40 }}>
                    <AddressAutocomplete
                      placeholder="Lieu de destination"
                      placeholderTextColor={C.text3}
                      value={endLocation}
                      onSelect={setEndLocation}
                      style={{ color: C.text }}
                      textInputProps={{ style: { color: C.text }, placeholderTextColor: C.text3 }}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.centeredSwapBtn} onPress={swapAddresses} activeOpacity={0.8}>
                <Ionicons name="swap-vertical" size={20} color={C.brand} />
              </TouchableOpacity>
            </View>
          </View>

          {/* === 4. DATE & HEURE === */}
          <View style={[styles.sectionCard, { zIndex: 1 }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>DATE & HEURE</Text>
              <View style={styles.switchRow}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.switchLabel}>Retour ?</Text>
                  <Text style={styles.switchDesc}>Ajouter heure de retour</Text>
                </View>
                <Switch
                  value={isRoundTrip}
                  onValueChange={(v) => { setIsRoundTrip(v); if (v) setHasEmptyReturn(false); }}
                  trackColor={{ false: C.border, true: C.brand }}
                  thumbColor="#FFF"
                  style={{ marginLeft: 12 }}
                />
              </View>
            </View>

            <View style={styles.dateGrid}>
              <TouchableOpacity style={styles.dateCard} onPress={() => openDatePicker('start')}>
                <View style={styles.dateLabelRow}>
                  <View style={[styles.dateDot, { backgroundColor: C.green }]} />
                  <Text style={styles.dateLabel}>ALLER</Text>
                </View>
                <Text style={styles.dateBig}>{dayjs(date).format('HH:mm')}</Text>
                <Text style={styles.dateSmall}>{dayjs(date).format('DD MMM')}</Text>
              </TouchableOpacity>

              {isRoundTrip ? (
                <TouchableOpacity style={[styles.dateCard, styles.dateCardReturn]} onPress={() => openDatePicker('return')}>
                  <View style={styles.dateLabelRow}>
                    <View style={[styles.dateDot, { backgroundColor: C.brand }]} />
                    <Text style={[styles.dateLabel, { color: C.brand }]}>RETOUR</Text>
                  </View>
                  <Text style={styles.dateBig}>{dayjs(returnDate).format('HH:mm')}</Text>
                  <Text style={styles.dateSmall}>{dayjs(returnDate).format('DD MMM')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.dateCard, { opacity: 0.35 }]}>
                  <View style={styles.dateLabelRow}>
                    <View style={[styles.dateDot, { backgroundColor: C.text3 }]} />
                    <Text style={styles.dateLabel}>RETOUR</Text>
                  </View>
                  <Text style={styles.dateBig}>--:--</Text>
                  <Text style={styles.dateSmall}>Pas de retour</Text>
                </View>
              )}
            </View>
          </View>

          {/* === 5. NOTES === */}
          <View style={[styles.sectionCard, { zIndex: 1 }]}>
            <Text style={styles.sectionTitle}>NOTES (OPTIONNEL)</Text>
            <View style={[styles.notesBox, focusNotes && { borderColor: C.brand }]}>
              <Ionicons name="document-text-outline" size={18} color={C.text3} style={{ marginTop: 4, marginRight: 10 }} />
              <TextInput
                style={styles.notesInput}
                placeholder="Ex: Patient en fauteuil, code porte 12A..."
                placeholderTextColor={C.text3}
                multiline={true}
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
                onFocus={() => setFocusNotes(true)}
                onBlur={() => setFocusNotes(false)}
              />
            </View>
          </View>

          {/* === 6. SÉRIE RÉCURRENTE === */}
          {!editingRideId && (
            <View style={[styles.sectionCard, { zIndex: 1 }]}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="repeat" size={15} color={isRecurring ? C.purple : C.text3} />
                  <Text style={[styles.sectionTitle, isRecurring && { color: C.purple }]}>SÉRIE RÉCURRENTE</Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={v => { setIsRecurring(v); if (!v) setRecurDays([]); }}
                  trackColor={{ false: C.border, true: C.purple }}
                  thumbColor="#FFF"
                />
              </View>

              {isRecurring && (
                <>
                  <Text style={styles.recurLabel}>Jours de la semaine</Text>
                  <View style={styles.daysRow}>
                    {DAYS.map(({ label, day }) => {
                      const active = recurDays.includes(day);
                      return (
                        <TouchableOpacity
                          key={day}
                          style={styles.dayBtnWrap}
                          onPress={() => setRecurDays(prev =>
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          )}
                          activeOpacity={0.8}
                        >
                          {active ? (
                            <LinearGradient colors={['#8B5CF6', '#A78BFA']} style={styles.dayBtnActive}>
                              <Text style={styles.dayBtnTextActive}>{label}</Text>
                            </LinearGradient>
                          ) : (
                            <View style={styles.dayBtnInactive}>
                              <Text style={styles.dayBtnTextInactive}>{label}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.recurLabel, { marginTop: 16 }]}>Jusqu'au</Text>
                  <TouchableOpacity style={styles.recurDateBtn} onPress={() => openDatePicker('recurEnd')}>
                    <Ionicons name="calendar-outline" size={16} color={C.brand} />
                    <Text style={styles.recurDateText}>{dayjs(recurEndDate).format('DD MMMM YYYY')}</Text>
                  </TouchableOpacity>

                  {recurDays.length > 0 && (() => {
                    const dates = getRecurringDates();
                    if (dates.length === 0) return null;
                    return (
                      <View style={styles.previewBox}>
                        <Ionicons name="information-circle-outline" size={15} color={C.purple} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.previewCount}>
                            {dates.length} course{dates.length > 1 ? 's' : ''} seront créées
                          </Text>
                          <Text style={styles.previewDates} numberOfLines={2}>
                            {dates.slice(0, 6).map(d => dayjs(d).format('DD/MM')).join(' · ')}
                            {dates.length > 6 ? ` ... +${dates.length - 6}` : ''}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </>
              )}
            </View>
          )}

          {/* ── FOOTER BOUTON SUBMIT ── */}
          <View style={styles.footer}>
            {isRecurring && recurDays.length > 0 ? (
              <TouchableOpacity onPress={handleSave} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={['#7C3AED', '#8B5CF6']} style={styles.mainButton}>
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="repeat" size={20} color="#FFF" />
                      <Text style={styles.mainButtonText}>CRÉER {getRecurringDates().length} COURSES</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleSave} disabled={loading} activeOpacity={0.85} style={loading ? { opacity: 0.6 } : null}>
                <LinearGradient colors={['#FF5500', C.brandGrad]} style={styles.mainButton}>
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={editingRideId ? 'checkmark-circle' : 'add-circle'} size={20} color="#FFF" />
                      <Text style={styles.mainButtonText}>
                        {editingRideId ? 'METTRE À JOUR LA COURSE' : 'VALIDER LA COURSE'}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── MODAL AJOUT PATIENT ── */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nouveau dossier patient</Text>
            <View style={[styles.modalInputBox, focusModalFullName && { borderColor: C.brand }]}>
              <Ionicons name="person-outline" size={16} color={C.text3} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.modalInputField}
                placeholder="Nom & Prénom"
                placeholderTextColor={C.text3}
                autoFocus
                value={newPatient.fullName}
                onChangeText={t => setNewPatient({ ...newPatient, fullName: t })}
                onFocus={() => setFocusModalFullName(true)}
                onBlur={() => setFocusModalFullName(false)}
              />
            </View>
            <View style={[styles.modalInputBox, focusModalAddress && { borderColor: C.brand }]}>
              <Ionicons name="location-outline" size={16} color={C.text3} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.modalInputField}
                placeholder="Adresse complète"
                placeholderTextColor={C.text3}
                value={newPatient.address}
                onChangeText={t => setNewPatient({ ...newPatient, address: t })}
                onFocus={() => setFocusModalAddress(true)}
                onBlur={() => setFocusModalAddress(false)}
              />
            </View>
            <View style={[styles.modalInputBox, focusModalPhone && { borderColor: C.brand }]}>
              <Ionicons name="call-outline" size={16} color={C.text3} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.modalInputField}
                placeholder="Téléphone"
                placeholderTextColor={C.text3}
                keyboardType="phone-pad"
                value={newPatient.phone}
                onChangeText={t => setNewPatient({ ...newPatient, phone: t })}
                onFocus={() => setFocusModalPhone(true)}
                onBlur={() => setFocusModalPhone(false)}
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNewPatient} activeOpacity={0.85} style={{ flex: 1 }}>
                <LinearGradient colors={['#FF5500', C.brandGrad]} style={styles.saveBtn}>
                  <Text style={styles.saveTxt}>Enregistrer</Text>
                </LinearGradient>
              </TouchableOpacity>
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

      <BonTransportScannerModal
        visible={showBonTransportScanner}
        onClose={() => setShowBonTransportScanner(false)}
        onPatientAdded={(patient) => {
          if (patient?.fullName) setPatientName(patient.fullName);
          setShowBonTransportScanner(false);
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── HEADER ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(80,160,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.hText, letterSpacing: 0.3 },
  headerSub: { fontSize: 12, color: C.hText2, marginTop: 2 },
  headerScanBtn: { marginLeft: 'auto' },
  headerScanGrad: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.brand, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },

  // ── SECTION CARD ──
  sectionCard: {
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: C.text3, letterSpacing: 1.2, textTransform: 'uppercase',
  },

  newPatientBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.brand + '12', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: C.brand + '30',
  },
  newPatientText: { color: C.brand, fontWeight: '700', fontSize: 12 },

  // ── INPUT BOX ──
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card2, borderRadius: 14,
    height: 52, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.border,
  },
  inputField: { flex: 1, fontSize: 15, color: C.text, fontWeight: '600' },

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  phoneText: { color: C.green, fontSize: 12, fontWeight: '700' },

  retryButton: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
    padding: 10, backgroundColor: '#FEF2F2', borderRadius: 10, gap: 6,
  },
  retryText: { color: C.red, fontSize: 12, fontWeight: '700' },

  suggestionsDropdown: {
    position: 'absolute', top: 82, left: 0, right: 0,
    backgroundColor: C.card, borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 12,
    zIndex: 9999, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border,
  },
  suggestionRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  suggestionText: { fontWeight: '700', fontSize: 15, color: C.text },
  suggestionSubText: { fontSize: 12, color: C.text2, marginTop: 2 },

  // ── PILLS ──
  pillWrap: { marginRight: 8 },
  pillActive: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  pillInactive: {
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  pillTextActive: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  pillTextInactive: { color: C.text2, fontWeight: '600', fontSize: 13 },

  // ── HOSPITALS ──
  hospitalRow: { marginBottom: 14, marginTop: 4 },
  hospitalChip: {
    backgroundColor: '#FEFCE8', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#FEF08A',
  },
  hospitalText: { color: '#854D0E', fontWeight: '700', fontSize: 12 },

  // ── RECENT ──
  recentContainer: { marginBottom: 10 },
  recentLabel: { fontSize: 11, color: C.blue, marginBottom: 6, fontWeight: '700' },
  recentChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFF6FF', paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#BFDBFE',
  },
  recentChipText: { color: C.blue, fontSize: 12, fontWeight: '600' },

  // ── STACKED INPUTS (ITINÉRAIRE) ──
  stackedInputContainer: {
    backgroundColor: C.card2, borderRadius: 16, paddingVertical: 4, paddingHorizontal: 14,
    position: 'relative', borderWidth: 1, borderColor: C.border, marginTop: 8,
  },
  timelineContainer: {
    position: 'absolute', left: 14, top: 22, bottom: 22,
    width: 20, alignItems: 'center', justifyContent: 'space-between',
  },
  timelineDotStart: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green },
  timelineLine: { width: 2, flex: 1, backgroundColor: C.border, marginVertical: 4 },
  timelineSquareEnd: { width: 10, height: 10, backgroundColor: C.text, borderRadius: 2 },

  inputsColumn: { marginLeft: 24 },
  inputRow: { height: 55, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  inputLabelSmall: { fontSize: 10, fontWeight: '800', color: C.text3, width: 24, marginRight: 6 },
  separator: { height: 1, backgroundColor: C.border, width: '100%' },

  centeredSwapBtn: {
    position: 'absolute', right: 14, top: '50%', marginTop: -20,
    backgroundColor: C.card, width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 9999, elevation: 20, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },

  // ── DATE ──
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchLabel: { fontSize: 13, fontWeight: '700', color: C.text, textAlign: 'right' },
  switchDesc: { fontSize: 11, color: C.text3, textAlign: 'right' },

  dateGrid: { flexDirection: 'row', gap: 12 },
  dateCard: {
    flex: 1, backgroundColor: C.card2, borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  dateCardReturn: { borderColor: C.brand + '40', backgroundColor: '#FFF7F0' },
  dateLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  dateDot: { width: 7, height: 7, borderRadius: 4 },
  dateLabel: { fontSize: 10, fontWeight: '800', color: C.text3, letterSpacing: 0.8 },
  dateBig: { fontSize: 26, fontWeight: '900', color: C.text },
  dateSmall: { fontSize: 12, color: C.text2, marginTop: 2 },

  // ── NOTES ──
  notesBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.card2, borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: C.border, marginTop: 12,
  },
  notesInput: { flex: 1, fontSize: 14, color: C.text, minHeight: 64, textAlignVertical: 'top' },

  // ── RÉCURRENCES ──
  recurLabel: { fontSize: 11, fontWeight: '700', color: C.text3, letterSpacing: 0.8, marginBottom: 10 },
  daysRow: { flexDirection: 'row', gap: 5 },
  dayBtnWrap: { flex: 1 },
  dayBtnActive: { paddingVertical: 11, borderRadius: 11, alignItems: 'center' },
  dayBtnInactive: {
    paddingVertical: 11, borderRadius: 11, alignItems: 'center',
    backgroundColor: C.card2, borderWidth: 1, borderColor: C.border,
  },
  dayBtnTextActive: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  dayBtnTextInactive: { fontSize: 11, fontWeight: '700', color: C.text2 },
  recurDateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF7ED', padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  recurDateText: { fontSize: 15, fontWeight: '700', color: C.text },
  previewBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14,
    backgroundColor: '#F5F3FF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#DDD6FE',
  },
  previewCount: { fontSize: 14, fontWeight: '800', color: C.purple },
  previewDates: { fontSize: 12, color: C.text2, marginTop: 2 },

  // ── FOOTER ──
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  mainButton: {
    borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.brand, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  mainButtonText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.8 },

  // ── MODAL ──
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 30, borderTopRightRadius: 30,
    padding: 28, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 20 },
  modalInputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card2, borderRadius: 14, height: 52,
    paddingHorizontal: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  modalInputField: { flex: 1, fontSize: 15, color: C.text, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, height: 52, justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.card2, borderRadius: 14, borderWidth: 1, borderColor: C.border,
  },
  cancelTxt: { color: C.text2, fontWeight: '700', fontSize: 15 },
  saveBtn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
