import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import ScreenWrapper from '../components/ScreenWrapper';
import api from '../services/api';

const C = {
  bg:      '#F0F3FA',
  card:    '#FFFFFF',
  card2:   '#F5F7FF',
  border:  '#E4E8F0',
  text:    '#0D1117',
  text2:   '#64748B',
  text3:   '#94A3B8',
  brand:   '#FF6B00',
  green:   '#10B981',
  hBg1:   '#0A0F1E',
  hBg2:   '#111827',
  hText:  '#F1F5F9',
  hText2: '#94A3B8',
};

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
      // On utilise l'ID de la course pour faire le PUT
      await api.put(`/rides/${ride._id}`, {
        ...form,
        date: form.date.toISOString()
      });

      Alert.alert("Succès", "La course a été mise à jour.");
      navigation.goBack(); // Retour automatique à l'agenda
    } catch (error) {
      Alert.alert("Erreur", "Impossible de modifier la course.");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'patientName',   label: 'PATIENT',        icon: 'person-outline',   keyboard: 'default' },
    { key: 'patientPhone',  label: 'TÉLÉPHONE',       icon: 'call-outline',     keyboard: 'phone-pad' },
    { key: 'startLocation', label: 'PRISE EN CHARGE', icon: 'navigate-outline', keyboard: 'default' },
    { key: 'endLocation',   label: 'DESTINATION',     icon: 'location-outline', keyboard: 'default' },
  ];

  return (
    <ScreenWrapper style={{ backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* ── HEADER DARK GRADIENT ── */}
        <LinearGradient colors={[C.hBg1, C.hBg2]} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={22} color={C.hText} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Modifier la course</Text>
            <Text style={styles.headerSub}>
              {ride.patientName} · {moment(ride.date).format('DD MMM, HH:mm')}
            </Text>
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── CARD INFOS COURSE ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>INFORMATIONS</Text>

            {fields.map(f => (
              <View key={f.key} style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <View style={styles.inputBox}>
                  <Ionicons name={f.icon} size={16} color={C.text3} style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.inputField}
                    value={form[f.key]}
                    onChangeText={t => setForm({ ...form, [f.key]: t })}
                    keyboardType={f.keyboard}
                    placeholderTextColor={C.text3}
                    placeholder={`Saisir ${f.label.toLowerCase()}...`}
                  />
                </View>
              </View>
            ))}

            {/* DATE & HEURE */}
            <Text style={styles.fieldLabel}>DATE & HEURE</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
              <View style={styles.dateBtnIcon}>
                <Ionicons name="calendar-outline" size={18} color={C.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateBtnTime}>{moment(form.date).format('HH:mm')}</Text>
                <Text style={styles.dateBtnDate}>{moment(form.date).format('dddd DD MMMM YYYY')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.text3} />
            </TouchableOpacity>
          </View>

          {/* ── CARD NOTES ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <View style={[styles.inputBox, { height: 90, alignItems: 'flex-start', paddingTop: 12 }]}>
              <Ionicons name="document-text-outline" size={16} color={C.text3} style={{ marginRight: 10, marginTop: 2 }} />
              <TextInput
                style={[styles.inputField, { minHeight: 64, textAlignVertical: 'top' }]}
                value={form.notes}
                onChangeText={t => setForm({ ...form, notes: t })}
                placeholder="Informations complémentaires..."
                placeholderTextColor={C.text3}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* ── BOUTON SOUMETTRE ── */}
          <TouchableOpacity onPress={handleUpdate} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={['#FF6B00', '#FF8C38']} style={styles.saveBtn}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.saveBtnText}>ENREGISTRER LES MODIFICATIONS</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={form.date}
          mode="datetime"
          display="spinner"
          is24Hour={true}
          onChange={(e, d) => {
            setShowDatePicker(false);
            if (d) setForm({ ...form, date: d });
          }}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  // ── HEADER ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 14,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.hText, letterSpacing: 0.2 },
  headerSub: { fontSize: 12, color: C.hText2, marginTop: 2 },

  // ── SECTION CARD ──
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: C.text3,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16,
  },

  // ── FIELD ──
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: C.text3,
    letterSpacing: 0.8, marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card2, borderRadius: 14,
    height: 52, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.border,
  },
  inputField: {
    flex: 1, fontSize: 15, color: C.text, fontWeight: '600',
  },

  // ── DATE BTN ──
  dateBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card2, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: C.border, gap: 12,
  },
  dateBtnIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.brand + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  dateBtnTime: { fontSize: 18, fontWeight: '800', color: C.text },
  dateBtnDate: { fontSize: 12, color: C.text2, marginTop: 2, textTransform: 'capitalize' },

  // ── SAVE BTN ──
  saveBtn: {
    borderRadius: 16, height: 56,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.brand, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.8 },
});
