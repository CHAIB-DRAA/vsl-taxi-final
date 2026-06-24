import React, { useState } from 'react';
import {
  View, Text, TextInput, Alert, Platform,
  StyleSheet, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import api, { loginUser } from '../services/api';

// ============================================================
// FONCTION DE GÉNÉRATION DU PUSH TOKEN
// ============================================================
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission refusée pour les notifications push !');
      return null;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({})).data;
    } catch (e) {
      console.error("Erreur lors de la génération du token Expo :", e);
    }
  } else {
    console.log('Les notifications Push nécessitent un appareil physique.');
  }

  return token;
}

// ============================================================
// ÉCRAN DE CONNEXION
// ============================================================
export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Erreur', 'Veuillez remplir tous les champs');

    setLoading(true);
    try {
      await loginUser({ email, password });

      const pushToken = await registerForPushNotificationsAsync();

      if (pushToken) {
        try {
          await api.put('/auth/push-token', { pushToken });
          console.log("Token Push enregistré sur le serveur :", pushToken);
        } catch (tokenErr) {
          console.error("Impossible d'envoyer le Push Token au serveur :", tokenErr);
        }
      }

      navigation.replace('Agenda');
    } catch (err) {
      Alert.alert('Erreur', 'Email ou mot de passe invalide');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0A0F1E', '#111827']}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* LOGO */}
          <View style={styles.logoSection}>
            <LinearGradient
              colors={['#FF6B00', '#FF8C00']}
              style={styles.logoCircle}
            >
              <Ionicons name="car" size={44} color="#FFF" />
            </LinearGradient>
            <Text style={styles.appName}>TaxiApp</Text>
            <Text style={styles.appTagline}>Votre assistant de transport</Text>
          </View>

          {/* CARD FORMULAIRE */}
          <View style={styles.formCard}>
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.subtitle}>Bon retour parmi nous</Text>

            {/* CHAMP EMAIL */}
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Adresse email"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
            </View>

            {/* CHAMP MOT DE PASSE */}
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Mot de passe"
                placeholderTextColor="#94A3B8"
                style={[styles.input, { flex: 1 }]}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>

            {/* BOUTON CONNEXION */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              style={styles.submitWrapper}
            >
              <LinearGradient
                colors={['#FF6B00', '#FF8C00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitText}>Se connecter</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* LIEN INSCRIPTION */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.registerLink}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>
                Pas encore de compte ?{' '}
                <Text style={styles.registerTextBold}>S'inscrire</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  // LOGO
  logoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F1F5F9',
    marginTop: 14,
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },

  // FORMULAIRE
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 28,
    fontWeight: '500',
  },

  // INPUTS
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#F1F5F9',
  },
  eyeBtn: {
    padding: 4,
  },

  // BOUTON SUBMIT
  submitWrapper: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  submitBtn: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  submitText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // LIEN S'INSCRIRE
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    color: '#94A3B8',
    fontSize: 15,
  },
  registerTextBold: {
    color: '#FF6B00',
    fontWeight: '700',
  },
});
