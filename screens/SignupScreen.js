import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import * as SecureStore from 'expo-secure-store';
import C from '../styles/tokens';

export default function SignUpScreen({ navigation, onSignUp }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusName, setFocusName] = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPwd, setFocusPwd] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !fullName) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/user/signup', { email, fullName, password });
      const { token, user } = res.data;

      // Sauvegarder le token pour l'intercepteur API
      await SecureStore.setItemAsync('token', token);

      // Remonter la session complète { token, user } à App.js
      onSignUp({ token, user });
    } catch (err) {
      console.error('Signup error:', err.response?.data || err.message);
      Alert.alert('Erreur', err.response?.data?.error || 'Impossible de créer le compte');
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
              colors={['#FF5500', C.brandGrad]}
              style={styles.logoCircle}
            >
              <Ionicons name="person-add" size={40} color="#FFF" />
            </LinearGradient>
            <Text style={styles.appName}>TaxiApp</Text>
            <Text style={styles.appTagline}>Créez votre compte</Text>
          </View>

          {/* CARD FORMULAIRE */}
          <View style={styles.formCard}>
            <Text style={styles.title}>Inscription</Text>
            <Text style={styles.subtitle}>Rejoignez-nous dès maintenant</Text>

            {/* CHAMP NOM COMPLET */}
            <View style={[styles.inputWrapper, focusName && { borderColor: C.brand }]}>
              <Ionicons name="person-outline" size={20} color={C.hText2} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nom complet"
                placeholderTextColor={C.hText2}
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setFocusName(true)}
                onBlur={() => setFocusName(false)}
              />
            </View>

            {/* CHAMP EMAIL */}
            <View style={[styles.inputWrapper, focusEmail && { borderColor: C.brand }]}>
              <Ionicons name="mail-outline" size={20} color={C.hText2} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Adresse email"
                placeholderTextColor={C.hText2}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusEmail(true)}
                onBlur={() => setFocusEmail(false)}
              />
            </View>

            {/* CHAMP MOT DE PASSE */}
            <View style={[styles.inputWrapper, focusPwd && { borderColor: C.brand }]}>
              <Ionicons name="lock-closed-outline" size={20} color={C.hText2} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Mot de passe"
                placeholderTextColor={C.hText2}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
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

            {loading ? (
              <ActivityIndicator size="large" color="#FF5500" style={{ marginVertical: 16 }} />
            ) : (
              <>
                {/* BOUTON S'INSCRIRE */}
                <TouchableOpacity
                  onPress={handleSignUp}
                  activeOpacity={0.85}
                  style={[styles.submitWrapper, loading && { opacity: 0.6 }]}
                >
                  <LinearGradient
                    colors={['#FF5500', C.brandGrad]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitBtn}
                  >
                    <Text style={styles.submitText}>Créer mon compte</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                  </LinearGradient>
                </TouchableOpacity>

                {/* LIEN CONNEXION */}
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.loginLink}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loginText}>
                    Déjà un compte ?{' '}
                    <Text style={styles.loginTextBold}>Se connecter</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
    color: '#A8A29E',
    marginTop: 4,
    fontWeight: '500',
  },

  // FORMULAIRE
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
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

  // LIEN CONNEXION
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    color: '#A8A29E',
    fontSize: 15,
  },
  loginTextBold: {
    color: '#FF5500',
    fontWeight: '700',
  },
});
