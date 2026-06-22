import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../contexts/DataContext';

import HomeScreen from './HomeTabs';
import AgendaScreen from './AgendaScreen';
import CreateRideScreen from './CreateRideScreen';
import HistoryScreen from './HistoryScreen';
import TodayRidesScreen from './TodayRidesScreen';

const Tab = createBottomTabNavigator();

// Bouton central flottant avec gradient brand
const CustomPostButton = ({ children, onPress }) => (
  <TouchableOpacity
    style={styles.centralBtnWrapper}
    onPress={onPress}
    activeOpacity={0.88}
  >
    <LinearGradient
      colors={['#FF6B00', '#FF8C00']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.centralBtnGradient}
    >
      {children}
    </LinearGradient>
  </TouchableOpacity>
);

export default function MainTabs({ webPendingCount = 0 }) {
  const { pendingInvitation } = useData();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: 18,
          left: 16,
          right: 16,
          backgroundColor: '#FFFFFF',
          borderRadius: 28,
          height: 70,
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#FF6B00',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          zIndex: 999,
          borderWidth: 1,
          borderColor: '#F0F3FA',
        },
      }}
    >
      {/* 1. ACCUEIL */}
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={24}
                color={focused ? '#FF6B00' : '#94A3B8'}
              />
              {focused && <Text style={styles.activeLabel}>Accueil</Text>}
              {!focused && <View style={styles.inactiveDot} />}
            </View>
          ),
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
                <Ionicons
                  name={focused ? 'calendar' : 'calendar-outline'}
                  size={24}
                  color={focused ? '#FF6B00' : '#94A3B8'}
                />
                {pendingInvitation && <View style={styles.badge} />}
              </View>
              {focused && <Text style={styles.activeLabel}>Agenda</Text>}
              {!focused && <View style={styles.inactiveDot} />}
            </View>
          ),
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
                <Ionicons
                  name={focused ? 'notifications' : 'notifications-outline'}
                  size={24}
                  color={focused ? '#FF6B00' : '#94A3B8'}
                />
                {webPendingCount > 0 && (
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeText}>
                      {webPendingCount > 9 ? '9+' : webPendingCount}
                    </Text>
                  </View>
                )}
              </View>
              {focused && <Text style={styles.activeLabel}>Courses</Text>}
              {!focused && <View style={styles.inactiveDot} />}
            </View>
          ),
        }}
      />

      {/* 4. BOUTON CENTRAL (CRÉER) */}
      <Tab.Screen
        name="Créer"
        component={CreateRideScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name="add" size={36} color="#FFF" />
          ),
          tabBarButton: (props) => <CustomPostButton {...props} />,
        }}
      />

      {/* 5. HISTORIQUE / COMPTA */}
      <Tab.Screen
        name="Historique"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons
                name={focused ? 'pie-chart' : 'pie-chart-outline'}
                size={24}
                color={focused ? '#FF6B00' : '#94A3B8'}
              />
              {focused && <Text style={styles.activeLabel}>Stats</Text>}
              {!focused && <View style={styles.inactiveDot} />}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // BOUTON CENTRAL
  centralBtnWrapper: {
    top: -28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 14,
  },
  centralBtnGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },

  // ICÔNES TABS
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  activeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF6B00',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  inactiveDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 4,
  },

  // BADGES
  badge: {
    position: 'absolute',
    right: -2,
    top: -2,
    backgroundColor: '#EF4444',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeCount: {
    position: 'absolute',
    right: -7,
    top: -4,
    backgroundColor: '#EF4444',
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
  },
});
