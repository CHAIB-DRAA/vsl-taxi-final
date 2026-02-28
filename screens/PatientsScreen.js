import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, 
  ActivityIndicator, Alert, Modal, ScrollView, Image, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/fr';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// --- OUTILS ANTI-FRAUDE ---
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { extractSecuNumber } from '../services/ocrService'; 

// Contexte & API
import { useData } from '../contexts/DataContext';
import api, { getPatients, updatePatient, deletePatient, getRides } from '../services/api';

// Composant Scanner
import DocumentScannerButton from '../components/DocumentScannerButton';

export default function PatientsScreen() {
  const { contacts } = useData(); 

  // --- ÉTATS GLOBAUX ---
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modals Standards
  const [modalVisible, setModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [docSelectionModal, setDocSelectionModal] = useState(false);

  // --- ÉTATS POUR LA SAISIE DU PMT (NOUVEAU) ---
  const [customPMTModalVisible, setCustomPMTModalVisible] = useState(false);
  const [tempPMTUri, setTempPMTUri] = useState(null);
  const [customRideCount, setCustomRideCount] = useState('');

  // Sélection pour partage
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [shareTarget, setShareTarget] = useState(null);
  const [targetContact, setTargetContact] = useState(null);

  // Détails Patient
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('profil');
  const [patientRides, setPatientRides] = useState([]);
  const [patientDocs, setPatientDocs] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Upload & Scan États
  const [uploading, setUploading] = useState(false);

  // Visionneuse Image
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Formulaire Edition Profil
  const [formData, setFormData] = useState({ fullName: '', address: '', phone: '' });

  // ============================================================
  // 1. CHARGEMENT
  // ============================================================
  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPatients();
      const sorted = data.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setPatients(sorted);
      setFilteredPatients(sorted);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const handleSearch = (text) => {
    setSearch(text);
    if (text) {
      const filtered = patients.filter(p => p.fullName.toLowerCase().includes(text.toLowerCase()));
      setFilteredPatients(filtered);
    } else { setFilteredPatients(patients); }
  };

  const openPatientModal = (patient) => {
    setSelectedPatient(patient);
    setFormData({ fullName: patient.fullName, address: patient.address || '', phone: patient.phone || '' });
    setActiveTab('profil');
    setModalVisible(true);
    fetchPatientDetails(patient);
  };

  const fetchPatientDetails = async (patient) => {
    try {
      setLoadingDetails(true);
      
      // 1. Historique
      const allRides = await getRides();
      const myRides = allRides.filter(r => r.patientName === patient.fullName);
      myRides.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPatientRides(myRides);

      // 2. Documents
      let allDocs = [];
      try {
         const res = await api.get(`/documents/patient/${patient._id}`);
         allDocs = res.data;
      } catch (e) {
         const docsPromises = myRides.map(r => api.get(`/documents/by-ride/${r._id}`).catch(() => ({ data: [] })));
         const docsResults = await Promise.all(docsPromises);
         allDocs = docsResults.flatMap(res => res.data);
      }

      // Tri
      allDocs.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
      
      // Filtre d'affichage
      const finalDocs = [];
      const typesVus = {}; 
      allDocs.forEach(doc => {
        if (doc.type === 'PMT') {
          finalDocs.push(doc); // On garde tous les PMT
        } else {
          if (!typesVus[doc.type]) {
            finalDocs.push(doc);
            typesVus[doc.type] = true;
          }
        }
      });
      setPatientDocs(finalDocs);

    } catch (err) { console.log("Erreur détails", err); } 
    finally { setLoadingDetails(false); }
  };

  // ============================================================
  // 2. LOGIQUE PMT (MÉTIER VSL) 🚨
  // ============================================================

  const checkPMTStatus = () => {
    const pmts = patientDocs.filter(d => d.type === 'PMT');
    
    // CAS : Aucun PMT
    if (pmts.length === 0) return { status: 'MISSING', message: "Aucun PMT dans le dossier.", color: '#FF9800' };

    const lastPMT = pmts[0];
    const pmtDate = new Date(lastPMT.uploadDate);
    
    // On force la conversion en nombre pour éviter les bugs si le serveur renvoie du texte
    const maxQuota = lastPMT.maxRides ? parseFloat(lastPMT.maxRides) : 1;

    // On compte ce qu'on a fait depuis le scan du PMT
    const ridesSincePMT = patientRides.filter(ride => {
      const rideDate = new Date(ride.date);
      // On compte les courses faites APRÈS le scan
      return rideDate >= pmtDate && ride.status !== 'Annulée';
    });

    // --- CALCUL MÉTIER ---
    let consumed = 0;
    ridesSincePMT.forEach(ride => {
        if (ride.isRoundTrip) {
            consumed += 1;   // Aller-Retour = 1 point
        } else {
            consumed += 0.5; // Aller Simple = 0.5 point
        }
    });

    const remaining = maxQuota - consumed;

    // CAS : Série illimitée (code 1000)
    if (maxQuota >= 1000) {
        return { status: 'OK', message: "✅ PMT Série / Longue durée", color: '#4CAF50' };
    }

    // CAS : Épuisé
    if (remaining <= 0) {
      return { 
        status: 'EXPIRED', 
        message: `⛔️ PMT ÉPUISÉ (${consumed}/${maxQuota})\nDemandez un nouveau bon !`, 
        color: '#D32F2F' 
      };
    } 
    // CAS : Bientôt fini
    else if (remaining <= 1) {
        return { 
          status: 'WARNING', 
          message: `⚠️ Reste ${remaining} Aller(s)-Retour(s)`, 
          color: '#FF9800' 
        };
    }
    // CAS : OK
    else {
      return { 
        status: 'OK', 
        message: `✅ PMT Valide (${remaining} restants sur ${maxQuota})`, 
        color: '#4CAF50' 
      };
    }
  };

  // ============================================================
  // 3. SCAN & UPLOAD AVEC SAISIE
  // ============================================================

  const handleDocumentScanned = async (uri, docType) => {
    if (docType === 'PMT') {
        // Demande simple
        Alert.alert(
            "Nouveau Bon de Transport",
            "Quelle quantité est écrite sur le bon ?",
            [
              { text: "1 Aller-Retour", onPress: () => uploadDocument(uri, docType, 1) },
              { 
                text: "Série (Entrer nombre)", 
                onPress: () => {
                    setTempPMTUri(uri);
                    setCustomRideCount(''); 
                    setCustomPMTModalVisible(true);
                } 
              },
              { text: "Annuler", style: "cancel" }
            ]
        );
    } else {
        await uploadDocument(uri, docType, 0);
    }
  };

  // Validation du Modal de saisie
  const submitCustomPMT = () => {
      // On remplace la virgule par un point au cas où
      const count = parseFloat(customRideCount.replace(',', '.'));
      
      if (!count || count <= 0) {
          Alert.alert("Erreur", "Entrez un nombre valide (ex: 20).");
          return;
      }
      
      setCustomPMTModalVisible(false);
      uploadDocument(tempPMTUri, 'PMT', count);
  };

  const uploadDocument = async (uri, docType, maxRides = 0) => {
    if (!selectedPatient) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('photo', { uri: uri, name: `scan.jpg`, type: 'image/jpeg' });
      formData.append('patientName', selectedPatient.fullName);
      formData.append('patientId', selectedPatient._id);
      formData.append('docType', docType);
      
      // On envoie le maxRides au serveur
      if (maxRides > 0) formData.append('maxRides', maxRides);

      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (data) => data,
      });

      Alert.alert("Succès", "Document ajouté !");
      fetchPatientDetails(selectedPatient);

    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Echec de l'envoi.");
    } finally {
      setUploading(false);
    }
  };

  // --- ANTI-FRAUDE VITALE ---
  const handleAntiFraudScan = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return Alert.alert("Erreur", "Accès caméra requis");
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 });
      if (!result.canceled) {
        setUploading(true);
        const nir = await extractSecuNumber(result.assets[0].uri);
        setUploading(false);
        if (nir) {
          await Clipboard.setStringAsync(nir);
          Alert.alert("NIR Trouvé !", `Copié : ${nir}`, [{ text: "Ouvrir Ameli", onPress: () => Linking.openURL('https://professionnels.ameli.fr/') }]);
        } else { Alert.alert("Échec", "Illisible."); }
      }
    } catch (error) { setUploading(false); Alert.alert("Erreur", "Problème scan."); }
  };

  const deleteDocument = (docId) => {
    Alert.alert("Supprimer", "Supprimer définitivement ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: async () => {
            try { await api.delete(`/documents/${docId}`); fetchPatientDetails(selectedPatient); } 
            catch (err) { Alert.alert("Erreur", "Impossible de supprimer"); }
        }}
    ]);
  };

  // ============================================================
  // 4. PARTAGE & ACTIONS
  // ============================================================

  const initiateShareProcess = (mode, contact = null) => {
    setShareTarget(mode);
    setTargetContact(contact);
    const preSelected = patientDocs.filter(d => d.type !== 'PMT').map(d => d._id);
    setSelectedDocIds(preSelected);
    setDocSelectionModal(true);
    setShareModalVisible(false);
  };

  const toggleDocSelection = (id) => {
    if (selectedDocIds.includes(id)) setSelectedDocIds(prev => prev.filter(docId => docId !== id));
    else setSelectedDocIds(prev => [...prev, id]);
  };

  const generateCustomPDF = async () => {
    if (!selectedPatient) return null;
    const docsToInclude = patientDocs.filter(doc => selectedDocIds.includes(doc._id));
    let imagesHtml = '';
    if (docsToInclude.length > 0) {
        docsToInclude.forEach(doc => {
            imagesHtml += `
                <div style="margin-bottom: 20px; page-break-inside: avoid; border: 1px solid #ddd; padding: 10px; border-radius: 8px;">
                    <p><strong>${doc.type}</strong> <span style="font-size:12px; color:#666;">(${moment(doc.uploadDate).format('DD/MM/YYYY')})</span></p>
                    <img src="${doc.imageData}" style="width: 100%; max-height: 800px; object-fit: contain;" />
                </div>`;
        });
    } else { imagesHtml = `<p>Aucun document joint.</p>`; }

    const html = `<html><body style="font-family: Helvetica; padding: 40px;">
          <h1 style="color: #FF6B00;">Fiche Patient</h1><h2>${selectedPatient.fullName}</h2>
          <p>Tél: ${selectedPatient.phone}</p><h3>Documents</h3>${imagesHtml}</body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  };

  const handleInternalShare = async () => {
    if (!targetContact) return;
    setDocSelectionModal(false); setLoading(true);
    try { await api.post('/share/transfert-patient', { patientId: selectedPatient._id, targetUserId: targetContact.contactId._id, docIds: selectedDocIds });
      Alert.alert("Envoyé !", `Dossier envoyé.`); } catch (err) { Alert.alert("Erreur", "Echec transfert."); } 
    finally { setLoading(false); }
  };

  const handleSystemShare = async () => {
    setDocSelectionModal(false);
    try { const pdfUri = await generateCustomPDF(); if (!pdfUri) return; await Sharing.shareAsync(pdfUri, { UTI: '.pdf', mimeType: 'application/pdf' }); } catch (err) { Alert.alert("Erreur", "Impossible"); }
  };

  const handleSave = async () => { try { await updatePatient(selectedPatient._id, formData); setModalVisible(false); loadPatients(); } catch (err) { Alert.alert("Erreur", "Mise à jour impossible"); } };
  const handleDelete = () => { Alert.alert("Attention", "Supprimer ?", [{ text: "Non", style: "cancel" }, { text: "Oui", style: "destructive", onPress: async () => { try { await deletePatient(selectedPatient._id); setModalVisible(false); loadPatients(); } catch (err) {} } }]); };

  // ============================================================
  // 5. RENDU (UI)
  // ============================================================

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openPatientModal(item)}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text></View>
      <View style={styles.info}><Text style={styles.name}>{item.fullName}</Text><Text style={styles.subInfo}>{item.phone || "Non renseigné"}</Text></View>
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </TouchableOpacity>
  );

  const renderContactItem = ({ item }) => (
    <TouchableOpacity style={styles.contactRow} onPress={() => initiateShareProcess('colleague', item)}>
       <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{item.contactId?.fullName?.charAt(0)}</Text></View>
       <Text style={styles.contactName}>{item.contactId?.fullName}</Text>
       <Ionicons name="send" size={20} color="#FF6B00" />
    </TouchableOpacity>
  );

  const renderDocSelectionItem = ({ item }) => {
    const isSelected = selectedDocIds.includes(item._id);
    return (
      <TouchableOpacity style={[styles.selectDocRow, isSelected && styles.selectDocRowActive]} onPress={() => toggleDocSelection(item._id)}>
         <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={24} color={isSelected ? "#FF6B00" : "#CCC"} />
         <View style={{marginLeft: 15, flex:1}}><Text style={[styles.selectDocTitle, isSelected && {fontWeight:'bold'}]}>{item.type}</Text><Text style={styles.selectDocDate}>{moment(item.uploadDate).format('DD/MM/YYYY')}</Text></View>
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    if (loadingDetails) return <ActivityIndicator color="#FF6B00" style={{marginTop: 50}} />;

    switch (activeTab) {
      case 'profil':
        const pmtStatus = checkPMTStatus();
        return (
          <ScrollView style={styles.tabContent}>
             
             {/* ALERTE PMT */}
             <View style={[styles.alertBox, { borderColor: pmtStatus.color, backgroundColor: pmtStatus.status === 'EXPIRED' ? '#FFEBEE' : '#E8F5E9' }]}>
                <Ionicons 
                    name={pmtStatus.status === 'EXPIRED' || pmtStatus.status === 'MISSING' ? "warning" : "checkmark-circle"} 
                    size={30} 
                    color={pmtStatus.status === 'MISSING' ? '#FF9800' : pmtStatus.color} 
                />
                <Text style={[styles.alertText, { color: pmtStatus.status === 'MISSING' ? '#EF6C00' : pmtStatus.color }]}>
                    {pmtStatus.message}
                </Text>
             </View>

             <TouchableOpacity style={styles.antiFraudBtn} onPress={handleAntiFraudScan} disabled={uploading}>
                <View style={styles.antiFraudIcon}><Ionicons name="shield-checkmark" size={24} color="#FFF" /></View>
                <View><Text style={styles.antiFraudTitle}>Vérifier Droits (Anti-Fraude)</Text><Text style={styles.antiFraudSub}>Scanner Vitale → Copier NIR → AmeliPro</Text></View>
                {uploading && <ActivityIndicator color="#FFF" style={{marginLeft: 10}}/>}
             </TouchableOpacity>

             <View style={styles.inputGroup}><Text style={styles.label}>Nom</Text><TextInput style={styles.input} value={formData.fullName} onChangeText={t => setFormData({...formData, fullName: t})} /></View>
             <View style={styles.inputGroup}><Text style={styles.label}>Tél</Text><TextInput style={styles.input} value={formData.phone} keyboardType="phone-pad" onChangeText={t => setFormData({...formData, phone: t})} /></View>
             <View style={styles.inputGroup}><Text style={styles.label}>Adresse</Text><TextInput style={styles.input} value={formData.address} multiline onChangeText={t => setFormData({...formData, address: t})} /></View>
             <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveBtnText}>Enregistrer</Text></TouchableOpacity>
             
             <Text style={styles.sectionHeader}>PARTAGE</Text>
             <TouchableOpacity style={styles.shareBtnColl} onPress={() => setShareModalVisible(true)}><Ionicons name="people" size={20} color="#FFF" style={{marginRight: 10}} /><Text style={styles.saveBtnText}>Envoyer à un collègue</Text></TouchableOpacity>
             <TouchableOpacity style={styles.shareBtnPDF} onPress={() => initiateShareProcess('export')}><Ionicons name="document-text" size={20} color="#FF6B00" style={{marginRight: 10}} /><Text style={{color:'#FF6B00', fontWeight:'bold'}}>Exporter en PDF</Text></TouchableOpacity>
             <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}><Text style={styles.deleteText}>Supprimer le dossier</Text></TouchableOpacity>
          </ScrollView>
        );

      case 'docs':
        return (
          <View style={{flex:1}}>
            <View style={styles.scanGrid}>
                {/* Ces boutons appellent handleDocumentScanned qui gère le PMT */}
                <DocumentScannerButton title="PMT" docType="PMT" color="#FF6B00" onScan={handleDocumentScanned} isLoading={uploading}/>
                <DocumentScannerButton title="Vitale" docType="CarteVitale" color="#4CAF50" onScan={handleDocumentScanned} isLoading={uploading}/>
                <DocumentScannerButton title="Mutuelle" docType="Mutuelle" color="#2196F3" onScan={handleDocumentScanned} isLoading={uploading}/>
            </View>

            <FlatList 
                data={patientDocs} keyExtractor={(item, idx) => idx.toString()} numColumns={2} contentContainerStyle={{paddingBottom: 20}}
                ListEmptyComponent={<Text style={styles.emptyText}>Aucun document.</Text>}
                renderItem={({item}) => (
                <View style={styles.docCardContainer}>
                    <TouchableOpacity style={styles.docCard} onPress={() => { setSelectedDoc(item); setViewerVisible(true); }}>
                        <Ionicons name={item.type === 'PMT' ? 'document-text' : 'card'} size={32} color={item.type === 'PMT' ? '#5C6BC0' : '#4CAF50'} />
                        <Text style={styles.docTitle}>{item.type}</Text>
                        <Text style={styles.docDate}>{moment(item.uploadDate).format('DD/MM/YY')}</Text>
                        {/* Affichage Quantité */}
                        {item.type === 'PMT' && item.maxRides > 0 && (
                            <Text style={{fontSize:10, color: item.maxRides >= 1000 ? '#4CAF50' : '#FF6B00', fontWeight:'bold', textAlign:'center'}}>
                                {item.maxRides >= 1000 ? 'Illimité' : `${item.maxRides} AR`}
                            </Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteDocBadge} onPress={() => deleteDocument(item._id)}>
                        <Ionicons name="trash" size={14} color="#FFF" />
                    </TouchableOpacity>
                </View>
                )}
            />
          </View>
        );
      case 'history':
        return (
            <FlatList data={patientRides} keyExtractor={item => item._id} renderItem={({item}) => (
                <View style={styles.historyCard}>
                    <Text style={{fontWeight:'bold', width: 40}}>{moment(item.date).format('DD/MM')}</Text>
                    <View style={{flex:1, marginLeft:10}}>
                        <Text style={{fontWeight:'bold', color:'#333'}}>{item.type}</Text>
                        <Text style={{fontSize:12, color:'#666'}} numberOfLines={1}>{item.startLocation}</Text>
                    </View>
                    <View style={{alignItems:'flex-end'}}>
                        <Ionicons name={item.status === 'Terminée' ? "checkmark-circle" : "time"} size={18} color={item.status === 'Terminée' ? "#4CAF50" : "#FF9800"} />
                        <Text style={{fontSize:10, color:'#999'}}>{item.isRoundTrip ? "Aller-Retour" : "Aller Simple"}</Text>
                    </View>
                </View>
            )} />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput style={styles.searchInput} placeholder="Chercher un patient..." value={search} onChangeText={handleSearch} />
        </View>
      </View>

      {loading ? <ActivityIndicator size="large" color="#FF6B00" style={{marginTop: 50}} /> : (
        <FlatList data={filteredPatients} keyExtractor={item => item._id} renderItem={renderItem} contentContainerStyle={{ padding: 15 }} ListEmptyComponent={<Text style={styles.emptyText}>Aucun patient trouvé.</Text>} />
      )}

      {/* MODAL FICHE PATIENT */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedPatient?.fullName}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
          </View>
          <View style={styles.tabsContainer}>
            {['profil', 'docs', 'history'].map((tab) => (
              <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab === 'profil' ? 'Profil' : tab === 'docs' ? 'Documents' : 'Historique'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.contentContainer}>{renderTabContent()}</View>
        </View>
      </Modal>

      {/* MODAL SAISIE NOMBRE PMT */}
      <Modal visible={customPMTModalVisible} transparent={true} animationType="fade">
        <View style={styles.inputModalOverlay}>
            <View style={styles.inputModalCard}>
                <Text style={styles.inputModalTitle}>Quantité prescrite</Text>
                <Text style={styles.inputModalSub}>Nombre d'Allers-Retours indiqué ?</Text>
                
                <TextInput 
                    style={styles.bigNumberInput}
                    value={customRideCount}
                    onChangeText={setCustomRideCount}
                    placeholder="Ex: 20"
                    keyboardType="numeric"
                    autoFocus={true}
                />
                
                <Text style={{fontSize: 12, color:'#666', marginBottom: 20, textAlign:'center'}}>
                    Entrez le nombre exact écrit sur le papier.{"\n"}
                    (Ex: Pour "20 Allers-Retours", tapez 20).
                </Text>

                <View style={{flexDirection:'row', gap: 10}}>
                    <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#999'}]} onPress={() => setCustomPMTModalVisible(false)}>
                        <Text style={{color:'#FFF'}}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#FF6B00'}]} onPress={submitCustomPMT}>
                        <Text style={{color:'#FFF', fontWeight:'bold'}}>Valider</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* MODALS AUXILIAIRES */}
      <Modal visible={shareModalVisible} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Destinataire</Text><TouchableOpacity onPress={() => setShareModalVisible(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity></View>
            <FlatList data={contacts} keyExtractor={item => item._id} renderItem={renderContactItem} contentContainerStyle={{padding: 20}} />
        </View>
      </Modal>

      <Modal visible={docSelectionModal} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Documents à joindre</Text><TouchableOpacity onPress={() => setDocSelectionModal(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity></View>
            <FlatList data={patientDocs} keyExtractor={item => item._id} renderItem={renderDocSelectionItem} contentContainerStyle={{padding:20}} />
            <View style={styles.actionFooter}>
                {shareTarget === 'colleague' ? (
                    <View style={{flexDirection:'row', gap:10}}>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#2196F3', flex:1}]} onPress={handleInternalShare}><Ionicons name="cloud-upload" size={20} color="#FFF" style={{marginRight:5}}/><Text style={styles.actionBtnText}>Transfert App</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#4CAF50', flex:1}]} onPress={handleSystemShare}><Ionicons name="logo-whatsapp" size={20} color="#FFF" style={{marginRight:5}}/><Text style={styles.actionBtnText}>WhatsApp</Text></TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#FF6B00'}]} onPress={handleSystemShare}><Text style={styles.actionBtnText}>Générer PDF</Text></TouchableOpacity>
                )}
            </View>
        </View>
      </Modal>

      <Modal visible={viewerVisible} transparent={true} animationType="fade">
        <View style={styles.viewerOverlay}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)}><Ionicons name="close-circle" size={40} color="#FFF" /></TouchableOpacity>
            {selectedDoc && <Image source={{ uri: selectedDoc.imageData }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  searchHeader: { backgroundColor: '#FFF', padding: 15, borderBottomWidth:1, borderBottomColor:'#EEE' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 15, height: 45 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, marginBottom: 10, borderRadius: 12, marginHorizontal: 15, elevation: 1 },
  avatar: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#FF6B00' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  subInfo: { fontSize: 13, color: '#888' },
  
  modalContainer: { flex: 1, backgroundColor: '#F2F2F2' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  
  tabsContainer: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20 },
  tabBtn: { marginRight: 25, paddingBottom: 15 },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#FF6B00' },
  tabText: { fontSize: 15, color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#FF6B00', fontWeight: 'bold' },
  contentContainer: { flex: 1, padding: 20 },
  tabContent: { flex: 1 },

  // STYLES ALERT PMT
  alertBox: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 10, borderWidth: 1, marginBottom: 20 },
  alertText: { marginLeft: 10, fontSize: 14, fontWeight: 'bold', flex: 1 },

  antiFraudBtn: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#43A047', 
    padding: 15, borderRadius: 12, marginBottom: 20, elevation: 3 
  },
  antiFraudIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  antiFraudTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  antiFraudSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },

  inputGroup: { marginBottom: 15 },
  label: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight: 'bold' },
  input: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#DDD', fontSize: 16 },
  saveBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  sectionHeader: { marginTop: 25, marginBottom: 5, fontSize: 12, fontWeight:'bold', color:'#555', letterSpacing:1 },
  shareBtnColl: { backgroundColor: '#FF6B00', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 5, flexDirection:'row', justifyContent:'center' },
  shareBtnPDF: { backgroundColor: '#FFF', borderWidth:1, borderColor:'#FF6B00', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, flexDirection:'row', justifyContent:'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  deleteBtn: { alignItems: 'center', marginTop: 30, padding: 15 },
  deleteText: { color: '#D32F2F', fontWeight: 'bold' },

  contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10 },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  contactAvatarText: { color: '#1976D2', fontWeight: 'bold', fontSize: 18 },
  contactName: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },

  scanGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  docCardContainer: { flex: 0.5, margin: 6 },
  docCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2, minHeight: 110 },
  deleteDocBadge: { position:'absolute', top:-5, right:-5, backgroundColor:'#D32F2F', width:24, height:24, borderRadius:12, justifyContent:'center', alignItems:'center', elevation:3 },
  docTitle: { marginTop: 8, fontWeight: '700', color: '#333', fontSize: 13, textAlign:'center' },
  docDate: { fontSize: 10, color: '#999', marginTop: 2 },
  
  historyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 10 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30 },

  selectDocRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#EEE' },
  selectDocRowActive: { borderColor: '#FF6B00', backgroundColor: '#FFF3E0' },
  selectDocTitle: { fontSize: 15, color: '#666' },
  selectDocDate: { fontSize: 12, color: '#999' },
  
  actionFooter: { padding: 20, borderTopWidth: 1, borderColor: '#EEE', backgroundColor: '#FFF' },
  actionBtn: { padding: 15, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },

  // STYLES MODAL SAISIE
  inputModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  inputModalCard: { backgroundColor: '#FFF', padding: 25, borderRadius: 15, width: '80%', alignItems: 'center' },
  inputModalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  inputModalSub: { color: '#666', marginBottom: 15 },
  bigNumberInput: { fontSize: 30, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: '#FF6B00', width: 100, textAlign: 'center', marginBottom: 10, color: '#333' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, minWidth: 100, alignItems: 'center' },
});