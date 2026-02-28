import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api'; // Assure-toi que ce chemin est correct pour ton projet

export default function DispatchModal({ visible, onClose, ride, contacts, groups, onCreateGroup, onSuccess }) {
  const [activeTab, setActiveTab] = useState('contacts'); // 'contacts' ou 'groups'
  const [sendingId, setSendingId] = useState(null);

  const handleDispatch = async (target, isGroup) => {
    const name = isGroup ? target.name : target.contactId.fullName;
    const typeMsg = isGroup ? `au groupe "${name}"` : `à ${name}`;
    const confirmMsg = isGroup 
        ? `La course sera proposée aux ${target.members.length} chauffeurs du groupe. Le premier qui accepte l'aura.`
        : `La course sera envoyée directement à ce chauffeur.`;

    Alert.alert(
      `Envoyer ${typeMsg} ?`,
      confirmMsg,
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Envoyer", 
          onPress: async () => {
            try {
              setSendingId(target.id || target._id);
              
              // 👇 VRAI APPEL API (Connecté au Backend)
              const payload = {
                  rideId: ride._id,
                  // Si c'est un groupe, on envoie l'ID du groupe, sinon l'ID du contact
                  targetGroupId: isGroup ? (target.id || target._id) : null,
                  targetUserId: isGroup ? null : target.contactId._id
              };

              // Assure-toi que cette route existe dans ton backend
              await api.post('/dispatch/send', payload);

              Alert.alert("Succès", "Offre envoyée au réseau ! 📡");
              if (onSuccess) onSuccess();
              onClose();
            } catch (error) {
              console.error(error);
              Alert.alert("Erreur", "Impossible d'envoyer la course (Erreur serveur).");
            } finally {
              setSendingId(null);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bourse d'Échange 📡</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close-circle" size={30} color="#DDD" /></TouchableOpacity>
        </View>

        {/* Info Course */}
        <View style={styles.rideSummary}>
            <Text style={styles.summaryText}>📍 {ride?.startLocation} ➔ 🏁 {ride?.endLocation}</Text>
        </View>

        {/* Onglets */}
        <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, activeTab === 'contacts' && styles.activeTab]} onPress={() => setActiveTab('contacts')}>
                <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>👤 Individuel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, activeTab === 'groups' && styles.activeTab]} onPress={() => setActiveTab('groups')}>
                <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>👥 Groupes</Text>
            </TouchableOpacity>
        </View>

        {/* Liste */}
        <FlatList
          data={activeTab === 'contacts' ? contacts : groups}
          keyExtractor={(item) => (item.id || item._id).toString()}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => handleDispatch(item, activeTab === 'groups')}
              disabled={sendingId !== null}
            >
              <View style={[styles.avatar, activeTab === 'groups' && {backgroundColor: '#FFEBEE'}]}>
                <Ionicons name={activeTab === 'groups' ? "people" : "person"} size={20} color={activeTab === 'groups' ? "#D32F2F" : "#1976D2"} />
              </View>
              
              <View style={styles.infoCol}>
                <Text style={styles.name}>{activeTab === 'groups' ? item.name : item.contactId?.fullName}</Text>
                <Text style={styles.subText}>
                    {activeTab === 'groups' ? `${item.members ? item.members.length : 0} membres` : "Chauffeur partenaire"}
                </Text>
              </View>

              {sendingId === (item.id || item._id) ? <ActivityIndicator color="#6200EE" /> : <Ionicons name="paper-plane-outline" size={24} color="#6200EE" />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aucun {activeTab === 'groups' ? 'groupe' : 'contact'}.</Text>
                {activeTab === 'groups' && (
                    <TouchableOpacity style={styles.createBtn} onPress={onCreateGroup}>
                        <Text style={styles.createBtnText}>+ Créer un groupe</Text>
                    </TouchableOpacity>
                )}
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, flexDirection:'row', justifyContent:'space-between', backgroundColor: '#FFF' },
  title: { fontSize: 22, fontWeight: '800' },
  rideSummary: { backgroundColor: '#EDE7F6', padding: 12, alignItems: 'center' },
  summaryText: { fontWeight: 'bold', color: '#4527A0', fontSize: 13 },
  
  tabs: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 10 },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#6200EE' },
  tabText: { fontWeight: '600', color: '#999' },
  activeTabText: { color: '#6200EE', fontWeight: 'bold' },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  infoCol: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  subText: { fontSize: 12, color: '#888' },

  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#999', marginBottom: 15 },
  createBtn: { backgroundColor: '#6200EE', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  createBtnText: { color: '#FFF', fontWeight: 'bold' }
});