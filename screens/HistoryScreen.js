import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, 
  Alert, TextInput, StatusBar, Platform, RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system'; 

import api, { getRides, updateRide } from '../services/api'; 
import { calculatePrice } from '../utils/pricing'; 

// Import des nouveaux sous-composants
import RideHistoryCard from '../components/RideHistoryCard';
import RideDetailsModal from '../components/RideDetailsModal';

dayjs.locale('fr'); // Configuration globale de la langue

export default function HistoryScreen() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false); // Pour le Pull-to-Refresh
  
  const [currentDate, setCurrentDate] = useState(dayjs()); 
  const [showDatePicker, setShowDatePicker] = useState(false); 
  
  // États de recherche avec Debounce
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedRide, setSelectedRide] = useState(null);

  // --- EFFET DEBOUNCE (Performance) ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300); // Attend 300ms après la dernière frappe avant de chercher
    return () => clearTimeout(handler);
  }, [searchText]);

  // --- CHARGEMENT ---
  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const allRides = await getRides();
      const history = allRides.filter(r => r.status === 'Terminée');      
      history.sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date));
      setRides(history);
    } catch(e) { console.error("Erreur historique:", e); } 
    finally { 
      setLoading(false); 
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // --- LOGIQUE MÉTIER ---
  const conflictingRideIds = useMemo(() => {
    const conflicts = new Set();
    const sortedRides = [...rides].sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date));

    for (let i = 0; i < sortedRides.length - 1; i++) {
      const currentRide = sortedRides[i];
      const nextRide = sortedRides[i + 1];

      if (dayjs(currentRide.date).isSame(dayjs(nextRide.date), 'day')) {
          if (currentRide.endTime && (nextRide.startTime || nextRide.date)) {
            const endCurrent = dayjs(currentRide.endTime);
            const startNext = dayjs(nextRide.startTime || nextRide.date);
            const diffMinutes = startNext.diff(endCurrent, 'minute');

            if (diffMinutes < 10 && diffMinutes >= 0) {
              conflicts.add(currentRide._id);
              conflicts.add(nextRide._id);
            }
          }
      }
    }
    return conflicts;
  }, [rides]);

  const filteredRides = useMemo(() => {
    return rides.filter(r => {
      if (debouncedSearch.trim().length === 0) {
        return dayjs(r.date).isSame(currentDate, 'day');
      } 
      const query = debouncedSearch.toLowerCase();
      return (
        (r.patientName && r.patientName.toLowerCase().includes(query)) || 
        (r.startLocation && r.startLocation.toLowerCase().includes(query)) ||
        (r.endLocation && r.endLocation.toLowerCase().includes(query))
      );
    });
  }, [rides, currentDate, debouncedSearch]);

  const stats = useMemo(() => {
    return filteredRides.reduce((acc, curr) => {
        const estimatedPrice = parseFloat(calculatePrice(curr));
        return { km: acc.km + (curr.realDistance || curr.distance || 0), ca: acc.ca + estimatedPrice, count: acc.count + 1 };
    }, { km: 0, ca: 0, count: 0 });
  }, [filteredRides]);

  // --- ACTIONS ---
  const generateCSV = async () => {
    if (filteredRides.length === 0) return Alert.alert("Info", "Rien à exporter.");
    try {
      let csvContent = "Date;Patient;Type;Départ;Arrivée;Km;Péages;Prix Convention 2025 (€);Facturé;Origine\n";
      filteredRides.forEach(ride => {
        const price = calculatePrice(ride); 
        const origin = ride.isShared ? `Partagé par ${ride.sharedByName || 'Collègue'}` : 'Perso';
        const typeCourse = ride.type || 'Standard';
        csvContent += `${dayjs(ride.date).format('DD/MM/YYYY')};${ride.patientName};${typeCourse};${ride.startLocation};${ride.endLocation};${ride.realDistance};${ride.tolls};${price};${ride.statuFacturation};${origin}\n`;
      });
      
      const fileName = debouncedSearch.trim().length > 0 ? 'Recherche_Globale' : currentDate.format('DD_MM_YYYY');
      const fileUri = FileSystem.cacheDirectory + `Facturation_${fileName}.csv`;
      
      await FileSystem.writeAsStringAsync(fileUri, '\uFEFF' + csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exporter Excel' });
    } catch (error) { Alert.alert("Erreur", "Export impossible."); }
  };

  const handleSaveEdit = async (rideToEdit, editData) => {
    try {
      const updates = {
        realDistance: parseFloat(editData.realDistance) || 0,
        tolls: parseFloat(editData.tolls) || 0
      };
      
      if (editData.startTime.includes(':')) {
        const [h, m] = editData.startTime.split(':');
        updates.startTime = dayjs(rideToEdit.date).hour(parseInt(h)).minute(parseInt(m)).toISOString();
      }
      
      if (editData.endTime.includes(':')) {
        const [h, m] = editData.endTime.split(':');
        updates.endTime = dayjs(rideToEdit.date).hour(parseInt(h)).minute(parseInt(m)).toISOString();
      }

      const tempRide = { ...rideToEdit, ...updates }; 
      updates.price = parseFloat(calculatePrice(tempRide)); 

      await updateRide(rideToEdit._id, updates);
      
      const finalRide = { ...rideToEdit, ...updates };
      setSelectedRide(finalRide);
      setRides(prev => prev.map(r => r._id === finalRide._id ? finalRide : r).sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date)));
      
      Alert.alert("Succès", `Mise à jour réussie !\nNouveau Prix : ${updates.price} €`);
    } catch (err) { Alert.alert("Erreur", "Mise à jour échouée."); } 
  };

  const handleDeleteRide = (id) => {
    Alert.alert("Supprimer ?", "Irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
          await api.delete(`/rides/${id}`);
          setSelectedRide(null); 
          loadHistory();
      }}
    ]);
  };

  const handleToggleBilling = async (ride) => {
    try {
     const newStatus = ride.statuFacturation === 'Facturé' ? 'Non facturé' : 'Facturé';
     setRides(prev => prev.map(r => r._id === ride._id ? { ...r, statuFacturation: newStatus } : r));
     if (selectedRide && selectedRide._id === ride._id) setSelectedRide({ ...selectedRide, statuFacturation: newStatus });
     await updateRide(ride._id, { statuFacturation: newStatus });
   } catch (err) { Alert.alert("Erreur", "Impossible."); loadHistory(); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B00" />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Facturation</Text>
            <TouchableOpacity style={styles.exportBtn} onPress={generateCSV}>
                <Ionicons name="download-outline" size={18} color="#FFF" />
                <Text style={styles.exportBtnText}>Export CSV</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.monthSelector}>
             <TouchableOpacity onPress={() => setCurrentDate(currentDate.subtract(1, 'day'))} style={styles.monthArrow}>
                <Ionicons name="chevron-back" size={24} color="#FFF" />
             </TouchableOpacity>
             
             <TouchableOpacity 
                onPress={() => setShowDatePicker(true)} 
                style={styles.dateSelectorBtn}
             >
                 <Ionicons name="calendar-outline" size={18} color="#FFF" style={{marginRight: 8}} />
                 <Text style={styles.monthTitle}>{currentDate.format('dddd DD MMMM')}</Text>
             </TouchableOpacity>

             <TouchableOpacity onPress={() => setCurrentDate(currentDate.add(1, 'day'))} style={styles.monthArrow}>
                <Ionicons name="chevron-forward" size={24} color="#FFF" />
             </TouchableOpacity>
        </View>

        {showDatePicker && (
            <DateTimePicker
                value={currentDate.toDate()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) setCurrentDate(dayjs(date));
                }}
            />
        )}

        <View style={styles.statsContainer}>
             <View style={styles.statItem}>
                 <Text style={styles.statValue}>{stats.count}</Text>
                 <Text style={styles.statLabel}>Courses</Text>
             </View>
             <View style={styles.statDivider} />
             <View style={styles.statItem}>
                 <Text style={styles.statValue}>{stats.km}</Text>
                 <Text style={styles.statLabel}>Km Total</Text>
             </View>
             <View style={styles.statDivider} />
             <View style={styles.statItem}>
                 <Text style={styles.statValue}>{stats.ca.toFixed(2)} €</Text>
                 <Text style={styles.statLabel}>CA Estimé</Text>
             </View>
        </View>
      </View>

      <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput 
              style={styles.searchInput} 
              placeholder="Rechercher patient, ville..." 
              value={searchText}
              onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons name="close-circle" size={18} color="#CCC" />
              </TouchableOpacity>
          )}
      </View>

      {loading && !refreshing ? <ActivityIndicator size="large" color="#FF6B00" style={{marginTop: 50}} /> : (
        <FlatList 
            data={filteredRides} 
            keyExtractor={i => i._id} 
            renderItem={({item}) => (
              <RideHistoryCard 
                item={item} 
                hasConflict={conflictingRideIds.has(item._id)} 
                onPress={setSelectedRide} 
              />
            )} 
            contentContainerStyle={styles.listContent} 
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} colors={["#FF6B00"]} />
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {debouncedSearch.length > 0 ? "Aucun résultat trouvé dans la base." : "Aucune course terminée ce jour."}
              </Text>
            } 
        />
      )}

      <RideDetailsModal 
        visible={!!selectedRide} 
        selectedRide={selectedRide}
        hasConflict={selectedRide ? conflictingRideIds.has(selectedRide._id) : false}
        onClose={() => setSelectedRide(null)}
        onSave={handleSaveEdit}
        onDelete={handleDeleteRide}
        onToggleBilling={handleToggleBilling}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  header: { backgroundColor: '#FF6B00', paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingBottom: 40, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  exportBtn: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, alignItems: 'center' },
  exportBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 5, fontSize: 12 },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 },
  dateSelectorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  monthTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textTransform: 'capitalize' },
  monthArrow: { padding: 5 },
  statsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 15, justifyContent: 'space-between', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1 },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.3)' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 20, marginTop: -25, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, elevation: 5 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#333' },
  listContent: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 100 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 16 },
});