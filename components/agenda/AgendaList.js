import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RideCard from '../RideCard'; // Ajuste le chemin

const THEME = { primary: '#FF6B00', primaryLight: '#FFF3E0', info: '#3B82F6', text: '#1F2937', card: '#FFFFFF', bg: '#F8F9FA', textLight: '#9CA3AF' };

export default function AgendaList({ rides, loading, onRefresh, onCardPress, onStatusChange, onSync, onImport, onRespond, getPMTStatus }) {

  const renderSkeleton = () => (
      <View style={{marginTop: 20}}>
          {[1,2,3].map(i => (
             <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonLineShort}/>
                <View style={styles.skeletonLineLong}/>
             </View>
          ))}
      </View>
  );

  const renderEmptyState = () => (
      <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}><Ionicons name="calendar-outline" size={48} color={THEME.primary} /></View>
          <Text style={styles.emptyTitle}>Journée Libre</Text>
          <Text style={styles.emptyText}>Aucune course prévue pour le moment.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={onImport}>
              <Text style={styles.emptyBtnText}>Coller une course</Text>
          </TouchableOpacity>
      </View>
  );

  return (
    <View style={styles.listContainer}>
        <View style={styles.listHeader}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
              <Text style={styles.dateTitle}>Planning</Text>
              <View style={styles.countBadge}><Text style={styles.countText}>{rides.length}</Text></View>
            </View>
            {rides.length > 0 && (
              <TouchableOpacity onPress={onSync} style={styles.syncBtn}>
                <Ionicons name="cloud-upload-outline" size={16} color={THEME.info} style={{marginRight: 6}} />
                <Text style={styles.syncBtnText}>Sync Tel</Text>
              </TouchableOpacity>
            )}
        </View>

        {loading ? renderSkeleton() : (
          <FlatList 
            data={rides} 
            keyExtractor={i => i._id} 
            contentContainerStyle={{ paddingBottom: 150 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            renderItem={({ item }) => {
              const status = getPMTStatus ? getPMTStatus(item) : null;
              return (
                <View style={styles.rideWrapper}>
                  {status && (
                    <View style={[styles.statusBadge, { backgroundColor: status.color, borderColor: status.color }]}>
                        <Ionicons name={status.icon} size={12} color={status.textColor} />
                        <Text style={[styles.statusText, {color: status.textColor}]}>{status.text}</Text>
                    </View>
                  )}
                  <RideCard 
                    ride={item} 
                    onStatusChange={onStatusChange} 
                    onPress={onCardPress} 
                    onRespond={onRespond}
                  />
                </View>
              );
            }} 
            refreshing={loading} 
            onRefresh={onRefresh}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: { flex: 1, paddingHorizontal: 20 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  dateTitle: { fontSize: 20, fontWeight: '800', color: THEME.text },
  syncBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF5FF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  syncBtnText: { color: THEME.info, fontWeight: '700', fontSize: 12 },
  countBadge: { backgroundColor: THEME.primaryLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  countText: { color: THEME.primary, fontWeight: '800', fontSize: 12 },
  rideWrapper: { marginBottom: 18 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, marginBottom: -10, zIndex: 1, marginLeft: 15, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', marginLeft: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: THEME.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: THEME.text },
  emptyText: { fontSize: 15, color: THEME.textLight, marginTop: 8, textAlign: 'center', maxWidth: '70%' },
  emptyBtn: { marginTop: 30, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 2, borderColor: THEME.primary, borderRadius: 30 },
  emptyBtnText: { color: THEME.primary, fontWeight: '700' },
  skeletonCard: { backgroundColor: THEME.card, padding: 20, borderRadius: 20, marginBottom: 15 },
  skeletonLineShort: { width: '40%', height: 16, backgroundColor: THEME.bg, borderRadius: 8, marginBottom: 12 },
  skeletonLineLong: { width: '80%', height: 16, backgroundColor: THEME.bg, borderRadius: 8 },
});