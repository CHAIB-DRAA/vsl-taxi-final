import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { loginUser } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await loginUser({ email, password });
      navigation.replace('Agenda'); // redirige vers l’agenda
    } catch (err) {
      Alert.alert('Erreur', 'Email ou mot de passe invalide');
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Email</Text>
      <TextInput value={email} onChangeText={setEmail} style={{ borderWidth:1, marginBottom:10, padding:8 }} />
      <Text>Mot de passe</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth:1, marginBottom:10, padding:8 }} />
      <Button title="Se connecter" onPress={handleLogin} />
      <Button title="Créer un compte" onPress={() => navigation.navigate('Register')} />
    </View>
  );
}
