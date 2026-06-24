import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, ScrollView, Image, SafeAreaView, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// --- OUTILS ANTI-FRAUDE ---
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { extractSecuNumber } from '../services/ocrService';

// Contexte & API
import { useData } from '../contexts/DataContext';
import api, { getPatients, updatePatient, deletePatient } from '../services/api';

// Composant Scanner
import DocumentScannerButton from '../components/DocumentScannerButton';
import BonTransportScannerModal from '../components/BonTransportScannerModal';
import C from '../styles/tokens';

export default function PatientsScreen() {
  const { contacts, allRides } = useData();

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

  // Focus states
  const [focusSearch, setFocusSearch] = useState(false);
  const [focusPMTInput, setFocusPMTInput] = useState(false);

  // Visionneuse Image
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Scanner Bon de Transport
  const [btScannerVisible, setBtScannerVisible] = useState(false);

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

      // 1. Historique — utilise le cache DataContext, évite un appel API
      const myRides = allRides
        .filter(r => r.patientName === patient.fullName)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
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
  // 2. LOGIQUE PMT (MÉTIER VSL)
  // ============================================================

  const checkPMTStatus = () => {
    const pmts = patientDocs.filter(d => d.type === 'PMT');

    if (pmts.length === 0) return { status: 'MISSING', message: "Aucun PMT dans le dossier.", color: C.amber };

    const lastPMT = pmts[0];
    const pmtDate = new Date(lastPMT.uploadDate);

    const maxQuota = lastPMT.maxRides ? parseFloat(lastPMT.maxRides) : 1;

    const ridesSincePMT = patientRides.filter(ride => {
      const rideDate = new Date(ride.date);
      return rideDate >= pmtDate && ride.status !== 'Annulée';
    });

    let consumed = 0;
    ridesSincePMT.forEach(ride => {
        if (ride.isRoundTrip) {
            consumed += 1;
        } else {
            consumed += 0.5;
        }
    });

    const remaining = maxQuota - consumed;

    if (maxQuota >= 1000) {
        return { status: 'OK', message: "PMT Série / Longue durée", color: C.green };
    }

    if (remaining <= 0) {
      return {
        status: 'EXPIRED',
        message: `PMT ÉPUISÉ (${consumed}/${maxQuota})\nDemandez un nouveau bon !`,
        color: C.red
      };
    }
    else if (remaining <= 1) {
        return {
          status: 'WARNING',
          message: `Reste ${remaining} Aller(s)-Retour(s)`,
          color: C.amber
        };
    }
    else {
      return {
        status: 'OK',
        message: `PMT Valide (${remaining} restants sur ${maxQuota})`,
        color: C.green
      };
    }
  };

  // ============================================================
  // 3. SCAN & UPLOAD AVEC SAISIE
  // ============================================================

  const handleDocumentScanned = async (uri, docType) => {
    if (docType === 'PMT') {
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

  const submitCustomPMT = () => {
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
                    <p><strong>${doc.type}</strong> <span style="font-size:12px; color:#666;">(${dayjs(doc.uploadDate).format('DD/MM/YYYY')})</span></p>
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
    <TouchableOpacity style={styles.card} onPress={() => openPatientModal(item)} activeOpacity={0.75}>
      <LinearGradient colors={[C.brand, '#E55A00']} style={styles.avatar}>
        <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
      </LinearGradient>
      <View style={styles.info}>
        <Text style={styles.name}>{item.fullName}</Text>
        <Text style={styles.subInfo}>{item.phone || "Non renseigné"}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.text3} />
    </TouchableOpacity>
  );

  const renderContactItem = ({ item }) => (
    <TouchableOpacity style={styles.contactRow} onPress={() => initiateShareProcess('colleague', item)}>
      <LinearGradient colors={[C.blue, '#2563EB']} style={styles.contactAvatar}>
        <Text style={styles.contactAvatarText}>{item.contactId?.fullName?.charAt(0)}</Text>
      </LinearGradient>
      <Text style={styles.contactName}>{item.contactId?.fullName}</Text>
      <LinearGradient colors={[C.brand, '#E55A00']} style={styles.sendBadge}>
        <Ionicons name="send" size={14} color="#FFF" />
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderDocSelectionItem = ({ item }) => {
    const isSelected = selectedDocIds.includes(item._id);
    return (
      <TouchableOpacity style={[styles.selectDocRow, isSelected && styles.selectDocRowActive]} onPress={() => toggleDocSelection(item._id)}>
         <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={24} color={isSelected ? C.brand : C.text3} />
         <View style={{marginLeft: 15, flex:1}}>
           <Text style={[styles.selectDocTitle, isSelected && {fontWeight:'bold', color: C.text}]}>{item.type}</Text>
           <Text style={styles.selectDocDate}>{dayjs(item.uploadDate).format('DD/MM/YYYY')}</Text>
         </View>
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    if (loadingDetails) return <ActivityIndicator color={C.brand} style={{marginTop: 50}} />;

    switch (activeTab) {
      case 'profil':
        const pmtStatus = checkPMTStatus();
        const pmtBg = pmtStatus.status === 'EXPIRED' ? '#FEF2F2' : pmtStatus.status === 'WARNING' ? '#FFFBEB' : '#F0FDF4';
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>

             {/* ALERTE PMT */}
             <View style={[styles.alertBox, { borderColor: pmtStatus.color, backgroundColor: pmtBg }]}>
                <View style={[styles.alertIconCircle, { backgroundColor: pmtStatus.color + '20' }]}>
                  <Ionicons
                      name={pmtStatus.status === 'EXPIRED' || pmtStatus.status === 'MISSING' ? "warning" : "checkmark-circle"}
                      size={22}
                      color={pmtStatus.color}
                  />
                </View>
                <Text style={[styles.alertText, { color: pmtStatus.color }]}>
                    {pmtStatus.message}
                </Text>
             </View>

             {/* ANTI-FRAUDE */}
             <LinearGradient colors={['#059669', '#047857']} style={styles.antiFraudBtn}>
               <TouchableOpacity style={styles.antiFraudInner} onPress={handleAntiFraudScan} disabled={uploading}>
                <View style={styles.antiFraudIcon}><Ionicons name="shield-checkmark" size={22} color="#FFF" /></View>
                <View style={{flex:1}}>
                  <Text style={styles.antiFraudTitle}>Vérifier Droits (Anti-Fraude)</Text>
                  <Text style={styles.antiFraudSub}>Scanner Vitale → Copier NIR → AmeliPro</Text>
                </View>
                {uploading && <ActivityIndicator color="#FFF" style={{marginLeft: 10}}/>}
               </TouchableOpacity>
             </LinearGradient>

             {/* FORMULAIRE */}
             <View style={styles.inputGroup}><Text style={styles.label}>Nom</Text><TextInput style={styles.input} value={formData.fullName} onChangeText={t => setFormData({...formData, fullName: t})} /></View>
             <View style={styles.inputGroup}><Text style={styles.label}>Tél</Text><TextInput style={styles.input} value={formData.phone} keyboardType="phone-pad" onChangeText={t => setFormData({...formData, phone: t})} /></View>
             <View style={styles.inputGroup}><Text style={styles.label}>Adresse</Text><TextInput style={styles.input} value={formData.address} multiline onChangeText={t => setFormData({...formData, address: t})} /></View>

             <TouchableOpacity style={styles.saveBtnWrap} onPress={handleSave}>
               <LinearGradient colors={[C.green, '#059669']} style={styles.saveBtn}>
                 <Ionicons name="checkmark" size={18} color="#FFF" style={{marginRight:8}} />
                 <Text style={styles.saveBtnText}>Enregistrer</Text>
               </LinearGradient>
             </TouchableOpacity>

             <Text style={styles.sectionHeader}>PARTAGE</Text>
             <TouchableOpacity style={styles.shareBtnCollWrap} onPress={() => setShareModalVisible(true)}>
               <LinearGradient colors={[C.brand, '#E55A00']} style={styles.shareBtnColl}>
                 <Ionicons name="people" size={20} color="#FFF" style={{marginRight: 10}} />
                 <Text style={styles.saveBtnText}>Envoyer à un collègue</Text>
               </LinearGradient>
             </TouchableOpacity>
             <TouchableOpacity style={styles.shareBtnPDF} onPress={() => initiateShareProcess('export')}>
               <Ionicons name="document-text" size={20} color={C.brand} style={{marginRight: 10}} />
               <Text style={{color: C.brand, fontWeight:'bold', fontSize:15}}>Exporter en PDF</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
               <Text style={styles.deleteText}>Supprimer le dossier</Text>
             </TouchableOpacity>
          </ScrollView>
        );

      case 'docs':
        return (
          <View style={{flex:1}}>
            <View style={styles.scanGrid}>
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
                        <LinearGradient
                          colors={item.type === 'PMT' ? [C.purple, '#7C3AED'] : [C.green, '#059669']}
                          style={styles.docIconBox}
                        >
                          <Ionicons name={item.type === 'PMT' ? 'document-text' : 'card'} size={22} color="#FFF" />
                        </LinearGradient>
                        <Text style={styles.docTitle}>{item.type}</Text>
                        <Text style={styles.docDate}>{dayjs(item.uploadDate).format('DD/MM/YY')}</Text>
                        {item.type === 'PMT' && item.maxRides > 0 && (
                            <Text style={{fontSize:10, color: item.maxRides >= 1000 ? C.green : C.brand, fontWeight:'bold', textAlign:'center', marginTop:2}}>
                                {item.maxRides >= 1000 ? 'Illimité' : `${item.maxRides} AR`}
                            </Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteDocBadge} onPress={() => deleteDocument(item._id)}>
                        <Ionicons name="trash" size={12} color="#FFF" />
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
                    <View style={styles.historyDateBadge}>
                      <Text style={styles.historyDateText}>{dayjs(item.date).format('DD')}</Text>
                      <Text style={styles.historyMonthText}>{dayjs(item.date).format('MMM')}</Text>
                    </View>
                    <View style={{flex:1, marginLeft:12}}>
                        <Text style={styles.historyType}>{item.type}</Text>
                        <Text style={styles.historyLocation} numberOfLines={1}>{item.startLocation}</Text>
                    </View>
                    <View style={{alignItems:'flex-end', gap:3}}>
                        <Ionicons name={item.status === 'Terminée' ? "checkmark-circle" : "time"} size={18} color={item.status === 'Terminée' ? C.green : C.amber} />
                        <Text style={styles.historyTrip}>{item.isRoundTrip ? "A/R" : "Aller"}</Text>
                    </View>
                </View>
            )} />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER DARK GRADIENT */}
      <LinearGradient colors={[C.hBg1, C.hBg2, C.hBg3]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Patients</Text>
            <Text style={styles.headerSub}>{filteredPatients.length} dossiers</Text>
          </View>
          <TouchableOpacity style={[styles.scanHeaderBtn, uploading && { opacity: 0.5 }]} onPress={() => setBtScannerVisible(true)} disabled={uploading}>
            <LinearGradient colors={[C.brand, '#E55A00']} style={styles.scanHeaderGradient}>
              <Ionicons name="scan" size={16} color="#FFF" />
              <Text style={styles.scanHeaderText}>Bon de transport</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* SEARCH BAR IN HEADER */}
        <View style={[styles.searchBar, focusSearch && { borderColor: C.brand }]}>
          <Ionicons name="search" size={18} color={C.hText2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Chercher un patient..."
            placeholderTextColor={C.hText2}
            value={search}
            onChangeText={handleSearch}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={C.hText2} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={C.brand} style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={filteredPatients}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <LinearGradient colors={[C.card2, C.border]} style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={32} color={C.text3} />
              </LinearGradient>
              <Text style={styles.emptyText}>Aucun patient trouvé.</Text>
            </View>
          }
        />
      )}

      {/* FAB + */}
      <TouchableOpacity style={styles.fabWrap} onPress={() => Alert.alert("Nouveau patient", "Scannez un bon de transport pour ajouter un patient.")}>
        <LinearGradient colors={[C.brand, '#E55A00']} style={styles.fab}>
          <Ionicons name="add" size={28} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* MODAL FICHE PATIENT */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />
          <LinearGradient colors={[C.hBg1, C.hBg2]} style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{selectedPatient?.fullName}</Text>
              <Text style={styles.modalSub}>Fiche patient</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={20} color={C.hText} />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.tabsContainer}>
            {['profil', 'docs', 'history'].map((tab) => (
              <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'profil' ? 'Profil' : tab === 'docs' ? 'Documents' : 'Historique'}
                </Text>
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
                <View style={styles.inputModalHandle} />
                <Text style={styles.inputModalTitle}>Quantité prescrite</Text>
                <Text style={styles.inputModalSub}>Nombre d'Allers-Retours indiqué ?</Text>

                <TextInput
                    style={[styles.bigNumberInput, focusPMTInput && { borderBottomColor: C.brand }]}
                    value={customRideCount}
                    onChangeText={setCustomRideCount}
                    placeholder="Ex: 20"
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                    autoFocus={true}
                    onFocus={() => setFocusPMTInput(true)}
                    onBlur={() => setFocusPMTInput(false)}
                />

                <Text style={{fontSize: 12, color: C.text2, marginBottom: 20, textAlign:'center', lineHeight:18}}>
                    Entrez le nombre exact écrit sur le papier.{"\n"}
                    (Ex: Pour "20 Allers-Retours", tapez 20).
                </Text>

                <View style={{flexDirection:'row', gap: 10, width:'100%'}}>
                    <TouchableOpacity style={[styles.modalBtn, {backgroundColor: C.card2, borderWidth:1, borderColor: C.border, flex:1}]} onPress={() => setCustomPMTModalVisible(false)}>
                        <Text style={{color: C.text2, fontWeight:'600'}}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{flex:1, borderRadius:12, overflow:'hidden'}} onPress={submitCustomPMT}>
                      <LinearGradient colors={[C.brand, '#E55A00']} style={styles.modalBtn}>
                        <Text style={{color:'#FFF', fontWeight:'bold'}}>Valider</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* MODAL COLLÈGUES */}
      <Modal visible={shareModalVisible} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <LinearGradient colors={[C.hBg1, C.hBg2]} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Destinataire</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShareModalVisible(false)}>
                <Ionicons name="close" size={20} color={C.hText} />
              </TouchableOpacity>
            </LinearGradient>
            <FlatList data={contacts} keyExtractor={item => item._id} renderItem={renderContactItem} contentContainerStyle={{padding: 20}} />
        </View>
      </Modal>

      {/* MODAL SÉLECTION DOCS */}
      <Modal visible={docSelectionModal} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <LinearGradient colors={[C.hBg1, C.hBg2]} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Documents à joindre</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDocSelectionModal(false)}>
                <Ionicons name="close" size={20} color={C.hText} />
              </TouchableOpacity>
            </LinearGradient>
            <FlatList data={patientDocs} keyExtractor={item => item._id} renderItem={renderDocSelectionItem} contentContainerStyle={{padding:20}} />
            <View style={styles.actionFooter}>
                {shareTarget === 'colleague' ? (
                    <View style={{flexDirection:'row', gap:10}}>
                        <TouchableOpacity style={{flex:1, borderRadius:12, overflow:'hidden'}} onPress={handleInternalShare}>
                          <LinearGradient colors={[C.blue, '#2563EB']} style={styles.actionBtn}>
                            <Ionicons name="cloud-upload" size={18} color="#FFF" style={{marginRight:6}}/>
                            <Text style={styles.actionBtnText}>Transfert App</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={{flex:1, borderRadius:12, overflow:'hidden'}} onPress={handleSystemShare}>
                          <LinearGradient colors={[C.green, '#059669']} style={styles.actionBtn}>
                            <Ionicons name="share-outline" size={18} color="#FFF" style={{marginRight:6}}/>
                            <Text style={styles.actionBtnText}>Partager…</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={{borderRadius:12, overflow:'hidden'}} onPress={handleSystemShare}>
                      <LinearGradient colors={[C.brand, '#E55A00']} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>Générer PDF</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        </View>
      </Modal>

      {/* VISIONNEUSE */}
      <Modal visible={viewerVisible} transparent={true} animationType="fade">
        <View style={styles.viewerOverlay}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)}>
              <Ionicons name="close-circle" size={40} color="#FFF" />
            </TouchableOpacity>
            {selectedDoc && <Image source={{ uri: selectedDoc.imageData }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* SCANNER BON DE TRANSPORT */}
      <BonTransportScannerModal
        visible={btScannerVisible}
        onClose={() => setBtScannerVisible(false)}
        onPatientAdded={() => { setBtScannerVisible(false); loadPatients(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // HEADER
  header: { paddingTop: 8, paddingBottom: 20, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: C.hText, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: C.hText2, marginTop: 2 },
  scanHeaderBtn: { borderRadius: 12, overflow: 'hidden' },
  scanHeaderGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  scanHeaderText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  // SEARCH
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.hCard, borderRadius: 16,
    borderWidth: 1, borderColor: C.hBorder,
    paddingHorizontal: 16, height: 48, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.hText },

  // LIST
  listContent: { padding: 16, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, padding: 15,
    marginBottom: 10, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: C.text },
  subInfo: { fontSize: 13, color: C.text2, marginTop: 2 },

  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: C.text3, fontSize: 15 },

  // FAB
  fabWrap: {
    position: 'absolute', bottom: 30, right: 24,
    shadowColor: C.brand, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 10,
  },
  fab: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },

  // MODAL
  modalContainer: { flex: 1, backgroundColor: C.bg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 18 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.hText },
  modalSub: { fontSize: 12, color: C.hText2, marginTop: 2 },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.hCard, justifyContent: 'center', alignItems: 'center' },

  tabsContainer: { flexDirection: 'row', backgroundColor: C.card, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  tabBtn: { marginRight: 24, paddingBottom: 14, paddingTop: 14 },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: C.brand },
  tabText: { fontSize: 14, color: C.text3, fontWeight: '600' },
  tabTextActive: { color: C.brand, fontWeight: '800' },
  contentContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  tabContent: { flex: 1 },

  // PMT ALERT
  alertBox: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 18 },
  alertIconCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  alertText: { fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },

  // ANTI-FRAUDE
  antiFraudBtn: { borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  antiFraudInner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  antiFraudIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  antiFraudTitle: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  antiFraudSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },

  inputGroup: { marginBottom: 14 },
  label: { fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, fontSize: 15, color: C.text },
  saveBtnWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  saveBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 14 },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  sectionHeader: { marginTop: 24, marginBottom: 8, fontSize: 11, fontWeight: '800', color: C.text3, letterSpacing: 1.2, textTransform: 'uppercase' },
  shareBtnCollWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  shareBtnColl: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 14 },
  shareBtnPDF: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.brand, padding: 14, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 10 },
  deleteBtn: { alignItems: 'center', marginTop: 20, padding: 14 },
  deleteText: { color: C.red, fontWeight: '700', fontSize: 14 },

  // CONTACT ROWS
  contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 14, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  contactAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  contactAvatarText: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  contactName: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  sendBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },

  // DOCS
  scanGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  docCardContainer: { flex: 0.5, margin: 6 },
  docCard: { backgroundColor: C.card, padding: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, minHeight: 120,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  docIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  deleteDocBadge: { position:'absolute', top:-6, right:-6, backgroundColor: C.red, width:26, height:26, borderRadius:13, justifyContent:'center', alignItems:'center', elevation:3 },
  docTitle: { fontWeight: '700', color: C.text, fontSize: 13, textAlign:'center' },
  docDate: { fontSize: 10, color: C.text3, marginTop: 2 },

  // HISTORY
  historyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  historyDateBadge: { width: 44, height: 48, borderRadius: 12, backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  historyDateText: { fontSize: 16, fontWeight: '800', color: C.text },
  historyMonthText: { fontSize: 9, color: C.text3, fontWeight: '600', textTransform: 'uppercase' },
  historyType: { fontSize: 14, fontWeight: '700', color: C.text },
  historyLocation: { fontSize: 12, color: C.text2, marginTop: 2 },
  historyTrip: { fontSize: 9, color: C.text3, fontWeight: '600' },

  // SELECT DOCS
  selectDocRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  selectDocRowActive: { borderColor: C.brand, backgroundColor: '#FFF8F5' },
  selectDocTitle: { fontSize: 14, color: C.text2 },
  selectDocDate: { fontSize: 11, color: C.text3, marginTop: 2 },

  actionFooter: { padding: 20, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.card },
  actionBtn: { padding: 15, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // VIEWER
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },

  // PMT INPUT MODAL
  inputModalOverlay: { flex: 1, backgroundColor: 'rgba(10,15,30,0.75)', justifyContent: 'flex-end' },
  inputModalCard: { backgroundColor: C.card, padding: 28, borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center' },
  inputModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 20 },
  inputModalTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 6 },
  inputModalSub: { color: C.text2, marginBottom: 18, fontSize: 13 },
  bigNumberInput: { fontSize: 36, fontWeight: '800', borderBottomWidth: 2.5, borderBottomColor: C.brand, width: 120, textAlign: 'center', marginBottom: 14, color: C.text, paddingBottom: 6 },
  modalBtn: { paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12, minWidth: 110, alignItems: 'center', justifyContent: 'center' },
});
