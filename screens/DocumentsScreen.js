import React, { useState, useEffect, useCallback } from 'react';
import C from '../styles/tokens';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Image, Modal, SafeAreaView, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import dayjs from 'dayjs';

// Composants & API
import DocumentScannerButton from '../components/DocumentScannerButton';
import api from '../services/api';


// Couleurs dégradées par type de document
const DOC_GRADIENTS = {
  Permis:          ['#3B82F6', '#2563EB'],
  CartePro:        ['#8B5CF6', '#7C3AED'],
  VisiteMedicale:  ['#00D68F', '#00B87A'],
  Assurance:       ['#F59E0B', '#D97706'],
  Kbis:            ['#FF5500', '#E55A00'],
  Formation:       ['#EF4444', '#DC2626'],
};

// Liste des documents obligatoires en France pour Taxi/VSL
const REQUIRED_DOCS = [
  { id: 'Permis',         label: 'Permis de Conduire',     icon: 'car-sport',        desc: 'Recto/Verso' },
  { id: 'CartePro',       label: 'Carte Professionnelle',  icon: 'id-card',          desc: 'Validité visible' },
  { id: 'VisiteMedicale', label: 'Aptitude Médicale',      icon: 'medical',          desc: 'Attestation Préfecture' },
  { id: 'Assurance',      label: 'Assurance Pro',          icon: 'shield-checkmark', desc: 'Carte verte / Mémo' },
  { id: 'Kbis',           label: 'K-bis / Siren',          icon: 'business',         desc: '< 3 mois idéalement' },
  { id: 'Formation',      label: 'Formation Continue',     icon: 'school',           desc: 'Attestation stage' },
];

export default function DocumentsScreen() {
  const [myDocs, setMyDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Visionneuse
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    loadDriverDocs();
  }, []);

  const loadDriverDocs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents/driver/me');
      setMyDocs(res.data);
    } catch (err) {
      // échec chargement documents chauffeur
    } finally {
      setLoading(false);
    }
  };

  // Callback du Scanner
  const handleDocumentScanned = async (uri, docType) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const fileName = `admin_${docType}_${dayjs().format('YYYYMMDD')}.jpg`;
      formData.append('photo', { uri: uri, name: fileName, type: 'image/jpeg' });
      formData.append('docType', docType);
      formData.append('patientName', "CHAUFFEUR");

      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (data) => data,
      });

      Alert.alert("Succès", "Document enregistré !");
      loadDriverDocs();
    } catch (error) {
      Alert.alert("Erreur", "Echec de l'envoi.");
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = (docId) => {
    Alert.alert("Supprimer", "Retirer ce document ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: async () => {
            try {
                await api.delete(`/documents/${docId}`);
                loadDriverDocs();
            } catch (err) { Alert.alert("Erreur", "Impossible de supprimer"); }
        }}
    ]);
  };

  // Stats : combien de docs valides ?
  const validCount = REQUIRED_DOCS.filter(d => myDocs.find(m => m.type === d.id)).length;
  const totalCount = REQUIRED_DOCS.length;
  const progressPct = validCount / totalCount;

  const renderItem = ({ item }) => {
    const existingDoc = myDocs.find(d => d.type === item.id);
    const gradColors = DOC_GRADIENTS[item.id] || [C.blue, C.purple];
    const isValid = !!existingDoc;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {/* Icône avec gradient */}
          <LinearGradient
            colors={isValid ? gradColors : ['#E2E8F0', '#CBD5E1']}
            style={styles.iconBox}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={isValid ? '#FFF' : C.text3}
            />
          </LinearGradient>

          <View style={{flex: 1, marginLeft: 14}}>
            <Text style={styles.cardTitle}>{item.label}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </View>

          {/* Badge statut */}
          {isValid ? (
            <View style={styles.validBadge}>
              <Ionicons name="checkmark" size={13} color="#FFF" />
              <Text style={styles.validBadgeText}>OK</Text>
            </View>
          ) : (
            <View style={styles.missingBadge}>
              <Text style={styles.missingBadgeText}>Manquant</Text>
            </View>
          )}
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardActions}>
          {existingDoc ? (
            // CAS 1 : Document présent -> Voir ou Supprimer
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.viewBtnWrap}
                onPress={() => { setSelectedDoc(existingDoc); setViewerVisible(true); }}
              >
                <LinearGradient colors={[C.text, '#374151']} style={styles.viewBtn}>
                  <Ionicons name="eye" size={16} color="#FFF" />
                  <Text style={styles.viewBtnText}>Voir le document</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteDocument(existingDoc._id)}
              >
                <Ionicons name="trash" size={17} color={C.red} />
              </TouchableOpacity>
            </View>
          ) : (
            // CAS 2 : Document manquant -> Scanner
            <View style={{minHeight: 48}}>
              {uploading ? (
                <ActivityIndicator color={C.brand} />
              ) : (
                <DocumentScannerButton
                  title="SCANNER MAINTENANT"
                  docType={item.id}
                  color={C.brand}
                  onScan={handleDocumentScanned}
                  isLoading={uploading}
                />
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER DARK GRADIENT */}
      <View style={[styles.header, {backgroundColor: "#FFFFFF"}]}>
        {/* Accent blob */}

        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Mes Documents</Text>
            <Text style={styles.headerSub}>Obligatoires en cas de contrôle</Text>
          </View>
          {/* Compteur */}
          <View style={styles.counterBadge}>
            <Text style={styles.counterNum}>{validCount}</Text>
            <Text style={styles.counterDen}>/{totalCount}</Text>
          </View>
        </View>

        {/* BARRE DE PROGRESSION */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={progressPct === 1 ? [C.green, '#00B87A'] : [C.brand, '#E55A00']}
              style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.progressLabel}>
            {progressPct === 1 ? 'Dossier complet ✓' : `${totalCount - validCount} document(s) manquant(s)`}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.brand} style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={REQUIRED_DOCS}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Visionneuse */}
      <Modal visible={viewerVisible} transparent={true} animationType="fade">
        <View style={styles.viewerOverlay}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)}>
                <Ionicons name="close-circle" size={40} color="#FFF" />
            </TouchableOpacity>
            {selectedDoc && (
                <Image source={{ uri: selectedDoc.imageData }} style={styles.fullImage} resizeMode="contain" />
            )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // HEADER
  header: { paddingTop: 8, paddingBottom: 22, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: C.hText, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: C.hText2, marginTop: 2 },
  counterBadge: {
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: C.hCard, borderRadius: 16,
    borderWidth: 1, borderColor: C.hBorder,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  counterNum: { fontSize: 22, fontWeight: '900', color: C.hText },
  counterDen: { fontSize: 14, fontWeight: '600', color: C.hText2 },

  progressWrap: { gap: 8 },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: C.hCard,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 12, color: C.hText2, fontWeight: '600' },

  // LIST
  listContent: { padding: 16, paddingBottom: 40 },

  // CARD
  card: {
    backgroundColor: C.card, borderRadius: 20,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  cardDesc: { fontSize: 12, color: C.text3, marginTop: 2 },

  validBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.green, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, gap: 3,
  },
  validBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  missingBadge: {
    backgroundColor: '#FEF2F2', borderRadius: 20,
    borderWidth: 1, borderColor: '#FECACA',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  missingBadgeText: { color: C.red, fontSize: 11, fontWeight: '700' },

  cardDivider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  cardActions: {},

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewBtnWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  viewBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12, gap: 8 },
  viewBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  deleteBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12 },

  // VIEWER
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
});
