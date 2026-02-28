import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../contexts/DataContext';

import HomeScreen from './HomeTabs';
import AgendaScreen from './AgendaScreen';
import CreateRideScreen from './CreateRideScreen';
import HistoryScreen from './HistoryScreen';

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
      borderColor: '#F8F9FA', // ⚠️ DOIT MATCH L'ARRIÈRE PLAN DE TES ÉCRANS (Gris clair)
    }}>
      {children}
    </View>
  </TouchableOpacity>
);

export default function MainTabs() {
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
          bottom: 20, // Décollé du bas
          left: 20,   // Marge gauche
          right: 20,  // Marge droite
          
          backgroundColor: '#FFFFFF',
          borderRadius: 25, // Coins très arrondis (Style iOS/Samsung OneUI)
          height: 70,       // Hauteur confortable
          borderTopWidth: 0, // Pas de bordure moche
          
          // Ombres Premium (Android + iOS)
          elevation: 10, 
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          
          zIndex: 999, // Reste au-dessus de tout
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

      {/* 3. BOUTON CENTRAL (CRÉER) */}
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
  }
});