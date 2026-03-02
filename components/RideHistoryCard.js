import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { calculatePrice } from '../utils/pricing';

const RideHistoryCard = ({ item, hasConflict, onPress }) => {
  const isBilled = item.statuFacturation === 'Facturé';
  const displayPrice = calculatePrice(item);
  
  // 👈 NOUVEAU : On récupère et on formate la date complète
  const rideDate = dayjs(item.date || item.startTime).format('DD/MM/YYYY');
  const rideTime = item.startTime ? dayjs(item.startTime).format('HH:mm') : '--:--';

  return (
    <TouchableOpacity 
      style={[styles.card, hasConflict && styles.cardConflicting]} 
      onPress={() => onPress(item)} 
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        
        {/* COLONNE GAUCHE : L'heure en grand, la Date complète en dessous */}
        <View style={[styles.dateCol, hasConflict && { borderRightColor: '#FFCDD2' }]}>
          <Text style={[styles.dayText, hasConflict && { color: '#D32F2F' }]}>
              {rideTime}
          </Text>
          <Text style={[styles.monthText, hasConflict && { color: '#D32F2F' }]}>
              {rideDate}
          </Text>
        </View>
        
        <View style={styles.detailsCol}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start'}}>
              <Text style={styles.patientName} numberOfLines={1}>{item.patientName}</Text>
              {item.isShared && <Ionicons name="arrow-undo" size={14} color="#EF6C00" style={{marginLeft: 5}} />}
          </View>
          
          <View style={styles.infoRow}>
              <View style={styles.typeBadge}>
                  <Ionicons name="car-outline" size={10} color="#0056b3" style={{marginRight:3}}/>
                  <Text style={styles.typeBadgeText}>{item.type || 'Standard'}</Text>
              </View>
              <View style={styles.timeEndBox}>
                  <Ionicons name="flag-outline" size={12} color="#999" style={{marginRight:4}}/>
                  <Text style={styles.rideInfoText}>
                      Fin : {item.endTime ? dayjs(item.endTime).format('HH:mm') : '--:--'}
                  </Text>
              </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.priceTextList}>{displayPrice} €</Text>
            
            {hasConflict ? (
                <View style={styles.conflictBadge}>
                    <Ionicons name="warning" size={12} color="#D32F2F" style={{marginRight:3}}/>
                    <Text style={styles.conflictBadgeText}>&lt; 10 min</Text>
                </View>
            ) : isBilled ? (
               <View style={styles.billedBadge}>
                   <Ionicons name="checkmark-circle" size={12} color="#2E7D32" style={{marginRight:3}}/>
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

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, elevation: 2, padding: 15, borderLeftWidth: 4, borderLeftColor: 'transparent' },
  cardConflicting: { borderLeftColor: '#D32F2F', backgroundColor: '#FFF0F0' }, 
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  
  // 👈 MODIFIÉ : J'ai élargi un peu la colonne pour que "JJ/MM/AAAA" rentre parfaitement
  dateCol: { alignItems: 'center', paddingRight: 15, borderRightWidth: 1, borderRightColor: '#F0F0F0', width: 85 }, 
  
  dayText: { fontSize: 18, fontWeight: 'bold', color: '#333' }, 
  // 👈 MODIFIÉ : J'ai mis la date en orange pour bien la faire ressortir
  monthText: { fontSize: 11, color: '#FF6B00', fontWeight: 'bold', marginTop: 4 }, 
  
  detailsCol: { flex: 1, paddingLeft: 15 },
  patientName: { fontSize: 16, fontWeight: 'bold', color: '#333', flex:1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e6f0fa', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, color: '#0056b3', fontWeight: 'bold', textTransform: 'capitalize' },
  timeEndBox: { flexDirection: 'row', alignItems: 'center' },
  rideInfoText: { fontSize: 13, color: '#666' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  priceTextList: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32' },
  billedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  billedText: { fontSize: 11, fontWeight: 'bold', color: '#2E7D32' },
  pendingText: { fontSize: 11, color: '#F57C00', fontStyle: 'italic' },
  conflictBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  conflictBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#D32F2F' },
});