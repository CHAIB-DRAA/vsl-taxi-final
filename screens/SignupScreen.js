import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://vsl-taxi.onrender.com/api/user';

export default function SignUpScreen({ navigation, onSignUp }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !fullName) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/signup`, { email, fullName, password });

      await AsyncStorage.setItem('token', res.data.token);

      Alert.alert('Succès', 'Compte créé avec succès');
      onSignUp(res.data.user);
    } catch (err) {
      console.error('Signup error:', err.response?.data || err.message);
      Alert.alert('Erreur', err.response?.data?.error || 'Impossible de créer le compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Nom complet"
        placeholderTextColor="#000"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#000"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#000"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#FF6B00" style={{ marginVertical: 10 }} />
      ) : (
        <>
          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
            <Text style={styles.buttonText}>S'inscrire</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.signInButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Déjà un compte ? Se connecter</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20, 
    backgroundColor: '#F8F8F8'
  },
  input: { 
    height: 55, 
    borderColor: '#FF6B00', 
    borderWidth: 1.5, 
    borderRadius: 12, 
    marginBottom: 15, 
    paddingHorizontal: 15, 
    fontSize: 16, 
    color: "#000",
    backgroundColor: '#FFF',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  button: { 
    backgroundColor: '#FF6B00', 
    paddingVertical: 15, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  signInButton: { backgroundColor: '#4CAF50' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});
