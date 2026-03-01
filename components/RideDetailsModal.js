import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, Linking, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { calculatePrice } from '../utils/pricing';

export default function RideDetailsModal({ visible, selectedRide, onClose, onSave, onDelete, onToggleBilling, hasConflict }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ realDistance: '', tolls: '', startTime: '', endTime: '' });
  
  // État pour l'animation du calcul automatique
  const [isCalculating, setIsCalculating] = useState(false);

  // Initialisation des données à l'ouverture de la modal
  useEffect(() => {
    if (selectedRide && visible) {
      setEditData({
        realDistance: String(selectedRide.realDistance || selectedRide.distance || 0),
        tolls: String(selectedRide.tolls || 0),
        startTime: selectedRide.startTime ? dayjs(selectedRide.startTime).format('HH:mm') : '',
        endTime: selectedRide.endTime ? dayjs(selectedRide.endTime).format('HH:mm') : ''
      });
      setIsEditing(false);
    }
  }, [selectedRide, visible]);

  if (!selectedRide) return null;

  // --- ACTIONS ---

  // 1. Calcul automatique de la distance via OpenStreetMap (Nominatim + OSRM)
  const calculateDistanceAuto = async () => {
    if (!selectedRide.startLocation || !selectedRide.endLocation) {
      return Alert.alert("Erreur", "Les adresses de départ et d'arrivée sont requises.");
    }
    
    setIsCalculating(true);
    try {
      // ÉTAPE A : Convertir les adresses avec Photon (Moteur beaucoup plus intelligent et tolérant)
      const getCoordinates = async (address) => {
        // On ajoute " France" à la fin pour aider le moteur à cibler le bon pays
        const cleanAddress = address + ", France";
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanAddress)}&limit=1`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.features && data.features.length > 0) {
          // Photon renvoie les coordonnées dans l'ordre [longitude, latitude]
          const coords = data.features[0].geometry.coordinates;
          return { lon: coords[0], lat: coords[1] };
        }
        return null;
      };
      const startCoords = await getCoordinates(selectedRide.startLocation);
      const endCoords = await getCoordinates(selectedRide.endLocation);

      if (!startCoords || !endCoords) {
        Alert.alert("Échec", "OpenStreetMap n'a pas pu trouver les coordonnées exactes de ces adresses.");
        setIsCalculating(false);
        return;
      }

      // ÉTAPE B : Calculer la distance routière (OSRM)
      // OSRM demande les coordonnées dans l'ordre {longitude},{latitude}
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},${startCoords.lat};${endCoords.lon},${endCoords.lat}?overview=false`;
      
      const routeRes = await fetch(osrmUrl);
      const routeData = await routeRes.json();

      if (routeData.code === "Ok" && routeData.routes.length > 0) {
        // OSRM renvoie la distance en mètres, on convertit en km avec 1 décimale
        const distanceMeters = routeData.routes[0].distance;
        const distanceKm = (distanceMeters / 1000).toFixed(1); 
        
        // Mise à jour de l'interface
        setEditData(prev => ({ ...prev, realDistance: String(distanceKm) }));
      } else {
        Alert.alert("Échec du calcul", "Impossible de tracer un itinéraire routier entre ces deux points.");
      }
    } catch (error) {
      Alert.alert("Erreur réseau", "Impossible de joindre les serveurs OpenStreetMap.");
    } finally {
      setIsCalculating(false);
    }
  };

  // 2. Vérification manuelle sur Mappy
  const openMappy = () => {
    if (!selectedRide.startLocation || !selectedRide.endLocation) return Alert.alert("Erreur", "Adresses incomplètes.");
    const url = `https://fr.mappy.com/itineraire#/voiture/${encodeURIComponent(selectedRide.startLocation)}/${encodeURIComponent(selectedRide.endLocation)}/car/7`;
    Linking.openURL(url).catch(() => Alert.alert("Erreur", "Impossible d'ouvrir Mappy."));
  };

  // 3. Sauvegarde des modifications
  const handleSave = () => {
    onSave(selectedRide, editData);
    setIsEditing(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* HEADER */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Détails Course</Text>
          <View style={{flexDirection: 'row', gap: 10}}>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.iconBtn}>
                <Ionicons name={isEditing ? "close-circle" : "pencil"} size={22} color="#2196F3" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(selectedRide._id)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={22} color="#D32F2F" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.modalScroll}>
          {/* PRIX CONVENTION */}
          <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>MONTANT CONVENTION</Text>
              <Text style={styles.priceBig}>{calculatePrice(selectedRide)} €</Text>
              {isEditing && <Text style={{color:'red', fontSize:10, marginTop:5}}>Mode Édition Activé</Text>}
          </View>

          {/* PATIENT INFO */}
          <View style={styles.sectionCard}>
             <Text style={styles.sectionHeader}>👤 Patient & Course</Text>
             <Text style={styles.patientBig}>{selectedRide.patientName}</Text>
             <View style={styles.detailTypeBox}>
                <Ionicons name="car" size={16} color="#0056b3" />
                <Text style={styles.detailTypeText}>Type : <Text style={{fontWeight:'bold'}}>{selectedRide.type || 'Standard'}</Text></Text>
             </View>
             {selectedRide.isShared && (
                <View style={styles.sharedInfoBox}>
                    <Ionicons name="arrow-undo" size={16} color="#EF6C00" />
                    <Text style={styles.sharedInfoText}>Transmis par : <Text style={{fontWeight:'bold'}}>{selectedRide.sharedByName || "Inconnu"}</Text></Text>
                </View>
             )}
          </View>

          {/* ITINÉRAIRE & HORAIRES */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>📍 Itinéraire & Horaires</Text>
            <View style={styles.timelineItem}>
                <View style={[styles.dot, {backgroundColor:'#4CAF50'}]} />
                <View style={{flex:1}}>
                    <Text style={styles.addrLabel}>DÉPART ({selectedRide.startLocation})</Text>
                    {isEditing ? (
                        <TextInput style={styles.inputTime} value={editData.startTime} placeholder="HH:MM" onChangeText={t => setEditData({...editData, startTime: t})} />
                    ) : (
                        <Text style={styles.timeText}>{selectedRide.startTime ? dayjs(selectedRide.startTime).format('HH:mm') : '--:--'}</Text>
                    )}
                </View>
            </View>
            <View style={styles.line} />
            <View style={styles.timelineItem}>
                <View style={[styles.dot, {backgroundColor:'#FF6B00'}]} />
                <View style={{flex:1}}>
                    <Text style={styles.addrLabel}>ARRIVÉE ({selectedRide.endLocation})</Text>
                    {isEditing ? (
                        <TextInput style={styles.inputTime} value={editData.endTime} placeholder="HH:MM" onChangeText={t => setEditData({...editData, endTime: t})} />
                    ) : (
                        <Text style={styles.timeText}>{selectedRide.endTime ? dayjs(selectedRide.endTime).format('HH:mm') : '--:--'}</Text>
                    )}
                </View>
            </View>
            {hasConflict && !isEditing && (
                <View style={styles.conflictAlert}>
                    <Text style={styles.conflictText}>⚠️ Attention : Écart &lt; 10 min avec une autre course.</Text>
                </View>
            )}
          </View>

          {/* MÉTRIQUES & FACTURATION */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>📊 Métriques (Tarification)</Text>
            <View style={styles.metricsRow}>
               
               {/* BLOC DISTANCE MODIFIÉ (AVEC CALCUL AUTO) */}
               <View style={styles.metricItem}>
                 <Text style={styles.metricLabel}>Distance (km)</Text>
                 {isEditing ? (
                     <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                         <TextInput 
                            style={[styles.inputMetric, {width: '60%'}]} 
                            keyboardType="numeric" 
                            value={editData.realDistance} 
                            onChangeText={t => setEditData({...editData, realDistance: t})}
                         />
                         <TouchableOpacity onPress={calculateDistanceAuto} style={{marginLeft: 10, padding: 5}}>
                             {isCalculating ? (
                                 <ActivityIndicator size="small" color="#2196F3" />
                             ) : (
                                 <Ionicons name="calculator" size={22} color="#2196F3" />
                             )}
                         </TouchableOpacity>
                     </View>
                 ) : (
                     <Text style={styles.metricValue}>{selectedRide.realDistance || 0}</Text>
                 )}
               </View>

               {/* BLOC PÉAGES */}
               <View style={styles.metricItem}>
                 <Text style={styles.metricLabel}>Péages (€)</Text>
                 {isEditing ? <TextInput style={styles.inputMetric} keyboardType="numeric" value={editData.tolls} onChangeText={t => setEditData({...editData, tolls: t})}/> : <Text style={styles.metricValue}>{selectedRide.tolls || 0}</Text>}
               </View>
            </View>

            {/* BOUTON MAPPY TOUJOURS PRÉSENT */}
            <TouchableOpacity style={styles.mappyBtn} onPress={openMappy}>
                <Ionicons name="map-outline" size={18} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.mappyBtnText}>Vérifier sur Mappy</Text>
            </TouchableOpacity>

            <View style={{marginTop: 20}}>
                {isEditing ? (
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Text style={styles.saveBtnText}>SAUVEGARDER</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        style={[styles.billBtn, selectedRide.statuFacturation === 'Facturé' ? styles.billBtnDone : styles.billBtnTodo]} 
                        onPress={() => onToggleBilling(selectedRide)}
                    >
                        <Ionicons name={selectedRide.statuFacturation === 'Facturé' ? "checkmark-circle" : "ellipse-outline"} size={20} color="#FFF" style={{marginRight:8}}/>
                        <Text style={styles.billBtnText}>{selectedRide.statuFacturation === 'Facturé' ? "FACTURÉ" : "MARQUER FACTURÉ"}</Text>
                    </TouchableOpacity>
                )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#F4F6F8' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  iconBtn: { padding: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalScroll: { padding: 20 },
  priceCard: { backgroundColor: '#E0F2F1', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#B2DFDB' },
  priceLabel: { fontSize: 12, color: '#00695C', fontWeight: 'bold', letterSpacing: 1 },
  priceBig: { fontSize: 36, fontWeight: '900', color: '#004D40', marginTop: 5 },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 15, elevation: 1 },
  sectionHeader: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  patientBig: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  detailTypeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e6f0fa', padding: 10, borderRadius: 8, marginTop: 10 },
  detailTypeText: { color: '#0056b3', marginLeft: 8, fontSize: 13 },
  sharedInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, marginTop: 10 },
  sharedInfoText: { color: '#EF6C00', marginLeft: 8, fontSize: 13 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5, marginRight: 15 },
  line: { width: 2, height: 30, backgroundColor: '#EEE', marginLeft: 5, marginVertical: 2 },
  addrLabel: { fontSize: 10, color: '#999', fontWeight: 'bold', marginBottom: 4 },
  timeText: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  inputTime: { fontSize: 16, fontWeight: 'bold', color: '#FF6B00', borderBottomWidth: 1, borderBottomColor: '#FF6B00', paddingVertical: 2, minWidth: 60, textAlign: 'center' },
  conflictAlert: { marginTop: 15, padding: 10, backgroundColor: '#FFEBEE', borderRadius: 8 },
  conflictText: { color: '#D32F2F', fontSize: 12, fontWeight: 'bold' },
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