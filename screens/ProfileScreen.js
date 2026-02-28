import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, 
  Alert, Modal, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, Switch, SafeAreaView, StatusBar 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store'; 

import api from '../services/api'; 
// 👇 1. IMPORT DU CONTEXTE DE THÈME
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileScreen({ onLogout }) {
  const navigation = useNavigation(); 
  
  // 👇 2. RÉCUPÉRATION DES COULEURS
  const { colors, isDark } = useTheme();

  // --- ÉTATS ---
  const [user, setUser] = useState({
    fullName: '',
    email: '',
    phone: '',
    avatar: null,
    rating: 5.0,
    totalRides: 0,
    vehicleModel: 'Mercedes Classe V',
    licensePlate: 'AA-123-BB',
  });

  const [isOnline, setIsOnline] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [loadingSave, setLoadingSave] = useState(false);

  // --- 1. CHARGEMENT ---
  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/user/profile');
      setUser(prev => ({ ...prev, ...response.data }));
    } catch (err) {
      console.error("Erreur profil:", err);
    } finally {
      setLoadingInitial(false);
    }
  };

  // --- 2. GESTION PHOTO ---
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission requise", "Accès aux photos nécessaire.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      const newImageUri = result.assets[0].uri;
      const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setUser({ ...user, avatar: newImageUri });
      try {
        await api.put('/user/profile', { avatar: base64Data });
      } catch (e) {
        Alert.alert("Erreur", "Échec upload photo.");
      }
    }
  };

  // --- 3. SAUVEGARDE ---
  const handleSaveProfile = async () => {
    setLoadingSave(true);
    try {
      const res = await api.put('/user/profile', {
        fullName: editedData.fullName,
        phone: editedData.phone,
        email: editedData.email,
      });
      setUser(prev => ({ ...prev, ...editedData, ...res.data }));
      setEditModalVisible(false);
      Alert.alert("Succès", "Profil mis à jour !");
    } catch (err) {
      Alert.alert("Erreur", "Mise à jour impossible.");
    } finally {
      setLoadingSave(false);
    }
  };

  // --- 4. DÉCONNEXION ---
  const handleLogout = async () => {
    Alert.alert(
      "Déconnexion",
      "Voulez-vous vraiment vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Me déconnecter", 
          style: "destructive",
          onPress: async () => {
            await SecureStore.deleteItemAsync('token');
            if (onLogout) onLogout(); 
            else navigation.replace('SignIn');
          }
        }
      ]
    );
  };

  // --- COMPOSANTS UI ADAPTÉS AU THÈME ---
  const StatItem = ({ label, value, icon, color }) => (
    <View style={[styles.statItem, { backgroundColor: colors.card }]}>
      <View style={[styles.statIconBox, { backgroundColor: isDark ? color + '40' : color + '20' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );

  const MenuOption = ({ icon, title, subtitle, onPress, isDestructive = false }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconBox, { backgroundColor: isDestructive ? (isDark ? '#3E1F1F' : '#FFEBEE') : colors.iconBg }]}>
        <Ionicons name={icon} size={22} color={isDestructive ? colors.danger : colors.textSecondary} />
      </View>
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={[styles.menuTitle, { color: isDestructive ? colors.danger : colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  if (loadingInitial) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        
        {/* --- HEADER PROFILE --- */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.headerTopRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Mon Profil</Text>
            
            <View style={[styles.statusContainer, { backgroundColor: colors.iconBg }]}>
              <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.textSecondary }]}>
                {isOnline ? 'En service' : 'Hors ligne'}
              </Text>
              <Switch
                trackColor={{ false: colors.border, true: colors.success + '80' }}
                thumbColor={isOnline ? colors.success : "#f4f3f4"}
                onValueChange={() => setIsOnline(!isOnline)}
                value={isOnline}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          </View>

          <View style={styles.profileRow}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.placeholderAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}</Text>
                </View>
              )}
              <View style={[styles.editIconBadge, { borderColor: colors.card }]}>
                <Ionicons name="pencil" size={12} color="#FFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={[styles.name, { color: colors.text }]}>{user.fullName || "Utilisateur"}</Text>
              <View style={[styles.ratingBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="star" size={14} color="#FFF" />
                <Text style={styles.ratingText}>{user.rating} Excellent</Text>
              </View>
              <Text style={[styles.vehicleText, { color: colors.textSecondary }]}>
                {user.vehicleModel} • {user.licensePlate}
              </Text>
            </View>
          </View>
        </View>

        {/* --- DASHBOARD STATS --- */}
        <View style={styles.statsContainer}>
            <StatItem label="Courses" value={user.totalRides || "124"} icon="car-side" color="#2196F3" />
            <StatItem label="Revenus" value="2.4k€" icon="finance" color={colors.success} />
            <StatItem label="Heures" value="34h" icon="clock-time-four-outline" color="#FF9800" />
        </View>

        {/* --- COORDONNÉES --- */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Mes Infos</Text>
            <TouchableOpacity onPress={() => { setEditedData(user); setEditModalVisible(true); }}>
              <Text style={[styles.linkText, { color: colors.primary }]}>Modifier</Text>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoRow}>
              <View style={[styles.miniIcon, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="mail" size={16} color={colors.textSecondary} />
              </View>
              <Text style={[styles.infoText, { color: colors.text }]}>{user.email}</Text>
            </View>
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
               <View style={[styles.miniIcon, { backgroundColor: colors.iconBg }]}>
                 <Ionicons name="call" size={16} color={colors.textSecondary} />
               </View>
              <Text style={[styles.infoText, { color: colors.text }]}>{user.phone || "Non renseigné"}</Text>
            </View>
          </View>
        </View>

        {/* --- MENU ESPACE PRO --- */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Espace Pro</Text>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <MenuOption 
              icon="document-text-outline" 
              title="Mes Documents" 
              subtitle="Permis, Assurance, K-bis, Carte Pro"
              onPress={() => navigation.navigate('Documents')}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <MenuOption 
              icon="car-sport-outline" 
              title="Véhicule" 
              subtitle="Gérer les informations du véhicule"
              onPress={() => Alert.alert("Bientôt", "Module véhicule en cours")}
            />
          </View>
        </View>

        {/* --- MENU APPLICATION --- */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Application</Text>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <MenuOption 
              icon="settings-outline" 
              title="Paramètres" 
              subtitle="Notifications, Thème, GPS"
              onPress={() => navigation.navigate('SettingsApp')} 
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <MenuOption 
              icon="help-buoy-outline" 
              title="Aide & Support" 
              subtitle="FAQ, Contacter le support"
              onPress={() => {}}
            />
             <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <MenuOption 
              icon="log-out-outline" 
              title="Se déconnecter" 
              isDestructive={true}
              onPress={handleLogout}
            />
          </View>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>Version 1.0.2 (Build 240)</Text>
        </View>

      </ScrollView>

      {/* --- MODAL EDIT --- */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Modifier mes infos</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                    <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Nom Complet</Text>
                <TextInput 
                  style={[styles.input, { 
                      backgroundColor: isDark ? '#333' : '#F9F9F9', 
                      color: colors.text,
                      borderColor: colors.border 
                  }]} 
                  placeholderTextColor={colors.textSecondary}
                  value={editedData.fullName} 
                  onChangeText={t => setEditedData({...editedData, fullName: t})} 
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Email (Non modifiable)</Text>
                <TextInput 
                  style={[styles.input, { 
                      backgroundColor: isDark ? '#222' : '#EEE', 
                      color: colors.textSecondary,
                      borderColor: colors.border
                  }]} 
                  value={editedData.email} 
                  editable={false}
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Téléphone</Text>
                <TextInput 
                  style={[styles.input, { 
                      backgroundColor: isDark ? '#333' : '#F9F9F9', 
                      color: colors.text,
                      borderColor: colors.border 
                  }]} 
                  placeholderTextColor={colors.textSecondary}
                  value={editedData.phone} 
                  keyboardType="phone-pad"
                  onChangeText={t => setEditedData({...editedData, phone: t})} 
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Modèle Véhicule</Text>
                <TextInput 
                  style={[styles.input, { 
                      backgroundColor: isDark ? '#333' : '#F9F9F9', 
                      color: colors.text,
                      borderColor: colors.border 
                  }]} 
                  placeholderTextColor={colors.textSecondary}
                  value={editedData.vehicleModel || user.vehicleModel} 
                  onChangeText={t => setEditedData({...editedData, vehicleModel: t})} 
                />
                 <Text style={[styles.label, { color: colors.textSecondary }]}>Plaque d'immatriculation</Text>
                <TextInput 
                  style={[styles.input, { 
                      backgroundColor: isDark ? '#333' : '#F9F9F9', 
                      color: colors.text,
                      borderColor: colors.border 
                  }]} 
                  placeholderTextColor={colors.textSecondary}
                  value={editedData.licensePlate || user.licensePlate} 
                  onChangeText={t => setEditedData({...editedData, licensePlate: t})} 
                />

                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveProfile} disabled={loadingSave}>
                    {loadingSave ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>}
                </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// Les styles restent "structuraux". Les couleurs sont gérées dans le render.
const styles = StyleSheet.create({
  // LAYOUT
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // HEADER
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity:0.05, shadowRadius:10, elevation: 4, borderBottomWidth: 1 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  statusContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 13, fontWeight: '600', marginRight: 8 },
  
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 25 },
  placeholderAvatar: { width: 80, height: 80, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 32, color: '#FFF', fontWeight: 'bold' },
  editIconBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#333', borderRadius: 12, padding: 6, borderWidth: 2 },
  
  profileInfo: { marginLeft: 20, flex: 1 },
  name: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 6 },
  ratingText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, marginLeft: 4 },
  vehicleText: { fontSize: 13 },

  // STATS DASHBOARD
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 20 },
  statItem: { flex: 1, marginHorizontal: 5, padding: 15, borderRadius: 16, alignItems: 'center', shadowColor: "#000", shadowOffset: {width:0, height:2}, shadowOpacity:0.03, shadowRadius:5, elevation: 2 },
  statIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 2 },

  // SECTIONS
  sectionContainer: { marginTop: 25, paddingHorizontal: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  linkText: { fontWeight: '600', fontSize: 14 },
  
  infoCard: { borderRadius: 16, padding: 5, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  miniIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  infoText: { marginLeft: 15, fontSize: 15, fontWeight: '500' },
  
  menuCard: { borderRadius: 16, paddingHorizontal: 5, elevation: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuTitle: { fontSize: 15, fontWeight: '600' },
  menuSubtitle: { fontSize: 12, marginTop: 1 },
  separator: { height: 1, marginLeft: 66 },
  
  versionText: { textAlign: 'center', fontSize: 12, marginTop: 20, marginBottom: 10 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 15 },
  input: { borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1 },
  saveBtn: { borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 30, marginBottom: 40, shadowColor: "#FF6B00", shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:5 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});