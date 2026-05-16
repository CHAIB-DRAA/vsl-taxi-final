import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import dayjs from 'dayjs';
import { calculatePrice } from '../utils/pricing';

const RideHistoryCard = ({ item, hasConflict, onPress }) => {
  const isBilled = item.statuFacturation === 'Facturé';
  const displayPrice = calculatePrice(item);
  const rideDate = dayjs(item.date || item.startTime).format('DD/MM/YYYY');
  const rideTime = item.startTime ? dayjs(item.startTime).format('HH:mm') : '--:--';

  const copyAddr = async (e, text, label) => {
    e.stopPropagation();
    await Clipboard.setStringAsync(text);
    Alert.alert('Copié ✓', label);
  };

  return (
    <TouchableOpacity
      style={[styles.card, hasConflict && styles.cardConflicting]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>

        {/* COLONNE GAUCHE : heure + date */}
        <View style={[styles.dateCol, hasConflict && { borderRightColor: '#FFCDD2' }]}>
          <Text style={[styles.dayText, hasConflict && { color: '#D32F2F' }]}>{rideTime}</Text>
          <Text style={[styles.monthText, hasConflict && { color: '#D32F2F' }]}>{rideDate}</Text>
        </View>

        <View style={styles.detailsCol}>
          {/* Nom patient + partagé */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={styles.patientName} numberOfLines={1}>{item.patientName}</Text>
            {item.isShared && <Ionicons name="arrow-undo" size={14} color="#EF6C00" style={{ marginLeft: 5 }} />}
          </View>

          {/* Type + fin */}
          <View style={styles.infoRow}>
            <View style={styles.typeBadge}>
              <Ionicons name="car-outline" size={10} color="#0056b3" style={{ marginRight: 3 }} />
              <Text style={styles.typeBadgeText}>{item.type || 'Standard'}</Text>
            </View>
            <View style={styles.timeEndBox}>
              <Ionicons name="flag-outline" size={12} color="#999" style={{ marginRight: 4 }} />
              <Text style={styles.rideInfoText}>Fin : {item.endTime ? dayjs(item.endTime).format('HH:mm') : '--:--'}</Text>
            </View>
          </View>

          {/* Adresses (cliquables) */}
          <View style={styles.routeBlock}>
            <TouchableOpacity
              style={styles.routeLine}
              onPress={(e) => copyAddr(e, item.startLocation, 'Adresse de départ copiée')}
              activeOpacity={0.7}
            >
              <View style={[styles.routeDot, { backgroundColor: C.green }]} />
              <Text style={styles.routeText} numberOfLines={1}>{item.startLocation}</Text>
              <Ionicons name="copy-outline" size={11} color={C.text3} />
            </TouchableOpacity>
            <View style={styles.routeDivider} />
            <TouchableOpacity
              style={styles.routeLine}
              onPress={(e) => copyAddr(e, item.endLocation, 'Adresse d\'arrivée copiée')}
              activeOpacity={0.7}
            >
              <View style={[styles.routeDot, { backgroundColor: '#FF6B00', borderRadius: 2 }]} />
              <Text style={styles.routeText} numberOfLines={1}>{item.endLocation}</Text>
              <Ionicons name="copy-outline" size={11} color={C.text3} />
            </TouchableOpacity>
          </View>

          {/* Bon de transport */}
          {item.bonTransport ? (
            <View style={styles.btRow}>
              <Ionicons name="document-text-outline" size={10} color={C.text3} />
              <Text style={styles.btText}>BT n° {item.bonTransport}</Text>
            </View>
          ) : null}

          {/* Prix + statut */}
          <View style={styles.metaRow}>
            <Text style={styles.priceTextList}>{displayPrice} €</Text>
            {hasConflict ? (
              <View style={styles.conflictBadge}>
                <Ionicons name="warning" size={12} color="#D32F2F" style={{ marginRight: 3 }} />
                <Text style={styles.conflictBadgeText}>&lt; 10 min</Text>
              </View>
            ) : isBilled ? (
              <View style={styles.billedBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#2E7D32" style={{ marginRight: 3 }} />
                <Text style={styles.billedText}>Facturé</Text>
              </View>
            ) : (
              <Text style={styles.pendingText}>À facturer</Text>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#CCC" />
      </View>
    </TouchableOpacity>
  );
};

export default memo(RideHistoryCard);

const C = {
  bg: '#F2F3F7', card: '#FFFFFF', card2: '#F5F7FB',
  border: '#E2E5EC', text: '#111827', text2: '#6B7280', text3: '#9CA3AF',
  brand: '#FF6B00', green: '#16A34A', red: '#EF4444',
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 16, marginBottom: 10,
    padding: 14, borderLeftWidth: 3, borderLeftColor: 'transparent',
    borderWidth: 1, borderColor: C.border,
  },
  cardConflicting: { borderLeftColor: C.red, backgroundColor: '#FFF1F2' },
  cardContent: { flexDirection: 'row', alignItems: 'flex-start' },

  dateCol: {
    alignItems: 'center', paddingRight: 14,
    borderRightWidth: 1, borderRightColor: C.border, width: 82, paddingTop: 2,
  },
  dayText: { fontSize: 18, fontWeight: '800', color: C.text },
  monthText: { fontSize: 11, color: C.brand, fontWeight: '700', marginTop: 3 },

  detailsCol: { flex: 1, paddingLeft: 14 },
  patientName: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 8 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  typeBadgeText: { fontSize: 11, color: '#2563EB', fontWeight: '700', textTransform: 'capitalize' },
  timeEndBox: { flexDirection: 'row', alignItems: 'center' },
  rideInfoText: { fontSize: 12, color: C.text2 },

  routeBlock: {
    backgroundColor: C.card2, borderRadius: 8, padding: 8, marginTop: 8,
    borderWidth: 1, borderColor: C.border,
  },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
  routeDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  routeText: { flex: 1, fontSize: 11, color: C.text2, fontWeight: '500' },
  routeDivider: { height: 1, backgroundColor: C.border, marginLeft: 14, marginVertical: 1 },

  btRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  btText: { fontSize: 11, color: C.text3, fontWeight: '600' },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  priceTextList: { fontSize: 15, fontWeight: '800', color: C.green },
  billedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  billedText: { fontSize: 11, fontWeight: '700', color: C.green },
  pendingText: { fontSize: 11, color: C.brand, fontStyle: 'italic', fontWeight: '600' },
  conflictBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF1F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: '#FECACA',
  },
  conflictBadgeText: { fontSize: 11, fontWeight: '700', color: C.red },
});