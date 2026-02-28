import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import axios from 'axios';

const API_URL = 'https://vsl-taxi.onrender.com/api/users';

export default function AuthScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password) return Alert.alert('Erreur', 'Email et mot de passe requis');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/signup`, { email, password, fullName });
      Alert.alert('Succès', 'Inscription terminée, connectez-vous');
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Inscription échouée');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Erreur', 'Email et mot de passe requis');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/login`, { email, password });
      console.log('JWT token:', data.token);
      navigation.navigate('Contacts', { userId: data.userId, token: data.token });
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Connexion échouée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Nom complet" value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      {loading ? <ActivityIndicator size="large" color="#2196F3" /> : (
        <>
          <TouchableOpacity style={styles.button} onPress={handleSignup}><Text style={styles.buttonText}>S'inscrire</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.loginButton]} onPress={handleLogin}><Text style={styles.buttonText}>Se connecter</Text></TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 60, padding: 20 },
  input: { height: 50, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, marginBottom: 12, paddingHorizontal: 12 },
  button: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  loginButton: { backgroundColor: '#2196F3' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
