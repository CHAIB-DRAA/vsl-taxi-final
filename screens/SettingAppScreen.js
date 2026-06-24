import React, { useState } from 'react';
import C from '../styles/tokens';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView, Modal, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../contexts/ThemeContext';

export default function SettingAppScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const { colors, isDark, themeMode, changeTheme } = useTheme();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [navApp, setNavApp] = useState('Waze');
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const getThemeLabel = () => {
    switch (themeMode) {
      case 'dark': return 'Sombre';
      case 'light': return 'Clair';
      default: return 'Système';
    }
  };

  // --- COMPOSANT LIGNE ---
  const SettingItem = ({ icon, gradientColors, title, subtitle, type, value, onToggle, onPress, rightText, isLast }) => (
    <TouchableOpacity
      style={[styles.itemRow, !isLast && styles.itemBorder]}
      onPress={type === 'switch' ? () => onToggle(!value) : onPress}
      activeOpacity={type === 'switch' ? 1 : 0.7}
    >
      <LinearGradient colors={gradientColors} style={styles.itemIconBox}>
        <Ionicons name={icon} size={20} color="#FFF" />
      </LinearGradient>

      <View style={styles.itemTextBox}>
        <Text style={styles.itemTitle}>{title}</Text>
        {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
      </View>

      {type === 'switch' && (
        <Switch
          trackColor={{ false: '#E4E8F0', true: gradientColors[0] + '80' }}
          thumbColor={value ? gradientColors[0] : '#F5F7FF'}
          onValueChange={onToggle}
          value={value}
        />
      )}

      {type === 'select' && (
        <View style={styles.selectRight}>
          <Text style={styles.selectValue}>{rightText}</Text>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" style={{ marginLeft: 4 }} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* HEADER DARK GRADIENT */}
      <LinearGradient
        colors={['#0A0F1E', '#111827']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <View style={styles.backBtnInner}>
            <Ionicons name="arrow-back" size={20} color="#F1F5F9" />
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.headerIcon}
          >
            <Ionicons name="settings" size={22} color="#FFF" />
          </LinearGradient>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <Text style={styles.headerSubtitle}>Personnalisez votre expérience</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* SECTION APPARENCE */}
        <Text style={styles.sectionLabel}>APPARENCE</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="color-palette"
            gradientColors={['#8B5CF6', '#7C3AED']}
            title="Thème de l'application"
            subtitle="Clair, sombre ou système"
            type="select"
            rightText={getThemeLabel()}
            onPress={() => setThemeModalVisible(true)}
            isLast
          />
        </View>

        {/* SECTION SONS & NOTIFICATIONS */}
        <Text style={styles.sectionLabel}>SONS & NOTIFICATIONS</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="notifications"
            gradientColors={['#FF6B00', '#FF8C00']}
            title="Notifications Push"
            subtitle="Alertes courses et départs"
            type="switch"
            value={pushEnabled}
            onToggle={setPushEnabled}
          />
          <SettingItem
            icon="volume-mute"
            gradientColors={['#EF4444', '#DC2626']}
            title="Mode Sourdine"
            subtitle="Désactive les sons d'alerte"
            type="switch"
            value={isMuted}
            onToggle={setIsMuted}
            isLast
          />
        </View>

        {/* SECTION NAVIGATION */}
        <Text style={styles.sectionLabel}>NAVIGATION</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="navigate"
            gradientColors={['#3B82F6', '#2563EB']}
            title="Application GPS par défaut"
            subtitle="Waze ou Google Maps"
            type="select"
            rightText={navApp}
            onPress={() => setNavApp(prev => prev === 'Waze' ? 'Google Maps' : 'Waze')}
            isLast
          />
        </View>

        <Text style={styles.footerText}>TaxiApp v1.0.2 · Build 240</Text>
      </ScrollView>

      {/* MODAL CHOIX DU THÈME */}
      <Modal visible={themeModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setThemeModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choisir le thème</Text>

            {['light', 'dark', 'system'].map((t, index, arr) => (
              <TouchableOpacity
                key={t}
                style={[styles.themeOption, index < arr.length - 1 && styles.themeOptionBorder]}
                onPress={() => { changeTheme(t); setThemeModalVisible(false); }}
              >
                <View style={styles.themeOptionLeft}>
                  <LinearGradient
                    colors={
                      t === 'light' ? ['#F59E0B', '#D97706'] :
                      t === 'dark' ? ['#1E293B', '#0F172A'] :
                      ['#3B82F6', '#2563EB']
                    }
                    style={styles.themeOptionIcon}
                  >
                    <Ionicons
                      name={t === 'light' ? 'sunny' : t === 'dark' ? 'moon' : 'phone-portrait'}
                      size={16}
                      color="#FFF"
                    />
                  </LinearGradient>
                  <Text style={[
                    styles.themeText,
                    themeMode === t && { color: '#FF6B00', fontWeight: '700' }
                  ]}>
                    {t === 'light' ? 'Clair' : t === 'dark' ? 'Sombre' : 'Système'}
                  </Text>
                </View>
                {themeMode === t && (
                  <Ionicons name="checkmark-circle" size={22} color="#FF6B00" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F3FA',
  },

  // HEADER
  header: {
    paddingBottom: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backBtnInner: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },

  // SCROLL
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 50,
  },

  // SECTION
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 10,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E4E8F0',
  },

  // ITEMS
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E4E8F0',
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemTextBox: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0D1117',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  selectRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectValue: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 28,
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,15,30,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '82%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D1117',
    marginBottom: 18,
    textAlign: 'center',
  },
  themeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  themeOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E4E8F0',
  },
  themeOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  themeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0D1117',
  },
});
