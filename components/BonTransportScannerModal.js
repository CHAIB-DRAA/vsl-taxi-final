import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { parseBonTransport } from '../services/bonTransportParser';
import { createPatient } from '../services/api';

// ── Champ copiable ────────────────────────────────────────────────────────────
function CopyField({ label, value, mono = false, badge = null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldInfo}>
        <View style={styles.labelRow}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {value ? (
          <Text style={[styles.fieldValue, mono && styles.mono]} selectable>
            {value}
          </Text>
        ) : (
          <Text style={styles.fieldEmpty}>Non détecté</Text>
        )}
      </View>
      {!!value && (
        <TouchableOpacity
          style={[styles.copyBtn, copied && styles.copyBtnDone]}
          onPress={handleCopy}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={18}
            color={copied ? '#4CAF50' : '#FF6B00'}
          />
          <Text style={[styles.copyBtnText, copied && { color: '#4CAF50' }]}>
            {copied ? 'Copié !' : 'Copier'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Bouton de choix de source ─────────────────────────────────────────────────
function SourceButton({ icon, label, sub, color, onPress }) {
  return (
    <TouchableOpacity style={[styles.sourceBtn, { borderColor: color }]} onPress={onPress}>
      <View style={[styles.sourceIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={[styles.sourceLabel, { color }]}>{label}</Text>
      <Text style={styles.sourceSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function BonTransportScannerModal({ visible, onClose, onPatientAdded }) {
  const [step, setStep] = useState('idle'); // idle | scanning | result | saving
  const [parsed, setParsed] = useState(null);

  const reset = () => { setStep('idle'); setParsed(null); };
  const handleClose = () => { reset(); onClose(); };

  // ── OCR sur une URI d'image ──────────────────────────────────────────────
  const runOcr = async (imageUri) => {
    setStep('scanning');
    try {
      const ocrResult = await TextRecognition.recognize(imageUri);
      const ocrText = ocrResult?.text || '';

      if (!ocrText || ocrText.trim().length < 8) {
        setStep('idle');
        Alert.alert(
          'Lecture impossible',
          'Aucun texte détecté. Assurez-vous que l\'image est nette, bien éclairée et que le bon est entièrement visible.',
        );
        return;
      }

      const data = parseBonTransport(ocrText);
      setParsed(data);
      setStep('result');
    } catch (err) {
      console.error('OCR:', err);
      setStep('idle');
      Alert.alert('Erreur', 'La lecture OCR a échoué. Réessayez.');
    }
  };

  // ── Option 1 : Caméra ────────────────────────────────────────────────────
  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Caméra requise', 'Autorisez l\'accès à la caméra dans les réglages.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1 });
    if (!result.canceled) await runOcr(result.assets[0].uri);
  };

  // ── Option 2 : Galerie photos ────────────────────────────────────────────
  const handleGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Accès requis', 'Autorisez l\'accès à la galerie dans les réglages.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled) await runOcr(result.assets[0].uri);
  };

  // ── Option 3 : Import depuis les fichiers (screenshot PDF, etc.) ─────────
  const handleFiles = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Accès requis', 'Autorisez l\'accès à la galerie dans les réglages.');
      return;
    }
    // Laisse l'utilisateur naviguer dans TOUTES ses images (y compris screenshots de PDFs)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled) await runOcr(result.assets[0].uri);
  };

  // ── Création patient ─────────────────────────────────────────────────────
  const handleCreatePatient = async () => {
    const name = (parsed.fullName || '').trim();
    if (!name) {
      Alert.alert('Nom requis', 'Le nom du patient n\'a pas pu être détecté. Vérifiez votre image.');
      return;
    }
    try {
      setStep('saving');
      await createPatient({
        fullName: name,
        address: parsed.adresse || '',
        phone: '',
      });
      Alert.alert('Patient ajouté !', `${name} a été créé avec succès.`);
      onPatientAdded && onPatientAdded({ fullName: name, address: parsed.adresse || '' });
      handleClose();
    } catch (err) {
      console.error('Création patient:', err);
      setStep('result');
      Alert.alert('Erreur', 'Impossible de créer le patient. Vérifiez votre connexion.');
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Ionicons name="document-text" size={22} color="#FFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Bon de Transport</Text>
              <Text style={styles.headerSub}>Extraction automatique patient</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

          {/* ── IDLE : choix de source ── */}
          {step === 'idle' && (
            <View>
              <Text style={styles.sectionTitle}>Choisissez comment importer le bon</Text>

              <View style={styles.sourceGrid}>
                <SourceButton
                  icon="camera"
                  label="Caméra"
                  sub="Photographier le bon papier"
                  color="#FF6B00"
                  onPress={handleCamera}
                />
                <SourceButton
                  icon="images"
                  label="Galerie"
                  sub="Choisir une photo ou capture d'écran"
                  color="#2196F3"
                  onPress={handleGallery}
                />
                <SourceButton
                  icon="folder-open"
                  label="Mes fichiers"
                  sub="Capture d'écran ou photo enregistrée"
                  color="#9C27B0"
                  onPress={handleFiles}
                />
              </View>

              <View style={styles.tipsBox}>
                <Ionicons name="information-circle" size={18} color="#1976D2" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={styles.tipsText}>
                  <Text style={{ fontWeight: 'bold' }}>PDF reçu par WhatsApp ou email ?</Text>
                  {' '}Ouvrez-le, faites une capture d'écran, puis utilisez "Galerie" ou "Mes fichiers".
                </Text>
              </View>
            </View>
          )}

          {/* ── SCANNING ── */}
          {(step === 'scanning') && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={styles.scanningText}>Lecture en cours…</Text>
              <Text style={styles.scanningSubText}>Analyse du document</Text>
            </View>
          )}

          {/* ── RESULT ── */}
          {step === 'result' && parsed && (
            <View>
              <View style={styles.resultBanner}>
                <Ionicons name="checkmark-circle" size={26} color="#4CAF50" />
                <Text style={styles.resultTitle}>Informations détectées</Text>
              </View>
              <Text style={styles.resultSub}>
                Vérifiez et copiez les champs. Appuyez sur "Ajouter" pour créer le patient.
              </Text>

              <View style={styles.card}>
                <CopyField label="NOM" value={parsed.nom} />
                <View style={styles.sep} />
                <CopyField label="PRÉNOM" value={parsed.prenom} />
                <View style={styles.sep} />
                <CopyField label="DATE DE NAISSANCE" value={parsed.dateNaissance} />
                <View style={styles.sep} />
                <CopyField
                  label="N° SÉCURITÉ SOCIALE"
                  value={parsed.nir}
                  mono
                  badge="Sans espaces"
                />
                <View style={styles.sep} />
                <CopyField label="ADRESSE" value={parsed.adresse} />
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                  <Ionicons name="refresh" size={18} color="#FF6B00" />
                  <Text style={styles.retryText}>Reprendre</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={handleCreatePatient}>
                  <Ionicons name="person-add" size={20} color="#FFF" />
                  <Text style={styles.addBtnText}>Ajouter le patient</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── SAVING ── */}
          {step === 'saving' && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.scanningText}>Création du patient…</Text>
            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#FF6B00',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  headerSub: { fontSize: 12, color: '#999', marginTop: 1 },

  body: { padding: 20, flexGrow: 1 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#444', marginBottom: 16 },

  sourceGrid: { gap: 12, marginBottom: 20 },
  sourceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF', borderRadius: 14, padding: 18,
    borderWidth: 1.5,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  sourceIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sourceLabel: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  sourceSub: { position: 'absolute', left: 80, bottom: 10, fontSize: 12, color: '#999', right: 16 },

  tipsBox: {
    flexDirection: 'row', backgroundColor: '#E3F2FD', borderRadius: 10,
    padding: 14, alignItems: 'flex-start',
  },
  tipsText: { flex: 1, fontSize: 13, color: '#1976D2', lineHeight: 18 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  scanningText: { marginTop: 20, fontSize: 17, color: '#333', fontWeight: '600' },
  scanningSubText: { marginTop: 6, fontSize: 13, color: '#999' },

  resultBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  resultTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  resultSub: { fontSize: 13, color: '#777', marginBottom: 18, lineHeight: 18 },

  card: {
    backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, marginBottom: 20,
  },
  sep: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  fieldInfo: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  fieldLabel: {
    fontSize: 10, color: '#999', fontWeight: '800', letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  badge: { backgroundColor: '#E8F5E9', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, color: '#388E3C', fontWeight: 'bold', textTransform: 'uppercase' },
  fieldValue: { fontSize: 16, color: '#222', fontWeight: '600' },
  mono: { fontFamily: 'monospace', fontSize: 15, letterSpacing: 1.2, color: '#333' },
  fieldEmpty: { fontSize: 14, color: '#CCC', fontStyle: 'italic' },

  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#FF6B00', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, marginLeft: 10,
  },
  copyBtnDone: { borderColor: '#4CAF50' },
  copyBtnText: { fontSize: 12, color: '#FF6B00', fontWeight: '700' },

  actionsRow: { flexDirection: 'row', gap: 12 },
  retryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#FF6B00', borderRadius: 12, paddingVertical: 14,
  },
  retryText: { color: '#FF6B00', fontWeight: 'bold', fontSize: 15 },
  addBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 14,
    elevation: 3,
  },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
