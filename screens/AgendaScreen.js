import React, { useState, useMemo, useEffect } from 'react';
import { 
  StyleSheet, Alert, Vibration, StatusBar, Linking, Platform, 
  View, Text, TouchableOpacity, Modal 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';

// --- CONTEXTE & API ---
import { useData } from '../contexts/DataContext'; 
import api, { updateRide, shareRide, deleteRide } from '../services/api';
import { addRideToCalendar, syncBatchRides, fetchGoogleCalendarEvents } from '../services/calendarService';

// --- COMPOSANTS UI ---
import ScreenWrapper from '../components/ScreenWrapper';
import IncomingOfferToast from '../components/IncomingOfferToast';
import AgendaHeader from '../components/agenda/AgendaHeader';
import AgendaToolbar from '../components/agenda/AgendaToolbar';
import AgendaList from '../components/agenda/AgendaList';
import { 
  FinishRideModal, ReturnRideModal, ShareModal, DocsModal, CpamCheckModal 
} from '../components/agenda/AgendaModals';
import RideOptionsModal from '../components/RideOptionsModal';
import DispatchModal from '../components/DispatchModal'; 
import GroupCreatorModal from '../components/GroupCreatorModal'; 
import GroupListModal from '../components/GroupListModal'; 

const THEME_BG = '#F8F9FA';
const PRIMARY_COLOR = '#FF6B00';

// 🚀 CONFIGURATION DES NOTIFICATIONS (Premier plan)
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export default function AgendaScreen({ navigation }) {
  // ============================================================
  // 1. DATA DU CONTEXTE & ÉTATS UI
  // ============================================================
  const { allRides, contacts, loading, loadData, handleGlobalRespond } = useData();

  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [showCalendar, setShowCalendar] = useState(true);
  const [activeRide, setActiveRide] = useState(null);
  const [analyzing, setAnalyzing] = useState(false); 
  const [isFabOpen, setIsFabOpen] = useState(false); 
  
  // ÉTATS DES MODALS (Lazy Loading)
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
  // 🚀 SURVEILLANCE ACTIVE (NOTIFS & POLLING)
  // ============================================================
  useEffect(() => {
    // 1. Écouteur de notifications Push
    const subNotif = Notifications.addNotificationReceivedListener(() => loadData(false));

    // 2. Le Radar (Polling 15s) pour rester synchronisé silencieusement
    const intervalId = setInterval(() => { 
      loadData(false); 
    }, 15000); 

    return () => {
      if (subNotif) subNotif.remove();
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => { fetchGlobalPMTs(); fetchGroups(); }, [allRides]); 

  const fetchGlobalPMTs = async () => { try { const res = await api.get('/documents/pmts/all'); setAllPMTs(res.data); } catch (err) {} };
  const fetchGroups = async () => { try { const res = await api.get('/groups'); setMyGroups(res.data); } catch (e) {} };
  
  const getPMTStatus = (ride) => {
    const medicalTypes = ['VSL', 'Ambulance', 'Taxi', 'Aller', 'Retour', 'Consultation', 'HDJ', 'Hospit'];
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
          if(!m[d].dots.find(dot => dot.color === c)) m[d].dots.push({ key: r._id, color: c }); 
      }); 
      m[selectedDate] = { ...(m[selectedDate] || {}), selected: true, selectedColor: PRIMARY_COLOR }; 
      return m; 
  }, [allRides, selectedDate]);

  const dailyRides = useMemo(() => 
      allRides.filter(r => moment(r.date).format('YYYY-MM-DD') === selectedDate && (!r.isShared || r.statusPartage !== 'refused'))
      .sort((a, b) => new Date(a.date) - new Date(b.date)), 
  [allRides, selectedDate]);

  const pendingWebRides = useMemo(() => allRides.filter(r => r.source === 'Web' && r.status === 'En attente'), [allRides]);

  useEffect(() => { if (pendingWebRides.length > 0) Vibration.vibrate([500, 500, 500]); }, [pendingWebRides.length]);

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
          const msg = `Bonjour ${ride.patientName}. Votre demande de transport du ${dateStr} est CONFIRMÉE ✅. À très vite !`;
          Linking.openURL(`sms:${ride.patientPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(msg)}`);
      }
    } catch (error) { Alert.alert("Erreur", "Action impossible. Vérifiez votre connexion internet."); }
  };

  const handleRejectWeb = async (ride) => {
    Alert.alert("Refuser", "Annuler cette demande ?", [
      { text: "Non", style: "cancel" },
      { text: "Oui", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/rides/${ride._id}/reject-web`);
            loadData(true);
            if (ride.patientPhone) {
                const dateStr = moment(ride.date).format('DD/MM à HH:mm');
                const msg = `Bonjour ${ride.patientName}. Nous ne pouvons malheureusement pas assurer votre transport du ${dateStr} (Planning complet ❌).`;
                Linking.openURL(`sms:${ride.patientPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(msg)}`);
            }
          } catch (error) { Alert.alert("Erreur", "Action impossible. Vérifiez votre connexion internet."); }
      }}
    ]);
  };
  
  // --- INTELLIGENCE ARTIFICIELLE & IMPORT ---
  const handleImport = async () => {
    setIsFabOpen(false);
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) return Alert.alert("Presse-papier vide", "Copiez d'abord un texte (SMS).");
      setAnalyzing(true); 
      const response = await api.post('/ai/parse-ride', { text });
      let rides = Array.isArray(response.data.rides) ? response.data.rides : [response.data];
      if (rides.length > 0 && rides[0].patientName) {
          Vibration.vibrate(50);
          navigation.navigate('CreateRide', { importedData: rides[0] }); 
      } else Alert.alert("Erreur", "L'IA n'a pas pu extraire de course.");
    } catch (e) { Alert.alert("Erreur IA", "Problème serveur ou réseau."); } 
    finally { setAnalyzing(false); }
  };

  // 🚀 L'Aspirateur Google Agenda
  const handleMassImportFromGoogle = async () => {
    Alert.alert("Aspiration Automatique", "Importer les courses de votre Google Agenda et créer les contacts manquants ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Aspirer", onPress: async () => {
          setAnalyzing(true);
          try {
            const events = await fetchGoogleCalendarEvents(15, 15);
            if (events.length === 0) {
                setAnalyzing(false);
                return Alert.alert("Info", "Aucun événement récent trouvé dans l'agenda Google.");
            }
            
            const textToParse = events.map(e => `${moment(e.startDate).format('DD/MM HH:mm')} : ${e.title} à ${e.location || ''} - ${e.notes || ''}`).join('\n');
            const parseResponse = await api.post('/ai/parse-ride', { text: textToParse });
            let extractedRides = Array.isArray(parseResponse.data.rides) ? parseResponse.data.rides : [parseResponse.data];
            
            if (extractedRides.length === 0) {
               setAnalyzing(false);
               return Alert.alert("Erreur", "L'IA n'a pas pu comprendre les événements.");
            }

            const importResponse = await api.post('/rides/mass-import', { rides: extractedRides });
            Alert.alert("Importation terminée ✅", `${importResponse.data.addedRidesCount} courses ajoutées.\n${importResponse.data.newContactsCount} nouveaux contacts créés !`);
            loadData(true);
          } catch (error) { Alert.alert("Erreur", "L'importation a échoué. Vérifiez votre connexion."); } 
          finally { setAnalyzing(false); }
      }}
    ]);
  };

  // --- ACTIONS COURSES CLASSIQUES ---
  const handleStatusChange = async (r, a) => { 
    if (a === 'start') { await updateRide(r._id, { startTime: new Date().toISOString() }); Vibration.vibrate(50); loadData(true); } 
    else if (a === 'finish') { setActiveRide(r); setBillingData({ kmReel: '', peage: '' }); setFinishModal(true); } 
  };

  const confirmFinishRide = async () => { 
    if (!billingData.kmReel) return Alert.alert("Donnée manquante", "Le kilométrage est requis."); 
    try {
      await updateRide(activeRide._id, { endTime: new Date().toISOString(), realDistance: parseFloat(billingData.kmReel), tolls: parseFloat(billingData.peage)||0, status: 'Terminée' }); 
      setFinishModal(false); loadData(true); 
    } catch (error) { Alert.alert("Erreur", "Impossible de clôturer."); }
  };

  const handleCreateReturnRide = async () => {
    if (!returnData.time) return Alert.alert("Erreur", "Heure requise.");
    try {
      const [h, m] = returnData.time.split(':');
      const payload = { ...activeRide, _id: undefined, type: 'Retour', startLocation: returnData.startLocation, endLocation: returnData.endLocation, date: moment(returnData.date).hour(h).minute(m).toISOString(), startTime: null, endTime: null, status: 'À venir', realDistance: 0, tolls: 0 };
      await api.post('/rides', payload); setReturnModal(false); loadData(true); Alert.alert("Succès", "Retour planifié.");
    } catch (error) { Alert.alert("Erreur", "Enregistrement impossible."); }
  };

  const handleSingleSync = async () => {
    try { await addRideToCalendar(activeRide); setModals({ ...modals, options: false }); } 
    catch (error) { Alert.alert("Erreur", "Ajout impossible."); }
  };

  const handleSendSMS = () => {
    if (!activeRide?.patientPhone) return Alert.alert("Erreur", "Aucun numéro renseigné.");
    Linking.openURL(`sms:${activeRide.patientPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(`Bonjour ${activeRide.patientName}, rappel pour votre transport du ${moment(activeRide.date).format('DD/MM à HH:mm')}.`)}`);
    setModals({ ...modals, options: false });
  };

  const fetchDocs = async (ride) => {
    setLoadingDocs(true);
    try { const res = await api.get(`/documents/by-ride/${ride._id}`); setPatientDocs(res.data); setModals({ options:false, share:false, docs:true }); } 
    catch (e) { Alert.alert("Erreur", "Impossible de charger le dossier."); } finally { setLoadingDocs(false); }
  };
  
  const onScanDoc = (uri, type) => { type === 'PMT' ? (setTempScanUri(uri), setPrescriptionDate(new Date(activeRide.date)), setBtValidationModal(true)) : uploadDoc(uri, type); };
  
  const uploadDoc = async (uri, type) => {
     setUploading(true);
     try { 
       const f = new FormData(); f.append('photo', { uri, name: 'scan.jpg', type: 'image/jpeg' }); f.append('patientName', activeRide.patientName); f.append('docType', type); f.append('rideId', activeRide._id);
       await api.post('/documents/upload', f, { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: d => d }); 
       Alert.alert("Succès", "Document intégré."); fetchDocs(activeRide); 
     } catch(e){ Alert.alert("Erreur", "Échec de l'envoi."); } finally { setUploading(false); }
  };
  
  const shareInternal = async (c) => {
    try { await shareRide(activeRide._id, c.contactId._id, shareNote); setModals({...modals, share:false}); setShareNote(''); loadData(true); Alert.alert("Dispatch", `Course transmise à ${c.contactId.fullName}`); }
    catch(e){ Alert.alert("Erreur", "Envoi échoué."); }
  };

  const deleteGroup = async (id) => { try { await api.delete(`/groups/${id}`); setMyGroups(prev=>prev.filter(g=>g._id!==id)); } catch(e) {} };

  // ============================================================
  // 4. RENDU DE L'INTERFACE
  // ============================================================
  return (
    <ScreenWrapper style={{backgroundColor: THEME_BG}}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME_BG} />

      <AgendaHeader selectedDate={selectedDate} onDateSelect={setSelectedDate} showCalendar={showCalendar} toggleCalendar={() => setShowCalendar(!showCalendar)} markedDates={markedDates} />
      
      <AgendaToolbar 
        onImport={() => {}} // On l'a déplacé dans le FAB
        analyzing={analyzing} 
        onGroupList={() => setShowGroupList(true)} 
        onSettings={() => navigation.navigate('Settings')} 
      />

      {/* 🚀 LE GROS BOUTON ASPIRATEUR GOOGLE AGENDA */}
      <TouchableOpacity 
        onPress={handleMassImportFromGoogle}
        style={{
          backgroundColor: '#4CAF50',
          marginHorizontal: 20,
          marginTop: 10,
          marginBottom: 10,
          padding: 15,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 2
        }}
      >
        <Ionicons name="calendar-sync-outline" size={24} color="#FFF" />
        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 10 }}>
          {analyzing ? "Aspiration en cours..." : "Aspirer Google Agenda"}
        </Text>
      </TouchableOpacity>

      {/* 🚨 POP-UP DEMANDES WEB */}
      <Modal visible={pendingWebRides.length > 0} transparent={true} animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 25, overflow: 'hidden', elevation: 10 }}>
            <View style={{ backgroundColor: PRIMARY_COLOR, padding: 20, alignItems: 'center' }}>
              <Ionicons name="notifications-circle" size={50} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 10 }}>{pendingWebRides.length} NOUVELLE(S) DEMANDE(S)</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Site internet</Text>
            </View>
            <View style={{ padding: 20, maxHeight: 400 }}>
              {pendingWebRides.map(ride => (
                <View key={ride._id} style={{ backgroundColor: '#F8F9FA', padding: 15, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#EEE' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#333' }}>{ride.patientName}</Text>
                  <Text style={{ color: PRIMARY_COLOR, fontSize: 15, fontWeight: 'bold', marginVertical: 8 }}>📅 {moment(ride.date).format('dddd DD MMM à HH:mm')}</Text>
                  <Text style={{ fontSize: 14, color: '#555' }}>📍 {ride.startLocation}</Text>
                  <Text style={{ fontSize: 14, color: '#555', marginBottom: 10 }}>🏁 {ride.endLocation}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={() => handleRejectWeb(ride)} style={{ paddingVertical: 12, backgroundColor: '#FFEBEE', borderRadius: 12, flex: 1, alignItems: 'center' }}><Text style={{ color: '#D32F2F', fontWeight: 'bold' }}>Refuser</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleAcceptWeb(ride)} style={{ paddingVertical: 12, backgroundColor: '#4CAF50', borderRadius: 12, flex: 1, alignItems: 'center' }}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>Accepter</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <AgendaList rides={dailyRides} loading={loading} onRefresh={() => loadData(false)} onCardPress={(r) => { setActiveRide(r); setModals({ ...modals, options: true }); }} onStatusChange={handleStatusChange} onSync={() => syncBatchRides(dailyRides)} onImport={handleImport} onRespond={handleGlobalRespond} getPMTStatus={getPMTStatus} />

      {/* ========================================================= */}
      {/* 🔘 BOUTON D'ACTION FLOTTANT (HUB) */}
      {/* ========================================================= */}
      {isFabOpen && (
        <View style={styles.fabMenu}>
          <TouchableOpacity style={[styles.fabItem, { backgroundColor: '#9C27B0' }]} onPress={handleImport}>
            <Ionicons name="color-wand-outline" size={24} color="#FFF" />
            <Text style={styles.fabText}>Magic Paste (Texte)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fabItem, { backgroundColor: PRIMARY_COLOR }]} onPress={() => { setIsFabOpen(false); navigation.navigate('CreateRide'); }}>
            <Ionicons name="add-circle-outline" size={24} color="#FFF" />
            <Text style={styles.fabText}>Saisie Manuelle</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.fabMain} onPress={() => setIsFabOpen(!isFabOpen)}>
        <Ionicons name={isFabOpen ? "close" : "add"} size={32} color="#FFF" />
      </TouchableOpacity>

      {/* ========================================================= */}
      {/* ⚡ LAZY LOADING DES MODALS (Performances) */}
      {/* ========================================================= */}
      {modals.options && <RideOptionsModal visible={modals.options} ride={activeRide} onClose={() => setModals({ ...modals, options: false })} onEdit={() => { setModals({ ...modals, options: false }); setTimeout(() => navigation.navigate('CreateRide', { rideToEdit: activeRide }), 150); }} onCreateReturn={() => { setModals({ ...modals, options: false }); setTimeout(() => { if(activeRide) { setReturnData(p => ({ ...p, startLocation: activeRide.endLocation, endLocation: activeRide.startLocation, date: moment(activeRide.date).format('YYYY-MM-DD') })); setReturnModal(true); } }, 150); }} onAddToCalendar={handleSingleSync} onShare={() => setModals({ options: false, share: true, docs: false })} onOpenDocs={() => fetchDocs(activeRide)} onSendSMS={handleSendSMS} onDelete={async () => { Alert.alert("Suppression", "Confirmer ?", [{ text: "Annuler", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: async () => { await deleteRide(activeRide._id); setModals({...modals, options:false}); loadData(true); }}]); }} onDispatch={() => { setModals({ ...modals, options: false }); setTimeout(() => setShowDispatchModal(true), 150); }} />}
      
      {showDispatchModal && <DispatchModal visible={showDispatchModal} onClose={() => setShowDispatchModal(false)} ride={activeRide} contacts={contacts} groups={myGroups} onCreateGroup={() => { setShowDispatchModal(false); setTimeout(() => { setEditingGroup(null); setShowGroupCreator(true); }, 200); }} onSuccess={() => loadData(true)} />}
      {showGroupList && <GroupListModal visible={showGroupList} onClose={() => setShowGroupList(false)} groups={myGroups} onCreateNew={() => { setEditingGroup(null); setShowGroupList(false); setTimeout(() => setShowGroupCreator(true), 200); }} onEdit={(group) => { setEditingGroup(group); setShowGroupList(false); setTimeout(() => setShowGroupCreator(true), 200); }} onDelete={deleteGroup} />}
      {finishModal && <FinishRideModal visible={finishModal} onClose={() => setFinishModal(false)} data={billingData} setData={setBillingData} onConfirm={confirmFinishRide} />}
      {returnModal && <ReturnRideModal visible={returnModal} onClose={() => setReturnModal(false)} data={returnData} setData={setReturnData} tempDate={tempReturnDate} setTempDate={setTempReturnDate} showPicker={showTimePicker} setShowPicker={setShowTimePicker} onConfirm={handleCreateReturnRide} />}
      {modals.share && <ShareModal visible={modals.share} onClose={() => setModals({...modals, share: false})} note={shareNote} setNote={setShareNote} onWhatsApp={() => Linking.openURL(`whatsapp://send?text=${encodeURIComponent(`📅 Course: ${moment(activeRide.date).format('DD/MM HH:mm')}\n📍 ${activeRide.startLocation} ➡️ ${activeRide.endLocation}`)}`)} contacts={contacts} onShareInternal={shareInternal} />}
      {modals.docs && <DocsModal visible={modals.docs} onClose={() => setModals({...modals, docs: false})} docs={patientDocs} loading={loadingDocs} onScan={onScanDoc} uploading={uploading} />}
      {btValidationModal && <CpamCheckModal visible={btValidationModal} onClose={() => setBtValidationModal(false)} prescriptionDate={prescriptionDate} setPrescriptionDate={setPrescriptionDate} showPicker={showPrescriptionPicker} setShowPicker={setShowPrescriptionPicker} rideDate={activeRide?.date} onValidate={validateBT} />}
      
      <IncomingOfferToast onRideAccepted={() => loadData(true)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  fabMain: {
    position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30,
    backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  fabMenu: {
    position: 'absolute', right: 20, bottom: 90, alignItems: 'flex-end', gap: 15,
  },
  fabItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 25, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3,
  },
  fabText: {
    color: '#FFF', fontWeight: 'bold', marginLeft: 10, fontSize: 14,
  }
});