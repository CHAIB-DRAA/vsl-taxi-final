import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

/**
 * Composant Bouton Scanner Réutilisable
 * @param {string} title - Le nom du bouton (ex: "PMT")
 * @param {string} docType - Le type technique (ex: "PMT", "CarteVitale")
 * @param {string} color - La couleur du bouton (ex: "#FF6B00")
 * @param {function} onScan - Fonction callback (uri, docType) => void
 * @param {boolean} isLoading - Si un upload est en cours globalement
 */
export default function DocumentScannerButton({ title, docType, color = "#FF6B00", onScan, isLoading }) {
  const [localLoading, setLocalLoading] = useState(false);

  const handleScan = async () => {
    if (isLoading) return; // Bloque si déjà occupé ailleurs
    setLocalLoading(true);

    try {
      // 1. Demander la permission
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert("Permission requise", "L'accès à la caméra est nécessaire pour scanner.");
        setLocalLoading(false);
        return;
      }

      // 2. Lancer la caméra avec option de CADRAGE (allowsEditing)
      // C'est "allowsEditing: true" qui transforme la photo en "Scan" (recadrage manuel)
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // 👈 IMPORTANT : Permet de rogner comme un scanner
        aspect: [4, 5], // Ratio document (ajuste selon besoin, ex: [3, 4])
        quality: 0.7,   // Bonne qualité mais pas trop lourd
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Renvoie l'image scannée au parent
        onScan(result.assets[0].uri, docType);
      }
    } catch (error) {
      console.error("Erreur Scan:", error);
      Alert.alert("Erreur", "Impossible d'ouvrir le scanner.");
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.scanBtn} 
      onPress={handleScan}
      disabled={isLoading || localLoading}
    >
      <View style={[styles.scanIconBg, { backgroundColor: '#F5F5F5' }]}>
        {localLoading ? (
          <ActivityIndicator color={color} size="small" />
        ) : (
          <Ionicons name="scan-outline" size={24} color={color} /> 
        )}
      </View>
      <Text style={styles.scanText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scanBtn: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  scanIconBg: {
    width: 60,
    height: 60,
    borderRadius: 15, // Forme carrée arrondie plus moderne
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEE',
    elevation: 2, // Ombre Android
    shadowColor: '#000', // Ombre iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scanText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});