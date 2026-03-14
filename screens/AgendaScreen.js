import React, { useState, useMemo, useEffect } from 'react';
import { 
  StyleSheet, Alert, Vibration, StatusBar, Linking, Platform, 
  View, Text, TouchableOpacity, Modal 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';

// --- CONTEXTE & API ---
import { useData } from '../contexts/DataContext'; 
import api, { updateRide, shareRide, deleteRide } from '../services/api';
import { addRideToCalendar, syncBatchRides } from '../services/calendarService';

// --- COMPOSANTS UI ---
import ScreenWrapper from '../components/ScreenWrapper';
import IncomingOfferToast from '../components/IncomingOfferToast';

// --- NOUVEAUX COMPOSANTS AGENDA (MODULAIRES) ---
import AgendaHeader from '../components/agenda/AgendaHeader';
import AgendaToolbar from '../components/agenda/AgendaToolbar';
import AgendaList from '../components/agenda/AgendaList';
import { 
  FinishRideModal, 
  ReturnRideModal, 
  ShareModal, 
  DocsModal, 
  CpamCheckModal 
} from '../components/agenda/AgendaModals';

// --- ANCIENS COMPOSANTS (Groupes & Dispatch) ---
import RideOptionsModal from '../components/RideOptionsModal';
import DispatchModal from '../components/DispatchModal'; 
import GroupCreatorModal from '../components/GroupCreatorModal'; 
import GroupListModal from '../components/GroupListModal'; 

const THEME_BG = '#F8F9FA';

export default function AgendaScreen({ navigation }) {
  // ============================================================
  // 1. DATA DU CONTEXTE & ÉTATS UI
  // ============================================================
  const { allRides, contacts, loading, loadData, handleGlobalRespond } = useData();

  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [showCalendar, setShowCalendar] = useState(true);
  const [activeRide, setActiveRide] = useState(null);
  const [analyzing, setAnalyzing] = useState(false); 
  
  // ÉTATS DES MODALS
  const [modals, setModals] = useState({ options: false, share: false, docs: false });
  const [finishModal, setFinishModal] = useState(false); 
  const [returnModal, setReturnModal] = useState(false); 
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [showGroupList, setShowGroupList] = useState(false); 
  const [editingGroup, setEditingGroup] = useState(null); 
  const [btValidationModal, setBtValidationModal] = useState(false);

  // DATA LOCALES & FORM STATES
  const [myGroups, setMyGroups] = useState([]); 
  const [patientDocs, setPatientDocs] = useState([]); 
  const [allPMTs, setAllPMTs] = useState([]); 

  const [prescriptionDate, setPrescriptionDate] = useState(new Date());
  const [showPrescriptionPicker, setShowPrescriptionPicker] = useState(false);
  const [tempScanUri, setTempScanUri] = useState(null); 
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [returnData, setReturnData] = useState({ date: '', time: '', startLocation: '', endLocation: '', type: 'Retour' });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempReturnDate, setTempReturnDate] = useState(new Date());
  const [shareNote, setShareNote] = useState(''); 
  const [billingData, setBillingData] = useState({ kmReel: '', peage: '' });

  // ============================================================
  // 2. CHARGEMENT & CALCULS (UseMemo / UseEffect)
  // ============================================================
  useEffect(() => { 
      fetchGlobalPMTs(); 
      fetchGroups(); 
  }, [allRides]); 

  const fetchGlobalPMTs = async () => { try { const res = await api.get('/documents/pmts/all'); setAllPMTs(res.data); } catch (err) {} };
  const fetchGroups = async () => { try { const res = await api.get('/groups'); setMyGroups(res.data); } catch (e) {} };
  
  const getPMTStatus = (ride) => {
    const medicalTypes = ['VSL', 'Ambulance', 'Taxi', 'Aller', 'Retour', 'Consultation'];
    if (!medicalTypes.includes(ride.type) || ride.endTime) return null;
    const docs = allPMTs.filter(d => d.patientName === ride.patientName);
    return docs.length === 0 ? { color: '#FFEBEE', text: 'BT MANQUANT', textColor: '#D32F2F', icon: 'alert-circle' } 
                             : { color: '#E8F5E9', text: 'BT OK', textColor: '#2E7D32', icon: 'checkbox' };
  };

  const markedDates = useMemo(() => { 
      const m = {}; 
      allRides.forEach(r => { 
          const d = moment(r.date).format('YYYY-MM-DD'); 
          if(!m[d]) m[d] = { dots: [] }; 
          const c = r.isShared ? '#FF9800' : '#10B981'; 
          if(!m[d].dots.find(dot => dot.color === c)) {
              m[d].dots.push({ key: r._id, color: c }); 
          }
      }); 
      m[selectedDate] = { ...(m[selectedDate] || {}), selected: true, selectedColor: '#FF6B00' }; 
      return m; 
  }, [allRides, selectedDate]);

  const dailyRides = useMemo(() => 
      allRides.filter(r => moment(r.date).format('YYYY-MM-DD') === selectedDate && (!r.isShared || r.statusPartage !== 'refused'))
      .sort((a, b) => new Date(a.date) - new Date(b.date)), 
  [allRides, selectedDate]);

  // --- FILTRE DEMANDES WEB EN ATTENTE ---
  const pendingWebRides = useMemo(() => {
    return allRides.filter(r => r.source === 'Web' && r.status === 'En attente');
  }, [allRides]);

  // 🔔 VIBRATION AUTOMATIQUE SUR NOUVELLE DEMANDE
  useEffect(() => {
    if (pendingWebRides.length > 0) {
      Vibration.vibrate([500, 500, 500]); 
    }
  }, [pendingWebRides.length]);

  // ============================================================
  // 3. LOGIQUE MÉTIER & ACTIONS
  // ============================================================

  // --- ACTIONS WEB BOOKING & SMS AUTO ---
  const handleAcceptWeb = async (ride) => {
    try {
      await api.post(`/rides/${ride._id}/accept-web`);
      loadData(true);
      
      if (ride.patientPhone) {
          const dateStr = moment(ride.date).format('DD/MM à HH:mm');
          const msg = `Bonjour ${ride.patientName}. Votre demande de transport VSL du ${dateStr} est CONFIRMÉE ✅. À très vite !`;
          const separator = Platform.OS === 'ios' ? '&' : '?';
          Linking.openURL(`sms:${ride.patientPhone}${separator}body=${encodeURIComponent(msg)}`);
      } else {
          Alert.alert("Succès", "Course acceptée (Pas de numéro de téléphone pour le SMS).");
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'accepter cette course.");
    }
  };

  const handleRejectWeb = async (ride) => {
    Alert.alert("Refuser", "Voulez-vous vraiment annuler cette demande ?", [
      { text: "Non, garder", style: "cancel" },
      { text: "Oui, Refuser", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/rides/${ride._id}/reject-web`);
            loadData(true);

            if (ride.patientPhone) {
                const dateStr = moment(ride.date).format('DD/MM à HH:mm');
                const msg = `Bonjour ${ride.patientName}. Nous ne pouvons malheureusement pas assurer votre transport VSL du ${dateStr} (Planning complet ❌). Merci de votre compréhension.`;
                const separator = Platform.OS === 'ios' ? '&' : '?';
                Linking.openURL(`sms:${ride.patientPhone}${separator}body=${encodeURIComponent(msg)}`);
            }
          } catch (error) {
            Alert.alert("Erreur", "Impossible de refuser cette course.");
          }
      }}
    ]);
  };
  
  const handleImport = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        return Alert.alert("Presse-papier vide", "Copiez d'abord un texte (SMS, WhatsApp) avant de lancer l'analyse.");
      }

      setAnalyzing(true); 
      const response = await api.post('/ai/parse-ride', { text });
      let rides = Array.isArray(response.data.rides) ? response.data.rides : [response.data];
      
      if (rides.length > 0 && rides[0].patientName) {
          Vibration.vibrate(50);
          navigation.navigate('CreateRide', { importedData: rides[0] }); 
      } else {
          Alert.alert("Erreur de lecture", "L'IA n'a pas pu extraire de course valide depuis ce texte.");
      }
    } catch (e) { 
      Alert.alert("Erreur IA", "Problème de connexion au serveur d'analyse."); 
    } finally { 
      setAnalyzing(false); 
    }
  };

  const handleStatusChange = async (r, a) => { 
    if (a === 'start') { await updateRide(r._id, { startTime: new Date().toISOString() }); Vibration.vibrate(50); loadData(true); } 
    else if (a === 'finish') { setActiveRide(r); setBillingData({ kmReel: '', peage: '' }); setFinishModal(true); } 
  };

  const confirmFinishRide = async () => { 
    if (!billingData.kmReel) return Alert.alert("Donnée manquante", "Le kilométrage réel est requis pour clôturer la course."); 
    try {
      await updateRide(activeRide._id, { endTime: new Date().toISOString(), realDistance: parseFloat(billingData.kmReel), tolls: parseFloat(billingData.peage)||0, status: 'Terminée' }); 
      setFinishModal(false); loadData(true); 
    } catch (error) { Alert.alert("Erreur", "Impossible de terminer la course."); }
  };

  const handleCreateReturnRide = async () => {
    if (!returnData.time) return Alert.alert("Erreur", "Veuillez définir une heure pour le retour.");
    try {
      const [h, m] = returnData.time.split(':');
      const payload = {
        ...activeRide,
        _id: undefined, 
        type: 'Retour',
        startLocation: returnData.startLocation,
        endLocation: returnData.endLocation,
        date: moment(returnData.date).hour(h).minute(m).toISOString(),
        startTime: null, 
        endTime: null,
        status: 'À venir',
        realDistance: 0,
        tolls: 0
      };

      await api.post('/rides', payload);
      setReturnModal(false);
      loadData(true);
      Alert.alert("Succès", "Le trajet retour a été planifié.");
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'enregistrer le retour.");
    }
  };

  const handleSyncCalendar = async () => {
    if (!dailyRides || dailyRides.length === 0) return Alert.alert("Info", "Aucune course à synchroniser pour cette journée.");
    try {
      await syncBatchRides(dailyRides);
      Alert.alert("Succès", "Planning synchronisé avec le calendrier de votre téléphone.");
    } catch (error) {
      Alert.alert("Erreur", "Synchronisation échouée. Vérifiez les permissions de l'application.");
    }
  };

  const handleSingleSync = async () => {
    try {
      await addRideToCalendar(activeRide);
      Alert.alert("Succès", "Course ajoutée à votre calendrier.");
    } catch (error) {
      Alert.alert("Erreur", "Ajout impossible. Vérifiez les permissions du calendrier.");
    } finally {
      setModals({ ...modals, options: false });
    }
  };

  const handleSendSMS = () => {
    if (!activeRide || !activeRide.patientPhone) return Alert.alert("Erreur", "Aucun numéro de téléphone renseigné pour ce patient.");
    const date = moment(activeRide.date).format('DD/MM à HH:mm');
    const msg = `Bonjour ${activeRide.patientName}, voici un rappel pour votre transport médicalisé du ${date}. Cordialement.`;
    const separator = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${activeRide.patientPhone}${separator}body=${encodeURIComponent(msg)}`);
    setModals({ ...modals, options: false });
  };

  // --- GESTION DES DOCUMENTS ---
  const fetchDocs = async (ride) => {
    if (!ride) return;
    setLoadingDocs(true);
    try { const res = await api.get(`/documents/by-ride/${ride._id}`); setPatientDocs(res.data); setModals({ options:false, share:false, docs:true }); } 
    catch (e) { Alert.alert("Erreur", "Impossible de charger le dossier médical."); } finally { setLoadingDocs(false); }
  };
  
  const onScanDoc = (uri, type) => {
     if (type === 'PMT') { setTempScanUri(uri); setPrescriptionDate(new Date(activeRide.date)); setBtValidationModal(true); }
     else uploadDoc(uri, type);
  };
  
  const uploadDoc = async (uri, type) => {
     setUploading(true);
     try { 
       const f = new FormData(); 
       f.append('photo', { uri, name: 'scan.jpg', type: 'image/jpeg' }); 
       f.append('patientName', activeRide.patientName); 
       f.append('docType', type); 
       f.append('rideId', activeRide._id);
       await api.post('/documents/upload', f, { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: d => d }); 
       Alert.alert("Succès", "Document intégré au dossier."); 
       fetchDocs(activeRide); 
     }
     catch(e){ Alert.alert("Erreur", "L'envoi du document a échoué. Vérifiez votre réseau."); } 
     finally { setUploading(false); }
  };
  
  const onGallery = async (type) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!r.canceled) onScanDoc(r.assets[0].uri, type);
  };
  
  const validateBT = () => { setBtValidationModal(false); if(tempScanUri) uploadDoc(tempScanUri, 'PMT'); };

  // --- DISPATCH & PARTAGE ---
  const shareInternal = async (c) => {
    try { await shareRide(activeRide._id, c.contactId._id, shareNote); setModals({...modals, share:false}); setShareNote(''); loadData(true); Alert.alert("Dispatch", `Course transmise à ${c.contactId.fullName}`); }
    catch(e){ Alert.alert("Erreur", "L'envoi au collègue a échoué."); }
  };
  
  const shareWhatsApp = () => {
    const msg = `📅 Course: ${moment(activeRide.date).format('DD/MM HH:mm')}\n📍 ${activeRide.startLocation} ➡️ ${activeRide.endLocation}\n📝 ${shareNote}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
  };

  const saveGroup = async (g) => {
     const p = { name: g.name, members: g.members.map(m => m.contactId?._id || m._id) };
     try {
       if(g._id) { const res = await api.put(`/groups/${g._id}`, p); setMyGroups(prev=>prev.map(x=>x._id===g._id?res.data:x)); }
       else { const res = await api.post('/groups', p); setMyGroups(prev=>[...prev, res.data]); }
       setShowGroupCreator(false); setTimeout(()=>setShowGroupList(true),300);
     } catch(e) { Alert.alert("Erreur", "Échec de l'enregistrement du groupe."); }
  };
  
  const deleteGroup = async (id) => { 
    try { await api.delete(`/groups/${id}`); setMyGroups(prev=>prev.filter(g=>g._id!==id)); }
    catch(e) { Alert.alert("Erreur", "Suppression du groupe impossible."); }
  };

  // ============================================================
  // 4. RENDU DE L'INTERFACE
  // ============================================================
  return (
    <ScreenWrapper style={{backgroundColor: THEME_BG}}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME_BG} />
      
      <AgendaHeader 
        selectedDate={selectedDate} 
        onDateSelect={setSelectedDate} 
        showCalendar={showCalendar} 
        toggleCalendar={() => setShowCalendar(!showCalendar)}
        markedDates={markedDates}
      />
      
      <AgendaToolbar 
        onImport={handleImport} 
        analyzing={analyzing} 
        onGroupList={() => setShowGroupList(true)} 
        onSettings={() => navigation.navigate('Settings')} 
      />

      {/* 🚨 POP-UP D'ALERTE PREMIER PLAN (DEMANDES WEB) */}
      <Modal
        visible={pendingWebRides.length > 0}
        transparent={true}
        animationType="slide"
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 25, overflow: 'hidden', elevation: 10 }}>
            
            <View style={{ backgroundColor: '#E65100', padding: 20, alignItems: 'center' }}>
              <Ionicons name="notifications-circle" size={50} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>
                {pendingWebRides.length} NOUVELLE(S) DEMANDE(S) !
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 5 }}>Depuis votre site internet</Text>
            </View>

            <View style={{ padding: 20, maxHeight: 400 }}>
              {pendingWebRides.map(ride => (
                <View key={ride._id} style={{ backgroundColor: '#F8F9FA', padding: 15, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#EEE' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#333' }}>{ride.patientName}</Text>
                    <View style={{ backgroundColor: '#FFE0B2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ color: '#E65100', fontWeight: 'bold', fontSize: 12 }}>{ride.type}</Text>
                    </View>
                  </View>
                  
                  <Text style={{ color: '#E65100', fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>
                    📅 {moment(ride.date).format('dddd DD MMM à HH:mm')}
                  </Text>
                  
                  <Text style={{ fontSize: 14, color: '#555', marginBottom: 5 }} numberOfLines={2}>📍 De : {ride.startLocation}</Text>
                  <Text style={{ fontSize: 14, color: '#555', marginBottom: 10 }} numberOfLines={2}>🏁 À : {ride.endLocation}</Text>

                  {ride.notes ? (
                    <Text style={{ fontSize: 13, color: '#757575', fontStyle: 'italic', marginBottom: 10 }}>📝 Note: {ride.notes}</Text>
                  ) : null}
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, gap: 10 }}>
                    <TouchableOpacity onPress={() => handleRejectWeb(ride)} style={{ paddingVertical: 12, backgroundColor: '#FFEBEE', borderRadius: 12, flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: '#D32F2F', fontWeight: 'bold', fontSize: 15 }}>Refuser (SMS)</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => handleAcceptWeb(ride)} style={{ paddingVertical: 12, backgroundColor: '#4CAF50', borderRadius: 12, flex: 1, alignItems: 'center', elevation: 2 }}>
                      <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 15 }}>Accepter (SMS)</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

          </View>
        </View>
      </Modal>

      <AgendaList 
        rides={dailyRides} 
        loading={loading} 
        onRefresh={() => loadData(false)} 
        onCardPress={(r) => { setActiveRide(r); setModals({ ...modals, options: true }); }} 
        onStatusChange={handleStatusChange}
        onSync={handleSyncCalendar} 
        onImport={handleImport}
        onRespond={handleGlobalRespond}
        getPMTStatus={getPMTStatus}
      />

      {/* --- MODAL PRINCIPALE D'OPTIONS DE COURSE --- */}
      <RideOptionsModal 
        visible={modals.options} 
        ride={activeRide} 
        onClose={() => setModals({ ...modals, options: false })}
        onEdit={() => { 
          setModals({ ...modals, options: false }); 
          setTimeout(() => navigation.navigate('CreateRide', { rideToEdit: activeRide }), 150); 
        }}
        onCreateReturn={() => { 
          setModals({ ...modals, options: false }); 
          setTimeout(() => { 
            if(activeRide) { 
              setReturnData(p => ({
                ...p, 
                startLocation: activeRide.endLocation, 
                endLocation: activeRide.startLocation, 
                date: moment(activeRide.date).format('YYYY-MM-DD')
              })); 
              setReturnModal(true); 
            }
          }, 150); 
        }}
        onAddToCalendar={handleSingleSync} 
        onShare={() => setModals({ options: false, share: true, docs: false })} 
        onOpenDocs={() => fetchDocs(activeRide)} 
        onSendSMS={handleSendSMS} 
        onDelete={async () => { 
          Alert.alert("Suppression", "Confirmez-vous la suppression de cette course ?", [
            { text: "Annuler", style: "cancel" },
            { text: "Supprimer", style: "destructive", onPress: async () => {
                await deleteRide(activeRide._id); setModals({...modals, options:false}); loadData(true);
            }}
          ]);
        }}
        onDispatch={() => { setModals({ ...modals, options: false }); setTimeout(() => setShowDispatchModal(true), 150); }}
      />

      {/* --- SOUS-MODALS & COMPOSANTS ANNEXES --- */}
      <DispatchModal visible={showDispatchModal} onClose={() => setShowDispatchModal(false)} ride={activeRide} contacts={contacts} groups={myGroups} onCreateGroup={() => { setShowDispatchModal(false); setTimeout(() => { setEditingGroup(null); setShowGroupCreator(true); }, 200); }} onSuccess={() => loadData(true)} />
      
      <GroupListModal visible={showGroupList} onClose={() => setShowGroupList(false)} groups={myGroups} onCreateNew={() => { setEditingGroup(null); setShowGroupList(false); setTimeout(() => setShowGroupCreator(true), 200); }} onEdit={(group) => { setEditingGroup(group); setShowGroupList(false); setTimeout(() => setShowGroupCreator(true), 200); }} onDelete={deleteGroup} />
      
      <GroupCreatorModal visible={showGroupCreator} groupToEdit={editingGroup} onClose={() => { setShowGroupCreator(false); setTimeout(() => setShowGroupList(true), 200); }} contacts={contacts} onSaveGroup={saveGroup} />
      
      <FinishRideModal visible={finishModal} onClose={() => setFinishModal(false)} data={billingData} setData={setBillingData} onConfirm={confirmFinishRide} />
      
      <ReturnRideModal visible={returnModal} onClose={() => setReturnModal(false)} data={returnData} setData={setReturnData} tempDate={tempReturnDate} setTempDate={setTempReturnDate} showPicker={showTimePicker} setShowPicker={setShowTimePicker} onConfirm={handleCreateReturnRide} />
      
      <ShareModal visible={modals.share} onClose={() => setModals({...modals, share: false})} note={shareNote} setNote={setShareNote} onWhatsApp={shareWhatsApp} contacts={contacts} onShareInternal={shareInternal} />
      
      <DocsModal visible={modals.docs} onClose={() => setModals({...modals, docs: false})} docs={patientDocs} loading={loadingDocs} onScan={onScanDoc} uploading={uploading} onGallery={onGallery} />
      
      <CpamCheckModal visible={btValidationModal} onClose={() => setBtValidationModal(false)} prescriptionDate={prescriptionDate} setPrescriptionDate={setPrescriptionDate} showPicker={showPrescriptionPicker} setShowPicker={setShowPrescriptionPicker} rideDate={activeRide?.date} onValidate={validateBT} />
      
      <IncomingOfferToast onRideAccepted={() => loadData(true)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME_BG }
});