import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RideCard from '../RideCard';
import dayjs from 'dayjs';

const C = {
  bg:     '#F2F3F7',
  card:   '#FFFFFF',
  card2:  '#F5F7FB',
  border: '#E2E5EC',
  text:   '#060E1E',
  text2:  '#6B7280',
  text3:  '#9CA3AF',
  brand:  '#FF5500',
  green:  '#16A34A',
  red:    '#EF4444',
  amber:  '#F59E0B',
};

export default function AgendaList({
  rides,
  loading,
  onRefresh,
  onCardPress,
  onStatusChange,
  onSync,
  onImport,
  onRespond,
  estimatedKm = {},
  conflictingRideIds = new Set(),
}) {

  const renderSkeleton = () => (
    <View style={{ paddingTop: 8 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skelRow}>
            <View style={styles.skelTime} />
            <View style={styles.skelBadge} />
          </View>
          <View style={styles.skelName} />
          <View style={styles.skelAddr} />
          <View style={[styles.skelAddr, { width: '55%' }]} />
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View style={styles.emptyCircle}>
        <Ionicons name="calendar-outline" size={38} color={C.brand} />
      </View>
      <Text style={styles.emptyTitle}>Journée libre</Text>
      <Text style={styles.emptySubtitle}>Aucune course pour ce jour</Text>
      {onImport && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onImport}>
          <Ionicons name="sparkles-outline" size={15} color={C.brand} />
          <Text style={styles.emptyBtnText}>Coller une course</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Calcul des gaps de temps entre courses ────────────────────────────────
  const getGapMinutes = (rideA, rideB) => {
    if (!rideA || !rideB) return null;
    const endA = rideA.endTime
      ? dayjs(rideA.endTime)
      : dayjs(rideA.date).add(30, 'minutes'); // durée estimée si pas de endTime
    const startB = dayjs(rideB.date);
    return startB.diff(endA, 'minutes');
  };

  // ── Résumé de fin de journée ──────────────────────────────────────────────
  const remaining   = rides.filter(r => r.status !== 'Terminée' && r.status !== 'Annulée');
  const done        = rides.filter(r => r.status === 'Terminée');
  const lastRide    = rides[rides.length - 1];
  const endHour     = lastRide?.endTime
    ? dayjs(lastRide.endTime).format('HH:mm')
    : lastRide?.date
      ? dayjs(lastRide.date).add(30, 'minutes').format('HH:mm')
      : null;
  const totalEstKm  = Object.values(estimatedKm).reduce((acc, v) => acc + (v || 0), 0);

  const renderItem = ({ item, index }) => {
    const prevRide  = index > 0 ? rides[index - 1] : null;
    const gapMin    = prevRide ? getGapMinutes(prevRide, item) : null;
    const isConflict = conflictingRideIds.has(item._id);
    const km         = estimatedKm[item._id];

    return (
      <>
        {/* Gap entre courses */}
        {gapMin !== null && gapMin >= 0 && gapMin < 120 && (
          <View style={[styles.gapRow, gapMin < 10 && styles.gapRowAlert]}>
            {gapMin < 10 ? (
              <>
                <Ionicons name="warning-outline" size={12} color={C.red} />
                <Text style={[styles.gapText, { color: C.red, fontWeight: '800' }]}>
                  Conflit horaire — seulement {gapMin} min entre les deux courses
                </Text>
              </>
            ) : (
              <>
                <View style={styles.gapLine} />
                <Text style={styles.gapText}>{gapMin} min</Text>
                <View style={styles.gapLine} />
              </>
            )}
          </View>
        )}

        {/* Bannière conflit horaire */}
        {isConflict && (
          <View style={styles.conflictBanner}>
            <Ionicons name="alert-circle-outline" size={13} color={C.red} />
            <Text style={styles.conflictBannerText}>Chevauchement horaire détecté</Text>
          </View>
        )}

        <RideCard
          ride={item}
          onStatusChange={onStatusChange}
          onPress={onCardPress}
          onRespond={onRespond}
          estimatedKm={km}
        />
      </>
    );
  };

  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Missions</Text>
          {rides.length > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{rides.length}</Text>
            </View>
          )}
        </View>
        {rides.length > 0 && onSync && (
          <TouchableOpacity onPress={onSync} style={styles.syncBtn}>
            <Ionicons name="cloud-upload-outline" size={14} color={C.text2} />
            <Text style={styles.syncText}>Sync</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── LISTE ── */}
      {loading ? renderSkeleton() : (
        <FlatList
          data={rides}
          keyExtractor={i => i._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={[C.brand]}
              tintColor={C.brand}
            />
          }
          renderItem={renderItem}
          ListFooterComponent={rides.length > 0 ? (
            <View style={styles.daySummary}>
              <View style={styles.daySummaryRow}>
                <Ionicons name="checkmark-circle" size={14} color={C.green} />
                <Text style={styles.daySummaryText}>
                  {done.length} terminée{done.length > 1 ? 's' : ''}
                </Text>
                {remaining.length > 0 && (
                  <>
                    <View style={styles.daySummarySep} />
                    <Ionicons name="time-outline" size={14} color={C.brand} />
                    <Text style={[styles.daySummaryText, { color: C.brand }]}>
                      {remaining.length} restante{remaining.length > 1 ? 's' : ''}
                    </Text>
                  </>
                )}
                {totalEstKm > 0 && (
                  <>
                    <View style={styles.daySummarySep} />
                    <Ionicons name="speedometer-outline" size={14} color={C.text3} />
                    <Text style={styles.daySummaryText}>~{Math.round(totalEstKm)} km estimés</Text>
                  </>
                )}
                {endHour && remaining.length === 0 && (
                  <>
                    <View style={styles.daySummarySep} />
                    <Ionicons name="flag-outline" size={14} color={C.text3} />
                    <Text style={styles.daySummaryText}>Fin ~{endHour}</Text>
                  </>
                )}
              </View>
            </View>
          ) : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 14 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  countPill: {
    backgroundColor: C.brand + '22',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.brand + '44',
  },
  countText: { color: C.brand, fontWeight: '800', fontSize: 12 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F7FB', paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
  },
  syncText: { color: C.text2, fontWeight: '600', fontSize: 12 },

  listContent: { paddingBottom: 120 },

  // GAP entre courses
  gapRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 4, paddingHorizontal: 4,
  },
  gapRowAlert: {
    backgroundColor: C.red + '10', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, marginBottom: 6,
  },
  gapLine: { flex: 1, height: 1, backgroundColor: C.border },
  gapText: { fontSize: 11, color: C.text3, fontWeight: '600', paddingHorizontal: 4 },

  // Bannière conflit
  conflictBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF2F2', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#FECACA',
    marginBottom: 4,
  },
  conflictBannerText: { color: C.red, fontSize: 11, fontWeight: '700', flex: 1 },

  // Résumé fin de journée
  daySummary: {
    marginTop: 8, marginBottom: 16,
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, padding: 12,
  },
  daySummaryRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  daySummaryText: { fontSize: 12, color: C.text2, fontWeight: '600' },
  daySummarySep: { width: 1, height: 14, backgroundColor: C.border },

  // EMPTY
  empty: { alignItems: 'center', paddingTop: 70 },
  emptyCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.brand + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
    borderWidth: 1, borderColor: C.brand + '22',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  emptySubtitle: { fontSize: 13, color: C.text2, marginTop: 5 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 24, paddingVertical: 12, paddingHorizontal: 22,
    borderWidth: 1.5, borderColor: C.brand, borderRadius: 50, gap: 6,
  },
  emptyBtnText: { color: C.brand, fontWeight: '700', fontSize: 14 },

  // SKELETON
  skeletonCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    marginBottom: 12, borderLeftWidth: 3, borderLeftColor: C.border,
    borderWidth: 1, borderColor: C.border,
  },
  skelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  skelTime:  { width: 80, height: 28, backgroundColor: '#E8EAEF', borderRadius: 6 },
  skelBadge: { width: 60, height: 22, backgroundColor: '#E8EAEF', borderRadius: 6 },
  skelName:  { width: '50%', height: 16, backgroundColor: '#E8EAEF', borderRadius: 5, marginBottom: 12 },
  skelAddr:  { width: '80%', height: 13, backgroundColor: '#EEF0F5', borderRadius: 5, marginBottom: 7 },
});
