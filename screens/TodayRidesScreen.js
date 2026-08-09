import React, { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, FlatList, Platform, TextInput, Modal, RefreshControl, StatusBar, Linking
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import dayjs from 'dayjs';
import { startRideById, finishRideById, cancelRideById, acceptWebBooking, rejectWebBooking } from '../services/api';
import { useData } from '../contexts/DataContext';
import C from '../styles/tokens';

// ─── Waze helper (globale) ───────────────────────────────────────────────────
const openWaze = async (addr) => {
  if (!addr) return;
  const encoded = encodeURIComponent(addr);
  const wazeNative = `waze://?q=${encoded}&navigate=yes`;
  const wazeWeb    = `https://waze.com/ul?q=${encoded}&navigate=yes`;
  try {
    const canWaze = await Linking.canOpenURL(wazeNative);
    await Linking.openURL(canWaze ? wazeNative : wazeWeb);
  } catch {
    Linking.openURL(`https://maps.google.com/?q=${encoded}`).catch(() => {});
  }
};

const STATUS_CONFIG = {
  'À venir':    { color: '#3D7FFF', bg: '#EBF0FF', icon: 'time-outline',              grad: ['#3D7FFF', '#2255DD'] },
  'En attente': { color: '#FFB800', bg: '#FFF8E0', icon: 'hourglass-outline',         grad: ['#FFB800', '#FF8800'] },
  'En cours':   { color: '#00D68F', bg: '#E0FFF5', icon: 'navigate-outline',          grad: ['#00D68F', '#00B87A'] },
  'Terminée':   { color: '#7A90B2', bg: '#F0F4FF', icon: 'checkmark-circle-outline',  grad: ['#7A90B2', '#4B5E7A'] },
  'Annulée':    { color: '#FF3355', bg: '#FFF0F3', icon: 'close-circle-outline',      grad: ['#FF3355', '#CC0033'] },
};

const RIDE_ORDER = { 'En cours': 0, 'À venir': 1, 'En attente': 1, 'Terminée': 2, 'Annulée': 3 };

export default function TodayRidesScreen({ navigation }) {
  const { allRides, loading, loadData, updateLocalRide, removeLocalRide } = useData();

  const [finishModal, setFinishModal] = useState({ visible: false, rideId: null, ride: null });
  const [distance, setDistance] = useState('');
  const [tolls, setTolls]       = useState('');

  const [cancelModal, setCancelModal] = useState({ visible: false, rideId: null, patientName: '' });
  const [cancelReason, setCancelReason] = useState('');

  const [returnModal, setReturnModal] = useState({ visible: false, ride: null });
  const [returnTime, setReturnTime] = useState(new Date());
  const [showReturnPicker, setShowReturnPicker] = useState(false);

  // ─── Focus states inputs ────────────────────────────────────────────────
  const [focusDistance, setFocusDistance] = useState(false);
  const [focusTolls, setFocusTolls] = useState(false);
  const [focusCancel, setFocusCancel] = useState(false);

  const todayStr = new Date().toDateString();

  const rides = useMemo(() => {
    const today = allRides.filter(r =>
      new Date(r.date).toDateString() === todayStr ||
      (r.source === 'Web' && r.status === 'En attente')
    );
    return [...today].sort((a, b) => {
      const d = (RIDE_ORDER[a.status] ?? 4) - (RIDE_ORDER[b.status] ?? 4);
      return d !== 0 ? d : new Date(a.date) - new Date(b.date);
    });
  }, [allRides, todayStr]);

  useFocusEffect(useCallback(() => { loadData(true); }, [loadData]));

  // ─── Actions ────────────────────────────────────────────────────────────
  const handleStart = async (id) => {
    try {
      const updated = await startRideById(id);
      updateLocalRide(updated);
      const addr = updated.startLocation;
      if (addr) {
        const encoded = encodeURIComponent(addr);
        const wazeNative = `waze://?q=${encoded}&navigate=yes`;
        const wazeWeb    = `https://waze.com/ul?q=${encoded}&navigate=yes`;
        Linking.canOpenURL(wazeNative).then(can =>
          Linking.openURL(can ? wazeNative : wazeWeb).catch(() => {})
        );
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de démarrer la course.');
    }
  };

  const openFinishModal = (ride) => {
    setFinishModal({ visible: true, rideId: ride._id, ride });
    setTolls('');
    const norm = a => (a || '').trim().toLowerCase();
    const past = allRides.find(r =>
      r._id !== ride._id && r.status === 'Terminée' && r.realDistance > 0 &&
      norm(r.startLocation) === norm(ride.startLocation) &&
      norm(r.endLocation) === norm(ride.endLocation)
    );
    setDistance(past ? String(past.realDistance) : '');
  };

  const submitFinish = async () => {
    const km = parseFloat(distance?.trim());
    if (!km || isNaN(km) || km <= 0) return Alert.alert('Erreur', 'Distance invalide (km).');
    const { rideId, ride } = finishModal;
    try {
      const updated = await finishRideById(rideId, km, parseFloat(tolls) || 0);
      updateLocalRide(updated);
      setFinishModal({ visible: false, rideId: null, ride: null });
      setTimeout(() => {
        Alert.alert('Terminée ✓', `${ride?.patientName || 'Patient'} — Créer le retour ?`, [
          { text: 'Non', style: 'cancel' },
          { text: 'Retour →', onPress: () => openReturnModal(ride) },
        ]);
      }, 350);
    } catch {
      Alert.alert('Erreur', 'Impossible de terminer la course.');
    }
  };

  const openCancelModal = (ride) => {
    setCancelModal({ visible: true, rideId: ride._id, patientName: ride.patientName });
    setCancelReason('');
  };

  const handleAcceptWeb = async (id) => {
    Alert.alert('Accepter ?', 'La demande web sera ajoutée au planning.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Accepter ✓', onPress: async () => {
        try { const r = await acceptWebBooking(id); updateLocalRide(r.ride); }
        catch { Alert.alert('Erreur', "Impossible d'accepter."); }
      }},
    ]);
  };

  const handleRejectWeb = async (id, name) => {
    Alert.alert('Refuser ?', `La course de ${name} sera supprimée.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: async () => {
        try { await rejectWebBooking(id); removeLocalRide(id); }
        catch { Alert.alert('Erreur', 'Impossible de refuser.'); }
      }},
    ]);
  };

  const submitCancel = async () => {
    try {
      const updated = await cancelRideById(cancelModal.rideId, cancelReason);
      updateLocalRide(updated);
      setCancelModal({ visible: false, rideId: null, patientName: '' });
    } catch {
      Alert.alert('Erreur', "Impossible d'annuler la course.");
    }
  };

  const openReturnModal = (ride) => {
    setReturnTime(new Date());
    setShowReturnPicker(false);
    setReturnModal({ visible: true, ride });
  };

  const confirmReturn = () => {
    const { ride } = returnModal;
    setReturnModal({ visible: false, ride: null });
    navigation.navigate('Créer', {
      importedData: {
        patientName:   ride.patientName   || '',
        patientPhone:  ride.patientPhone  || '',
        patientNIR:    ride.patientNIR    || '',
        startLocation: ride.endLocation   || '',
        endLocation:   ride.startLocation || '',
        type:          ride.type          || 'VSL',
        motif:         ride.motif         || '',
        notes:         ride.notes         || '',
        date:          returnTime.toISOString(),
      },
    });
  };

  // ─── Stats header ────────────────────────────────────────────────────────
  const headerStats = useMemo(() => ({
    total:    rides.filter(r => r.status !== 'Annulée').length,
    done:     rides.filter(r => r.status === 'Terminée').length,
    active:   rides.filter(r => r.status === 'En cours').length,
    upcoming: rides.filter(r => r.status === 'À venir' || r.status === 'En attente').length,
  }), [rides]);

  // ─── Render ride card ────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const cfg         = STATUS_CONFIG[item.status] || STATUS_CONFIG['À venir'];
    const isFinished  = item.status === 'Terminée';
    const isCancelled = item.status === 'Annulée';
    const isActive    = item.status === 'En cours';
    const isWebPending = item.source === 'Web' && item.status === 'En attente';

    const duration = isFinished && item.startTime && item.endTime
      ? dayjs(item.endTime).diff(dayjs(item.startTime), 'minutes')
      : null;

    /* ── CARTE WEB ÉPURÉE ── */
    if (isWebPending) {
      return (
        <View style={styles.webCard}>
          <View style={styles.webCardStripe} />
          <View style={styles.webCardInner}>

            {/* Date + heure */}
            <View style={styles.webCardTopRow}>
              <Ionicons name="globe-outline" size={12} color="#92400E" />
              <Text style={styles.webCardDate}>
                {dayjs(item.date).format('ddd D MMM · HH:mm')}
              </Text>
              <View style={styles.webCardBadge}>
                <Text style={styles.webCardBadgeTxt}>À traiter</Text>
              </View>
            </View>

            {/* Nom patient */}
            <Text style={styles.webCardName} numberOfLines={1}>{item.patientName}</Text>

            {/* Note si présente */}
            {item.notes ? (
              <Text style={styles.webCardNote} numberOfLines={1}>{item.notes}</Text>
            ) : null}

            {/* Bouton itinéraire */}
            <TouchableOpacity
              style={styles.btnItinerary}
              activeOpacity={0.85}
              onPress={() => {
                const from = encodeURIComponent(item.startLocation || '');
                const to   = encodeURIComponent(item.endLocation   || '');
                const wazeNative = `waze://?q=${to}&navigate=yes`;
                const googleRoute = `https://www.google.com/maps/dir/?api=1&origin=${from}&destination=${to}&travelmode=driving`;
                Linking.canOpenURL(wazeNative).then(can =>
                  Linking.openURL(can ? wazeNative : googleRoute).catch(() => {})
                );
              }}
            >
              <Ionicons name="map-outline" size={14} color="#FFF" />
              <Text style={styles.btnItineraryText}>Voir l'itinéraire</Text>
            </TouchableOpacity>

            {/* Accepter / Refuser */}
            <View style={styles.webActions}>
              <TouchableOpacity style={styles.btnAccept} onPress={() => handleAcceptWeb(item._id)} activeOpacity={0.85}>
                <LinearGradient colors={[C.green, '#00B87A']} style={styles.btnGrad}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                  <Text style={styles.btnGradText}>Accepter</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnReject} onPress={() => handleRejectWeb(item._id, item.patientName)} activeOpacity={0.85}>
                <Ionicons name="close" size={16} color={C.red} />
                <Text style={styles.btnRejectText}>Refuser</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.card, (isFinished || isCancelled) && styles.cardDim]}>

        {/* Accent latéral coloré */}
        <LinearGradient
          colors={cfg.grad}
          style={styles.cardStripe}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        <View style={styles.cardInner}>
          {/* Heure + badge */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.timeText, (isFinished || isCancelled) && styles.dimmed]}>
                {dayjs(item.date).format('HH:mm')}
              </Text>
              {isActive && (
                <View style={styles.liveRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>EN COURS</Text>
                </View>
              )}
            </View>
            <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color + '33' }]}>
              <Ionicons name={cfg.icon} size={11} color={cfg.color} />
              <Text style={[styles.statusPillText, { color: cfg.color }]}>{item.status}</Text>
            </View>
          </View>

          {/* Patient */}
          <Text style={[styles.patientName, (isFinished || isCancelled) && styles.dimmed]} numberOfLines={1}>
            {item.patientName}
          </Text>
          {item.patientPhone ? <Text style={styles.phoneText}>{item.patientPhone}</Text> : null}

          {/* Trajet */}
          <View style={styles.routeBlock}>
            <TouchableOpacity
              style={styles.routeRow}
              onPress={() => !isFinished && !isCancelled && openWaze(item.startLocation)}
              activeOpacity={isFinished || isCancelled ? 1 : 0.7}
            >
              <View style={[styles.routeDot, { backgroundColor: C.green }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>Départ</Text>
                <Text style={[styles.routeText, (isFinished || isCancelled) && styles.dimmed]} numberOfLines={1}>
                  {item.startLocation}
                </Text>
              </View>
              {!isFinished && !isCancelled && (
                <Ionicons name="navigate-outline" size={13} color={C.green + 'AA'} />
              )}
            </TouchableOpacity>
            <View style={styles.routeVLine} />
            <TouchableOpacity
              style={styles.routeRow}
              onPress={() => !isFinished && !isCancelled && openWaze(item.endLocation)}
              activeOpacity={isFinished || isCancelled ? 1 : 0.7}
            >
              <View style={[styles.routeDot, { backgroundColor: C.brand, borderRadius: 2 }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>Arrivée</Text>
                <Text style={[styles.routeText, (isFinished || isCancelled) && styles.dimmed]} numberOfLines={1}>
                  {item.endLocation}
                </Text>
              </View>
              {!isFinished && !isCancelled && (
                <Ionicons name="navigate-outline" size={13} color={C.brand + 'AA'} />
              )}
            </TouchableOpacity>
          </View>

          {/* Info terminée */}
          {isFinished && (
            <View style={styles.finishedRow}>
              <Ionicons name="checkmark-circle" size={13} color={C.text3} />
              <Text style={styles.finishedText}>
                {item.endTime ? `Terminée à ${dayjs(item.endTime).format('HH:mm')}` : 'Terminée'}
                {duration !== null ? ` · ${duration} min` : ''}
                {item.realDistance > 0 ? ` · ${item.realDistance} km` : ''}
                {item.tolls > 0 ? ` · Péages ${item.tolls} €` : ''}
              </Text>
            </View>
          )}

          {/* Bouton créer retour */}
          {isFinished && (
            <TouchableOpacity
              style={styles.btnRetour}
              onPress={() => openReturnModal(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="repeat" size={14} color={C.brand} />
              <Text style={styles.btnRetourText}>Créer le retour</Text>
            </TouchableOpacity>
          )}

          {/* Raison annulation */}
          {isCancelled && (
            <View style={styles.cancelRow}>
              <Ionicons name="close-circle-outline" size={13} color={C.red} />
              <Text style={styles.cancelText}>
                Annulée{item.cancelReason ? ` · ${item.cancelReason}` : ''}
              </Text>
            </View>
          )}

          {/* Notes */}
          {item.notes ? (
            <View style={styles.noteBox}>
              <Ionicons name="chatbox-ellipses" size={12} color={C.brand} />
              <Text style={styles.noteText} numberOfLines={2}>{item.notes}</Text>
            </View>
          ) : null}

          {/* Actions normales */}
          {!isFinished && !isCancelled && !isWebPending && (
            <View style={styles.actions}>
              {!isActive ? (
                <TouchableOpacity
                  style={[styles.btnStart, loading && { opacity: 0.5 }]}
                  onPress={() => handleStart(item._id)}
                  activeOpacity={loading ? 1 : 0.85}
                >
                  <LinearGradient colors={['#040C1E', '#0D1A30']} style={styles.btnGrad}>
                    <Ionicons name="play" size={15} color="#FFF" />
                    <Text style={styles.btnGradText}>Démarrer</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.btnFinish, loading && { opacity: 0.5 }]}
                  onPress={() => openFinishModal(item)}
                  activeOpacity={loading ? 1 : 0.85}
                >
                  <LinearGradient colors={['#FF5500', '#FF0055']} style={styles.btnGrad}>
                    <Ionicons name="flag" size={15} color="#FFF" />
                    <Text style={styles.btnGradText}>Terminer</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btnCancelPill} onPress={() => openCancelModal(item)}>
                <Ionicons name="close" size={15} color={C.red} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      {/* ═══ HEADER GRADIENT ═══ */}
      <View
        style={[styles.header, {backgroundColor: "#FFFFFF"}]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerLabel}>Courses du jour</Text>
            <Text style={styles.headerDate}>{dayjs().format('dddd D MMMM')}</Text>
          </View>
          {headerStats.active > 0 && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDotHeader} />
              <Text style={styles.liveBadgeText}>{headerStats.active} en cours</Text>
            </View>
          )}
        </View>

        {/* Stats pills */}
        <View style={styles.headerPills}>
          <View style={styles.pill}>
            <Text style={styles.pillValue}>{headerStats.total}</Text>
            <Text style={styles.pillLabel}>total</Text>
          </View>
          <View style={styles.pillDivider} />
          <View style={styles.pill}>
            <Text style={[styles.pillValue, { color: C.electric }]}>{headerStats.upcoming}</Text>
            <Text style={styles.pillLabel}>à venir</Text>
          </View>
          <View style={styles.pillDivider} />
          <View style={styles.pill}>
            <Text style={[styles.pillValue, { color: C.green }]}>{headerStats.done}</Text>
            <Text style={styles.pillLabel}>terminées</Text>
          </View>
        </View>
      </View>

      {/* ═══ LISTE ═══ */}
      {loading && rides.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => loadData(true)}
              tintColor={C.brand}
              colors={[C.brand]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <LinearGradient
                colors={[C.brand + '18', C.brand + '08']}
                style={styles.emptyInner}
              >
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="calendar-outline" size={34} color={C.brand} />
                </View>
                <Text style={styles.emptyTitle}>Journée libre</Text>
                <Text style={styles.emptySub}>Aucune course aujourd'hui</Text>
              </LinearGradient>
            </View>
          }
        />
      )}

      {/* ═══ MODAL TERMINER ═══ */}
      <Modal
        visible={finishModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setFinishModal({ visible: false, rideId: null, ride: null })}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Terminer la course</Text>
            {finishModal.ride?.patientName && (
              <Text style={styles.sheetSub}>{finishModal.ride.patientName}</Text>
            )}

            <Text style={styles.fieldLabel}>Distance parcourue (km) *</Text>
            <View style={[styles.inputWrap, focusDistance && { borderColor: C.brand }]}>
              <Ionicons name="speedometer-outline" size={18} color={C.text3} />
              <TextInput
                style={styles.input}
                value={distance}
                onChangeText={setDistance}
                placeholder="Ex : 12.5"
                placeholderTextColor={C.text3}
                keyboardType="decimal-pad"
                autoFocus
                onFocus={() => setFocusDistance(true)}
                onBlur={() => setFocusDistance(false)}
              />
            </View>

            <Text style={styles.fieldLabel}>Péages (€) — optionnel</Text>
            <View style={[styles.inputWrap, focusTolls && { borderColor: C.brand }]}>
              <Ionicons name="card-outline" size={18} color={C.text3} />
              <TextInput
                style={styles.input}
                value={tolls}
                onChangeText={setTolls}
                placeholder="Ex : 3.50"
                placeholderTextColor={C.text3}
                keyboardType="decimal-pad"
                onFocus={() => setFocusTolls(true)}
                onBlur={() => setFocusTolls(false)}
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.sheetBtnCancel}
                onPress={() => setFinishModal({ visible: false, rideId: null, ride: null })}
              >
                <Text style={styles.sheetBtnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetBtnPrimary} onPress={submitFinish} activeOpacity={0.85}>
                <LinearGradient colors={['#FF5500', '#FF0055']} style={styles.sheetBtnGrad}>
                  <Ionicons name="flag" size={16} color="#FFF" />
                  <Text style={styles.sheetBtnPrimaryText}>Valider</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODAL ANNULER ═══ */}
      <Modal
        visible={cancelModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModal({ visible: false, rideId: null, patientName: '' })}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Annuler la course</Text>
            <Text style={styles.sheetSub}>{cancelModal.patientName}</Text>

            <Text style={styles.fieldLabel}>Motif (optionnel)</Text>
            <View style={[styles.inputWrap, { height: 90, alignItems: 'flex-start', paddingTop: 12 }, focusCancel && { borderColor: C.brand }]}>
              <Ionicons name="chatbox-outline" size={18} color={C.text3} style={{ marginTop: 2 }} />
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Patient hospitalisé, transport annulé..."
                placeholderTextColor={C.text3}
                multiline
                onFocus={() => setFocusCancel(true)}
                onBlur={() => setFocusCancel(false)}
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.sheetBtnCancel}
                onPress={() => setCancelModal({ visible: false, rideId: null, patientName: '' })}
              >
                <Text style={styles.sheetBtnCancelText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetBtnPrimary} onPress={submitCancel} activeOpacity={0.85}>
                <LinearGradient colors={[C.red, '#DC2626']} style={styles.sheetBtnGrad}>
                  <Ionicons name="close-circle" size={16} color="#FFF" />
                  <Text style={styles.sheetBtnPrimaryText}>Confirmer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODAL CRÉER LE RETOUR ═══ */}
      <Modal
        visible={returnModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setReturnModal({ visible: false, ride: null })}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Créer le retour</Text>
            {returnModal.ride?.patientName && (
              <Text style={styles.sheetSub}>{returnModal.ride.patientName}</Text>
            )}

            {/* Adresses inversées */}
            {returnModal.ride && (
              <View style={styles.returnAddresses}>
                <View style={styles.returnAddrRow}>
                  <View style={[styles.routeDot, { backgroundColor: C.green }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.returnAddrLabel}>Départ (retour)</Text>
                    <Text style={styles.returnAddrText} numberOfLines={2}>
                      {returnModal.ride.endLocation || '—'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.routeVLine, { marginLeft: 5 }]} />
                <View style={styles.returnAddrRow}>
                  <View style={[styles.routeDot, { backgroundColor: C.brand, borderRadius: 2 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.returnAddrLabel}>Arrivée (retour)</Text>
                    <Text style={styles.returnAddrText} numberOfLines={2}>
                      {returnModal.ride.startLocation || '—'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Heure de départ */}
            <Text style={styles.fieldLabel}>Heure de départ du retour</Text>
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
                style={styles.sheetBtnCancel}
                onPress={() => setReturnModal({ visible: false, ride: null })}
              >
                <Text style={styles.sheetBtnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetBtnPrimary} onPress={confirmReturn} activeOpacity={0.85}>
                <LinearGradient colors={[C.brand, '#2255DD']} style={styles.sheetBtnGrad}>
                  <Ionicons name="repeat" size={16} color="#FFF" />
                  <Text style={styles.sheetBtnPrimaryText}>Créer le retour</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── HEADER ──
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 50,
    paddingHorizontal: 20,
    paddingBottom: 24,
    },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  headerLabel: { color: C.hText2, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  headerDate: {
    color: C.hText, fontSize: 24, fontWeight: '800',
    textTransform: 'capitalize', letterSpacing: -0.5, marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.green + '22', borderWidth: 1, borderColor: C.green + '44',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  liveDotHeader: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  liveBadgeText: { color: C.green, fontSize: 12, fontWeight: '700' },

  headerPills: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.hCard, borderWidth: 1, borderColor: C.hBorder,
    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14,
  },
  pill: { flex: 1, alignItems: 'center', gap: 2 },
  pillValue: { color: C.hText, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  pillLabel: { color: C.hText2, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pillDivider: { width: 1, height: 32, backgroundColor: C.hBorder },

  // ── LISTE ──
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 160 },

  // ── CARD ──
  card: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#1A2550',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 3,
  },
  cardDim: { opacity: 0.72 },
  cardStripe: { width: 5 },
  cardInner: { flex: 1, padding: 16 },

  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10,
  },
  timeText: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -1 },
  dimmed: { color: C.text3 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  liveText: { fontSize: 10, fontWeight: '800', color: C.green, letterSpacing: 1.5 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  patientName: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 2 },
  phoneText: { fontSize: 12, color: C.text2, marginBottom: 10 },

  routeBlock: {
    backgroundColor: C.card2, borderRadius: 14, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: C.border,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeVLine: { height: 10, width: 1, backgroundColor: C.border, marginLeft: 3, marginVertical: 4 },
  routeLabel: { fontSize: 9, color: C.text3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeText: { fontSize: 14, color: C.text, fontWeight: '500', marginTop: 1 },

  finishedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  finishedText: { color: C.text3, fontSize: 12, fontStyle: 'italic', flex: 1 },

  cancelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.red + '22',
  },
  cancelText: { color: C.red, fontSize: 12, fontWeight: '600' },

  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.brand + '0C', padding: 10, borderRadius: 10,
    marginBottom: 10, borderLeftWidth: 2, borderLeftColor: C.brand + '66', gap: 7,
  },
  noteText: { fontSize: 13, color: C.text2, flex: 1, lineHeight: 18 },

  // ── ACTIONS ──
  actions: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, gap: 10,
  },
  btnStart: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  btnFinish: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  btnGrad: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 13, gap: 7,
  },
  btnGradText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  btnCancelPill: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: C.red + '10', borderWidth: 1, borderColor: C.red + '28',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Carte web épurée ──
  webCard: {
    flexDirection: 'row', backgroundColor: '#FFFBEB',
    borderRadius: 14, marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#FDE68A',
  },
  webCardStripe: { width: 4, backgroundColor: '#F59E0B' },
  webCardInner: { flex: 1, padding: 14 },
  webCardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  webCardDate: { flex: 1, fontSize: 13, fontWeight: '700', color: '#92400E', textTransform: 'capitalize' },
  webCardBadge: {
    backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A',
  },
  webCardBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  webCardName: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 4 },
  webCardNote: { fontSize: 12, color: C.text2, fontStyle: 'italic', marginBottom: 10 },

  // Web actions
  webBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 12, borderRadius: 8,
  },
  webBannerText: { fontSize: 10, fontWeight: '800', color: '#92400E', letterSpacing: 0.4 },
  webActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btnAccept: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  btnReject: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.red + '10', borderRadius: 14, gap: 7,
    borderWidth: 1, borderColor: C.red + '28',
  },
  btnRejectText: { color: C.red, fontWeight: '800', fontSize: 14 },

  // ── EMPTY ──
  empty: { marginTop: 40, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: C.brand + '22' },
  emptyInner: { alignItems: 'center', paddingVertical: 40 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: C.brand + '18', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: C.brand + '28',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  emptySub: { fontSize: 13, color: C.text2, marginTop: 5 },

  // ── MODALS ──
  overlay: {
    flex: 1, backgroundColor: 'rgba(28,25,23,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 42 : 28,
    borderTopWidth: 1, borderColor: C.border,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: C.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 24,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 2 },
  sheetSub: { fontSize: 14, color: C.text2, marginBottom: 20 },

  fieldLabel: {
    fontSize: 11, color: C.text2, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginTop: 16,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card2, borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.border, height: 52,
  },
  input: { flex: 1, fontSize: 16, color: C.text, fontWeight: '600' },

  sheetActions: { flexDirection: 'row', marginTop: 28, gap: 12 },
  sheetBtnCancel: {
    flex: 1, paddingVertical: 15, borderRadius: 16,
    backgroundColor: C.card2, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  sheetBtnCancelText: { color: C.text2, fontWeight: '700', fontSize: 15 },
  sheetBtnPrimary: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  sheetBtnGrad: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 15, gap: 8,
  },
  sheetBtnPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  // ── BOUTON ITINÉRAIRE WEB ──
  btnItinerary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 10, marginBottom: 2,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#3D7FFF',
    borderRadius: 20,
  },
  btnItineraryText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // ── BOUTON CRÉER RETOUR (carte) ──
  btnRetour: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: C.brand + '12',
    borderRadius: 20,
    borderWidth: 1, borderColor: C.brand + '33',
  },
  btnRetourText: { color: C.brand, fontSize: 12, fontWeight: '700' },

  // ── MODAL RETOUR ──
  returnAddresses: {
    backgroundColor: C.card2, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border, marginTop: 4,
  },
  returnAddrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  returnAddrLabel: {
    fontSize: 9, color: C.text3, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  returnAddrText: { fontSize: 13, color: C.text, fontWeight: '500', lineHeight: 18 },

  timePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card2, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  timePickerText: {
    flex: 1, fontSize: 28, fontWeight: '800',
    color: C.text, textAlign: 'center', letterSpacing: 1,
  },
});
