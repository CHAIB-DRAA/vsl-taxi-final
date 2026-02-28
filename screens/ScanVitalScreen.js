import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

// Import du service qu'on vient de créer
import { extractSecuNumber } from '../services/ocrService';

export default function ScanVitalScreen() {
  const [loading, setLoading] = useState(false);

  const handleScanAndCheck = async () => {
    // 1. Permission & Caméra
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Erreur", "Accès caméra requis");

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, // Cadre bien la carte pour aider l'IA
      quality: 1,
    });

    if (result.canceled) return;

    setLoading(true);

    // 2. Extraction du NIR via notre service
    const nir = await extractSecuNumber(result.assets[0].uri);
    setLoading(false);

    if (nir) {
      // 3. LE FLUX INTELLIGENT
      await Clipboard.setStringAsync(nir); // Copie automatique
      
      Alert.alert(
        "Numéro Trouvé !", 
        `NIR: ${nir}\n\nCopié dans le presse-papiers.\nOuverture d'AmeliPro pour vérification...`,
        [
          {
            text: "Ouvrir AmeliPro",
            onPress: () => {
                // Lien direct vers l'espace pro (le chauffeur devra s'identifier)
                Linking.openURL('https://professionnels.ameli.fr/');
            }
          }
        ]
      );
    } else {
      Alert.alert("Échec", "Numéro de sécu illisible. Essayez avec plus de lumière.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="shield-checkmark" size={50} color="#4CAF50" />
        <Text style={styles.title}>Vérification Droits (Anti-Fraude)</Text>
        <Text style={styles.desc}>
          Scannez la carte Vitale pour copier le NIR et vérifier les droits (CMU, ALD) sur AmeliPro.
        </Text>

        <TouchableOpacity style={styles.scanBtn} onPress={handleScanAndCheck} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="camera" size={24} color="#FFF" style={{marginRight: 10}} />
              <Text style={styles.btnText}>SCANNER & VÉRIFIER</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 20 },
  card: { backgroundColor: '#FFF', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5, width: '100%' },
  title: { fontSize: 20, fontWeight: 'bold', marginTop: 15, textAlign: 'center' },
  desc: { textAlign: 'center', color: '#666', marginTop: 10, marginBottom: 30 },
  scanBtn: { flexDirection: 'row', backgroundColor: '#FF6B00', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});