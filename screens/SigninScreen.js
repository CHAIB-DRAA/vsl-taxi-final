import React, { useState } from 'react';
import { 
  View, TextInput, TouchableOpacity, Text, StyleSheet, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Keyboard, Modal 
} from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons'; 

const API_URL = 'https://vsl-taxi.onrender.com/api/user'; 
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen({ navigation, onSignIn }) {
  // --- États Connexion ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // --- États Mot de Passe Oublié (MULTI-ÉTAPES) ---
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1 = Email, 2 = Code + MDP
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Validation email
  const isValidEmail = (email) => EMAIL_REGEX.test(email);

  // ==========================================
  // 1. GESTION DU LOGIN
  // ==========================================
  const handleSignIn = async () => {
    Keyboard.dismiss();
    const cleanEmail = email.trim();
    
    if (!cleanEmail || !password) {
      Alert.alert('Attention', 'Veuillez remplir tous les champs.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      Alert.alert('Format invalide', 'Veuillez entrer une adresse email valide.');
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(
        `${API_URL}/login`, 
        { email: cleanEmail, password },
        { timeout: 10000 }
      );

      if (res.data && res.data.token) {
        await SecureStore.setItemAsync('token', res.data.token);
        await SecureStore.setItemAsync('userEmail', cleanEmail);

        onSignIn({
          user: res.data.user || { email: cleanEmail }, 
          token: res.data.token
        });
      } else {
        throw new Error("Réponse serveur invalide");
      }

    } catch (err) {
      console.log('Login failed', err); 
      let userMessage = 'Une erreur est survenue.';

      if (err.response) {
        if (err.response.status === 400 || err.response.status === 401 || err.response.status === 404) {
          userMessage = 'Email ou mot de passe incorrect.';
        } else if (err.response.status >= 500) {
          userMessage = 'Erreur serveur. Réessayez plus tard.';
        }
      } else if (err.code === 'ECONNABORTED') {
        userMessage = 'Le serveur ne répond pas (Timeout).';
      }

      Alert.alert('Échec', userMessage);
      setPassword('');

    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  // ==========================================
  // 2. MOT DE PASSE OUBLIÉ - ÉTAPE 1 (Envoi Email)
  // ==========================================
  const handleResetRequest = async () => {
    const cleanResetEmail = resetEmail.trim();

    if (!isValidEmail(cleanResetEmail)) {
      Alert.alert("Erreur", "Veuillez entrer un email valide.");
      return;
    }

    setResetLoading(true);

    try {
      await axios.post(`${API_URL}/forgot-password`, { 
        email: cleanResetEmail 
      });

      // ✅ SUCCÈS : On passe à l'étape 2
      Alert.alert("Succès", "Code envoyé ! Vérifiez vos emails (et spams).");
      setResetStep(2);

    } catch (error) {
      console.log("Reset Step 1 error", error);
      if (error.response && error.response.status === 404) {
         Alert.alert("Compte introuvable", "Aucun compte associé à cet email.");
      } else {
         Alert.alert("Erreur", "Impossible d'envoyer la demande. Vérifiez votre connexion.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  // ==========================================
  // 3. MOT DE PASSE OUBLIÉ - ÉTAPE 2 (Validation Finale)
  // ==========================================
  const handleFinalReset = async () => {
    if (!resetCode || !newPassword) {
      Alert.alert("Erreur", "Le code et le nouveau mot de passe sont requis.");
      return;
    }

    setResetLoading(true);

    try {
      // Appel à la route de validation
      await axios.post(`${API_URL}/reset-password`, { 
        resetToken: resetCode.trim(), 
        newPassword: newPassword 
      });

      // ✅ SUCCÈS TOTAL
      Alert.alert("Félicitations 🎉", "Mot de passe modifié avec succès ! Connectez-vous.");
      
      // On ferme tout et on nettoie
      closeResetModal();

    } catch (error) {
      console.log("Reset Step 2 error", error);
      Alert.alert("Erreur", "Code invalide ou expiré.");
    } finally {
      setResetLoading(false);
    }
  };

  // Fonction pour fermer proprement le modal
  const closeResetModal = () => {
    setForgotModalVisible(false);
    setResetStep(1); // On remet à l'étape 1 pour la prochaine fois
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
  };

  // ==========================================
  // RENDU
  // ==========================================
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Taxi Planning</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#999"
          secureTextEntry={true}
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        {/* LIEN MOT DE PASSE OUBLIÉ */}
        <TouchableOpacity 
            style={styles.forgotContainer} 
            onPress={() => setForgotModalVisible(true)}
        >
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color="#FF6B00" style={{ marginVertical: 20 }} />
        ) : (
          <View style={{ width: '100%' }}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleSignIn}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Se connecter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.signUpButton]}
              onPress={() => navigation.navigate('SignUp')}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Pas de compte ? S'inscrire</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- MODAL DE RÉCUPÉRATION (DYNAMIQUE) --- */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={forgotModalVisible}
            onRequestClose={closeResetModal}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <TouchableOpacity 
                        style={styles.closeModalBtn} 
                        onPress={closeResetModal}
                    >
                        <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>

                    <Text style={styles.modalTitle}>
                        {resetStep === 1 ? "Réinitialisation" : "Nouveau mot de passe"}
                    </Text>
                    
                    <Text style={styles.modalDesc}>
                        {resetStep === 1 
                            ? "Entrez votre email pour recevoir un code." 
                            : "Entrez le code reçu et votre nouveau mot de passe."}
                    </Text>

                    {/* --- CONTENU ÉTAPE 1 : EMAIL --- */}
                    {resetStep === 1 ? (
                        <>
                            <TextInput
                                style={[styles.input, {width: '100%', marginTop: 15}]}
                                placeholder="Votre email"
                                placeholderTextColor="#999"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                value={resetEmail}
                                onChangeText={setResetEmail}
                            />

                            <TouchableOpacity 
                                style={[styles.button, {width: '100%', marginTop: 10}]} 
                                onPress={handleResetRequest}
                                disabled={resetLoading}
                            >
                                {resetLoading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.buttonText}>Envoyer le code</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                    /* --- CONTENU ÉTAPE 2 : CODE + PASSWORD --- */
                        <>
                            <TextInput
                                style={[styles.input, {width: '100%', marginTop: 15}]}
                                placeholder="Code reçu (ex: A1B2C)"
                                placeholderTextColor="#999"
                                autoCapitalize="characters"
                                value={resetCode}
                                onChangeText={setResetCode}
                            />
                            
                            <TextInput
                                style={[styles.input, {width: '100%'}]}
                                placeholder="Nouveau mot de passe"
                                placeholderTextColor="#999"
                                secureTextEntry
                                value={newPassword}
                                onChangeText={setNewPassword}
                            />

                            <TouchableOpacity 
                                style={[styles.button, {width: '100%', marginTop: 10}]} 
                                onPress={handleFinalReset}
                                disabled={resetLoading}
                            >
                                {resetLoading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.buttonText}>Valider le changement</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setResetStep(1)} style={{marginTop: 15}}>
                                <Text style={{color: '#FF6B00'}}>Retour à l'email</Text>
                            </TouchableOpacity>
                        </>
                    )}

                </View>
            </View>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: 20, 
    backgroundColor: '#F8F8F8'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B00',
    textAlign: 'center',
    marginBottom: 40
  },
  input: { 
    height: 55, 
    borderColor: '#E0E0E0', 
    borderWidth: 1, 
    borderRadius: 12, 
    marginBottom: 15, 
    paddingHorizontal: 15, 
    fontSize: 16, 
    color: "#333",
    backgroundColor: '#FFF',
    elevation: 2, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginBottom: 25,
    padding: 5
  },
  forgotText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14
  },
  button: { 
    backgroundColor: '#FF6B00', 
    paddingVertical: 16, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#FF6B00",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  signUpButton: { 
    backgroundColor: '#4CAF50',
    shadowColor: "#4CAF50", 
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16,
    letterSpacing: 0.5 
  },
  
  // STYLES MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 5,
    width: '100%' // Assure que le modal prend bien la largeur
  },
  closeModalBtn: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
    zIndex: 10
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  modalDesc: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 10,
    lineHeight: 20
  }
});