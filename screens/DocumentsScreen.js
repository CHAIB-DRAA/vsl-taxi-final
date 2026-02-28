import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
  ActivityIndicator, Image, Modal, SafeAreaView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

// Composants & API
import DocumentScannerButton from '../components/DocumentScannerButton';
import api from '../services/api';

// Liste des documents obligatoires en France pour Taxi/VSL
const REQUIRED_DOCS = [
  { id: 'Permis', label: 'Permis de Conduire', icon: 'car-sport', desc: 'Recto/Verso' },
  { id: 'CartePro', label: 'Carte Professionnelle', icon: 'id-card', desc: 'Validité visible' },
  { id: 'VisiteMedicale', label: 'Aptitude Médicale', icon: 'medical', desc: 'Attestation Préfecture' },
  { id: 'Assurance', label: 'Assurance Pro', icon: 'shield-checkmark', desc: 'Carte verte / Mémo' },
  { id: 'Kbis', label: 'K-bis / Siren', icon: 'business', desc: '< 3 mois idéalement' },
  { id: 'Formation', label: 'Formation Continue', icon: 'school', desc: 'Attestation stage' },
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Callback du Scanner
  const handleDocumentScanned = async (uri, docType) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const fileName = `admin_${docType}_${moment().format('YYYYMMDD')}.jpg`;

      formData.append('photo', { uri: uri, name: fileName, type: 'image/jpeg' });
      formData.append('docType', docType);
      
      // Astuce : On met "CHAUFFEUR" en nom de patient pour les distinguer en base
      formData.append('patientName', "CHAUFFEUR"); 
      // formData.append('patientId', user.id); // Si tu veux lier à l'ID user

      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (data) => data,
      });

      Alert.alert("Succès", "Document enregistré !");
      loadDriverDocs(); // Rafraîchir
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

  const renderItem = ({ item }) => {
    // Chercher si on a déjà scanné ce type de document
    // On prend le plus récent
    const existingDoc = myDocs.find(d => d.type === item.id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: existingDoc ? '#E8F5E9' : '#FFEBEE' }]}>
            <Ionicons 
              name={item.icon} 
              size={24} 
              color={existingDoc ? '#4CAF50' : '#D32F2F'} 
            />
          </View>
          <View style={{flex: 1, marginLeft: 15}}>
            <Text style={styles.cardTitle}>{item.label}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </View>
          {existingDoc && (
             <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          )}
        </View>

        <View style={styles.cardActions}>
            {existingDoc ? (
                // CAS 1 : Document présent -> Voir ou Supprimer
                <View style={styles.actionRow}>
                    <TouchableOpacity 
                        style={styles.viewBtn} 
                        onPress={() => { setSelectedDoc(existingDoc); setViewerVisible(true); }}
                    >
                        <Ionicons name="eye" size={20} color="#FFF" />
                        <Text style={styles.btnText}>Voir</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.deleteBtn} 
                        onPress={() => deleteDocument(existingDoc._id)}
                    >
                        <Ionicons name="trash" size={20} color="#D32F2F" />
                    </TouchableOpacity>
                </View>
            ) : (
                // CAS 2 : Document manquant -> Scanner
                <View style={{height: 50}}>
                    {uploading ? <ActivityIndicator color="#FF6B00" /> : (
                        <DocumentScannerButton 
                            title="SCANNER MAINTENANT" 
                            docType={item.id} 
                            color="#FF6B00" 
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
      <View style={styles.header}>
        <Text style={styles.title}>Mes Documents Admin</Text>
        <Text style={styles.subtitle}>Obligatoires en cas de contrôle</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF6B00" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={REQUIRED_DOCS}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 5 },
  
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  cardDesc: { fontSize: 12, color: '#999' },
  
  cardActions: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 15 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  viewBtn: { flex: 1, backgroundColor: '#333', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 8, marginRight: 10 },
  btnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
  deleteBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFEBEE', borderRadius: 8 },

  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
});