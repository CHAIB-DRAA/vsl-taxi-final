// screens/RegisterScreen.js
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { registerUser } from '../services/api';
import * as SecureStore from 'expo-secure-store';

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    try {
      const data = await registerUser({ name, email, password });
      await SecureStore.setItemAsync('token', data.token);
      navigation.replace('Home');
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de créer le compte');
    }
  };

  return (
    <View style={{ flex:1, justifyContent:'center', padding:20 }}>
      <TextInput placeholder="Nom" value={name} onChangeText={setName} style={{ borderWidth:1, marginBottom:10, padding:10 }} />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={{ borderWidth:1, marginBottom:10, padding:10 }} />
      <TextInput placeholder="Mot de passe" value={password} secureTextEntry onChangeText={setPassword} style={{ borderWidth:1, marginBottom:10, padding:10 }} />
      <Button title="S'inscrire" onPress={handleRegister} />
    </View>
  );
};

export default RegisterScreen;
