import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet, Alert, Vibration, View, Text,
  TouchableOpacity, ActivityIndicator, FlatList,
  Clipboard, Modal, TextInput, Platform, StatusBar,
  Linking, Share, ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/fr';

import { useData } from '../contexts/DataContext';
import api, { deleteRide, startRideById, finishRideById, shareRide, createRide } from '../services/api';
import { addRideToCalendar, syncBatchRides } from '../services/calendarService';

import { calculatePriceDetailed } from '../utils/pricing';
import AgendaHeader from '../components/agenda/AgendaHeader';
import AgendaList   from '../components/agenda/AgendaList';
import RideOptionsModal from '../components/RideOptionsModal';

// Ligne de détail tarification dans le modal "Terminer"
function BRow({ label, value, bold, sub, color }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ flex: 1, fontSize: 12, color: sub ? '#9CA3AF' : '#6B7280', paddingRight: 6, paddingLeft: sub ? 8 : 0 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 12, fontWeight: bold ? '800' : '600', color: color || (bold ? '#111827' : '#374151'), minWidth: 70, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const C = {
  bg:     '#F2F3F7',
  card:   '#FFFFFF',
  card2:  '#F5F7FB',
  border: '#E2E5EC',
  text:   '#111827',
  text2:  '#6B7280',
  brand:  '#FF6B00',
  green:  '#16A34A',
  red:    '#EF4444',
};

export default function AgendaScreen({ navigation }) {
  const { allRides, loading, loadData, addLocalRide, removeLocalRide, updateLocalRide, contacts } = useData();

  const [selectedDate, setSelectedDate]     = useState(moment().format('YYYY-MM-DD'));
  const [showCalendar, setShowCalendar]     = useState(true);
  const [activeRide, setActiveRide]         = useState(null);
  const [analyzing, setAnalyzing]           = useState(false);
  const [modals, setModals]                 = useState({ options: false, dispatch: false, finish: false, returnTime: false });

  // Modal terminer la course depuis l'agenda
  const [finishDistance, setFinishDistance]         = useState('');
  const [finishTolls, setFinishTolls]               = useState('0');
  const [finishBonTransport, setFinishBonTransport] = useState('');
  const [finishRide, setFinishRide]                 = useState(null);

  // Modal heure de retour
  const [returnTimeStr, setReturnTimeStr]   = useState('');

  useFocusEffect(
    useCallback(() => { loadData(false); }, [])
  );

  // ── MAGIC PASTE ──
  const handleMagicPaste = async () => {
    setAnalyzing(true);
    try {
      const text = await Clipboard.getString();
      if (!text || text.trim().length < 5) {
        Vibration.vibrate(100);
        return Alert.alert('Rien à coller', 'Copie d\'abord un SMS de course.');
      }
      const response = await api.post('/ai/parse-ride', { text: text.trim() });
      const raw = response.data;
      const data = raw?.rides ? raw.rides[0] : (Array.isArray(raw) ? raw[0] : raw);
      if (data?.startLocation || data?.endLocation || data?.patientName) {
        Vibration.vibrate([0, 70, 50, 70]);
        navigation.navigate('AddRide', { importedData: data });
      } else {
        throw new Error('Non reconnu');
      }
    } catch (err) {
      Vibration.vibrate(200);
      Alert.alert('Échec IA', "Impossible de lire ce message. Vérifie que le texte contient un départ, une arrivée ou un patient.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── HANDLERS RideOptionsModal ──
  const closeOptions = () => {
    setModals(m => ({ ...m, options: false }));
  };

  const handleEdit = () => {
    const ride = activeRide;
    closeOptions();
    navigation.navigate('AddRide', { rideToEdit: ride });
  };

  const handleDelete = () => {
    closeOptions();
    Alert.alert(
      'Supprimer la course',
      `Supprimer la course de ${activeRide?.patientName} ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRide(activeRide._id);
              removeLocalRide(activeRide._id);
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer la course.');
              loadData(false);
            }
          },
        },
      ]
    );
  };

  const handleCreateReturn = () => {
    if (!activeRide) return;
    closeOptions();
    setReturnTimeStr(moment().add(10, 'minutes').format('HH:mm'));
    setModals(m => ({ ...m, returnTime: true }));
  };

  const confirmReturn = async () => {
    const parts = returnTimeStr.split(':');
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      return Alert.alert('Erreur', 'Format invalide. Ex : 14:30');
    }
    const h = parseInt(parts[0], 10);
    const min = parseInt(parts[1], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) {
      return Alert.alert('Erreur', 'Heure invalide.');
    }
    const d = moment().hours(h).minutes(min).seconds(0).toISOString();
    setModals(m => ({ ...m, returnTime: false }));
    try {
      const newRide = await createRide({
        patientName:   activeRide.patientName,
        patientPhone:  activeRide.patientPhone,
        startLocation: activeRide.endLocation,
        endLocation:   activeRide.startLocation,
        type:          'Retour',
        date:          d,
      });
      addLocalRide(newRide);
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le retour.');
    }
  };

  const handleAddToCalendar = async () => {
    if (!activeRide) return;
    closeOptions();
    await addRideToCalendar(activeRide);
  };

  const handleSendSMS = () => {
    if (!activeRide) return;
    closeOptions();
    const phone = activeRide.patientPhone;
    if (!phone) return Alert.alert('Info', 'Aucun numéro enregistré pour ce patient.');
    const msg =
      `Bonjour ${activeRide.patientName}, votre transport est confirmé le ` +
      `${moment(activeRide.date).format('DD/MM à HH:mm')}. ` +
      `Prise en charge : ${activeRide.startLocation}. Bonne journée.`;
    const url = Platform.OS === 'ios'
      ? `sms:${phone}&body=${encodeURIComponent(msg)}`
      : `sms:${phone}?body=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir SMS.'));
  };

  const handleShare = () => {
    if (!activeRide) return;
    closeOptions();
    const msg =
      `Course : ${activeRide.patientName}\n` +
      `Date : ${moment(activeRide.date).format('DD/MM à HH:mm')}\n` +
      `De : ${activeRide.startLocation}\n` +
      `À : ${activeRide.endLocation}`;
    Share.share({ message: msg });
  };

  const handleDispatch = () => {
    if (!activeRide) return;
    closeOptions();
    setModals(m => ({ ...m, dispatch: true }));
  };

  const handleSendDispatch = async (contact) => {
    if (!activeRide) return;
    try {
      await shareRide(activeRide._id, contact.contactId._id);
      setModals(m => ({ ...m, dispatch: false }));
      Alert.alert('Envoyé !', `Course partagée avec ${contact.contactId?.fullName}.`);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer la course.');
    }
  };

  const handleOpenDocs = () => {
    if (!activeRide) return;
    closeOptions();
    navigation.navigate('Documents', { patientName: activeRide.patientName });
  };

  // ── DÉMARRER / TERMINER depuis la card ──
  const handleStatusChange = async (ride, action) => {
    if (action === 'start') {
      try {
        const updated = await startRideById(ride._id);
        updateLocalRide(updated);
      } catch {
        Alert.alert('Erreur', 'Impossible de démarrer la course.');
      }
    } else if (action === 'finish') {
      setFinishRide(ride);
      setFinishDistance('');
      setFinishTolls('0');
      setFinishBonTransport('');
      setModals(m => ({ ...m, finish: true }));
    }
  };

  const submitFinish = async () => {
    const km   = parseFloat(finishDistance?.trim());
    const tls  = parseFloat(finishTolls?.trim()) || 0;
    if (!km || isNaN(km) || km <= 0) return Alert.alert('Erreur', 'Distance invalide.');
    try {
      const updated = await finishRideById(finishRide._id, km, tls, finishBonTransport.trim());
      updateLocalRide(updated);
      setModals(m => ({ ...m, finish: false }));
      setFinishRide(null);
    } catch {
      Alert.alert('Erreur', 'Impossible de terminer la course.');
    }
  };


  const handleRespond = useCallback(async (ride, action) => {
    try {
      await api.post('/rides/respond-share', { rideId: ride._id || ride.rideId, action });
      loadData(false);
    } catch {
      Alert.alert('Erreur', 'Impossible de répondre.');
    }
  }, [loadData]);

  // ── DONNÉES ──
  const dailyRides = useMemo(() =>
    allRides
      .filter(r => moment(r.date).format('YYYY-MM-DD') === selectedDate && r.status !== 'Annulée')
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [allRides, selectedDate]
  );

  const markedDates = useMemo(() => {
    const marks = {};
    allRides.forEach(r => {
      const d = moment(r.date).format('YYYY-MM-DD');
      if (!marks[d]) marks[d] = { dots: [] };
      const color = r.status === 'Terminée' ? '#9E9E9E'
        : r.status === 'En cours'  ? C.green
        : C.brand;
      if (marks[d].dots.length < 3) marks[d].dots.push({ color });
    });
    return marks;
  }, [allRides]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <AgendaHeader
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        showCalendar={showCalendar}
        toggleCalendar={() => setShowCalendar(v => !v)}
        markedDates={markedDates}
      />

      {/* ── BARRE OUTILS ── */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.magicBtn, analyzing && { opacity: 0.6 }]}
          onPress={handleMagicPaste}
          disabled={analyzing}
          activeOpacity={0.85}
        >
          {analyzing
            ? <ActivityIndicator size="small" color="#FFF" />
            : <>
                <Ionicons name="sparkles" size={18} color="#FFF" />
                <Text style={styles.magicBtnText}>MAGIC PASTE</Text>
              </>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddRide')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color={C.brand} />
        </TouchableOpacity>
      </View>

      {/* ── LISTE ── */}
      <AgendaList
        rides={dailyRides}
        loading={loading}
        onRefresh={() => loadData(false)}
        onCardPress={(r) => { setActiveRide(r); setModals(m => ({ ...m, options: true })); }}
        onStatusChange={handleStatusChange}
        onRespond={handleRespond}
        onSync={() => syncBatchRides(dailyRides)}
        onImport={handleMagicPaste}
      />

      {/* ── MODAL OPTIONS ── */}
      <RideOptionsModal
        visible={modals.options}
        ride={activeRide}
        onClose={closeOptions}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreateReturn={handleCreateReturn}
        onAddToCalendar={handleAddToCalendar}
        onSendSMS={handleSendSMS}
        onShare={handleShare}
        onDispatch={handleDispatch}
        onOpenDocs={handleOpenDocs}
      />

      {/* ── MODAL DISPATCH ── */}
      <Modal visible={modals.dispatch} transparent animationType="slide">
        <View style={styles.finishOverlay}>
          <View style={styles.finishCard}>
            <Text style={styles.finishTitle}>Envoyer à un collègue</Text>
            {contacts.length === 0 ? (
              <Text style={{ color: C.text2, textAlign: 'center', marginVertical: 20 }}>
                Aucun collègue dans vos contacts.
              </Text>
            ) : (
              <FlatList
                data={contacts}
                keyExtractor={item => item._id}
                style={{ maxHeight: 300, marginBottom: 16 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dispatchRow}
                    onPress={() => handleSendDispatch(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dispatchAvatar}>
                      <Text style={styles.dispatchAvatarText}>
                        {item.contactId?.fullName?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text style={styles.dispatchName}>
                      {item.contactId?.fullName || 'Inconnu'}
                    </Text>
                    <Ionicons name="send" size={20} color={C.brand} />
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.finishCancel}
              onPress={() => setModals(m => ({ ...m, dispatch: false }))}
            >
              <Text style={styles.finishCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL HEURE RETOUR ── */}
      <Modal visible={modals.returnTime} transparent animationType="slide">
        <View style={styles.finishOverlay}>
          <View style={styles.finishCard}>
            <Text style={styles.finishTitle}>Heure du retour</Text>
            <Text style={styles.finishLabel}>Heure de départ (HH:MM)</Text>
            <TextInput
              style={styles.finishInput}
              value={returnTimeStr}
              onChangeText={setReturnTimeStr}
              placeholder="14:30"
              placeholderTextColor="#999"
              keyboardType="numbers-and-punctuation"
              autoFocus
              maxLength={5}
            />
            <View style={styles.finishActions}>
              <TouchableOpacity
                style={styles.finishCancel}
                onPress={() => setModals(m => ({ ...m, returnTime: false }))}
              >
                <Text style={styles.finishCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.finishConfirm} onPress={confirmReturn}>
                <Text style={styles.finishConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL TERMINER ── */}
      <Modal visible={modals.finish} transparent animationType="slide">
        <View style={styles.finishOverlay}>
          <View style={styles.finishCard}>

            {/* Titre + info patient */}
            <View style={styles.finishHeader}>
              <Text style={styles.finishTitle}>Terminer la course</Text>
              {finishRide && (
                <Text style={styles.finishSubtitle} numberOfLines={1}>
                  {finishRide.patientName}  ·  {(finishRide.startLocation || '').split(',')[0]} → {(finishRide.endLocation || '').split(',')[0]}
                </Text>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Inputs */}
              <View style={styles.finishRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.finishLabel}>Distance (km)</Text>
                  <TextInput
                    style={styles.finishInput}
                    value={finishDistance}
                    onChangeText={setFinishDistance}
                    placeholder="Ex : 12.5"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.finishLabel}>Péages (€)</Text>
                  <TextInput
                    style={styles.finishInput}
                    value={finishTolls}
                    onChangeText={setFinishTolls}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Détail du calcul live */}
              {(() => {
                const km  = parseFloat(finishDistance);
                const tls = parseFloat(finishTolls) || 0;
                if (!km || km <= 0) {
                  return (
                    <View style={styles.breakdownEmpty}>
                      <Ionicons name="calculator-outline" size={16} color="#9CA3AF" />
                      <Text style={styles.breakdownEmptyText}>Saisis la distance pour voir le calcul</Text>
                    </View>
                  );
                }
                const d = calculatePriceDetailed({
                  ...finishRide,
                  realDistance: km,
                  tolls: tls,
                });
                if (!d) return null;
                return (
                  <View style={styles.breakdownBlock}>
                    <View style={styles.breakdownHead}>
                      <Ionicons name="receipt-outline" size={13} color="#FF6B00" />
                      <Text style={styles.breakdownHeadText}>DÉTAIL CPAM</Text>
                    </View>

                    <BRow label="Forfait de base  (4 km inclus)" value="13,00 €" />
                    {d.metropole && (
                      <BRow label="+ Supplément Grande Ville" value={`+${d.metropoleCost.toFixed(2)} €`} color="#7C3AED" />
                    )}
                    {d.billableKm > 0 && (
                      <BRow label={`+ ${d.billableKm} km × 1,10 €`} value={`+${d.kmCost.toFixed(2)} €`} />
                    )}
                    {d.retourVide && d.retourCost > 0 && (
                      <BRow
                        label={`  ↳ Retour à vide (${d.tauxRetour * 100}%)`}
                        value={`+${d.retourCost.toFixed(2)} €`}
                        sub
                      />
                    )}

                    <View style={styles.breakdownSep} />
                    <BRow label="Sous-total" value={`${d.socle.toFixed(2)} €`} bold />

                    {d.nuit && (
                      <BRow
                        label="× Nuit / WE / Férié  (+50%)"
                        value={`+${(d.socleAvecNuit - d.socle).toFixed(2)} €`}
                        color="#D97706"
                      />
                    )}
                    {d.multiplicateurAbattement < 1 && (
                      <BRow
                        label={`× Abattement  ${d.nbPass} patients  (−${Math.round((1 - d.multiplicateurAbattement) * 100)}%)`}
                        value={`−${(d.socleAvecNuit - d.socleApresAbattement).toFixed(2)} €`}
                        color="#16A34A"
                      />
                    )}
                    {d.isTpmr && (
                      <BRow label="+ Supplément TPMR" value={`+${d.tpmrCost.toFixed(2)} €`} color="#7C3AED" />
                    )}
                    {d.tollsParPatient > 0 && (
                      <BRow
                        label={d.nbPass > 1 ? `+ Péages (÷${d.nbPass})` : '+ Péages'}
                        value={`+${d.tollsParPatient.toFixed(2)} €`}
                      />
                    )}

                    <View style={styles.breakdownTotal}>
                      <Text style={styles.breakdownTotalLabel}>TOTAL CONVENTION</Text>
                      <Text style={styles.breakdownTotalValue}>{d.total.toFixed(2)} €</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Bon de transport */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.finishLabel}>Bon de transport n° (optionnel)</Text>
                <TextInput
                  style={styles.finishInput}
                  value={finishBonTransport}
                  onChangeText={setFinishBonTransport}
                  placeholder="Ex : 2026-12345"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                />
              </View>

            </ScrollView>

            {/* Boutons fixes en bas */}
            <View style={styles.finishActions}>
              <TouchableOpacity
                style={styles.finishCancel}
                onPress={() => { setModals(m => ({ ...m, finish: false })); setFinishRide(null); }}
              >
                <Text style={styles.finishCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.finishConfirm} onPress={submitFinish}>
                <Text style={styles.finishConfirmText}>Terminer</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  magicBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: C.brand,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  magicBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  addBtn: {
    width: 50,
    height: 50,
    backgroundColor: C.card,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  // Modal terminer
  finishOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  finishCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 20,
    borderTopWidth: 1,
    borderColor: '#E2E5EC',
    maxHeight: '90%',
  },
  finishHeader: { marginBottom: 16 },
  finishTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  finishSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  finishRow: { flexDirection: 'row', marginBottom: 16 },
  finishLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  finishInput: {
    backgroundColor: '#F5F7FB',
    color: '#111827',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#E2E5EC',
  },

  // Détail tarification dans modal Terminer
  breakdownBlock: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E5EC',
  },
  breakdownHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E5EC',
  },
  breakdownHeadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6B00',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  breakdownSep: { height: 1, backgroundColor: '#E2E5EC', marginVertical: 6 },
  breakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#FF6B00',
  },
  breakdownTotalLabel: { fontSize: 12, fontWeight: '900', color: '#111827', letterSpacing: 0.5 },
  breakdownTotalValue: { fontSize: 22, fontWeight: '900', color: '#EA580C' },
  breakdownEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E5EC',
  },
  breakdownEmptyText: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', flex: 1 },
  dispatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  dispatchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.brand + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dispatchAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.brand,
  },
  dispatchName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },

  finishActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  finishCancel: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: '#F5F7FB', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E5EC',
  },
  finishCancelText: { color: '#6B7280', fontWeight: '700', fontSize: 15 },
  finishConfirm: {
    flex: 2, paddingVertical: 16, borderRadius: 14,
    backgroundColor: C.brand, alignItems: 'center',
  },
  finishConfirmText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

});
