import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api'; 

export default function ContactScreen({ navigation }) {
  const [contacts, setContacts] = useState([]); 
  const [searchResults, setSearchResults] = useState([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' ou 'search'

  // 1. Charger mes contacts
  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/contacts');
      setContacts(res.data);
    } catch (err) {
      console.error("Erreur chargement contacts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // 2. Rechercher (Optimisé Email)
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return; // .trim() enlève les espaces
    Keyboard.dismiss();
    try {
      setLoading(true);
      // On envoie la recherche nettoyée
      const res = await api.get('/contacts/search', { 
        params: { q: searchQuery.trim() } 
      });
      setSearchResults(res.data);
    } catch (err) {
      console.error("Erreur recherche:", err);
      Alert.alert("Erreur", "Problème lors de la recherche");
    } finally {
      setLoading(false);
    }
  };

  // 3. Ajouter un contact
  const addContact = async (userId) => {
    try {
      await api.post('/contacts', { contactId: userId });
      Alert.alert("Succès", "Nouveau contact ajouté !");
      
      // Reset et retour à la liste
      setSearchQuery('');
      setSearchResults([]);
      setActiveTab('list');
      loadContacts(); // Rafraîchir la liste principale
    } catch (err) {
      const msg = err.response?.data?.message || "Impossible d'ajouter";
      Alert.alert("Erreur", msg);
    }
  };

  // 4. Supprimer un contact
  const removeContact = async (id) => {
    Alert.alert("Confirmation", "Supprimer ce contact ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/contacts/${id}`);
            loadContacts();
          } catch (err) {
            Alert.alert("Erreur", "Suppression impossible");
          }
        } 
      }
    ]);
  };

  // Rendu d'une ligne (Item)
  const renderItem = ({ item, isSearch }) => (
    <View style={styles.card}>
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarText}>
          {isSearch 
            ? item.fullName?.charAt(0).toUpperCase() 
            : item.contactId?.fullName?.charAt(0).toUpperCase() || "?"}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={styles.name}>
          {isSearch ? item.fullName : item.contactId?.fullName || "Utilisateur inconnu"}
        </Text>
        <Text style={styles.email}>
          {isSearch ? item.email : item.contactId?.email}
        </Text>
      </View>
      
      {isSearch ? (
        <TouchableOpacity style={styles.addBtn} onPress={() => addContact(item._id)}>
          <Ionicons name="person-add" size={20} color="#FFF" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.delBtn} onPress={() => removeContact(item._id)}>
          <Ionicons name="trash-outline" size={22} color="#D32F2F" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER ONGLETS */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'list' && styles.activeTab]} 
          onPress={() => setActiveTab('list')}
        >
          <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>Mes Collègues</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'search' && styles.activeTab]} 
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* BARRE DE RECHERCHE (Visible uniquement dans l'onglet Ajouter) */}
        {activeTab === 'search' && (
          <View style={styles.searchBar}>
            <TextInput 
              style={styles.input} 
              placeholder="Email ou nom..." 
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              // Options Clavier Email
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={handleSearch} style={styles.searchBtnIcon}>
              <Ionicons name="search" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#FF6B00" style={{marginTop: 50}} />
        ) : (
          <FlatList 
            data={activeTab === 'list' ? contacts : searchResults}
            keyExtractor={item => item._id}
            renderItem={({ item }) => renderItem({ item, isSearch: activeTab === 'search' })}
            contentContainerStyle={{ padding: 15, paddingBottom: 50 }}
            ListEmptyComponent={
              <View style={{alignItems:'center', marginTop: 50}}>
                <Ionicons name={activeTab === 'list' ? "people-outline" : "search-outline"} size={50} color="#DDD" />
                <Text style={styles.emptyText}>
                  {activeTab === 'list' ? "Aucun collègue enregistré." : "Aucun résultat trouvé."}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFF', padding: 5, margin: 15, borderRadius: 12, elevation: 2 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#FF6B00' },
  tabText: { fontWeight: 'bold', color: '#666' },
  activeTabText: { color: '#FFF' },
  content: { flex: 1 },
  searchBar: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 15 },
  input: { flex: 1, backgroundColor: '#FFF', padding: 14, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, elevation: 1, fontSize: 16 },
  searchBtnIcon: { backgroundColor: '#333', justifyContent: 'center', padding: 14, borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, marginBottom: 10, borderRadius: 12, elevation: 1 },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#EF6C00' },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  email: { fontSize: 13, color: '#888' },
  addBtn: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 20 },
  delBtn: { padding: 10 },
  emptyText: { textAlign: 'center', marginTop: 10, color: '#999', fontSize: 16 }
});