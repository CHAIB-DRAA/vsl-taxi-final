import React, { useState, useEffect, useCallback } from 'react';
import C from '../styles/tokens';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, Keyboard, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';


// Avatar color palette cycling
const AVATAR_COLORS = [
  ['#3B82F6', '#2563EB'],
  ['#8B5CF6', '#7C3AED'],
  ['#00D68F', '#00B87A'],
  ['#F59E0B', '#D97706'],
  ['#EF4444', '#DC2626'],
  ['#FF5500', '#E55A00'],
];

const getAvatarColors = (name = '') => {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

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
      // échec silencieux — liste vide affichée
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // 2. Rechercher
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    Keyboard.dismiss();
    try {
      setLoading(true);
      const res = await api.get('/contacts/search', {
        params: { q: searchQuery.trim() }
      });
      setSearchResults(res.data);
    } catch (err) {
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
      setSearchQuery('');
      setSearchResults([]);
      setActiveTab('list');
      loadContacts();
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

  const renderItem = ({ item, isSearch }) => {
    const name = isSearch ? item.fullName : item.contactId?.fullName || "Utilisateur inconnu";
    const email = isSearch ? item.email : item.contactId?.email;
    const initial = name.charAt(0).toUpperCase() || '?';
    const avatarColors = getAvatarColors(name);

    return (
      <View style={styles.card}>
        <View style={[styles.avatarPlaceholder, {backgroundColor: avatarColors[0]}]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Statut badge (online indicator) — affiché sur les collègues existants */}
        {!isSearch && (
          <View style={styles.statusDot} />
        )}

        {isSearch ? (
          <TouchableOpacity style={styles.addBtnWrap} onPress={() => addContact(item._id)}>
            <LinearGradient colors={[C.green, '#00B87A']} style={styles.addBtn}>
              <Ionicons name="person-add" size={16} color="#FFF" />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.delBtn} onPress={() => removeContact(item._id)}>
            <Ionicons name="trash-outline" size={20} color={C.red} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER DARK GRADIENT */}
      <View style={[styles.header, {backgroundColor: "#FFFFFF"}]}>
        {/* Accent blob */}

        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Collègues</Text>
            <Text style={styles.headerSub}>{contacts.length} contacts</Text>
          </View>
          {/* Online count badge */}
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineBadgeText}>{contacts.length} en ligne</Text>
          </View>
        </View>

        {/* TABS IN HEADER */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'list' && styles.activeTab]}
            onPress={() => setActiveTab('list')}
          >
            <Ionicons name="people" size={14} color={activeTab === 'list' ? '#FFF' : C.hText2} style={{marginRight:6}} />
            <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>Mes Collègues</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.activeTab]}
            onPress={() => setActiveTab('search')}
          >
            <Ionicons name="person-add" size={14} color={activeTab === 'search' ? '#FFF' : C.hText2} style={{marginRight:6}} />
            <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>Ajouter</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* BARRE DE RECHERCHE — onglet Ajouter */}
        {activeTab === 'search' && (
          <View style={styles.searchBarWrap}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={C.text3} style={{marginRight:8}} />
              <TextInput
                style={styles.searchInput}
                placeholder="Email ou nom..."
                placeholderTextColor={C.text3}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity style={styles.searchBtnWrap} onPress={handleSearch}>
              <LinearGradient colors={[C.brand, '#E55A00']} style={styles.searchBtnGradient}>
                <Ionicons name="search" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={C.brand} style={{marginTop: 50}} />
        ) : (
          <FlatList
            data={activeTab === 'list' ? contacts : searchResults}
            keyExtractor={item => item._id}
            renderItem={({ item }) => renderItem({ item, isSearch: activeTab === 'search' })}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <LinearGradient colors={[C.card2, C.border]} style={styles.emptyIconBox}>
                  <Ionicons name={activeTab === 'list' ? "people-outline" : "search-outline"} size={32} color={C.text3} />
                </LinearGradient>
                <Text style={styles.emptyText}>
                  {activeTab === 'list' ? "Aucun collègue enregistré." : "Aucun résultat trouvé."}
                </Text>
                {activeTab === 'list' && (
                  <TouchableOpacity onPress={() => setActiveTab('search')}>
                    <Text style={styles.emptyAction}>Ajouter un collègue</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // HEADER
  header: { paddingTop: 8, paddingBottom: 20, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: C.hText, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: C.hText2, marginTop: 2 },
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.hCard, borderRadius: 20,
    borderWidth: 1, borderColor: C.hBorder,
    paddingHorizontal: 12, paddingVertical: 7, gap: 6,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  onlineBadgeText: { fontSize: 12, color: C.hText2, fontWeight: '600' },

  // TABS IN HEADER
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: C.hCard,
    borderRadius: 14, borderWidth: 1, borderColor: C.hBorder,
    padding: 4,
  },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  activeTab: { backgroundColor: C.brand },
  tabText: { fontWeight: '700', color: C.hText2, fontSize: 13 },
  activeTabText: { color: '#FFF' },

  content: { flex: 1 },

  // SEARCH BAR
  searchBarWrap: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, height: 50,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text },
  searchBtnWrap: { borderRadius: 16, overflow: 'hidden' },
  searchBtnGradient: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },

  // LIST
  listContent: { paddingHorizontal: 16, paddingBottom: 50 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, padding: 14,
    marginBottom: 10, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatarPlaceholder: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  email: { fontSize: 12, color: C.text2, marginTop: 2 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, marginRight: 10, borderWidth: 1.5, borderColor: '#FFF' },

  addBtnWrap: { borderRadius: 20, overflow: 'hidden' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, gap: 5 },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  delBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },

  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: C.text3, fontSize: 15 },
  emptyAction: { color: C.brand, fontWeight: '700', fontSize: 14, marginTop: 4 },
});
