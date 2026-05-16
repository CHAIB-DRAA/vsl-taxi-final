import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/fr';
import * as Clipboard from 'expo-clipboard';
import { calculatePrice } from '../utils/pricing';

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

const TYPE_COLOR = {
  Aller:        '#FF6B00',
  Retour:       '#3B82F6',
  Consultation: '#F59E0B',
  Hospit:       '#8B5CF6',
  HDJ:          '#06B6D4',
  VSL:          '#3B82F6',
  Ambulance:    '#EF4444',
  Autre:        '#6B7280',
};

export default function RideCard({ ride, onPress, onRespond, onStatusChange }) {
  const isFinished  = ride.status === 'Terminée' || !!ride.endTime;
  const isCancelled = ride.status === 'Annulée';
  const isActive    = !!ride.startTime && !isFinished && !isCancelled;

  const pendingStatus    = ride.shareStatus === 'pending' || ride.statusPartage === 'pending';
  const showResponseBtns = ride.isShared && pendingStatus;

  const noteContent = (ride.shareNote || ride.notes || '').trim();
  const needsPMT    = (ride.type === 'VSL' || ride.type === 'Ambulance') && !isFinished && !isCancelled;
  const typeColor   = TYPE_COLOR[ride.type] || TYPE_COLOR.Autre;

  const duration = isFinished && ride.startTime && ride.endTime
    ? moment(ride.endTime).diff(moment(ride.startTime), 'minutes')
    : null;

  const handleCopy = async () => {
    const txt =
      `${ride.type} — ${moment(ride.date).format('DD/MM à HH:mm')}\n` +
      `${ride.patientName}${ride.patientPhone ? ` · ${ride.patientPhone}` : ''}\n` +
      `${ride.startLocation} → ${ride.endLocation}` +
      (noteContent ? `\n${noteContent}` : '');
    await Clipboard.setStringAsync(txt);
    Alert.alert('Copié ✓', '');
  };

  const openWaze = (isStart) => {
    const addr = isStart ? ride.startLocation : ride.endLocation;
    if (!addr) return;
    Linking.openURL(`https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`)
      .catch(() => Alert.alert('Erreur', "Waze n'est pas installé."));
  };

  const callPatient = () => {
    if (!ride.patientPhone) return;
    Linking.openURL(`tel:${ride.patientPhone}`);
  };

  // Indicateur couleur gauche
  const accentColor = isCancelled ? C.red
    : isFinished  ? C.text3
    : isActive    ? C.green
    : showResponseBtns ? C.brand
    : C.border;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => !showResponseBtns && onPress && onPress(ride)}
      disabled={showResponseBtns}
      style={[styles.card, { borderLeftColor: accentColor }]}
    >

      {/* ── HEURE + TYPE + COPIE ── */}
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.time, (isFinished || isCancelled) && styles.dimmed]}>
            {ride.startTime ? moment(ride.startTime).format('HH:mm') : moment(ride.date).format('HH:mm')}
          </Text>
          {isActive && (
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN COURS</Text>
            </View>
          )}
        </View>

        <View style={styles.topRight}>
          <TouchableOpacity onPress={handleCopy} style={styles.iconBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="copy-outline" size={15} color={C.text3} />
          </TouchableOpacity>
          <View style={[styles.typePill, { backgroundColor: typeColor + '22', borderColor: typeColor + '44' }]}>
            <Text style={[styles.typePillText, { color: typeColor }]}>{ride.type}</Text>
          </View>
        </View>
      </View>

      {/* ── SHARED BADGE ── */}
      {ride.isShared && (
        <View style={styles.sharedBadge}>
          <Ionicons name={showResponseBtns ? 'mail-outline' : 'arrow-undo-outline'} size={11} color={C.brand} />
          <Text style={styles.sharedText}>
            {showResponseBtns ? 'Invitation reçue' : `Via ${ride.sharedByName || 'collègue'}`}
          </Text>
        </View>
      )}

      {/* ── NOTE ── */}
      {noteContent ? (
        <View style={styles.noteBox}>
          <Ionicons name="chatbox-ellipses" size={13} color={C.brand} />
          <Text style={styles.noteText} numberOfLines={2}>{noteContent}</Text>
        </View>
      ) : null}

      {/* ── ALERTE PMT ── */}
      {needsPMT && (
        <View style={styles.pmtBox}>
          <Ionicons name="document-text-outline" size={13} color={C.red} />
          <Text style={styles.pmtText}>Demander le bon de transport</Text>
        </View>
      )}

      {/* ── PATIENT ── */}
      <View style={styles.patientRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.patientName, (isFinished || isCancelled) && styles.dimmed]} numberOfLines={1}>
            {ride.patientName}
          </Text>
          {ride.patientPhone ? (
            <Text style={styles.phone}>{ride.patientPhone}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.callBtn, (!ride.patientPhone || isFinished || isCancelled) && styles.callBtnOff]}
          onPress={callPatient}
          disabled={!ride.patientPhone || isFinished || isCancelled}
        >
          <Ionicons name="call" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* ── ITINÉRAIRE ── */}
      <View style={styles.routeBox}>
        <TouchableOpacity style={styles.routeRow} onPress={() => openWaze(true)} activeOpacity={0.7}>
          <View style={[styles.routeDot, { backgroundColor: C.green }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.routeLabel}>Départ</Text>
            <Text style={[styles.routeAddr, (isFinished || isCancelled) && styles.dimmed]} numberOfLines={1}>
              {ride.startLocation}
            </Text>
          </View>
          <Ionicons name="navigate-outline" size={14} color={C.text3} />
        </TouchableOpacity>

        <View style={styles.routeDivider} />

        <TouchableOpacity style={styles.routeRow} onPress={() => openWaze(false)} activeOpacity={0.7}>
          <View style={[styles.routeDot, styles.routeDotSquare, { backgroundColor: C.brand }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.routeLabel}>Arrivée</Text>
            <Text style={[styles.routeAddr, (isFinished || isCancelled) && styles.dimmed]} numberOfLines={1}>
              {ride.endLocation}
            </Text>
          </View>
          <Ionicons name="navigate-outline" size={14} color={C.text3} />
        </TouchableOpacity>
      </View>

      {/* ── TERMINÉE : résumé ── */}
      {isFinished && (
        <View style={styles.doneRow}>
          <Ionicons name="checkmark-circle" size={14} color={C.text3} />
          <Text style={[styles.doneText, { flex: 1 }]}>
            {ride.endTime ? `${moment(ride.endTime).format('HH:mm')}` : 'Terminée'}
            {duration !== null ? ` · ${duration} min` : ''}
            {ride.realDistance ? ` · ${ride.realDistance} km` : ''}
          </Text>
          {ride.realDistance > 0 && (
            <Text style={styles.priceTag}>{calculatePrice(ride)} €</Text>
          )}
          {ride.statuFacturation === 'Facturé' ? (
            <View style={styles.billedBadge}>
              <Ionicons name="checkmark-circle" size={10} color={C.green} />
              <Text style={styles.billedText}>Facturé</Text>
            </View>
          ) : (
            <View style={styles.unbilledBadge}>
              <Text style={styles.unbilledText}>À facturer</Text>
            </View>
          )}
        </View>
      )}

      {/* ── ANNULÉE ── */}
      {isCancelled && (
        <View style={styles.cancelRow}>
          <Ionicons name="close-circle-outline" size={14} color={C.red} />
          <Text style={styles.cancelText}>
            Annulée{ride.cancelReason ? ` · ${ride.cancelReason}` : ''}
          </Text>
        </View>
      )}

      {/* ── ACTIONS DÉMARRER / TERMINER ── */}
      {!showResponseBtns && !isFinished && !isCancelled && onStatusChange && (
        <View style={styles.actionRow}>
          {!isActive ? (
            <TouchableOpacity
              style={styles.btnStart}
              onPress={() => onStatusChange(ride, 'start')}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={16} color="#000" />
              <Text style={styles.btnStartText}>Démarrer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.btnFinish}
              onPress={() => onStatusChange(ride, 'finish')}
              activeOpacity={0.85}
            >
              <Ionicons name="flag" size={16} color="#FFF" />
              <Text style={styles.btnFinishText}>Terminer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── RÉPONDRE ── */}
      {showResponseBtns && (
        <View style={styles.respondRow}>
          <TouchableOpacity style={styles.btnRefuse} onPress={() => onRespond(ride, 'refused')}>
            <Ionicons name="close" size={15} color={C.red} />
            <Text style={styles.btnRefuseText}>Refuser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAccept} onPress={() => onRespond(ride, 'accepted')}>
            <Ionicons name="checkmark" size={15} color="#000" />
            <Text style={styles.btnAcceptText}>Accepter</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: C.border,
  },

  // TOP
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  time: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -1 },
  dimmed: { color: C.text3 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  liveText: { fontSize: 10, fontWeight: '800', color: C.green, letterSpacing: 1.5 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 30, height: 30, backgroundColor: C.card2, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  typePillText: { fontSize: 12, fontWeight: '700' },

  // BADGES
  sharedBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: C.card2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: C.brand + '44', gap: 4 },
  sharedText: { color: C.brand, fontSize: 11, fontWeight: '700' },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.card2, padding: 10, borderRadius: 10, marginBottom: 10, borderLeftWidth: 2, borderLeftColor: C.brand, gap: 7 },
  noteText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 18 },
  pmtBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.red + '11', padding: 8, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: C.red + '33', gap: 6 },
  pmtText: { color: C.red, fontWeight: '700', fontSize: 12 },

  // PATIENT
  patientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  patientName: { fontSize: 17, fontWeight: '700', color: C.text },
  phone: { fontSize: 12, color: C.text2, marginTop: 2 },
  callBtn: { width: 38, height: 38, backgroundColor: C.green, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  callBtnOff: { backgroundColor: C.card2 },

  // ROUTE
  routeBox: { backgroundColor: C.card2, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeDotSquare: { borderRadius: 2 },
  routeLabel: { fontSize: 10, color: C.text3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAddr: { fontSize: 14, color: C.text, fontWeight: '500', marginTop: 1 },
  routeDivider: { height: 1, backgroundColor: C.border, marginVertical: 8, marginLeft: 18 },

  // STATES
  doneRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 6 },
  doneText: { color: C.text3, fontSize: 12 },
  priceTag: { fontSize: 13, fontWeight: '800', color: C.brand },
  billedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#BBF7D0' },
  billedText: { fontSize: 10, fontWeight: '700', color: C.green },
  unbilledBadge: { backgroundColor: '#FFF7ED', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#FED7AA' },
  unbilledText: { fontSize: 10, fontWeight: '700', color: '#EA580C' },
  cancelRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.red + '22', gap: 6 },
  cancelText: { color: C.red, fontSize: 12, fontWeight: '600' },

  // ACTIONS
  actionRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  btnStart: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#111827', paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  btnStartText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  btnFinish: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.brand, paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  btnFinishText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  // RESPOND
  respondRow: { flexDirection: 'row', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  btnRefuse: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: C.card2, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.red + '44', gap: 5 },
  btnRefuseText: { color: C.red, fontWeight: '700', fontSize: 14 },
  btnAccept: { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827', paddingVertical: 12, borderRadius: 12, gap: 5 },
  btnAcceptText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
