import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, 
  Alert, TextInput, StatusBar, Platform, RefreshControl, Modal, ScrollView 
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
  const [refreshing, setRefreshing] = useState(false); 
  
  const [currentDate, setCurrentDate] = useState(dayjs()); 
  const [showDatePicker, setShowDatePicker] = useState(false); 
  
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedRide, setSelectedRide] = useState(null);

  // --- ÉTATS POUR L'AUDIT INTELLIGENT ---
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditProposals, setAuditProposals] = useState([]);
  const [isAuditing, setIsAuditing] = useState(false);

  // --- EFFET DEBOUNCE (Performance) ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300); 
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


  // =========================================================================
  // --- L'ALGORITHME DE LISSAGE (OSRM + Logique Temporelle) ---
  // =========================================================================
 // =========================================================================
  // --- L'ALGORITHME DE LISSAGE PRAGMATIQUE (Respect du temps réel + Approche) ---
  // =========================================================================
// =========================================================================
  // --- L'ALGORITHME DE LISSAGE STRICT (Séquençage absolu pour la CPAM) ---
  // =========================================================================
  const runSmartAudit = async () => {
    if (filteredRides.length === 0) return Alert.alert("Info", "Aucune course terminée à analyser.");
    
    setIsAuditing(true);
    setShowAuditModal(true);
    
    try {
      let proposals = [];
      let sortedRides = [...filteredRides].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      // 1. Outil de géocodage silencieux
      const getCoords = async (address) => {
        try {
          const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address + ", France")}&limit=1`);
          const data = await res.json();
          if (data?.features?.length > 0) return { lon: data.features[0].geometry.coordinates[0], lat: data.features[0].geometry.coordinates[1] };
        } catch(e) {}
        return null;
      };

      for (let i = 0; i < sortedRides.length; i++) {
        let ride = sortedRides[i];
        
        // --- On conserve la durée RÉELLE de la course ---
        let origDuration = dayjs(ride.endTime).diff(dayjs(ride.startTime), 'minute');
        if (origDuration <= 0 || isNaN(origDuration)) origDuration = 15; // Minimum 15 min de sécurité

        // On utilise dayjs() pour pouvoir faire des calculs mathématiques précis
        let proposedStartTime = dayjs(ride.startTime);
        let proposedEndTime = dayjs(ride.endTime);
        let isOverlap = false;
        let approachMinutes = 0;

        if (i > 0) {
          const prevRide = proposals[i - 1];
          const prevEndTime = dayjs(prevRide.proposedEndTime);
          
          // 2. Calcul du temps d'approche
          const prevEndLoc = (prevRide.endLocation || "").trim().toLowerCase();
          const currStartLoc = (ride.startLocation || "").trim().toLowerCase();

          // Si on repart exactement de la même adresse, temps d'approche = 0
          if (prevEndLoc === currStartLoc || currStartLoc.includes(prevEndLoc) || prevEndLoc.includes(currStartLoc)) {
            approachMinutes = 0;
          } else {
            approachMinutes = 15; // Marge de sécurité par défaut si le GPS ne trouve pas

            const startC = await getCoords(prevRide.endLocation);
            const endC = await getCoords(ride.startLocation);

            if (startC && endC) {
              try {
                const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startC.lon},${startC.lat};${endC.lon},${endC.lat}?overview=false`;
                const routeRes = await fetch(osrmUrl);
                const routeData = await routeRes.json();
                if (routeData.code === "Ok" && routeData.routes.length > 0) {
                  let calcMins = Math.ceil(routeData.routes[0].duration / 60);
                  if (calcMins > 0 && calcMins <= 45) approachMinutes = calcMins;
                }
              } catch(e) {}
            }
          }

          // 3. LA RÈGLE STRICTE : Heure Minimum Possible = Fin de la précédente + Approche
          const earliestPossibleStart = prevEndTime.add(approachMinutes, 'minute');

          // Si la course est prévue AVANT qu'il ne soit physiquement possible d'y être...
          if (proposedStartTime.isBefore(earliestPossibleStart)) {
            isOverlap = true;
            
            // On glisse la course 2 pour qu'elle commence exactement quand on arrive !
            proposedStartTime = earliestPossibleStart;
            proposedEndTime = proposedStartTime.add(origDuration, 'minute');
          }
        }

        // On ré-injecte au format texte (ISOString) pour la base de données
        proposals.push({
          ...ride,
          proposedStartTime: proposedStartTime.toISOString(),
          proposedEndTime: proposedEndTime.toISOString(),
          hasConflict: isOverlap,
          theoreticalMinutes: origDuration,
          approachMinutes
        });
      }
      
      setAuditProposals(proposals);
    } catch (e) {
      Alert.alert("Erreur", "L'audit intelligent a échoué.");
      setShowAuditModal(false);
    } finally {
      setIsAuditing(false);
    }
  };
  const applyAuditCorrections = async () => {
    setLoading(true);
    try {
      for (const prop of auditProposals) {
        if (prop.startTime !== prop.proposedStartTime || prop.endTime !== prop.proposedEndTime) {
          await updateRide(prop._id, { 
            startTime: prop.proposedStartTime, 
            endTime: prop.proposedEndTime 
          });
        }
      }
      Alert.alert("Succès", "Le planning a été lissé et mis aux normes CPAM !");
      setShowAuditModal(false);
      loadHistory(); 
    } catch (e) {
      Alert.alert("Erreur", "La sauvegarde des corrections a échoué.");
    } finally {
      setLoading(false);
    }
  };


  // --- ACTIONS STANDARDS ---
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
            
            {/* 👈 AJOUT DU BOUTON LISSAGE ICI */}
            <View style={{flexDirection: 'row', gap: 10}}>
                <TouchableOpacity style={styles.exportBtn} onPress={runSmartAudit}>
                    <Ionicons name="color-wand-outline" size={18} color="#FFF" />
                    <Text style={styles.exportBtnText}>Lissage</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportBtn} onPress={generateCSV}>
                    <Ionicons name="download-outline" size={18} color="#FFF" />
                    <Text style={styles.exportBtnText}>CSV</Text>
                </TouchableOpacity>
            </View>
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

      {/* 👈 AJOUT DU MODAL D'AUDIT INTELLIGENT ICI */}
      <Modal visible={showAuditModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAuditModal(false)} style={styles.iconBtn}>
                <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Lissage Intelligent</Text>
            <View style={{width: 30}} />
          </View>

          <ScrollView contentContainerStyle={{padding: 20}}>
            <Text style={{color: '#666', marginBottom: 20, textAlign: 'center'}}>
              Analyse du temps de trajet réel et correction des chevauchements pour la conformité CPAM.
            </Text>

            {isAuditing ? (
              <View style={{alignItems: 'center', marginTop: 50}}>
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text style={{marginTop: 15, color: '#FF6B00', fontWeight: 'bold'}}>Calcul des trajectoires via OSRM...</Text>
              </View>
            ) : (
              auditProposals.map((prop, idx) => {
                const isChanged = dayjs(prop.startTime).diff(dayjs(prop.proposedStartTime)) !== 0 || 
                                  dayjs(prop.endTime).diff(dayjs(prop.proposedEndTime)) !== 0;

                return (
                  <View key={prop._id} style={[styles.sectionCard, isChanged && {borderColor: '#FF6B00', borderWidth: 1}]}>
                    <Text style={{fontWeight: 'bold', fontSize: 16, marginBottom: 5}}>{idx + 1}. {prop.patientName}</Text>
                    {prop.hasConflict && <Text style={{color: '#D32F2F', fontSize: 12, marginBottom: 10}}>⚠️ Chevauchement corrigé</Text>}
                    
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8}}>
                      <View>
                        <Text style={{fontSize: 10, color: '#999'}}>ACTUEL</Text>
                        <Text style={{textDecorationLine: isChanged ? 'line-through' : 'none', color: '#666'}}>
                          {dayjs(prop.startTime).format('HH:mm')} ➡️ {dayjs(prop.endTime).format('HH:mm')}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={20} color="#CCC" style={{alignSelf: 'center'}} />
                      <View style={{alignItems: 'flex-end'}}>
                        <Text style={{fontSize: 10, color: '#FF6B00', fontWeight: 'bold'}}>PROPOSÉ ({prop.theoreticalMinutes} min)</Text>
                        <Text style={{fontWeight: 'bold', color: isChanged ? '#FF6B00' : '#333'}}>
                          {dayjs(prop.proposedStartTime).format('HH:mm')} ➡️ {dayjs(prop.proposedEndTime).format('HH:mm')}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              })
            )}
            
            {!isAuditing && auditProposals.length > 0 && (
              <TouchableOpacity style={[styles.saveBtn, {marginTop: 20, backgroundColor: '#FF6B00'}]} onPress={applyAuditCorrections}>
                  <Text style={styles.saveBtnText}>APPLIQUER LES CORRECTIONS</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

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

  // Styles communs pour les Modals (Audit & Détails)
  modalContainer: { flex: 1, backgroundColor: '#F4F6F8' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  iconBtn: { padding: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 15, elevation: 1 },
  saveBtn: { padding: 15, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
});