import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/fr';
import * as Clipboard from 'expo-clipboard'; 

const typeColors = {
  Aller: '#4CAF50',
  Retour: '#1976D2',
  Consultation: '#FF9800',
  Ambulance: '#D32F2F',
  VSL: '#1976D2',
  Autre: '#607D8B',
};

export default function RideCard({ ride, onPress, onRespond, onStatusChange }) {
  const isFinished = ride.status === 'Terminée' || !!ride.endTime;
  const isStarted = !!ride.startTime && !isFinished;
  
  const pendingStatus = ride.shareStatus === 'pending' || ride.statusPartage === 'pending';
  const showResponseButtons = ride.isShared && pendingStatus;

  // 👇 CORRECTION MAJEURE ICI : Ordre de priorité et nettoyage
  // 1. shareNote (Note spécifique du partage)
  // 2. notes (Note générale du créateur)
  // 3. note (Faute de frappe fréquente)
  const rawNote = ride.shareNote || ride.notes || ride.note || ride.sharedNote || '';
  const noteContent = rawNote.trim(); // On enlève les espaces vides
  const hasNote = noteContent.length > 0;

  const needsPMT = (ride.type === 'VSL' || ride.type === 'Ambulance') && !isFinished;
  
  const handleCopy = async () => {
    const info = `🚕 *Course ${ride.type}*\n` +
                 `📅 ${moment(ride.date).format('DD/MM à HH:mm')}\n` +
                 `👤 ${ride.patientName} (${ride.patientPhone || 'Pas de tel'})\n` +
                 `📍 De : ${ride.startLocation}\n` +
                 `🏁 Vers : ${ride.endLocation}\n` +
                 (hasNote ? `📝 Note : ${noteContent}` : '');
    
    await Clipboard.setStringAsync(info);
    Alert.alert("Copié !", "Les infos de la course sont dans le presse-papier.");
  };

  const openWaze = (isStart) => {
    const targetAddress = isStart ? ride.startLocation : ride.endLocation;
    if (!targetAddress) return Alert.alert("Erreur", "Adresse manquante.");
    const encoded = encodeURIComponent(targetAddress);
    const url = `https://waze.com/ul?q=${encoded}&navigate=yes`;
    Linking.openURL(url).catch(() => Alert.alert("Erreur", "Waze ne semble pas installé."));
  };

  const callPatient = () => {
    if (!ride.patientPhone) return Alert.alert("Info", "Aucun numéro enregistré.");
    Linking.openURL(`tel:${ride.patientPhone}`);
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      onPress={() => onPress && onPress(ride)}
      disabled={showResponseButtons} 
      style={[
        styles.card, 
        isFinished && styles.cardFinished,
        showResponseButtons && styles.cardIncoming, 
        isStarted && styles.cardActive 
      ]}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.timeContainer}>
          <Ionicons name="time-outline" size={16} color={isFinished ? "#888" : "#333"} />
          <Text style={[styles.timeText, isFinished && { color: '#888' }]}>
            {ride.startTime ? moment(ride.startTime).format('HH:mm') : moment(ride.date).format('HH:mm')}
          </Text>
        </View>

        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={18} color="#555" />
            </TouchableOpacity>
            <View style={[styles.badge, { backgroundColor: isFinished ? '#999' : (typeColors[ride.type] || typeColors.Autre) }]}>
              <Text style={styles.badgeText}>{ride.type}</Text>
            </View>
        </View>
      </View>

      {/* INFO PARTAGE */}
      {ride.isShared && (
        <View style={styles.sharedBadge}>
            <Ionicons name="arrow-undo" size={12} color="#EF6C00" />
            <Text style={styles.sharedText}>
               {showResponseButtons ? "Invitation Reçue" : `Partagé par ${ride.sharedByName || "Collègue"}`}
            </Text>
        </View>
      )}

      {/* 👇 AFFICHAGE DE LA NOTE (Mis en évidence) */}
      {hasNote && (
        <View style={styles.noteContainer}>
            <Ionicons name="chatbox-ellipses" size={18} color="#FF6B00" style={{marginTop: 2}} />
            <Text style={styles.noteText}>
                {noteContent}
            </Text>
        </View>
      )}

      {/* PATIENT & APPEL */}
      <View style={styles.patientRow}>
        <Text style={[styles.patientName, isFinished && { color: '#888' }]} numberOfLines={1}>
          {ride.patientName}
        </Text>
        <TouchableOpacity 
          style={[styles.callBtn, (!ride.patientPhone || isFinished) && { backgroundColor: '#CCC' }]} 
          onPress={callPatient}
        >
          <Ionicons name="call" size={16} color="#FFF" />
          <Text style={styles.callBtnText}>{ride.patientPhone ? "Appeler" : "Pas de n°"}</Text>
        </TouchableOpacity>
      </View>

      {/* ALERTE PMT */}
      {needsPMT && (
        <View style={styles.pmtAlert}>
          <Ionicons name="document-text" size={16} color="#D32F2F" />
          <Text style={styles.pmtText}>⚠️ DEMANDER LE BON DE TRANSPORT</Text>
        </View>
      )}

      {/* ITINÉRAIRE */}
      <View style={styles.routeContainer}>
        <TouchableOpacity style={styles.addressRow} onPress={() => openWaze(true)}>
          <View style={styles.iconBoxStart}>
             <Ionicons name="navigate-circle" size={20} color="#4CAF50" />
          </View>
          <View style={{flex: 1}}>
             <Text style={styles.addressLabel}>Départ</Text>
             <Text style={[styles.addressText, isFinished && { color: '#999' }]} numberOfLines={1}>
                {ride.startLocation}
             </Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.routeLine} />
        
        <TouchableOpacity style={styles.addressRow} onPress={() => openWaze(false)}>
          <View style={styles.iconBoxEnd}>
             <Ionicons name="flag" size={20} color="#FF6B00" />
          </View>
          <View style={{flex: 1}}>
             <Text style={styles.addressLabel}>Arrivée</Text>
             <Text style={[styles.addressText, isFinished && { color: '#999' }]} numberOfLines={1}>
                {ride.endLocation}
             </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ACTIONS */}
      {!showResponseButtons && !isFinished && onStatusChange && (
        <View style={styles.actionZone}>
          {!isStarted ? (
            <TouchableOpacity style={[styles.statusBtn, styles.btnStart]} onPress={() => onStatusChange(ride, 'start')}>
              <Ionicons name="play" size={20} color="#FFF" />
              <Text style={styles.statusBtnText}>DÉMARRER</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.statusBtn, styles.btnFinish]} onPress={() => onStatusChange(ride, 'finish')}>
              <Ionicons name="checkbox" size={20} color="#FFF" />
              <Text style={styles.statusBtnText}>TERMINER</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* RÉPONSE INVITATION */}
      {showResponseButtons && (
        <View style={styles.footer}>
           <Text style={styles.shareLabel}>Répondre :</Text>
           <TouchableOpacity style={[styles.btn, styles.btnAccept]} onPress={() => onRespond(ride, 'accepted')}>
             <Text style={styles.btnText}>Accepter</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.btn, styles.btnDecline]} onPress={() => onRespond(ride, 'refused')}>
             <Text style={styles.btnText}>Refuser</Text>
           </TouchableOpacity>
        </View>
      )}
      
      {isFinished && (
         <View style={styles.footerInfo}>
            <Ionicons name="checkmark-circle" size={14} color="#888" />
            <Text style={{color:'#888', fontStyle:'italic', fontSize:12, marginLeft:5}}>
                Terminée {ride.endTime ? `à ${moment(ride.endTime).format('HH:mm')}` : ''}
            </Text>
         </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, marginBottom: 12, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#DDD' },
  cardFinished: { backgroundColor: '#F9F9F9', borderColor: '#E0E0E0', borderWidth: 1, borderLeftColor: '#999', elevation: 0 },
  cardActive: { borderLeftColor: '#4CAF50', backgroundColor: '#F1F8E9', borderWidth: 1, borderColor: '#C8E6C9' },
  cardIncoming: { borderLeftColor: '#FF9800', backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FFE0B2' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  timeContainer: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 20, fontWeight: 'bold', marginLeft: 5, color: '#333' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  copyBtn: { padding: 5, marginRight: 10, backgroundColor: '#F0F0F0', borderRadius: 8 },

  sharedBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 10 },
  sharedText: { color: '#EF6C00', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  
  // STYLE NOTE AMÉLIORÉ
  noteContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#FFF8E1', // Fond jaune clair pour ressortir
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 12, 
    borderLeftWidth: 3, 
    borderLeftColor: '#FF6B00',
    alignItems: 'center'
  },
  noteText: { fontSize: 14, color: '#333', fontWeight: '500', marginLeft: 10, flex: 1 },

  patientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  patientName: { fontSize: 18, fontWeight: 'bold', flex: 1, color: '#000' },
  
  callBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#009688', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginLeft: 10 },
  callBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },

  pmtAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', padding: 8, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#FFCDD2' },
  pmtText: { color: '#D32F2F', fontWeight: 'bold', fontSize: 12, marginLeft: 8 },
  
  routeContainer: { marginBottom: 15, backgroundColor: '#FAFAFA', borderRadius: 12, padding: 10 },
  addressRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  iconBoxStart: { width: 30, alignItems: 'center' },
  iconBoxEnd: { width: 30, alignItems: 'center' },
  addressLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 2 },
  addressText: { color: '#333', fontSize: 15, fontWeight: '500' },
  routeLine: { width: 2, height: 15, backgroundColor: '#DDD', marginLeft: 14, marginVertical: 2 },
  
  actionZone: { marginTop: 5, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEE' },
  statusBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  btnStart: { backgroundColor: '#4CAF50' },
  btnFinish: { backgroundColor: '#333' },
  statusBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, marginLeft: 8, letterSpacing: 1 },
  
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', alignItems: 'center' },
  shareLabel: { marginRight: 10, color: '#E65100', fontWeight:'bold' },
  btn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginLeft: 10 },
  btnAccept: { backgroundColor: '#4CAF50' },
  btnDecline: { backgroundColor: '#D32F2F' },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  
  footerInfo: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5, alignItems: 'center' }
});