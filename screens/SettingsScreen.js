import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Modal,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import C from '../styles/tokens';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ContactsScreen from './ContactScreen';
import PatientsScreen from './PatientsScreen';

export default function SettingsScreen({ navigation, onLogout }) {
  const insets = useSafeAreaInsets();

  const [showContacts, setShowContacts] = useState(false);
  const [showPatients, setShowPatients] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleTestProximity = async () => {
    setTesting(true);
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: s } = await Notifications.requestPermissionsAsync();
        if (s !== 'granted') {
          Alert.alert('Permission refusée', 'Active les notifications dans les paramètres Android.');
          return;
        }
      }

      await Notifications.scheduleNotificationAsync({
        identifier: 'vsl-test-depart',
        content: {
          title: '🚗 Départ dans 15 min — 09:00',
          body: 'Patient Test · 12 Rue de la Paix\nAppuyez pour ouvrir Waze',
          data: {
            type: 'departure_alert',
            rideId: 'test',
            startLocation: '12 Rue de la Paix, Paris',
            patientName: 'Patient Test',
          },
          sound: 'default',
          android: {
            channelId: 'vsl_proximity',
            priority: 'max',
            vibrate: [0, 500, 200, 500, 200, 500],
          },
        },
        trigger: { seconds: 5 },
      });

      Alert.alert(
        'Test programmé',
        'Une notification apparaîtra dans 5 secondes.\n\nAppuyez dessus → Waze s\'ouvre directement sur l\'adresse.',
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion', 'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion', style: 'destructive', onPress: async () => {
            setLoggingOut(true);
            try {
              await SecureStore.deleteItemAsync('user_session');
              if (onLogout) onLogout();
            } catch (err) {
              console.error("Erreur", err);
            } finally {
              setLoggingOut(false);
            }
          }
        }
      ]
    );
  };

  const menuSections = [
    {
      title: 'Compte',
      items: [
        {
          id: '1',
          label: 'Mon compte',
          subtitle: 'Profil et informations',
          icon: 'person',
          iconBg: C.blue,
          onPress: () => setShowProfile(true),
        },
        {
          id: '2',
          label: 'Mes contacts',
          subtitle: 'Gérer vos contacts',
          icon: 'people',
          iconBg: C.amber,
          onPress: () => setShowContacts(true),
        },
        {
          id: '5',
          label: 'Mes patients',
          subtitle: 'Liste des patients',
          icon: 'medkit',
          iconBg: C.green,
          onPress: () => setShowPatients(true),
        },
      ],
    },
    {
      title: 'Préférences',
      items: [
        {
          id: '3',
          label: "Paramètres app",
          subtitle: 'Notifications, langue…',
          icon: 'settings',
          iconBg: C.purple,
          onPress: () => navigation.navigate('SettingApp'),
        },
        {
          id: '6',
          label: 'Tester alerte approche',
          subtitle: 'Simule une alerte départ',
          icon: 'navigate',
          iconBg: C.brand,
          onPress: handleTestProximity,
          isTest: true,
        },
      ],
    },
  ];

  const renderMenuItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={item.onPress}
      activeOpacity={0.7}
      disabled={item.isTest && testing}
    >
      <View style={[styles.menuIconBox, { backgroundColor: item.iconBg }]}>
        {item.isTest && testing
          ? <ActivityIndicator size="small" color="#FFF" />
          : <Ionicons name={item.icon} size={20} color="#FFF" />
        }
      </View>

      <View style={styles.menuTextBox}>
        <Text style={styles.menuLabel}>
          {item.isTest && testing ? 'Test en cours...' : item.label}
        </Text>
        {item.subtitle ? (
          <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
        ) : null}
      </View>

      <View style={styles.chevronBox}>
        <Ionicons name="chevron-forward" size={16} color={C.text3} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* HEADER SOMBRE GRADIENT */}
      <LinearGradient
        colors={[C.hBg1, C.hBg2]}
        style={styles.header}
      >
        {/* AVATAR INITIALES */}
        <LinearGradient
          colors={[C.brand, C.brandGrad]}
          style={styles.avatarCircle}
        >
          <Ionicons name="person" size={32} color="#FFF" />
        </LinearGradient>
        <Text style={styles.headerTitle}>Mon Profil</Text>
        <Text style={styles.headerSubtitle}>Gérez vos préférences</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTIONS MENU */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, index) => (
                <View key={item.id}>
                  {renderMenuItem(item)}
                  {index < section.items.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* BOUTON DÉCONNEXION */}
        <TouchableOpacity
          style={[styles.logoutWrapper, loggingOut && { opacity: 0.5 }]}
          onPress={handleLogout}
          activeOpacity={0.85}
          disabled={loggingOut}
        >
          <LinearGradient
            colors={[C.red, '#DC2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoutBtn}
          >
            {loggingOut
              ? <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 10 }} />
              : <Ionicons name="log-out-outline" size={22} color="#FFF" style={{ marginRight: 10 }} />
            }
            <Text style={styles.logoutText}>{loggingOut ? 'Déconnexion…' : 'Déconnexion'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* --- MODALS --- */}

      {/* Modal Contacts */}
      <Modal visible={showContacts} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Mes Contacts</Text>
          <TouchableOpacity onPress={() => setShowContacts(false)} style={styles.closeButton}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
        </View>
        <ContactsScreen />
      </Modal>

      {/* Modal Patients */}
      <Modal visible={showPatients} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Mes Patients</Text>
          <TouchableOpacity onPress={() => setShowPatients(false)} style={styles.closeButton}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
        </View>
        <PatientsScreen />
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // HEADER
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: C.hText,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: C.hText2,
    marginTop: 4,
    fontWeight: '500',
  },

  // SCROLL
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },

  // SECTIONS
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text3,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.border,
  },

  // MENU ITEMS
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuTextBox: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: C.text3,
    marginTop: 2,
    fontWeight: '400',
  },
  chevronBox: {
    backgroundColor: C.card2,
    borderRadius: 20,
    padding: 6,
  },
  separator: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 72,
  },

  // BOUTON DÉCONNEXION
  logoutWrapper: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutBtn: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // MODALS
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
  },
  closeButton: {
    padding: 8,
    backgroundColor: C.bg,
    borderRadius: 20,
  },
});
