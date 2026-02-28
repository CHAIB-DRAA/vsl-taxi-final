import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, 
  SafeAreaView, Modal, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// 👇 IMPORT DU HOOK
import { useTheme } from '../contexts/ThemeContext';

export default function SettingAppScreen() {
  const navigation = useNavigation();
  
  // 👇 RÉCUPÉRATION DU THÈME GLOBAL
  const { colors, isDark, themeMode, changeTheme } = useTheme();

  // États locaux
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [navApp, setNavApp] = useState('Waze'); 
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  // Label pour l'affichage
  const getThemeLabel = () => {
    switch(themeMode) {
      case 'dark': return 'Sombre';
      case 'light': return 'Clair';
      default: return 'Système';
    }
  };

  // --- COMPOSANT LIGNE (Adapté avec couleurs dynamiques) ---
  const SettingItem = ({ icon, iconColor, title, subtitle, type, value, onToggle, onPress, rightText }) => (
    <TouchableOpacity 
      style={[styles.itemContainer, { borderBottomColor: colors.border }]} 
      onPress={type === 'switch' ? () => onToggle(!value) : onPress}
      activeOpacity={type === 'switch' ? 1 : 0.7}
    >
      {/* Icône */}
      <View style={[styles.iconBox, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      
      {/* Textes */}
      <View style={styles.textContainer}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>

      {/* Actions */}
      {type === 'switch' && (
        <Switch
          trackColor={{ false: "#E0E0E0", true: iconColor + '80' }}
          thumbColor={value ? iconColor : "#f4f3f4"}
          onValueChange={onToggle}
          value={value}
        />
      )}

      {type === 'select' && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.valueText, { color: colors.textSecondary }]}>{rightText}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={{marginLeft: 5}} />
        </View>
      )}
    </TouchableOpacity>
  );

  // --- RENDU AVEC COULEURS DYNAMIQUES ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Paramètres</Text>
        <View style={{width: 24}} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* --- SECTION 1 --- */}
        <Text style={styles.sectionHeader}>APPARENCE</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, shadowColor: isDark ? "#000" : "#000" }]}>
          <SettingItem 
            icon="color-palette" 
            iconColor="#9C27B0" 
            title="Thème de l'application" 
            type="select" 
            rightText={getThemeLabel()} 
            onPress={() => setThemeModalVisible(true)}
          />
        </View>

        {/* --- SECTION 2 --- */}
        <Text style={styles.sectionHeader}>SONS & NOTIFICATIONS</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <SettingItem 
            icon="notifications" 
            iconColor="#FF6B00" 
            title="Notifications Push" 
            type="switch" 
            value={pushEnabled} 
            onToggle={setPushEnabled}
          />
          
          <SettingItem 
            icon="volume-mute" 
            iconColor="#F44336" 
            title="Mode Sourdine" 
            subtitle="Désactive les sons d'alerte"
            type="switch" 
            value={isMuted} 
            onToggle={setIsMuted}
          />
        </View>

        {/* --- SECTION 3 --- */}
        <Text style={styles.sectionHeader}>NAVIGATION</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <SettingItem 
            icon="navigate" 
            iconColor="#2196F3" 
            title="Application GPS par défaut" 
            type="select" 
            rightText={navApp} 
            onPress={() => setNavApp(prev => prev === 'Waze' ? 'Google Maps' : 'Waze')}
          />
        </View>

        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Taxi App v1.0.2 • Build 240</Text>

      </ScrollView>

      {/* --- MODAL CHOIX DU THÈME --- */}
      <Modal visible={themeModalVisible} transparent animationType="fade">
        <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setThemeModalVisible(false)}
        >
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Choisir le thème</Text>
                
                {['light', 'dark', 'system'].map((t) => (
                    <TouchableOpacity 
                        key={t} 
                        style={[styles.themeOption, { borderBottomColor: colors.border }]}
                        onPress={() => { changeTheme(t); setThemeModalVisible(false); }}
                    >
                        <Text style={[
                            styles.themeText, 
                            { color: colors.text },
                            themeMode === t && { color: colors.primary, fontWeight: 'bold' }
                        ]}>
                            {t === 'light' ? 'Clair ☀️' : t === 'dark' ? 'Sombre 🌙' : 'Système 📱'}
                        </Text>
                        {themeMode === t && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                    </TouchableOpacity>
                ))}
            </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 5 },

  // Sections
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#999', marginTop: 25, marginBottom: 10, marginLeft: 25, letterSpacing: 0.5 },
  sectionCard: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', shadowOffset: {width:0, height:2}, shadowOpacity:0.03, shadowRadius:4, elevation: 1 },
  
  // Items
  itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: 'transparent' }, // border handled inline
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  textContainer: { flex: 1, marginRight: 10 },
  itemTitle: { fontSize: 16, fontWeight: '500' },
  itemSubtitle: { fontSize: 12, marginTop: 2 },
  valueText: { fontSize: 14, marginRight: 5 },
  
  footerText: { textAlign: 'center', fontSize: 12, marginTop: 30 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', borderRadius: 20, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  themeOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  themeText: { fontSize: 16 },
});