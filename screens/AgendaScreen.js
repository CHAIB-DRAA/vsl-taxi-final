import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet, Alert, Vibration, View, Text,
  TouchableOpacity, ActivityIndicator, FlatList,
  Clipboard, Modal, TextInput, Platform, StatusBar,
  Linking, Share, ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import dayjs from 'dayjs';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useData } from '../contexts/DataContext';
import api, { deleteRide, startRideById, finishRideById, shareRide, createRide } from '../services/api';
import { addRideToCalendar, syncBatchRides } from '../services/calendarService';

import { calculatePriceDetailed } from '../utils/pricing';
import AgendaHeader from '../components/agenda/AgendaHeader';
import AgendaList   from '../components/agenda/AgendaList';
import RideOptionsModal from '../components/RideOptionsModal';
import C from '../styles/tokens';

// Ligne de détail tarification dans le modal "Terminer"
function BRow({ label, value, bold, sub, color }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ flex: 1, fontSize: 12, color: sub ? C.text3 : C.text2, paddingRight: 6, paddingLeft: sub ? 8 : 0 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 12, fontWeight: bold ? '800' : '600', color: color || (bold ? C.text : C.text2), minWidth: 70, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

export default function AgendaScreen({ navigation }) {
  const { allRides, loading, ridesError, loadData, addLocalRide, removeLocalRide, updateLocalRide, contacts } = useData();

  const [selectedDate, setSelectedDate]     = useState(dayjs().format('YYYY-MM-DD'));
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
  const [returnTime, setReturnTime]         = useState(new Date());
  const [showReturnPicker, setShowReturnPicker] = useState(false);

  // Focus states for finishModal inputs
  const [focusDistance, setFocusDistance] = useState(false);
  const [focusTolls, setFocusTolls]       = useState(false);

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

  const getDefaultReturnDelay = (ride) => {
    const motif = ride?.motif || '';
    if (motif === 'HDJ') return 240;           // 4h
    if (motif === 'Hospitalisation') return 0;  // pas de retour automatique
    if (motif === 'Traitement') return 120;     // 2h
    return 90; // 1h30 par défaut (Consultation)
  };

  const handleCreateReturn = () => {
    if (!activeRide) return;
    closeOptions();
    setReturnTime(dayjs().add(getDefaultReturnDelay(activeRide), 'minutes').toDate());
    setShowReturnPicker(false);
    setModals(m => ({ ...m, returnTime: true }));
  };

  const confirmReturn = async () => {
    const d = dayjs(returnTime).second(0).toISOString();
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
      `${dayjs(activeRide.date).format('DD/MM à HH:mm')}. ` +
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
      `Date : ${dayjs(activeRide.date).format('DD/MM à HH:mm')}\n` +
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

  const doFinishRide = async () => {
    const km   = parseFloat(finishDistance?.trim());
    const tls  = parseFloat(finishTolls?.trim()) || 0;
    try {
      const updated = await finishRideById(finishRide._id, km, tls, finishBonTransport.trim());
      updateLocalRide(updated);
      setModals(m => ({ ...m, finish: false }));
      setFinishRide(null);
    } catch {
      Alert.alert('Erreur', 'Impossible de terminer la course.');
    }
  };

  const submitFinish = async () => {
    const km   = parseFloat(finishDistance?.trim());
    const tls  = parseFloat(finishTolls?.trim()) || 0;
    if (!km || isNaN(km) || km <= 0) return Alert.alert('Erreur', 'Distance invalide.');

    // Si le bon de transport n'est pas saisi, avertir (mais ne pas bloquer)
    if (!finishBonTransport || finishBonTransport.trim() === '') {
      return Alert.alert(
        '⚠️ Bon de transport',
        "Le numéro de bon de transport n'est pas renseigné. Sans ce numéro, le remboursement CPAM peut être refusé.\n\nContinuer sans bon de transport ?",
        [
          { text: 'Ajouter le numéro', style: 'cancel' },
          { text: 'Continuer quand même', onPress: async () => { await doFinishRide(); } }
        ]
      );
    }
    await doFinishRide();
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
      .filter(r => dayjs(r.date).format('YYYY-MM-DD') === selectedDate && r.status !== 'Annulée' && !(r.source === 'Web' && r.status === 'En attente'))
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [allRides, selectedDate]
  );

  const markedDates = useMemo(() => {
    const marks = {};
    allRides.forEach(r => {
      const d = dayjs(r.date).format('YYYY-MM-DD');
      if (!marks[d]) marks[d] = { dots: [] };
      const color = r.status === 'Terminée' ? C.text3
        : r.status === 'En cours'  ? C.green
        : C.brand;
      if (marks[d].dots.length < 3) marks[d].dots.push({ color });
    });
    return marks;
  }, [allRides]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <AgendaHeader
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        showCalendar={showCalendar}
        toggleCalendar={() => setShowCalendar(v => !v)}
        markedDates={markedDates}
      />

      {/* ── BANNIÈRE ERREUR ── */}
      {ridesError === 'auth' && (
        <View style={styles.errorBanner}>
          <Ionicons name="lock-closed-outline" size={15} color="#FFF" />
          <Text style={styles.errorBannerText}>Session expirée — Réglages → Déconnexion</Text>
        </View>
      )}
      {ridesError === 'network' && (
        <View style={[styles.errorBanner, { backgroundColor: C.text2 }]}>
          <Ionicons name="cloud-offline-outline" size={15} color="#FFF" />
          <Text style={styles.errorBannerText}>Erreur réseau — Tirez pour réessayer</Text>
        </View>
      )}

      {/* ── BARRE OUTILS ── */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.magicBtnWrapper, analyzing && { opacity: 0.6 }]}
          onPress={handleMagicPaste}
          disabled={analyzing}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[C.brand, '#E55A00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.magicBtn}
          >
            {analyzing
              ? <ActivityIndicator size="small" color="#FFF" />
              : <>
                  <Ionicons name="sparkles" size={18} color="#FFF" />
                  <Text style={styles.magicBtnText}>MAGIC PASTE</Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddRide')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color={C.brand} />
        </TouchableOpacity>
      </View>

      {/* ── COMPTEUR JOURNÉE ── */}
      {dailyRides.length > 0 && (
        <View style={styles.daySummaryBar}>
          <Text style={styles.daySummaryText}>
            {dailyRides.length} course{dailyRides.length > 1 ? 's' : ''} ce jour
          </Text>
          <View style={styles.daySummaryDots}>
            {dailyRides.slice(0, 5).map((r, i) => (
              <View
                key={i}
                style={[
                  styles.daySummaryDot,
                  {
                    backgroundColor:
                      r.status === 'Terminée' ? C.text3
                      : r.status === 'En cours' ? C.green
                      : C.brand,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

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
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Envoyer à un collègue</Text>
            {contacts.length === 0 ? (
              <Text style={styles.sheetEmptyText}>
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
                    <LinearGradient
                      colors={[C.brand, '#E55A00']}
                      style={styles.dispatchAvatar}
                    >
                      <Text style={styles.dispatchAvatarText}>
                        {item.contactId?.fullName?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </LinearGradient>
                    <Text style={styles.dispatchName}>
                      {item.contactId?.fullName || 'Inconnu'}
                    </Text>
                    <Ionicons name="send" size={20} color={C.brand} />
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModals(m => ({ ...m, dispatch: false }))}
            >
              <Text style={styles.cancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL HEURE RETOUR ── */}
      <Modal visible={modals.returnTime} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Heure du retour</Text>
            {activeRide && (
              <View style={styles.returnAddrPreview}>
                <View style={styles.returnAddrRow}>
                  <View style={[styles.returnDot, { backgroundColor: C.green }]} />
                  <Text style={styles.returnAddrText} numberOfLines={1}>
                    {activeRide.endLocation}
                  </Text>
                </View>
                <View style={styles.returnVLine} />
                <View style={styles.returnAddrRow}>
                  <View style={[styles.returnDot, { backgroundColor: C.brand, borderRadius: 2 }]} />
                  <Text style={styles.returnAddrText} numberOfLines={1}>
                    {activeRide.startLocation}
                  </Text>
                </View>
              </View>
            )}
            <Text style={styles.inputLabel}>Heure de départ :</Text>
            <TouchableOpacity
              style={styles.timePickerBtn}
              onPress={() => setShowReturnPicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={20} color={C.brand} />
              <Text style={styles.timePickerText}>{dayjs(returnTime).format('HH:mm')}</Text>
              <Ionicons name="chevron-down" size={16} color={C.text3} />
            </TouchableOpacity>
            {showReturnPicker && (
              <DateTimePicker
                value={returnTime}
                mode="time"
                is24Hour
                display="spinner"
                onChange={(event, selectedTime) => {
                  if (Platform.OS !== 'ios') setShowReturnPicker(false);
                  if (selectedTime) setReturnTime(selectedTime);
                }}
              />
            )}
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModals(m => ({ ...m, returnTime: false }))}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnWrapper} onPress={confirmReturn} activeOpacity={0.85}>
                <LinearGradient colors={[C.brand, '#E55A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtn}>
                  <Ionicons name="repeat" size={16} color="#FFF" />
                  <Text style={styles.confirmBtnText}>Créer le retour</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL TERMINER ── */}
      <Modal visible={modals.finish} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetCard, { maxHeight: '92%' }]}>
            <View style={styles.sheetHandle} />

            {/* Titre + info patient */}
            <View style={styles.finishHeader}>
              <Text style={styles.sheetTitle}>Terminer la course</Text>
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
                  <Text style={styles.inputLabel}>Distance (km)</Text>
                  <TextInput
                    style={[styles.sheetInput, { borderColor: focusDistance ? C.brand : C.border }]}
                    value={finishDistance}
                    onChangeText={setFinishDistance}
                    placeholder="Ex : 12.5"
                    placeholderTextColor={C.text3}
                    keyboardType="decimal-pad"
                    autoFocus
                    onFocus={() => setFocusDistance(true)}
                    onBlur={() => setFocusDistance(false)}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Péages (€)</Text>
                  <TextInput
                    style={[styles.sheetInput, { borderColor: focusTolls ? C.brand : C.border }]}
                    value={finishTolls}
                    onChangeText={setFinishTolls}
                    placeholder="0.00"
                    placeholderTextColor={C.text3}
                    keyboardType="decimal-pad"
                    onFocus={() => setFocusTolls(true)}
                    onBlur={() => setFocusTolls(false)}
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
                      <Ionicons name="calculator-outline" size={16} color={C.text3} />
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
                      <Ionicons name="receipt-outline" size={13} color={C.brand} />
                      <Text style={styles.breakdownHeadText}>DÉTAIL CPAM</Text>
                    </View>

                    <BRow label="Forfait de base  (4 km inclus)" value="13,00 €" />
                    {d.metropole && (
                      <BRow label="+ Supplément Grande Ville" value={`+${d.metropoleCost.toFixed(2)} €`} color={C.purple} />
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
                        color={C.amber}
                      />
                    )}
                    {d.multiplicateurAbattement < 1 && (
                      <BRow
                        label={`× Abattement  ${d.nbPass} patients  (−${Math.round((1 - d.multiplicateurAbattement) * 100)}%)`}
                        value={`−${(d.socleAvecNuit - d.socleApresAbattement).toFixed(2)} €`}
                        color={C.green}
                      />
                    )}
                    {d.isTpmr && (
                      <BRow label="+ Supplément TPMR" value={`+${d.tpmrCost.toFixed(2)} €`} color={C.purple} />
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
                <Text style={styles.inputLabel}>Bon de transport n° (optionnel)</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={finishBonTransport}
                  onChangeText={setFinishBonTransport}
                  placeholder="Ex : 2026-12345"
                  placeholderTextColor={C.text3}
                  autoCapitalize="characters"
                />
              </View>

            </ScrollView>

            {/* Boutons fixes en bas */}
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setModals(m => ({ ...m, finish: false })); setFinishRide(null); }}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnWrapper} onPress={submitFinish} activeOpacity={0.85}>
                <LinearGradient colors={[C.brand, '#E55A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtn}>
                  <Text style={styles.confirmBtnText}>Terminer</Text>
                </LinearGradient>
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

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.red, paddingHorizontal: 16, paddingVertical: 10,
  },
  errorBannerText: { color: '#FFF', fontSize: 13, fontWeight: '600', flex: 1 },

  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  magicBtnWrapper: { flex: 1 },
  magicBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
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

  daySummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: C.card2,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  daySummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daySummaryDots: { flexDirection: 'row', gap: 5 },
  daySummaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Bottom Sheet ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28,25,23,0.70)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: C.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    borderTopWidth: 1,
    borderColor: C.border,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sheetEmptyText: {
    color: C.text2,
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 14,
  },

  finishHeader: { marginBottom: 16 },
  finishSubtitle: { fontSize: 12, color: C.text2, marginTop: 4 },
  finishRow: { flexDirection: 'row', marginBottom: 16 },

  inputLabel: {
    fontSize: 11,
    color: C.text2,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetInput: {
    backgroundColor: C.card2,
    color: C.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: C.border,
  },

  // Détail tarification dans modal Terminer
  breakdownBlock: {
    backgroundColor: C.card2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  breakdownHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  breakdownHeadText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.brand,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  breakdownSep: { height: 1, backgroundColor: C.border, marginVertical: 6 },
  breakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: C.brand,
  },
  breakdownTotalLabel: { fontSize: 12, fontWeight: '900', color: C.text, letterSpacing: 0.5 },
  breakdownTotalValue: { fontSize: 22, fontWeight: '900', color: C.brand },
  breakdownEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  breakdownEmptyText: { fontSize: 12, color: C.text3, fontStyle: 'italic', flex: 1 },

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
    justifyContent: 'center',
    alignItems: 'center',
  },
  dispatchAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  dispatchName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: C.card2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelBtnText: { color: C.text2, fontWeight: '700', fontSize: 15 },
  confirmBtnWrapper: { flex: 2 },
  confirmBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  confirmBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  // ── MODAL RETOUR ──
  returnAddrPreview: {
    backgroundColor: C.card2, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: 14,
  },
  returnAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  returnDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  returnVLine: { height: 10, width: 1, backgroundColor: C.border, marginLeft: 3, marginVertical: 4 },
  returnAddrText: { flex: 1, fontSize: 13, color: C.text, fontWeight: '500' },
  timePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 4,
  },
  timePickerText: {
    flex: 1, fontSize: 28, fontWeight: '800',
    color: C.text, textAlign: 'center', letterSpacing: 1,
  },
});
