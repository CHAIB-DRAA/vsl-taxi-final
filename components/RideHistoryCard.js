import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { calculatePrice } from '../utils/pricing';

const C = {
  bg: '#F2F3F7', card: '#FFFFFF', card2: '#F5F7FB',
  border: '#E2E5EC', text: '#060E1E', text2: '#6B7280', text3: '#9CA3AF',
  brand: '#FF5500', green: '#16A34A', red: '#EF4444',
};

const RideHistoryCard = ({ item, hasConflict, onPress, pricesHidden = false }) => {
  const isBilled    = item.statuFacturation === 'Facturé';
  const price       = pricesHidden ? '●●●●' : calculatePrice(item);
  const startTime   = item.startTime ? dayjs(item.startTime).format('HH:mm') : dayjs(item.date).format('HH:mm');
  const endTime     = item.endTime   ? dayjs(item.endTime).format('HH:mm')   : '--:--';
  const dateShort   = dayjs(item.date).format('DD/MM');
  const startShort  = (item.startLocation || '').split(',')[0];
  const endShort    = (item.endLocation   || '').split(',')[0];
  const stripeColor = hasConflict ? C.red : isBilled ? C.green : C.brand;

  return (
    <TouchableOpacity
      style={[styles.card, hasConflict && styles.cardConflict]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

      {/* Colonne heures */}
      <View style={styles.timeCol}>
        <Text style={styles.timeDate}>{dateShort}</Text>
        <Text style={styles.timeStart}>{startTime}</Text>
        <View style={styles.timeLine} />
        <Text style={styles.timeEnd}>{endTime}</Text>
      </View>

      <View style={styles.inner}>
        {/* Ligne 1 : patient · prix */}
        <View style={styles.row1}>
          <Text style={styles.name} numberOfLines={1}>{item.patientName}</Text>
          <Text style={[styles.price, hasConflict && { color: C.red }]}>{price} €</Text>
        </View>

        {/* Ligne 2 : départ → arrivée · indicateur */}
        <View style={styles.row2}>
          <Ionicons name="navigate-outline" size={10} color={C.text3} style={{ marginRight: 3 }} />
          <Text style={styles.route} numberOfLines={1}>
            {startShort} → {endShort}
          </Text>
          {hasConflict ? (
            <View style={[styles.dot, { backgroundColor: C.red }]} />
          ) : isBilled ? (
            <Ionicons name="checkmark-circle" size={12} color={C.green} />
          ) : (
            <View style={[styles.dot, { backgroundColor: C.border }]} />
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={C.border} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
};

export default memo(RideHistoryCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingRight: 10,
  },
  cardConflict: { backgroundColor: '#FFF8F8', borderColor: '#FECACA' },
  stripe: { width: 3, alignSelf: 'stretch', marginRight: 8 },

  timeCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: C.border,
    width: 46,
    gap: 2,
  },
  timeDate:  { fontSize: 9, fontWeight: '800', color: C.brand, marginBottom: 2, letterSpacing: 0.2 },
  timeStart: { fontSize: 12, fontWeight: '800', color: C.text },
  timeLine:  { width: 1, height: 8, backgroundColor: C.border },
  timeEnd:   { fontSize: 11, fontWeight: '600', color: C.text3 },

  inner: { flex: 1, paddingVertical: 9, paddingLeft: 10 },

  row1: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  name: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text, marginRight: 6 },
  price: { fontSize: 13, fontWeight: '800', color: C.green },

  row2: { flexDirection: 'row', alignItems: 'center' },
  route: { flex: 1, fontSize: 11, color: C.text2, fontWeight: '500' },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
});
