import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
// 👇 LE SECRET DU DESIGN MODERNE :
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import des écrans
import ProfileScreen from './ProfileScreen';
import ContactsScreen from './ContactScreen'; 
import PatientsScreen from './PatientsScreen'; 

export default function SettingsScreen({ navigation, onLogout }) {
  // Récupération des marges de sécurité exactes du téléphone
  const insets = useSafeAreaInsets();
  
  const [showContacts, setShowContacts] = useState(false);
  const [showPatients, setShowPatients] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion', 'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' }, 
        { text: 'Déconnexion', style: 'destructive', onPress: async () => { try { await SecureStore.deleteItemAsync('user_session'); if (onLogout) onLogout(); } catch (err) { console.error("Erreur", err); } } }
      ]
    );
  };

  const options = [
    { id: '1', label: 'Mon compte', icon: 'person', colorBg: '#E3F2FD', colorIcon: '#2196F3', onPress: () => setShowProfile(true) },
    { id: '2', label: 'Mes contacts', icon: 'people', colorBg: '#FFF3E0', colorIcon: '#FF9800', onPress: () => setShowContacts(true) },
    { id: '5', label: 'Mes Patients', icon: 'medkit', colorBg: '#E8F5E9', colorIcon: '#4CAF50', onPress: () => setShowPatients(true) },
    { id: '3', label: 'Paramètres app', icon: 'settings', colorBg: '#F3E5F5', colorIcon: '#9C27B0', onPress: () => Alert.alert('Réglages', 'Notifications, Langue, etc.') },
    { id: '4', label: 'Déconnexion', icon: 'log-out', colorBg: '#FFEBEE', colorIcon: '#D32F2F', onPress: handleLogout, isDestructive: true },
  ];

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={item.onPress} activeOpacity={0.7}>
      <View style={styles.cardLeft}>
        {/* Icône dans une bulle colorée moderne */}
        <View style={[styles.iconBox, { backgroundColor: item.colorBg }]}>
            <Ionicons name={item.icon} size={20} color={item.colorIcon} />
        </View>
        <Text style={[styles.label, item.isDestructive && { color: '#D32F2F' }]}>{item.label}</Text>
      </View>
      
      {!item.isDestructive && (
        <View style={styles.chevronBox}>
           <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* HEADER ULTRA CLEAN */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Mon Profil</Text>
        <Text style={styles.headerSubtitle}>Gérez vos préférences</Text>
      </View>
      
      <FlatList
        data={options}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* --- MODALS --- */}
      
      {/* Modal Contacts */}
      <Modal visible={showContacts} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Mes Contacts</Text>
          <TouchableOpacity onPress={() => setShowContacts(false)} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <ContactsScreen />
      </Modal>

      {/* Modal Patients */}
      <Modal visible={showPatients} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Mes Patients</Text>
          <TouchableOpacity onPress={() => setShowPatients(false)} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <PatientsScreen />
      </Modal>

      {/* Modal Profil */}
      <Modal visible={showProfile} animationType="slide" presentationStyle="pageSheet">
         <View style={styles.modalHeader}>
           <Text style={styles.modalTitle}>Mon Profil</Text>
           <TouchableOpacity onPress={() => setShowProfile(false)} style={styles.closeButton}>
             <Ionicons name="close" size={24} color="#333" />
           </TouchableOpacity>
         </View>
         <ProfileScreen />
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA', // Gris très léger "Apple Style"
  },
  
  // HEADER
  headerContainer: {
    paddingHorizontal: 25,
    paddingTop: 20, // Espace supplémentaire sous la barre de statut
    paddingBottom: 10,
  },
  headerTitle: { 
    fontSize: 34, // Très grand titre moderne
    fontWeight: '800', 
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#888',
    marginTop: 5,
    fontWeight: '500'
  },

  // LISTE
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 50,
  },

  // CARTE (ITEM)
  card: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff', 
    marginBottom: 12, 
    borderRadius: 20, // Coins très ronds
    paddingVertical: 16, 
    paddingHorizontal: 20, 
    
    // Ombres très douces (Style 2024)
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.03, 
    shadowRadius: 10, 
    elevation: 1, // Android Low Elevation
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14, // Squircle
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  label: { 
    fontSize: 17, 
    fontWeight: '600', 
    color: '#333' 
  },
  chevronBox: {
    backgroundColor: '#F9F9F9',
    borderRadius: 20,
    padding: 6
  },
  
  // MODALS STYLES
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F5F5F5', 
    backgroundColor: '#FFF' 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#1A1A1A' 
  },
  closeButton: { 
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20
  }
});