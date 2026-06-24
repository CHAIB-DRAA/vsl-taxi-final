import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RideCard from '../RideCard';

const C = {
  bg:     '#F2F3F7',
  card:   '#FFFFFF',
  card2:  '#F5F7FB',
  border: '#E2E5EC',
  text:   '#060E1E',
  text2:  '#6B7280',
  text3:  '#9CA3AF',
  brand:  '#FF5500',
};

export default function AgendaList({ rides, loading, onRefresh, onCardPress, onStatusChange, onSync, onImport, onRespond }) {

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
          renderItem={({ item }) => (
            <RideCard
              ride={item}
              onStatusChange={onStatusChange}
              onPress={onCardPress}
              onRespond={onRespond}
            />
          )}
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
