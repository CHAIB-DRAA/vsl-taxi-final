import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, FlatList, Platform, TextInput, Modal, RefreshControl, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/fr';
import { getTodayRides, startRideById, finishRideById, cancelRideById, acceptWebBooking, rejectWebBooking } from '../services/api';

const C = {
  bg:     '#F2F3F7',
  card:   '#FFFFFF',
  card2:  '#F5F7FB',
  border: '#E2E5EC',
  text:   '#111827',
  text2:  '#6B7280',
  text3:  '#9CA3AF',
  brand:  '#FF6B00',
  green:  '#16A34A',
  red:    '#EF4444',
};

const STATUS_CONFIG = {
  'À venir':    { color: '#2563EB', bg: '#EFF6FF', icon: 'time-outline' },
  'En attente': { color: '#D97706', bg: '#FFFBEB', icon: 'hourglass-outline' },
  'En cours':   { color: '#16A34A', bg: '#F0FDF4', icon: 'navigate-outline' },
  'Terminée':   { color: '#9CA3AF', bg: '#F9FAFB', icon: 'checkmark-circle-outline' },
  'Annulée':    { color: '#EF4444', bg: '#FFF1F2', icon: 'close-circle-outline' },
};

export default function TodayRidesScreen() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal fin de course
  const [finishModal, setFinishModal] = useState({ visible: false, rideId: null });
  const [distance, setDistance] = useState('');
  const [tolls, setTolls] = useState('');

  // Modal annulation
  const [cancelModal, setCancelModal] = useState({ visible: false, rideId: null, patientName: '' });
  const [cancelReason, setCancelReason] = useState('');

  const fetchRides = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getTodayRides();
      // Tri : En cours d'abord, puis À venir par heure, puis Terminées, Annulées en dernier
      const order = { 'En cours': 0, 'À venir': 1, 'En attente': 1, 'Terminée': 2, 'Annulée': 3 };
      data.sort((a, b) => {
        const diff = (order[a.status] ?? 4) - (order[b.status] ?? 4);
        if (diff !== 0) return diff;
        return new Date(a.date) - new Date(b.date);
      });
      setRides(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer les courses.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  // Rafraîchit à chaque fois que l'onglet devient actif
  useFocusEffect(useCallback(() => { fetchRides(); }, [fetchRides]));

  const handleStart = async (id) => {
    try {
      const updated = await startRideById(id);
      setRides(prev => {
        const next = prev.map(r => r._id === id ? updated : r);
        next.sort((a, b) => {
          const order = { 'En cours': 0, 'À venir': 1, 'En attente': 1, 'Terminée': 2, 'Annulée': 3 };
          const diff = (order[a.status] ?? 4) - (order[b.status] ?? 4);
          return diff !== 0 ? diff : new Date(a.date) - new Date(b.date);
        });
        return next;
      });
    } catch {
      Alert.alert('Erreur', 'Impossible de démarrer la course.');
    }
  };

  const openFinishModal = (ride) => {
    setFinishModal({ visible: true, rideId: ride._id });
    setDistance('');
    setTolls('');
  };

  const submitFinish = async () => {
    const km = parseFloat(distance?.trim());
    if (!km || isNaN(km) || km <= 0) {
      return Alert.alert('Erreur', 'Entrez une distance valide (km).');
    }
    try {
      const updated = await finishRideById(finishModal.rideId, km, parseFloat(tolls) || 0);
      setRides(prev => prev.map(r => r._id === finishModal.rideId ? updated : r));
      setFinishModal({ visible: false, rideId: null });
    } catch {
      Alert.alert('Erreur', 'Impossible de terminer la course.');
    }
  };

  const openCancelModal = (ride) => {
    setCancelModal({ visible: true, rideId: ride._id, patientName: ride.patientName });
    setCancelReason('');
  };

  const handleAcceptWeb = async (id) => {
    Alert.alert('Accepter la course ?', 'La demande web sera ajoutée à votre planning.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Accepter ✓', onPress: async () => {
          try {
            const updated = await acceptWebBooking(id);
            setRides(prev => prev.map(r => r._id === id ? updated.ride : r));
          } catch {
            Alert.alert('Erreur', 'Impossible d\'accepter la demande.');
          }
        }
      },
    ]);
  };

  const handleRejectWeb = async (id, patientName) => {
    Alert.alert('Refuser la demande ?', `Refuser la course de ${patientName} ? Elle sera supprimée.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser', style: 'destructive', onPress: async () => {
          try {
            await rejectWebBooking(id);
            setRides(prev => prev.filter(r => r._id !== id));
          } catch {
            Alert.alert('Erreur', 'Impossible de refuser la demande.');
          }
        }
      },
    ]);
  };

  const submitCancel = async () => {
    try {
      const updated = await cancelRideById(cancelModal.rideId, cancelReason);
      setRides(prev => prev.map(r => r._id === cancelModal.rideId ? updated : r));
      setCancelModal({ visible: false, rideId: null, patientName: '' });
    } catch {
      Alert.alert('Erreur', "Impossible d'annuler la course.");
    }
  };

  const renderItem = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG['À venir'];
    const isFinished  = item.status === 'Terminée';
    const isCancelled = item.status === 'Annulée';
    const isActive    = item.status === 'En cours';
    const isWebPending = item.source === 'Web' && item.status === 'En attente';

    const duration = isFinished && item.startTime && item.endTime
      ? moment(item.endTime).diff(moment(item.startTime), 'minutes')
      : null;

    const accentColor = isWebPending ? '#D97706'
      : isCancelled ? C.red
      : isFinished  ? C.text3
      : isActive    ? C.green
      : C.border;

    return (
      <View style={[styles.card, { borderLeftColor: accentColor, borderLeftWidth: isWebPending ? 4 : 3 }]}>

        {/* BANDEAU DEMANDE WEB */}
        {isWebPending && (
          <View style={styles.webBanner}>
            <Ionicons name="globe-outline" size={13} color="#92400E" />
            <Text style={styles.webBannerText}>DEMANDE VIA LE SITE WEB — À TRAITER</Text>
          </View>
        )}

        {/* HEADER : heure + statut */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.timeText, (isFinished || isCancelled) && styles.dimmed]}>
              {moment(item.date).format(isWebPending ? 'ddd D MMM · HH:mm' : 'HH:mm')}
            </Text>
            {isActive && (
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>EN COURS</Text>
              </View>
            )}
          </View>
          {!isWebPending && (
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '44' }]}>
              <Ionicons name={cfg.icon} size={12} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{item.status}</Text>
            </View>
          )}
        </View>

        {/* PATIENT */}
        <Text style={[styles.patientName, (isFinished || isCancelled) && styles.dimmed]} numberOfLines={1}>
          {item.patientName}
        </Text>
        {item.patientPhone ? (
          <Text style={styles.phoneText}>{item.patientPhone}</Text>
        ) : null}

        {/* TRAJET */}
        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: C.green }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Départ</Text>
              <Text style={[styles.routeText, (isFinished || isCancelled) && styles.dimmed]} numberOfLines={1}>
                {item.startLocation}
              </Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, styles.dotSquare, { backgroundColor: C.brand }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Arrivée</Text>
              <Text style={[styles.routeText, (isFinished || isCancelled) && styles.dimmed]} numberOfLines={1}>
                {item.endLocation}
              </Text>
            </View>
          </View>
        </View>

        {/* INFO TERMINÉE */}
        {isFinished && (
          <View style={styles.finishedRow}>
            <Ionicons name="checkmark-circle" size={13} color={C.text3} />
            <Text style={styles.finishedText}>
              Terminée{item.endTime ? ` à ${moment(item.endTime).format('HH:mm')}` : ''}
              {duration !== null ? ` · ${duration} min` : ''}
              {item.realDistance > 0 ? ` · ${item.realDistance} km` : ''}
              {item.tolls > 0 ? ` · Péages ${item.tolls}€` : ''}
            </Text>
          </View>
        )}

        {/* RAISON ANNULATION */}
        {isCancelled && (
          <View style={styles.cancelRow}>
            <Ionicons name="close-circle-outline" size={13} color={C.red} />
            <Text style={styles.cancelText}>
              Annulée{item.cancelReason ? ` · ${item.cancelReason}` : ''}
            </Text>
          </View>
        )}

        {/* NOTES */}
        {item.notes ? (
          <View style={styles.noteBox}>
            <Ionicons name="chatbox-ellipses" size={13} color={C.brand} />
            <Text style={styles.noteText} numberOfLines={2}>{item.notes}</Text>
          </View>
        ) : null}

        {/* ACTIONS DEMANDE WEB */}
        {isWebPending && (
          <View style={styles.webActions}>
            <TouchableOpacity style={styles.btnAccept} onPress={() => handleAcceptWeb(item._id)}>
              <Ionicons name="checkmark" size={18} color="#FFF" />
              <Text style={styles.btnAcceptText}>Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnReject} onPress={() => handleRejectWeb(item._id, item.patientName)}>
              <Ionicons name="close" size={18} color={C.red} />
              <Text style={styles.btnRejectText}>Refuser</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ACTIONS NORMALES */}
        {!isFinished && !isCancelled && !isWebPending && (
          <View style={styles.actions}>
            {!isActive ? (
              <TouchableOpacity style={styles.btnStart} onPress={() => handleStart(item._id)}>
                <Ionicons name="play" size={16} color="#000" />
                <Text style={styles.btnStartText}>Démarrer</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.btnFinish} onPress={() => openFinishModal(item)}>
                <Ionicons name="flag" size={16} color="#FFF" />
                <Text style={styles.btnFinishText}>Terminer</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnCancelIcon} onPress={() => openCancelModal(item)}>
              <Ionicons name="close" size={16} color={C.red} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const stats = rides.reduce(
    (acc, r) => ({
      total: acc.total + 1,
      done: acc.done + (r.status === 'Terminée' ? 1 : 0),
      active: acc.active + (r.status === 'En cours' ? 1 : 0),
    }),
    { total: 0, done: 0, active: 0 }
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Aujourd'hui</Text>
          <Text style={styles.headerDate}>{moment().format('dddd D MMMM')}</Text>
        </View>
        <View style={styles.headerStats}>
          {stats.active > 0 ? (
            <View style={styles.activeBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.activeBadgeText}>{stats.active} en cours</Text>
            </View>
          ) : (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{stats.total} courses</Text>
            </View>
          )}
          {stats.done > 0 && (
            <Text style={styles.doneCount}>{stats.done} terminée{stats.done > 1 ? 's' : ''}</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRides(true)}
              colors={['#FF6B00']}
              tintColor="#FF6B00"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyCircle}>
                <Ionicons name="calendar-outline" size={38} color={C.brand} />
              </View>
              <Text style={styles.emptyTitle}>Journée libre</Text>
              <Text style={styles.emptySubtitle}>Aucune course aujourd'hui</Text>
            </View>
          }
        />
      )}

      {/* MODAL TERMINER */}
      <Modal visible={finishModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Terminer la course</Text>
            <Text style={styles.modalLabel}>Distance parcourue (km) *</Text>
            <TextInput
              style={styles.modalInput}
              value={distance}
              onChangeText={setDistance}
              placeholder="Ex: 12.5"
              placeholderTextColor={C.text3}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.modalLabel}>Péages (€) — optionnel</Text>
            <TextInput
              style={styles.modalInput}
              value={tolls}
              onChangeText={setTolls}
              placeholder="Ex: 3.50"
              placeholderTextColor={C.text3}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setFinishModal({ visible: false, rideId: null })}
              >
                <Text style={styles.modalBtnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={submitFinish}>
                <Text style={styles.modalBtnPrimaryText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL ANNULER */}
      <Modal visible={cancelModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Annuler la course</Text>
            <Text style={styles.modalSub}>{cancelModal.patientName}</Text>
            <Text style={styles.modalLabel}>Motif d'annulation (optionnel)</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Ex: Patient hospitalisé, transport annulé..."
              placeholderTextColor={C.text3}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setCancelModal({ visible: false, rideId: null, patientName: '' })}
              >
                <Text style={styles.modalBtnSecondaryText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnPrimary, { backgroundColor: C.red }]} onPress={submitCancel}>
                <Text style={styles.modalBtnPrimaryText}>Confirmer</Text>
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

  header: {
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  headerDate: { fontSize: 13, color: C.brand, fontWeight: '600', textTransform: 'capitalize', marginTop: 2 },
  headerStats: { alignItems: 'flex-end', gap: 4 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.green + '22', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1, borderColor: C.green + '44',
  },
  activeBadgeText: { color: C.green, fontSize: 12, fontWeight: '700' },
  countPill: {
    backgroundColor: C.card, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  countText: { color: C.text2, fontSize: 12, fontWeight: '600' },
  doneCount: { fontSize: 11, color: C.text3, fontWeight: '600' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 160 },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: C.border,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  timeText: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -1 },
  dimmed: { color: C.text3 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  liveText: { fontSize: 10, fontWeight: '800', color: C.green, letterSpacing: 1.5 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, gap: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  patientName: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 3 },
  phoneText: { fontSize: 12, color: C.text2, marginBottom: 10 },

  route: { backgroundColor: C.card2, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotSquare: { borderRadius: 2 },
  routeLabel: { fontSize: 10, color: C.text3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeText: { fontSize: 14, color: C.text, fontWeight: '500', marginTop: 1 },
  routeLine: { height: 1, backgroundColor: C.border, marginVertical: 8, marginLeft: 18 },

  finishedRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 6, marginBottom: 4 },
  finishedText: { color: C.text3, fontSize: 12, fontStyle: 'italic', flex: 1 },
  cancelRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.red + '22', gap: 6, marginBottom: 4 },
  cancelText: { color: C.red, fontSize: 12, fontWeight: '600' },

  noteBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card2, padding: 10, borderRadius: 10, marginBottom: 10, borderLeftWidth: 2, borderLeftColor: C.brand, gap: 7 },
  noteText: { fontSize: 13, color: '#CCC', flex: 1, lineHeight: 18 },

  actions: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, gap: 10,
  },
  btnStart: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#111827', paddingVertical: 13, borderRadius: 12, gap: 8,
  },
  btnStartText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  btnFinish: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.brand, paddingVertical: 13, borderRadius: 12, gap: 8,
  },
  btnFinishText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  btnCancelIcon: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.red + '11', borderRadius: 12, borderWidth: 1, borderColor: C.red + '33',
  },

  // Demande web
  webBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 12,
  },
  webBannerText: {
    fontSize: 10, fontWeight: '800', color: '#92400E', letterSpacing: 0.4,
  },
  webActions: {
    flexDirection: 'row', gap: 10, marginTop: 14,
  },
  btnAccept: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#16A34A', paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  btnAcceptText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  btnReject: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.red + '11', paddingVertical: 14, borderRadius: 12, gap: 8,
    borderWidth: 1, borderColor: C.red + '33',
  },
  btnRejectText: { color: C.red, fontWeight: '800', fontSize: 14 },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.brand + '15', alignItems: 'center', justifyContent: 'center',
    marginBottom: 18, borderWidth: 1, borderColor: C.brand + '22',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  emptySubtitle: { fontSize: 13, color: C.text2, marginTop: 5 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1, borderColor: C.border,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: C.text2, marginBottom: 20 },
  modalLabel: { fontSize: 12, color: C.text2, fontWeight: '600', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: {
    backgroundColor: C.card2, borderRadius: 12, padding: 14,
    fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border,
  },
  modalActions: { flexDirection: 'row', marginTop: 24, gap: 12 },
  modalBtnSecondary: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.card2, alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  modalBtnSecondaryText: { color: C.text2, fontWeight: '700', fontSize: 15 },
  modalBtnPrimary: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.brand, alignItems: 'center',
  },
  modalBtnPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
