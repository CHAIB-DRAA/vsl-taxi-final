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

import api from '../services/api';
import * as SecureStore from 'expo-secure-store';
import C from '../styles/tokens';

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
export default function LoginScreen({ navigation, onSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPwd, setFocusPwd] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Erreur', 'Veuillez remplir tous les champs');

    setLoading(true);
    try {
      const response = await api.post('/user/login', { email, password });
      const { token, user } = response.data;

      // Sauvegarder le token pour l'intercepteur API
      await SecureStore.setItemAsync('token', token);

      // Enregistrer le push token en arrière-plan (non bloquant)
      registerForPushNotificationsAsync().then(async (pushToken) => {
        if (pushToken) {
          try { await api.put('/user/push-token', { pushToken }); } catch {}
        }
      });

      // Remonter la session à App.js qui sauvegarde dans SecureStore + met à jour l'état
      onSignIn({ token, user });
    } catch (err) {
      const msg = err.response?.data?.error || 'Email ou mot de passe invalide';
      Alert.alert('Erreur de connexion', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
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
              colors={['#FF5500', '#FF0055']}
              style={styles.logoCircle}
            >
              <Ionicons name="car" size={44} color="#FFF" />
            </LinearGradient>
            <Text style={styles.appName}>VSL Mobile</Text>
            <Text style={styles.appTagline}>Transport médical VSL</Text>
          </View>

          {/* CARD FORMULAIRE */}
          <View style={styles.formCard}>
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.subtitle}>Bon retour parmi nous</Text>

            {/* CHAMP EMAIL */}
            <View style={[styles.inputWrapper, focusEmail && { borderColor: C.brand }]}>
              <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Adresse email"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                onFocus={() => setFocusEmail(true)}
                onBlur={() => setFocusEmail(false)}
              />
            </View>

            {/* CHAMP MOT DE PASSE */}
            <View style={[styles.inputWrapper, focusPwd && { borderColor: C.brand }]}>
              <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Mot de passe"
                placeholderTextColor="#94A3B8"
                style={[styles.input, { flex: 1 }]}
                onFocus={() => setFocusPwd(true)}
                onBlur={() => setFocusPwd(false)}
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
              style={[styles.submitWrapper, loading && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={[C.brand, C.brandGrad]}
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
              onPress={() => navigation.navigate('SignUp')}
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
    shadowColor: '#FF5500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F1F5F9',
    marginTop: 14,
    letterSpacing: 1.5,
  },
  appTagline: {
    fontSize: 14,
    color: '#A8A29E',
    marginTop: 4,
    fontWeight: '500',
  },

  // FORMULAIRE
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.08)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#A8A29E',
    marginTop: 4,
    marginBottom: 28,
    fontWeight: '500',
  },

  // INPUTS
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.08)',
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
    shadowColor: '#FF5500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.60,
    shadowRadius: 20,
    elevation: 12,
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
    color: '#A8A29E',
    fontSize: 15,
  },
  registerTextBold: {
    color: C.brand,
    fontWeight: '700',
  },
});
