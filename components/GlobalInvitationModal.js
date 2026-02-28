import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { useData } from '../contexts/DataContext'; // Connexion au cerveau

export default function GlobalInvitationModal() {
  const { pendingInvitation, handleGlobalRespond } = useData();

  if (!pendingInvitation) return null; // Rien à afficher

  return (
    <Modal visible={true} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="notifications" size={24} color="#FFF" />
            <Text style={styles.title}>Nouvelle Course Reçue</Text>
          </View>
          
          <View style={styles.body}>
            <Text style={styles.text}>
              <Text style={{fontWeight:'bold'}}>{pendingInvitation.sharedByName || "Un collègue"}</Text> vous propose :
            </Text>
            
            <View style={styles.detailBox}>
              <Text style={styles.detail}>📅 {moment(pendingInvitation.date).format('DD/MM/YYYY à HH:mm')}</Text>
              <Text style={styles.detailMain}>👤 {pendingInvitation.patientName}</Text>
              <Text style={styles.detail}>📍 {pendingInvitation.startLocation}</Text>
              <Text style={styles.detail}>🏁 {pendingInvitation.endLocation}</Text>
              {pendingInvitation.shareNote ? (
                  <Text style={styles.note}>📩 "{pendingInvitation.shareNote}"</Text>
              ) : null}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnRefuse} onPress={() => handleGlobalRespond(pendingInvitation._id, 'refused')}>
                  <Text style={styles.btnText}>Refuser</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAccept} onPress={() => handleGlobalRespond(pendingInvitation._id, 'accepted')}>
                  <Text style={styles.btnText}>Accepter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', elevation: 10 },
  header: { backgroundColor: '#FF6B00', padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  body: { padding: 20, alignItems: 'center' },
  text: { fontSize: 16, color: '#333', marginBottom: 15, textAlign: 'center' },
  detailBox: { width: '100%', backgroundColor: '#F5F5F5', padding: 15, borderRadius: 10, marginBottom: 20 },
  detail: { fontSize: 13, color: '#555', marginBottom: 3 },
  detailMain: { fontSize: 16, fontWeight: 'bold', color: '#000', marginBottom: 5 },
  note: { fontStyle: 'italic', color: '#E65100', marginTop: 10, fontWeight: 'bold' },
  actions: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  btnRefuse: { flex: 1, backgroundColor: '#D32F2F', padding: 15, borderRadius: 10, alignItems: 'center', marginRight: 10 },
  btnAccept: { flex: 1, backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center', marginLeft: 10 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});