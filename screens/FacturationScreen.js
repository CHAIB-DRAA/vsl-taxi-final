import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, 
  Image, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Imports Services
import { extractSecuNumber, extractName } from '../services/ocrService';

export default function FacturationScreen() {
  const [loading, setLoading] = useState(false);
  
  // Données du dossier
  const [patientData, setPatientData] = useState({ nom: '', nir: '' });
  const [photos, setPhotos] = useState({ vitale: null, pmt: null });

  // 1. SCAN INTELLIGENT VITALE
  const scanVitale = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
    
    if (!result.canceled) {
      setLoading(true);
      const uri = result.assets[0].uri;
      
      // Lancer les 2 analyses en parallèle (Gain de temps)
      const [nir, name] = await Promise.all([
        extractSecuNumber(uri),
        extractName(uri)
      ]);

      setPatientData({ 
        nir: nir || patientData.nir, 
        nom: name || patientData.nom 
      });
      setPhotos(prev => ({ ...prev, vitale: uri }));
      setLoading(false);
    }
  };

  // 2. PHOTO DU PMT
  const scanPMT = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setPhotos(prev => ({ ...prev, pmt: result.assets[0].uri }));
    }
  };

  // 3. GÉNÉRATION PDF (Le Cœur du système)
  const generatePDF = async () => {
    if (!patientData.nom || !patientData.nir) {
      return Alert.alert("Incomplet", "Il manque le nom ou le NIR.");
    }
    if (!photos.pmt) {
      return Alert.alert("Incomplet", "Il manque la photo du PMT.");
    }

    setLoading(true);
    try {
      // Construction du PDF en HTML
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Helvetica, sans-serif; padding: 30px; }
              h1 { color: #FF6B00; text-align: center; border-bottom: 2px solid #FF6B00; padding-bottom: 10px; }
              .section { margin-top: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
              .label { font-weight: bold; color: #555; }
              .value { font-size: 18px; margin-bottom: 10px; }
              img { width: 100%; max-height: 400px; object-fit: contain; margin-top: 10px; border: 1px dashed #ccc; }
            </style>
          </head>
          <body>
            <h1>DOSSIER DE TRANSPORT</h1>
            <p>Généré automatiquement par Taxi App</p>

            <div class="section">
              <h2>👤 LE PATIENT</h2>
              <div class="label">Nom / Prénom :</div>
              <div class="value">${patientData.nom}</div>
              <div class="label">Numéro Sécurité Sociale (NIR) :</div>
              <div class="value">${patientData.nir}</div>
            </div>

            <div class="section">
              <h2>📄 PRESCRIPTION MÉDICALE (PMT)</h2>
              <p>Copie numérique certifiée conforme à l'original papier.</p>
              <img src="${photos.pmt}" />
            </div>

            <div class="section">
              <h2>💳 PREUVE CARTE VITALE</h2>
              ${photos.vitale ? `<img src="${photos.vitale}" />` : '<p>Non jointe</p>'}
            </div>
            
            <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #999;">
              Document généré le ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString()}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

    } catch (err) {
      Alert.alert("Erreur PDF", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Création Dossier Facturation</Text>

      {/* ÉTAPE 1 : VITALE */}
      <View style={styles.card}>
        <Text style={styles.stepTitle}>1. Carte Vitale</Text>
        <TouchableOpacity style={styles.scanBtn} onPress={scanVitale}>
          <Ionicons name="scan" size={24} color="#FFF" />
          <Text style={styles.btnText}>Scanner Vitale (OCR)</Text>
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Nom détecté :</Text>
          <TextInput 
            style={styles.input} 
            value={patientData.nom} 
            onChangeText={t => setPatientData({...patientData, nom: t})}
            placeholder="Nom Prénom"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>NIR (Sécu) :</Text>
          <TextInput 
            style={styles.input} 
            value={patientData.nir} 
            onChangeText={t => setPatientData({...patientData, nir: t})}
            placeholder="1 88 ..."
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* ÉTAPE 2 : PMT */}
      <View style={styles.card}>
        <Text style={styles.stepTitle}>2. Bon de Transport (PMT)</Text>
        <TouchableOpacity style={[styles.scanBtn, {backgroundColor: '#2196F3'}]} onPress={scanPMT}>
          <Ionicons name="camera" size={24} color="#FFF" />
          <Text style={styles.btnText}>Prendre Photo PMT</Text>
        </TouchableOpacity>
        {photos.pmt && (
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={20} color="green" />
            <Text style={{color:'green', marginLeft: 5}}>Photo enregistrée</Text>
          </View>
        )}
      </View>

      {/* ÉTAPE 3 : ACTION */}
      <TouchableOpacity 
        style={[styles.generateBtn, loading && {opacity: 0.7}]} 
        onPress={generatePDF}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFF"/> : (
          <>
            <Ionicons name="document-text" size={24} color="#FFF" style={{marginRight: 10}}/>
            <Text style={styles.generateText}>GÉNÉRER PDF & ENVOYER</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{height: 50}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20, marginTop: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 15, padding: 20, marginBottom: 20, elevation: 2 },
  stepTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  scanBtn: { flexDirection: 'row', backgroundColor: '#4CAF50', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  btnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 10 },
  inputContainer: { marginBottom: 10 },
  label: { fontSize: 12, color: '#666', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#FAFAFA' },
  successBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8 },
  generateBtn: { backgroundColor: '#FF6B00', flexDirection: 'row', padding: 20, borderRadius: 15, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  generateText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});