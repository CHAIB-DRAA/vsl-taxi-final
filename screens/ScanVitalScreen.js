import React, { useState } from 'react';
import C from '../styles/tokens';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import { extractSecuNumber } from '../services/ocrService';

export default function ScanVitalScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const handleScanAndCheck = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Erreur", "Accès caméra requis");

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (result.canceled) return;

    setLoading(true);

    const nir = await extractSecuNumber(result.assets[0].uri);
    setLoading(false);

    if (nir) {
      await Clipboard.setStringAsync(nir);

      Alert.alert(
        "Numéro Trouvé !",
        `NIR: ${nir}\n\nCopié dans le presse-papiers.\nOuverture d'AmeliPro pour vérification...`,
        [
          {
            text: "Ouvrir AmeliPro",
            onPress: () => Linking.openURL('https://professionnels.ameli.fr/'),
          }
        ]
      );
    } else {
      Alert.alert("Échec", "Numéro de sécu illisible. Essayez avec plus de lumière.");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* HEADER DARK */}
      <LinearGradient
        colors={['#020710', '#060E1E']}
        style={styles.header}
      >
        <LinearGradient
          colors={['#00D68F', '#00B87A']}
          style={styles.headerIcon}
        >
          <Ionicons name="shield-checkmark" size={28} color="#FFF" />
        </LinearGradient>
        <Text style={styles.headerTitle}>Vérification Droits</Text>
        <Text style={styles.headerSubtitle}>Scan carte Vitale · Anti-fraude</Text>
      </LinearGradient>

      {/* CONTENU */}
      <View style={styles.content}>

        {/* CARD PRINCIPALE */}
        <View style={styles.card}>
          {/* ILLUSTRATION */}
          <LinearGradient
            colors={['#F0FDF4', '#DCFCE7']}
            style={styles.illustrationBox}
          >
            <Ionicons name="card" size={64} color="#10B981" />
          </LinearGradient>

          <Text style={styles.cardTitle}>Scanner la carte Vitale</Text>
          <Text style={styles.cardDesc}>
            Photographiez la carte Vitale pour extraire le NIR automatiquement.
            Il sera copié dans votre presse-papiers et vérifié sur AmeliPro.
          </Text>

          {/* ÉTAPES */}
          <View style={styles.stepsRow}>
            {[
              { icon: 'camera-outline', label: 'Photo' },
              { icon: 'copy-outline', label: 'Copier NIR' },
              { icon: 'checkmark-circle-outline', label: 'Vérifier' },
            ].map((step, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={styles.stepIconBox}>
                  <Ionicons name={step.icon} size={18} color="#10B981" />
                </View>
                <Text style={styles.stepLabel}>{step.label}</Text>
              </View>
            ))}
          </View>

          {/* BOUTON SCAN */}
          <TouchableOpacity
            onPress={handleScanAndCheck}
            disabled={loading}
            activeOpacity={0.85}
            style={styles.scanBtnWrapper}
          >
            <LinearGradient
              colors={['#00D68F', '#00B87A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scanBtn}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="camera" size={22} color="#FFF" style={{ marginRight: 10 }} />
                  <Text style={styles.scanBtnText}>SCANNER & VÉRIFIER</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* NOTE SÉCURITÉ */}
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={14} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.securityText}>
            Aucune donnée n'est stockée. La photo est traitée localement.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F3FA',
  },

  // HEADER
  header: {
    paddingBottom: 28,
    paddingTop: 10,
    alignItems: 'center',
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#00D68F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },

  // CONTENT
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },

  // CARD
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E4E8F0',
  },
  illustrationBox: {
    width: 110,
    height: 110,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0D1117',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  cardDesc: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 10,
    marginBottom: 24,
    fontSize: 14,
    lineHeight: 21,
  },

  // ÉTAPES
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 28,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // BOUTON SCAN
  scanBtnWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#00D68F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  scanBtn: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  scanBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },

  // NOTE SÉCURITÉ
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  securityText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    flex: 1,
  },
});
