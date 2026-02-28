import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Alert, Vibration, StatusBar, Linking, Platform } from 'react-native';
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
  // 1. DATA DU CONTEXTE
  const { allRides, contacts, loading, loadData, handleGlobalRespond } = useData();

  // 2. ÉTATS UI
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [showCalendar, setShowCalendar] = useState(true);
  const [activeRide, setActiveRide] = useState(null);
  const [analyzing, setAnalyzing] = useState(false); 
  
  // 3. ÉTATS DES MODALS
  const [modals, setModals] = useState({ options: false, share: false, docs: false });
  const [finishModal, setFinishModal] = useState(false); 
  const [returnModal, setReturnModal] = useState(false); 
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [showGroupList, setShowGroupList] = useState(false); 
  const [editingGroup, setEditingGroup] = useState(null); 
  const [btValidationModal, setBtValidationModal] = useState(false);

  // 4. DATA LOCALES
  const [myGroups, setMyGroups] = useState([]); 
  const [patientDocs, setPatientDocs] = useState([]); 
  const [allPMTs, setAllPMTs] = useState([]); 

  // 5. FORM STATES
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

  // --- CHARGEMENT INITIAL ---
  useEffect(() => { 
      fetchGlobalPMTs(); 
      fetchGroups(); 
  }, [allRides]); 

  // --- API HELPERS ---
  const fetchGlobalPMTs = async () => { try { const res = await api.get('/documents/pmts/all'); setAllPMTs(res.data); } catch (err) {} };
  const fetchGroups = async () => { try { const res = await api.get('/groups'); setMyGroups(res.data); } catch (e) {} };
  
  const getPMTStatus = (ride) => {
    const medicalTypes = ['VSL', 'Ambulance', 'Taxi', 'Aller', 'Retour', 'Consultation'];
    if (!medicalTypes.includes(ride.type) || ride.endTime) return null;
    const docs = allPMTs.filter(d => d.patientName === ride.patientName);
    return docs.length === 0 ? { color: '#FFEBEE', text: 'BT MANQUANT', textColor: '#D32F2F', icon: 'alert-circle' } 
                             : { color: '#E8F5E9', text: 'BT OK', textColor: '#2E7D32', icon: 'checkbox' };
  };

  // --- CALCUL DES POINTS (DOTS) ---
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

  // --- ACTIONS LOGIQUES ---
  const handleImport = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text) return Alert.alert("Vide", "Presse-papier vide.");
    setAnalyzing(true); 
    try {
        const response = await api.post('/ai/parse-ride', { text });
        let rides = Array.isArray(response.data.rides) ? response.data.rides : [response.data];
        if (rides.length > 0) {
            Vibration.vibrate(50);
            navigation.navigate('AddRide', { importedData: rides[0] }); 
        } else Alert.alert("Erreur", "Aucune course trouvée.");
    } catch (e) { Alert.alert("Erreur IA", "Analyse échouée."); } 
    finally { setAnalyzing(false); }
  };

  const handleStatusChange = async (r, a) => { 
    if (a === 'start') { await updateRide(r._id, { startTime: new Date().toISOString() }); Vibration.vibrate(50); loadData(true); } 
    else if (a === 'finish') { setActiveRide(r); setBillingData({ kmReel: '', peage: '' }); setFinishModal(true); } 
  };

  const confirmFinishRide = async () => { 
    if (!billingData.kmReel) return Alert.alert("Oubli", "KM requis."); 
    await updateRide(activeRide._id, { endTime: new Date().toISOString(), realDistance: parseFloat(billingData.kmReel), tolls: parseFloat(billingData.peage)||0, status: 'Terminée' }); 
    setFinishModal(false); loadData(true); 
  };

  // --- LOGIQUE SMS (Nouveau) ---
  const handleSendSMS = () => {
    if (!activeRide || !activeRide.patientPhone) return Alert.alert("Erreur", "Pas de numéro de téléphone.");
    const date = moment(activeRide.date).format('DD/MM à HH:mm');
    const msg = `Bonjour ${activeRide.patientName}, rappel pour votre transport VSL du ${date}. Cordialement.`;
    const separator = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${activeRide.patientPhone}${separator}body=${encodeURIComponent(msg)}`);
    setModals({ ...modals, options: false });
  };

  // --- DOCS LOGIC ---
  const fetchDocs = async (ride) => {
    if (!ride) return;
    setLoadingDocs(true);
    try { const res = await api.get(`/documents/by-ride/${ride._id}`); setPatientDocs(res.data); setModals({ options:false, share:false, docs:true }); } 
    catch (e) { Alert.alert("Erreur", "Impossible de charger les docs."); } finally { setLoadingDocs(false); }
  };
  const onScanDoc = (uri, type) => {
     if (type === 'PMT') { setTempScanUri(uri); setPrescriptionDate(new Date(activeRide.date)); setBtValidationModal(true); }
     else uploadDoc(uri, type);
  };
  const uploadDoc = async (uri, type) => {
     setUploading(true);
     try { const f = new FormData(); f.append('photo', { uri, name: 'scan.jpg', type: 'image/jpeg' }); f.append('patientName', activeRide.patientName); f.append('docType', type); f.append('rideId', activeRide._id);
     await api.post('/documents/upload', f, { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: d => d }); Alert.alert("Succès", "Document envoyé."); fetchDocs(activeRide); }
     catch(e){ Alert.alert("Erreur upload"); } finally { setUploading(false); }
  };
  const onGallery = async (type) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!r.canceled) onScanDoc(r.assets[0].uri, type);
  };
  const validateBT = () => { setBtValidationModal(false); if(tempScanUri) uploadDoc(tempScanUri, 'PMT'); };

  // --- SHARE LOGIC ---
  const shareInternal = async (c) => {
    try { await shareRide(activeRide._id, c.contactId._id, shareNote); setModals({...modals, share:false}); setShareNote(''); loadData(true); Alert.alert("Envoyé", `À ${c.contactId.fullName}`); }
    catch(e){ Alert.alert("Erreur envoi"); }
  };
  const shareWhatsApp = () => {
    const msg = `📅 Course: ${moment(activeRide.date).format('DD/MM HH:mm')}\n📍 ${activeRide.startLocation} ➡️ ${activeRide.endLocation}\n📝 ${shareNote}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
  };

  // --- GROUPS LOGIC ---
  const saveGroup = async (g) => {
     const p = { name: g.name, members: g.members.map(m => m.contactId?._id || m._id) };
     if(g._id) { const res = await api.put(`/groups/${g._id}`, p); setMyGroups(prev=>prev.map(x=>x._id===g._id?res.data:x)); }
     else { const res = await api.post('/groups', p); setMyGroups(prev=>[...prev, res.data]); }
     setShowGroupCreator(false); setTimeout(()=>setShowGroupList(true),300);
  };
  const deleteGroup = async (id) => { await api.delete(`/groups/${id}`); setMyGroups(prev=>prev.filter(g=>g._id!==id)); };

  // ============================================================
  // RENDU
  // ============================================================
  return (
    <ScreenWrapper style={{backgroundColor: THEME_BG}}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME_BG} />
      
      {/* 1. HEADER (Avec les points calculés) */}
      <AgendaHeader 
        selectedDate={selectedDate} 
        onDateSelect={setSelectedDate} 
        showCalendar={showCalendar} 
        toggleCalendar={() => setShowCalendar(!showCalendar)}
        markedDates={markedDates}
      />
      
      {/* 2. TOOLBAR */}
      <AgendaToolbar 
        onImport={handleImport} 
        analyzing={analyzing} 
        onGroupList={() => setShowGroupList(true)} 
        onSettings={() => navigation.navigate('Settings')} 
      />

      {/* 3. LISTE DES COURSES */}
      <AgendaList 
        rides={dailyRides} 
        loading={loading} 
        onRefresh={() => loadData(false)} 
        onCardPress={(r) => { setActiveRide(r); setModals({ ...modals, options: true }); }} 
        onStatusChange={handleStatusChange}
        onSync={() => syncBatchRides(dailyRides)}
        onImport={handleImport}
        onRespond={handleGlobalRespond}
        getPMTStatus={getPMTStatus}
      />

      {/* --- MODAL PRINCIPAL D'OPTIONS --- */}
      <RideOptionsModal 
        visible={modals.options} ride={activeRide} onClose={() => setModals({ ...modals, options: false })}
        onEdit={() => { setModals({ ...modals, options: false }); setTimeout(() => navigation.navigate('AddRide', { importedData: activeRide }), 100); }}
        onCreateReturn={() => { setModals({ ...modals, options: false }); setTimeout(() => { if(activeRide) { setReturnData(p => ({...p, startLocation: activeRide.endLocation, endLocation: activeRide.startLocation, date: moment(activeRide.date).format('YYYY-MM-DD')})); setReturnModal(true); }}, 100); }}
        onAddToCalendar={() => { addRideToCalendar(activeRide); setModals({ ...modals, options: false }); }}
        // Actions séparées et SMS ajouté
        onShare={() => setModals({ options: false, share: true, docs: false })} 
        onOpenDocs={() => fetchDocs(activeRide)} 
        onSendSMS={handleSendSMS} // 👈 FONCTION SMS CONNECTÉE
        onDelete={async () => { await deleteRide(activeRide._id); setModals({...modals, options:false}); loadData(true); }}
        onDispatch={() => { setModals({ ...modals, options: false }); setTimeout(() => setShowDispatchModal(true), 100); }}
      />

      <DispatchModal visible={showDispatchModal} onClose={() => setShowDispatchModal(false)} ride={activeRide} contacts={contacts} groups={myGroups} onCreateGroup={() => { setShowDispatchModal(false); setTimeout(() => { setEditingGroup(null); setShowGroupCreator(true); }, 200); }} onSuccess={() => loadData(true)} />
      <GroupListModal visible={showGroupList} onClose={() => setShowGroupList(false)} groups={myGroups} onCreateNew={() => { setEditingGroup(null); setShowGroupList(false); setTimeout(() => setShowGroupCreator(true), 200); }} onEdit={(group) => { setEditingGroup(group); setShowGroupList(false); setTimeout(() => setShowGroupCreator(true), 200); }} onDelete={deleteGroup} />
      <GroupCreatorModal visible={showGroupCreator} groupToEdit={editingGroup} onClose={() => { setShowGroupCreator(false); setTimeout(() => setShowGroupList(true), 200); }} contacts={contacts} onSaveGroup={saveGroup} />
      
      {/* --- NOUVEAUX MODALS MODULAIRES --- */}
      <FinishRideModal visible={finishModal} onClose={() => setFinishModal(false)} data={billingData} setData={setBillingData} onConfirm={confirmFinishRide} />
      <ReturnRideModal visible={returnModal} onClose={() => setReturnModal(false)} data={returnData} setData={setReturnData} tempDate={tempReturnDate} setTempDate={setTempReturnDate} showPicker={showTimePicker} setShowPicker={setShowTimePicker} onConfirm={async () => { const [h, m] = returnData.time.split(':'); await api.post('/rides', { ...activeRide, _id: undefined, type: 'Retour', startLocation: returnData.startLocation, endLocation: returnData.endLocation, date: moment(returnData.date).hour(h).minute(m).toISOString() }); setReturnModal(false); loadData(true); }} />
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