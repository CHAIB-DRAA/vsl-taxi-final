import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../contexts/DataContext';

import HomeScreen from './HomeTabs';
import AgendaScreen from './AgendaScreen';
import CreateRideScreen from './CreateRideScreen';
import HistoryScreen from './HistoryScreen';
import TodayRidesScreen from './TodayRidesScreen';

const Tab = createBottomTabNavigator();

// ✨ COMPOSANT SPÉCIAL : Le bouton central "Créer" flottant
const CustomPostButton = ({ children, onPress }) => (
  <TouchableOpacity
    style={{
      top: -30, // Fait sortir le bouton de la barre
      justifyContent: 'center',
      alignItems: 'center',
      ...styles.shadow // Ombre portée du bouton
    }}
    onPress={onPress}
    activeOpacity={0.9} // Effet de clic solide
  >
    <View style={{
      width: 65,
      height: 65,
      borderRadius: 35, // Parfaitement rond
      backgroundColor: '#FF6B00', // Orange vibrant
      borderWidth: 4,
      borderColor: '#F1F5F9',
    }}>
      {children}
    </View>
  </TouchableOpacity>
);

export default function MainTabs({ webPendingCount = 0 }) {
  const { pendingInvitation } = useData();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // Minimalisme : Pas de texte
        tabBarHideOnKeyboard: true, // INDISPENSABLE sur Z-Flip (cache la barre quand clavier actif)
        
        // 💎 LE STYLE "FLOTTANT" PROFESSIONNEL
        tabBarStyle: {
          position: 'absolute',
          bottom: 18,
          left: 16,
          right: 16,
          backgroundColor: '#FFFFFF',
          borderRadius: 26,
          height: 68,
          borderTopWidth: 0,
          elevation: 14,
          shadowColor: '#1E293B',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          zIndex: 999,
        }
      }}
    >
      {/* 1. ACCUEIL */}
      <Tab.Screen 
        name="Accueil" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={focused ? "#FF6B00" : "#9E9E9E"} />
              {focused && <View style={styles.activeDot} />}
            </View>
          )
        }}
      />

      {/* 2. AGENDA */}
      <Tab.Screen 
        name="Agenda" 
        component={AgendaScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <View>
                <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={focused ? "#FF6B00" : "#9E9E9E"} />
                {/* Badge Notification Rouge */}
                {pendingInvitation && <View style={styles.badge} />}
              </View>
              {focused && <View style={styles.activeDot} />}
            </View>
          )
        }}
      />

      {/* 3. DEMANDES WEB */}
      <Tab.Screen
        name="Demandes"
        component={TodayRidesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <View>
                <Ionicons name={focused ? "notifications" : "notifications-outline"} size={24} color={focused ? "#FF6B00" : "#9E9E9E"} />
                {webPendingCount > 0 && (
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeText}>{webPendingCount > 9 ? '9+' : webPendingCount}</Text>
                  </View>
                )}
              </View>
              {focused && <View style={styles.activeDot} />}
            </View>
          )
        }}
      />

      {/* 4. BOUTON CENTRAL (CRÉER) */}
      <Tab.Screen 
        name="Créer" 
        component={CreateRideScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name="add" size={36} color="#FFF" style={{marginLeft: 2}} />
          ),
          tabBarButton: (props) => (
            <CustomPostButton {...props} />
          )
        }}
      />

      {/* 4. HISTORIQUE / COMPTA */}
      <Tab.Screen 
        name="Historique" 
        component={HistoryScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "pie-chart" : "pie-chart-outline"} size={24} color={focused ? "#FF6B00" : "#9E9E9E"} />
              {focused && <View style={styles.activeDot} />}
            </View>
          )
        }}
      />

    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Ombre spécifique pour le bouton rond central
  shadow: {
    shadowColor: '#FF6B00', // Ombre orange (effet "Glow")
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8, // Android
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    top: 0, // Centrage vertical
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF6B00',
    marginTop: 4, // Petit point sous l'icône active
  },
  badge: {
    position: 'absolute',
    right: -1,
    top: -2,
    backgroundColor: '#D32F2F',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeCount: {
    position: 'absolute',
    right: -6,
    top: -4,
    backgroundColor: '#D32F2F',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  }
});