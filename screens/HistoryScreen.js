import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, 
  Alert, Modal, ScrollView, TextInput, StatusBar, Platform, Linking 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker'; // 👈 NOUVEL IMPORT
import moment from 'moment';
import 'moment/locale/fr';

// Modules natifs
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system'; 

// API & Utils
import api, { getRides, updateRide } from '../services/api'; 
import DocumentScannerButton from '../components/DocumentScannerButton'; 
import { calculatePrice } from '../utils/pricing'; 

export default function HistoryScreen({ navigation }) {
  // --- ÉTATS ---
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(moment()); // Représente maintenant le JOUR sélectionné
  const [showDatePicker, setShowDatePicker] = useState(false); // 👈 NOUVEAU : Pour le calendrier pop-up
  const [searchText, setSearchText] = useState('');

  // --- MODAL & DOCS ---
  const [selectedRide, setSelectedRide] = useState(null);
  const [patientDocs, setPatientDocs] = useState([]); 
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);

  // --- ÉDITION ---
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ realDistance: '', tolls: '', startTime: '', endTime: '' });

  // 1. CHARGEMENT
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const allRides = await getRides();
      const history = allRides.filter(r => r.status === 'Terminée');      
      history.sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date));
      setRides(history);
    } catch(e) { console.error("Erreur historique:", e); } 
    finally { setLoading(false); }
  }, []);
  
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // 2. LOGIQUE MÉTIER : DÉTECTION DES CONFLITS (< 10 MIN)
  const conflictingRideIds = useMemo(() => {
    const conflicts = new Set();
    const sortedRides = [...rides].sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date));

    for (let i = 0; i < sortedRides.length - 1; i++) {
      const currentRide = sortedRides[i];
      const nextRide = sortedRides[i + 1];

      if (moment(currentRide.date).isSame(moment(nextRide.date), 'day')) {
          if (currentRide.endTime && (nextRide.startTime || nextRide.date)) {
            const endCurrent = moment(currentRide.endTime);
            const startNext = moment(nextRide.startTime || nextRide.date);
            
            const diffMinutes = startNext.diff(endCurrent, 'minutes');

            if (diffMinutes < 10) {
              conflicts.add(currentRide._id);
              conflicts.add(nextRide._id);
            }
          }
      }
    }
    return conflicts;
  }, [rides]);

  // 3. FILTRES & STATS (MODIFIÉ POUR LE FILTRE PAR JOUR)
  const filteredRides = useMemo(() => {
    return rides.filter(r => {
      // 👈 MODIFICATION ICI : On vérifie si la course est le même JOUR que currentDate
      const isSameDay = moment(r.date).isSame(currentDate, 'day');
      
      if (searchText.length === 0) return isSameDay;
      const query = searchText.toLowerCase();
      return isSameDay && (
        (r.patientName && r.patientName.toLowerCase().includes(query)) || 
        (r.startLocation && r.startLocation.toLowerCase().includes(query))
      );
    });
  }, [rides, currentDate, searchText]);

  const stats = useMemo(() => {
    return filteredRides.reduce((acc, curr) => {
        const estimatedPrice = parseFloat(calculatePrice(curr));
        return { km: acc.km + (curr.realDistance || curr.distance || 0), ca: acc.ca + estimatedPrice, count: acc.count + 1 };
    }, { km: 0, ca: 0, count: 0 });
  }, [filteredRides]);

  // 4. ACTIONS
  const generateCSV = async () => {
    if (filteredRides.length === 0) return Alert.alert("Info", "Rien à exporter pour ce jour.");
    try {
      let csvContent = "Date;Patient;Départ;Arrivée;Km;Péages;Prix Convention 2025 (€);Facturé;Origine\n";
      filteredRides.forEach(ride => {
        const price = calculatePrice(ride); 
        const origin = ride.isShared ? `Partagé par ${ride.sharedByName || 'Collègue'}` : 'Perso';
        csvContent += `${moment(ride.date).format('DD/MM/YYYY')};${ride.patientName};${ride.startLocation};${ride.endLocation};${ride.realDistance};${ride.tolls};${price};${ride.statuFacturation};${origin}\n`;
      });
      // 👈 MODIFICATION ICI : Le fichier CSV porte le nom du jour exact
      const fileUri = FileSystem.cacheDirectory + `Facturation_${currentDate.format('DD_MM_YYYY')}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, '\uFEFF' + csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exporter Excel' });
    } catch (error) { Alert.alert("Erreur", "Export impossible."); }
  };

  const fetchSmartDocuments = async () => {
    try {
      setLoadingDocs(true);
      const res = await api.get(`/documents/by-ride/${selectedRide._id}`);
      setPatientDocs(res.data);
    } catch (err) { console.error(err); } finally { setLoadingDocs(false); }
  };

  useEffect(() => { if (selectedRide) fetchSmartDocuments(); }, [selectedRide]);

  // --- OUVRIR MAPPY ---
  const openMappy = () => {
    if (!selectedRide || !selectedRide.startLocation || !selectedRide.endLocation) {
      return Alert.alert("Erreur", "Adresses incomplètes pour cette course.");
    }
    const start = encodeURIComponent(selectedRide.startLocation);
    const end = encodeURIComponent(selectedRide.endLocation);
    const mappyUrl = `https://fr.mappy.com/itineraire#/voiture/${start}/${end}/car/7`;
    
    Linking.openURL(mappyUrl).catch(() => Alert.alert("Erreur", "Impossible d'ouvrir Mappy."));
  };

  // 5. ÉDITION (DISTANCES & HEURES)
  const toggleEditMode = () => {
    if (!isEditing) {
      setEditData({
        realDistance: String(selectedRide.realDistance || selectedRide.distance || 0),
        tolls: String(selectedRide.tolls || 0),
        startTime: selectedRide.startTime ? moment(selectedRide.startTime).format('HH:mm') : '',
        endTime: selectedRide.endTime ? moment(selectedRide.endTime).format('HH:mm') : ''
      });
      setIsEditing(true);
    } else { setIsEditing(false); }
  };

  const saveEdit = async () => {
    try {
      setUploading(true);
      const updates = {
        realDistance: parseFloat(editData.realDistance) || 0,
        tolls: parseFloat(editData.tolls) || 0
      };
      
      if (editData.startTime.includes(':')) {
        const [h, m] = editData.startTime.split(':');
        updates.startTime = moment(selectedRide.date).hour(parseInt(h)).minute(parseInt(m)).toISOString();
      }
      
      if (editData.endTime.includes(':')) {
        const [h, m] = editData.endTime.split(':');
        updates.endTime = moment(selectedRide.date).hour(parseInt(h)).minute(parseInt(m)).toISOString();
      }

      const tempRide = { ...selectedRide, ...updates }; 
      const newPrice = calculatePrice(tempRide); 
      updates.price = parseFloat(newPrice); 

      await updateRide(selectedRide._id, updates);
      
      const finalRide = { ...selectedRide, ...updates };
      setSelectedRide(finalRide);
      
      setRides(prev => {
        const newRides = prev.map(r => r._id === finalRide._id ? finalRide : r);
        return newRides.sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date));
      });
      
      setIsEditing(false); 
      Alert.alert("Succès", `Mise à jour réussie !\nNouveau Prix : ${newPrice} €`);

    } catch (err) { Alert.alert("Erreur", "Mise à jour échouée."); } 
    finally { setUploading(false); }
  };

  const handleDeleteRide = () => {
    Alert.alert("Supprimer ?", "Irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
          await api.delete(`/rides/${selectedRide._id}`);
          setSelectedRide(null); loadHistory();
      }}
    ]);
  };

  const toggleBillingStatus = async (ride) => {
    try {
     const newStatus = ride.statuFacturation === 'Facturé' ? 'Non facturé' : 'Facturé';
     const updatedRides = rides.map(r => r._id === ride._id ? { ...r, statuFacturation: newStatus } : r);
     setRides(updatedRides);
     if (selectedRide && selectedRide._id === ride._id) setSelectedRide({ ...selectedRide, statuFacturation: newStatus });
     await updateRide(ride._id, { statuFacturation: newStatus });
   } catch (err) { Alert.alert("Erreur", "Impossible."); loadHistory(); }
 };

  const handleDocumentScanned = async (uri, docType) => {
    setUploading(true); 
    try {
        const f = new FormData(); 
        f.append('photo', {uri, name:'scan.jpg', type:'image/jpeg'}); 
        f.append('rideId', selectedRide._id); 
        f.append('docType', docType); 
        await api.post('/documents/upload', f); 
        fetchSmartDocuments(); 
    } catch(e) { Alert.alert('Erreur', "Upload impossible"); }
    finally { setUploading(false); }
  };

  // 6. RENDU D'UNE CARTE DANS LA LISTE
  const renderItem = ({ item }) => {
    const isBilled = item.statuFacturation === 'Facturé';
    const displayPrice = calculatePrice(item); 
    const hasConflict = conflictingRideIds.has(item._id);

    return (
      <TouchableOpacity 
        style={[styles.card, hasConflict && styles.cardConflicting]} 
        onPress={() => { setIsEditing(false); setSelectedRide(item); }} 
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {/* On garde la bulle de date pour le visuel, mais on met l'heure de départ en grand à la place du jour */}
          <View style={[styles.dateCol, hasConflict && { borderRightColor: '#FFCDD2' }]}>
            <Text style={[styles.dayText, hasConflict && { color: '#D32F2F' }]}>
                {item.startTime ? moment(item.startTime).format('HH:mm') : '--:--'}
            </Text>
            <Text style={styles.monthText}>DÉPART</Text>
          </View>
          
          <View style={styles.detailsCol}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start'}}>
                <Text style={styles.patientName} numberOfLines={1}>{item.patientName}</Text>
                {item.isShared && <Ionicons name="arrow-undo" size={14} color="#EF6C00" style={{marginLeft: 5}} />}
            </View>
            
            <View style={styles.infoRow}>
                <Ionicons name="flag-outline" size={12} color="#999" style={{marginRight:4}}/>
                <Text style={styles.rideInfoText}>
                    Fin : {item.endTime ? moment(item.endTime).format('HH:mm') : '--:--'}
                </Text>
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B00" />
      
      {/* HEADER COURBÉ */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Facturation</Text>
            <TouchableOpacity style={styles.exportBtn} onPress={generateCSV}>
                <Ionicons name="download-outline" size={18} color="#FFF" />
                <Text style={styles.exportBtnText}>CSV du jour</Text>
            </TouchableOpacity>
        </View>

        {/* --- NOUVEAU SÉLECTEUR DE JOUR --- */}
        <View style={styles.monthSelector}>
             <TouchableOpacity onPress={() => setCurrentDate(moment(currentDate).subtract(1, 'day'))} style={styles.monthArrow}>
                <Ionicons name="chevron-back" size={24} color="#FFF" />
             </TouchableOpacity>
             
             {/* Clic sur la date pour ouvrir le calendrier */}
             <TouchableOpacity 
                onPress={() => setShowDatePicker(true)} 
                style={{flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20}}
             >
                 <Ionicons name="calendar-outline" size={18} color="#FFF" style={{marginRight: 8}} />
                 {/* Format: ex: Vendredi 28 Février */}
                 <Text style={styles.monthTitle}>{currentDate.format('dddd DD MMMM')}</Text>
             </TouchableOpacity>

             <TouchableOpacity onPress={() => setCurrentDate(moment(currentDate).add(1, 'day'))} style={styles.monthArrow}>
                <Ionicons name="chevron-forward" size={24} color="#FFF" />
             </TouchableOpacity>
        </View>

        {/* SÉLECTEUR CALENDRIER (POPUP NATIVE) */}
        {showDatePicker && (
            <DateTimePicker
                value={currentDate.toDate()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios'); // Cache sur Android après sélection
                    if (date) setCurrentDate(moment(date));
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
              placeholder="Rechercher patient..." 
              value={searchText}
              onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons name="close-circle" size={18} color="#CCC" />
              </TouchableOpacity>
          )}
      </View>

      {loading ? <ActivityIndicator size="large" color="#FF6B00" style={{marginTop: 50}} /> : (
        <FlatList 
            data={filteredRides} 
            keyExtractor={i => i._id} 
            renderItem={renderItem} 
            contentContainerStyle={styles.listContent} 
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune course terminée ce jour.</Text>} 
        />
      )}

      {/* MODAL DÉTAIL & ÉDITION */}
      <Modal visible={!!selectedRide} animationType="slide" presentationStyle="pageSheet">
        {selectedRide && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedRide(null)} style={styles.closeModalBtn}>
                  <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Détails Course</Text>
              <View style={{flexDirection: 'row', gap: 10}}>
                <TouchableOpacity onPress={toggleEditMode} style={styles.iconBtn}>
                    <Ionicons name={isEditing ? "close-circle" : "pencil"} size={22} color="#2196F3" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteRide} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={22} color="#D32F2F" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              
              <View style={styles.priceCard}>
                  <Text style={styles.priceLabel}>MONTANT CONVENTION 2025</Text>
                  <Text style={styles.priceBig}>{calculatePrice(selectedRide)} €</Text>
                  {isEditing && <Text style={{color:'red', fontSize:10, marginTop:5}}>Mode Édition Activé</Text>}
              </View>

              <View style={styles.sectionCard}>
                 <Text style={styles.sectionHeader}>👤 Patient</Text>
                 <Text style={styles.patientBig}>{selectedRide.patientName}</Text>
                 {selectedRide.isShared && (
                    <View style={styles.sharedInfoBox}>
                        <Ionicons name="arrow-undo" size={16} color="#EF6C00" />
                        <Text style={styles.sharedInfoText}>Transmis par : <Text style={{fontWeight:'bold'}}>{selectedRide.sharedByName || "Collègue inconnu"}</Text></Text>
                    </View>
                 )}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>📍 Itinéraire & Horaires</Text>
                
                <View style={styles.timelineItem}>
                    <View style={[styles.dot, {backgroundColor:'#4CAF50'}]} />
                    <View style={{flex:1}}>
                        <Text style={styles.addrLabel}>DÉPART ({selectedRide.startLocation})</Text>
                        <View style={{flexDirection:'row', alignItems:'center'}}>
                            {isEditing ? (
                                <TextInput 
                                    style={styles.inputTime} 
                                    value={editData.startTime} 
                                    placeholder="HH:MM"
                                    onChangeText={t => setEditData({...editData, startTime: t})}
                                />
                            ) : (
                                <Text style={styles.timeText}>{selectedRide.startTime ? moment(selectedRide.startTime).format('HH:mm') : '--:--'}</Text>
                            )}
                        </View>
                    </View>
                </View>
                
                <View style={styles.line} />
                
                <View style={styles.timelineItem}>
                    <View style={[styles.dot, {backgroundColor:'#FF6B00'}]} />
                    <View style={{flex:1}}>
                        <Text style={styles.addrLabel}>ARRIVÉE ({selectedRide.endLocation})</Text>
                        <View style={{flexDirection:'row', alignItems:'center'}}>
                            {isEditing ? (
                                <TextInput 
                                    style={styles.inputTime} 
                                    value={editData.endTime} 
                                    placeholder="HH:MM"
                                    onChangeText={t => setEditData({...editData, endTime: t})}
                                />
                            ) : (
                                <Text style={styles.timeText}>{selectedRide.endTime ? moment(selectedRide.endTime).format('HH:mm') : '--:--'}</Text>
                            )}
                        </View>
                    </View>
                </View>

                {conflictingRideIds.has(selectedRide._id) && !isEditing && (
                    <View style={{marginTop: 15, padding: 10, backgroundColor: '#FFEBEE', borderRadius: 8}}>
                        <Text style={{color: '#D32F2F', fontSize: 12, fontWeight: 'bold'}}>⚠️ Attention : Écart de moins de 10 minutes avec une autre course de la journée.</Text>
                    </View>
                )}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>📊 Métriques (Tarification)</Text>
                <View style={styles.metricsRow}>
                   <View style={styles.metricItem}>
                     <Text style={styles.metricLabel}>Distance (km)</Text>
                     {isEditing ? <TextInput style={styles.inputMetric} keyboardType="numeric" value={editData.realDistance} onChangeText={t => setEditData({...editData, realDistance: t})}/> : <Text style={styles.metricValue}>{selectedRide.realDistance || 0}</Text>}
                   </View>
                   <View style={styles.metricItem}>
                     <Text style={styles.metricLabel}>Péages (€)</Text>
                     {isEditing ? <TextInput style={styles.inputMetric} keyboardType="numeric" value={editData.tolls} onChangeText={t => setEditData({...editData, tolls: t})}/> : <Text style={styles.metricValue}>{selectedRide.tolls || 0}</Text>}
                   </View>
                </View>

                <TouchableOpacity style={styles.mappyBtn} onPress={openMappy}>
                    <Ionicons name="map-outline" size={18} color="#FFF" style={{marginRight: 8}} />
                    <Text style={styles.mappyBtnText}>Vérifier l'itinéraire sur Mappy</Text>
                </TouchableOpacity>

                <View style={{marginTop: 20}}>
                    {isEditing ? (
                        <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                            <Text style={styles.saveBtnText}>SAUVEGARDER LES MODIFICATIONS</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity 
                            style={[styles.billBtn, selectedRide.statuFacturation === 'Facturé' ? styles.billBtnDone : styles.billBtnTodo]} 
                            onPress={() => toggleBillingStatus(selectedRide)}
                        >
                            <Ionicons name={selectedRide.statuFacturation === 'Facturé' ? "checkmark-circle" : "ellipse-outline"} size={20} color="#FFF" style={{marginRight:8}}/>
                            <Text style={styles.billBtnText}>{selectedRide.statuFacturation === 'Facturé' ? "FACTURÉ" : "MARQUER FACTURÉ"}</Text>
                        </TouchableOpacity>
                    )}
                </View>
              </View>

            </ScrollView>
          </View>
        )}
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
  
  // Style mis à jour pour le sélecteur de jour
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 },
  monthTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textTransform: 'capitalize' },
  monthArrow: { padding: 5 },
  
  statsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 15, justifyContent: 'space-between', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1 },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.3)' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 20, marginTop: -25, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, elevation: 5 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#333' },
  
  // --- LISTE ---
  listContent: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 100 },
  card: { backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, elevation: 2, padding: 15, borderLeftWidth: 4, borderLeftColor: 'transparent' },
  cardConflicting: { borderLeftColor: '#D32F2F', backgroundColor: '#FFF0F0' }, 
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  dateCol: { alignItems: 'center', paddingRight: 15, borderRightWidth: 1, borderRightColor: '#F0F0F0', width: 75 }, // Fixe la largeur pour aligner proprement
  dayText: { fontSize: 18, fontWeight: 'bold', color: '#333' }, // Changé pour afficher l'heure
  monthText: { fontSize: 10, color: '#999', textTransform: 'uppercase', marginTop: 2 },
  detailsCol: { flex: 1, paddingLeft: 15 },
  patientName: { fontSize: 16, fontWeight: 'bold', color: '#333', flex:1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rideInfoText: { fontSize: 13, color: '#666' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  priceTextList: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32' },
  
  billedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  billedText: { fontSize: 11, fontWeight: 'bold', color: '#2E7D32' },
  pendingText: { fontSize: 11, color: '#F57C00', fontStyle: 'italic' },
  
  conflictBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  conflictBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#D32F2F' },
  
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 16 },

  // --- MODAL ---
  modalContainer: { flex: 1, backgroundColor: '#F4F6F8' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  closeModalBtn: { padding: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  iconBtn: { padding: 5 },
  modalScroll: { padding: 20 },
  priceCard: { backgroundColor: '#E0F2F1', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#B2DFDB' },
  priceLabel: { fontSize: 12, color: '#00695C', fontWeight: 'bold', letterSpacing: 1 },
  priceBig: { fontSize: 36, fontWeight: '900', color: '#004D40', marginTop: 5 },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 15, elevation: 1 },
  sectionHeader: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  patientBig: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  sharedInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, marginTop: 10 },
  sharedInfoText: { color: '#EF6C00', marginLeft: 8, fontSize: 13 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5, marginRight: 15 },
  line: { width: 2, height: 30, backgroundColor: '#EEE', marginLeft: 5, marginVertical: 2 },
  addrLabel: { fontSize: 10, color: '#999', fontWeight: 'bold', marginBottom: 4 },
  timeText: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  
  inputTime: { fontSize: 16, fontWeight: 'bold', color: '#FF6B00', borderBottomWidth: 1, borderBottomColor: '#FF6B00', paddingVertical: 2, minWidth: 60, textAlign: 'center' },

  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  metricItem: { flex: 1, backgroundColor: '#F9FAFB', padding: 15, borderRadius: 12, alignItems: 'center' },
  metricLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
  metricValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  inputMetric: { fontSize: 18, fontWeight: 'bold', color: '#2196F3', borderBottomWidth: 1, borderBottomColor: '#2196F3', textAlign: 'center', width: '80%' },
  
  mappyBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#3B82F6', padding: 12, borderRadius: 10, marginTop: 15 },
  mappyBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  saveBtn: { backgroundColor: '#2196F3', padding: 15, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
  billBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 12 },
  billBtnDone: { backgroundColor: '#388E3C' },
  billBtnTodo: { backgroundColor: '#757575' },
  billBtnText: { color: '#FFF', fontWeight: 'bold' },
});