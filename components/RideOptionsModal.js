import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';

const C = {
  bg:     '#F2F3F7',
  card:   '#FFFFFF',
  card2:  '#F5F7FB',
  border: '#E2E5EC',
  text:   '#060E1E',
  text2:  '#6B7280',
  brand:  '#FF5500',
};

const ACTIONS_ACTIVE = [
  { key: 'edit',       label: 'Modifier',  icon: 'create-outline',             bg: '#F5F7FB', color: '#060E1E' },
  { key: 'return',     label: 'Retour',    icon: 'swap-horizontal-outline',     bg: '#F5F7FB', color: '#060E1E' },
  { key: 'sms',        label: 'SMS',       icon: 'chatbubble-ellipses-outline', bg: '#F5F7FB', color: '#060E1E' },
  { key: 'calendar',   label: 'Agenda',    icon: 'calendar-outline',            bg: '#F5F7FB', color: '#060E1E' },
  { key: 'dispatch',   label: 'Envoyer',   icon: 'paper-plane-outline',         bg: '#F5F7FB', color: '#060E1E' },
  { key: 'docs',       label: 'Dossier',   icon: 'folder-open-outline',         bg: '#F5F7FB', color: '#060E1E' },
  { key: 'share',      label: 'Partager',  icon: 'share-social-outline',        bg: '#F5F7FB', color: '#060E1E' },
  { key: 'delete',     label: 'Supprimer', icon: 'trash-outline',               bg: '#FFF1F2', color: '#EF4444' },
];

const ACTIONS_DONE = [
  { key: 'edit',   label: 'Modifier',        icon: 'create-outline',         bg: '#F5F7FB', color: '#060E1E' },
  { key: 'return', label: 'Créer le retour', icon: 'swap-horizontal-outline', bg: '#EFF6FF', color: '#3B82F6' },
  { key: 'delete', label: 'Supprimer',       icon: 'trash-outline',           bg: '#FFF1F2', color: '#EF4444' },
];

export default function RideOptionsModal({
  visible, onClose, ride,
  onEdit, onCreateReturn, onAddToCalendar, onOpenDocs, onShare, onDelete, onDispatch, onSendSMS,
}) {
  const handlerMap = {
    edit:     onEdit,
    return:   onCreateReturn,
    sms:      onSendSMS,
    calendar: onAddToCalendar,
    dispatch: onDispatch,
    docs:     onOpenDocs,
    share:    onShare,
    delete:   onDelete,
  };

  const isFinished  = ride?.status === 'Terminée';
  const isCancelled = ride?.status === 'Annulée';

  const statusColor = isFinished ? '#9CA3AF'
    : isCancelled  ? '#EF4444'
    : ride?.status === 'En cours' ? '#16A34A'
    : C.brand;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>

          {ride ? (
            <>
              {/* ── POIGNÉE ── */}
              <View style={styles.handle} />

              {/* ── HEADER COURSE ── */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <View>
                    <Text style={styles.patientName} numberOfLines={1}>{ride.patientName}</Text>
                    <Text style={styles.rideInfo}>
                      {dayjs(ride.date).format('HH:mm')}
                      {'  ·  '}
                      {ride.startLocation?.split(',')[0]}
                      {' → '}
                      {ride.endLocation?.split(',')[0]}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Ionicons name="close" size={20} color={C.text2} />
                </TouchableOpacity>
              </View>

              {/* ── STATUT ── */}
              <View style={[styles.statusBar, { borderColor: statusColor + '33', backgroundColor: statusColor + '11' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{ride.status || 'À venir'}</Text>
                <Text style={styles.statusDate}>{dayjs(ride.date).format('dddd D MMMM')}</Text>
              </View>

              {/* ── ACTIONS ── */}
              {isFinished ? (
                // Course terminée : 3 boutons larges empilés
                <View style={styles.doneActions}>
                  {ACTIONS_DONE.map((a) => (
                    <TouchableOpacity
                      key={a.key}
                      style={[styles.doneBtn, { backgroundColor: a.bg, borderColor: a.color + '33' }]}
                      onPress={() => { handlerMap[a.key]?.(); }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.doneBtnIcon, { backgroundColor: a.color + '18' }]}>
                        <Ionicons name={a.icon} size={20} color={a.color} />
                      </View>
                      <Text style={[styles.doneBtnLabel, { color: a.color }]}>{a.label}</Text>
                      <Ionicons name="chevron-forward" size={16} color={a.color + '66'} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                // Course non terminée : grille complète
                <View style={styles.grid}>
                  {ACTIONS_ACTIVE.map((a) => (
                    <TouchableOpacity
                      key={a.key}
                      style={[styles.actionItem, { backgroundColor: a.bg }]}
                      onPress={() => { handlerMap[a.key]?.(); }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.actionIconBox, { borderColor: a.color + '30' }]}>
                        <Ionicons name={a.icon} size={22} color={a.color} />
                      </View>
                      <Text style={[styles.actionLabel, { color: a.color }]}>
                        {a.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={{ height: Platform.OS === 'ios' ? 20 : 8 }} />
            </>
          ) : null}

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },

  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },
  rideInfo: {
    fontSize: 13,
    color: C.text2,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    backgroundColor: C.card2,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  // STATUS BAR
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 13,
  },
  statusDate: {
    color: C.text2,
    fontSize: 13,
    textTransform: 'capitalize',
  },

  // GRID
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionItem: {
    width: '22%',
    aspectRatio: 0.85,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
    flexGrow: 1,
  },
  actionIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.card2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Boutons course terminée ──
  doneActions: { gap: 10, marginBottom: 4 },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  doneBtnIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  doneBtnLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
});
