import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  StyleSheet, Alert, Vibration, StatusBar, Linking, Platform, 
  View, Text, TouchableOpacity, Modal, Animated, Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/fr';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';

// --- CONTEXTE & API ---
import { useData } from '../contexts/DataContext'; 
import api, { updateRide, shareRide, deleteRide } from '../services/api';
import { addRideToCalendar, syncBatchRides } from '../services/calendarService';

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

moment.locale('fr');

// Couleurs Modernes
const THEME_BG = '#F3F4F6'; // Gris très clair (Tailwind Gray-100) pour faire ressortir le blanc pur
const PRIMARY_COLOR = '#FF6B00';
const SURFACE_COLOR = '#FFFFFF';
const TEXT_MAIN = '#111827';
const TEXT_MUTED = '#6B7280';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export default function AgendaScreen({ navigation }) {
  const { allRides, contacts, loading, loadData, handleGlobalRespond } = useData();

  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [showCalendar, setShowCalendar] = useState(true);
  const [activeRide, setActiveRide] = useState(null);
  const [analyzing, setAnalyzing] = useState(false); 
  
  // 🚀 Animation du Bouton Flottant (FAB)
  const [isFabOpen, setIsFabOpen] = useState(false); 
  const fabAnimation = useRef(new Animated.Value(0)).current;

  const toggleFab = () => {
    const toValue = isFabOpen ? 0 : 1;
    Animated.spring(fabAnimation, {
      toValue,
      friction: 5,
      useNativeDriver: true,
    }).start();
    setIsFabOpen(!isFabOpen);
  };

  const fabRotation = fabAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg']
  });

  const fabTranslateY = fabAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0]
  });

  const fabOpacity = fabAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

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

  // SURVEILLANCE ACTIVE
  useEffect(() => {
    const subNotif = Notifications.addNotificationReceivedListener(() => loadData(false));
    const intervalId = setInterval(() => { loadData(false); }, 15000); 
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
    return docs.length === 0 ? { color: '#FEE2E2', text: 'BT MANQUANT', textColor: '#DC2626', icon: 'alert-circle' } 
                             : { color: '#DCFCE7', text: 'BT OK', textColor: '#16A34A', icon: 'checkbox' };
  };

  const markedDates = useMemo(() => { 
      const m = {}; 
      allRides.forEach(r => { 
          const d = moment(r.date).format('YYYY-MM-DD'); 
          if(!m[d]) m[d] = { dots: [] }; 
          const c = r.isShared ? '#F59E0B' : '#10B981'; 
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

  // ACTIONS (Logique métier)
  const handleAcceptWeb = async (ride) => {
    try {
      await api.post(`/rides/${ride._id}/accept-web`);
      loadData(true);
      if (ride.patientPhone) {
          const dateStr = moment(ride.date).format('DD/MM à HH:mm');
          const msg = `Bonjour ${ride.patientName}. Votre transport du ${dateStr} est CONFIRMÉ ✅.`;
          Linking.openURL(`sms:${ride.patientPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(msg)}`);
      }
    } catch (error) { Alert.alert("Erreur", "Action impossible."); }
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
                const msg = `Bonjour ${ride.patientName}. Nous ne pouvons assurer votre transport du ${dateStr} (Planning complet ❌).`;
                Linking.openURL(`sms:${ride.patientPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(msg)}`);
            }
          } catch (error) { Alert.alert("Erreur", "Action impossible."); }
      }}
    ]);
  };
  
  const handleImport = async () => {
    toggleFab();
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) return Alert.alert("Vide", "Copiez un texte (SMS).");
      setAnalyzing(true); 
      const response = await api.post('/ai/parse-ride', { text });
      let rides = Array.isArray(response.data.rides) ? response.data.rides : [response.data];
      if (rides.length > 0 && rides[0].patientName) {
          Vibration.vibrate(50);
          navigation.navigate('CreateRide', { importedData: rides[0] }); 
      } else Alert.alert("Erreur", "Extraction impossible.");
    } catch (e) { Alert.alert("Erreur", "Problème serveur."); } 
    finally { setAnalyzing(false); }
  };

  const handleStatusChange = async (r, a) => { 
    if (a === 'start') { await updateRide(r._id, { startTime: new Date().toISOString() }); Vibration.vibrate(50); loadData(true); } 
    else if (a === 'finish') { setActiveRide(r); setBillingData({ kmReel: '', peage: '' }); setFinishModal(true); } 
  };

  const confirmFinishRide = async () => { 
    if (!billingData.kmReel) return Alert.alert("Erreur", "Kilométrage requis."); 
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
      await api.post('/rides', payload); setReturnModal(false); loadData(true);
    } catch (error) { Alert.alert("Erreur", "Enregistrement impossible."); }
  };

  const handleSingleSync = async () => {
    try { await addRideToCalendar(activeRide); setModals({ ...modals, options: false }); } 
    catch (error) { Alert.alert("Erreur", "Ajout impossible."); }
  };

  const handleSendSMS = () => {
    if (!activeRide?.patientPhone) return Alert.alert("Erreur", "Aucun numéro renseigné.");
    Linking.openURL(`sms:${activeRide.patientPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(`Bonjour ${activeRide.patientName}, rappel de votre transport du ${moment(activeRide.date).format('DD/MM à HH:mm')}.`)}`);
    setModals({ ...modals, options: false });
  };

  const fetchDocs = async (ride) => {
    setLoadingDocs(true);
    try { const res = await api.get(`/documents/by-ride/${ride._id}`); setPatientDocs(res.data); setModals({ options:false, share:false, docs:true }); } 
    catch (e) { Alert.alert("Erreur", "Chargement impossible."); } finally { setLoadingDocs(false); }
  };
  
  const onScanDoc = (uri, type) => { type === 'PMT' ? (setTempScanUri(uri), setPrescriptionDate(new Date(activeRide.date)), setBtValidationModal(true)) : uploadDoc(uri, type); };
  
  const uploadDoc = async (uri, type) => {
     setUploading(true);
     try { 
       const f = new FormData(); f.append('photo', { uri, name: 'scan.jpg', type: 'image/jpeg' }); f.append('patientName', activeRide.patientName); f.append('docType', type); f.append('rideId', activeRide._id);
       await api.post('/documents/upload', f, { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: d => d }); 
       fetchDocs(activeRide); 
     } catch(e){ Alert.alert("Erreur", "Échec de l'envoi."); } finally { setUploading(false); }
  };
  
  const shareInternal = async (c) => {
    try { await shareRide(activeRide._id, c.contactId._id, shareNote); setModals({...modals, share:false}); setShareNote(''); loadData(true); }
    catch(e){ Alert.alert("Erreur", "Envoi échoué."); }
  };

  const deleteGroup = async (id) => { try { await api.delete(`/groups/${id}`); setMyGroups(prev=>prev.filter(g=>g._id!==id)); } catch(e) {} };

  return (
    <ScreenWrapper style={{backgroundColor: THEME_BG}}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME_BG} />

      <AgendaHeader selectedDate={selectedDate} onDateSelect={setSelectedDate} showCalendar={showCalendar} toggleCalendar={() => setShowCalendar(!showCalendar)} markedDates={markedDates} />
      
      <AgendaToolbar 
        onImport={() => {}} 
        analyzing={analyzing} 
        onGroupList={() => setShowGroupList(true)} 
        onSettings={() => navigation.navigate('Settings')} 
      />

      {/* 🌟 NOUVEAU DESIGN : PILLULE DU JOUR (MODERNE) */}
      <View style={styles.modernSummaryWrapper}>
        <View style={styles.modernSummaryCard}>
          <Text style={styles.modernSummaryDate}>
            {moment(selectedDate).calendar(null, {
              sameDay: '[Aujourd\'hui]',
              nextDay: '[Demain]',
              nextWeek: 'dddd DD MMM',
              lastDay: '[Hier]',
              lastWeek: 'dddd DD MMM',
              sameElse: 'DD/MM/YYYY'
            })}
          </Text>
          <View style={styles.modernBadge}>
            <Text style={styles.modernBadgeText}>{dailyRides.length} course{dailyRides.length > 1 ? 's' : ''}</Text>
          </View>
        </View>
      </View>

      {/* 🚨 POP-UP DEMANDES WEB - DESIGN MODERNE */}
      <Modal visible={pendingWebRides.length > 0} transparent={true} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modernModalContent}>
            <View style={styles.modernModalHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="flash" size={28} color={PRIMARY_COLOR} />
              </View>
              <Text style={styles.modernModalTitle}>{pendingWebRides.length} Demande{pendingWebRides.length > 1 ? 's' : ''} Web</Text>
              <Text style={styles.modernModalSubtitle}>Action requise immédiatement</Text>
            </View>

            <View style={styles.modalScrollArea}>
              {pendingWebRides.map(ride => (
                <View key={ride._id} style={styles.modernWebCard}>
                  <View style={styles.webCardTop}>
                    <Text style={styles.webPatientName}>{ride.patientName}</Text>
                    <Text style={styles.webCardDate}>{moment(ride.date).format('HH:mm')}</Text>
                  </View>
                  
                  <View style={styles.webRouteContainer}>
                    <Ionicons name="navigate-circle-outline" size={20} color={TEXT_MUTED} />
                    <View style={styles.webRouteTexts}>
                      <Text style={styles.webLocationText} numberOfLines={1}>{ride.startLocation}</Text>
                      <View style={styles.webRouteLine} />
                      <Text style={[styles.webLocationText, {fontWeight: '600'}]} numberOfLines={1}>{ride.endLocation}</Text>
                    </View>
                  </View>

                  <View style={styles.webCardActions}>
                    <TouchableOpacity onPress={() => handleRejectWeb(ride)} style={[styles.modernBtn, styles.modernBtnRefuse]}>
                      <Text style={styles.modernBtnTextRefuse}>Refuser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleAcceptWeb(ride)} style={[styles.modernBtn, styles.modernBtnAccept]}>
                      <Text style={styles.modernBtnTextAccept}>Accepter</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <AgendaList rides={dailyRides} loading={loading} onRefresh={() => loadData(false)} onCardPress={(r) => { setActiveRide(r); setModals({ ...modals, options: true }); }} onStatusChange={handleStatusChange} onSync={() => syncBatchRides(dailyRides)} onImport={handleImport} onRespond={handleGlobalRespond} getPMTStatus={getPMTStatus} />

      {/* ========================================================= */}
      {/* 🔘 BOUTON D'ACTION FLOTTANT (FAB) ANIMÉ */}
      {/* ========================================================= */}
      {isFabOpen && (
        <TouchableOpacity style={styles.fabOverlay} activeOpacity={1} onPress={toggleFab} />
      )}

      <Animated.View style={[styles.fabMenu, { opacity: fabOpacity, transform: [{ translateY: fabTranslateY }] }]}>
        <TouchableOpacity style={[styles.fabItem, { backgroundColor: '#8B5CF6' }]} onPress={handleImport}>
          <Text style={styles.fabText}>Lecture IA (Texte)</Text>
          <View style={styles.fabIconWrapper}><Ionicons name="color-wand" size={20} color="#FFF" /></View>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.fabItem, { backgroundColor: TEXT_MAIN }]} onPress={() => { toggleFab(); navigation.navigate('CreateRide'); }}>
          <Text style={styles.fabText}>Saisie Manuelle</Text>
          <View style={styles.fabIconWrapper}><Ionicons name="create" size={20} color="#FFF" /></View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.fabMain, { transform: [{ rotate: fabRotation }] }]}>
        <TouchableOpacity style={styles.fabTouchable} onPress={toggleFab} activeOpacity={0.8}>
          <Ionicons name="add" size={32} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* LAZY LOADING DES MODALS */}
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
  // --- EN TÊTE DU JOUR (Pillule Moderne) ---
  modernSummaryWrapper: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 1,
  },
  modernSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SURFACE_COLOR,
    borderRadius: 100, // Effet pillule
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  modernSummaryDate: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_MAIN,
    textTransform: 'capitalize'
  },
  modernBadge: {
    backgroundColor: '#FFF7ED', // Orange ultra léger (Tailwind Orange-50)
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5'
  },
  modernBadgeText: {
    color: PRIMARY_COLOR,
    fontWeight: '700',
    fontSize: 13
  },

  // --- POP-UP WEB MODERNE ---
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.6)', // Effet Blur assombri
    justifyContent: 'center',
    padding: 20
  },
  modernModalContent: {
    backgroundColor: SURFACE_COLOR,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modernModalHeader: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  iconCircle: {
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  modernModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_MAIN
  },
  modernModalSubtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    marginTop: 4
  },
  modalScrollArea: {
    padding: 20,
    maxHeight: 400
  },
  modernWebCard: {
    backgroundColor: SURFACE_COLOR,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  webCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  webPatientName: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_MAIN
  },
  webCardDate: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY_COLOR
  },
  webRouteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16
  },
  webRouteTexts: {
    marginLeft: 12,
    flex: 1
  },
  webLocationText: {
    fontSize: 14,
    color: TEXT_MAIN
  },
  webRouteLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6
  },
  webCardActions: {
    flexDirection: 'row',
    gap: 12
  },
  modernBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modernBtnRefuse: {
    backgroundColor: '#FEF2F2',
  },
  modernBtnTextRefuse: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15
  },
  modernBtnAccept: {
    backgroundColor: TEXT_MAIN, // Noir moderne type Uber
  },
  modernBtnTextAccept: {
    color: SURFACE_COLOR,
    fontWeight: '700',
    fontSize: 15
  },

  // --- FAB ANIMÉ ---
  fabOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)', // Overlay léger quand ouvert
    zIndex: 9
  },
  fabMain: {
    position: 'absolute', right: 24, bottom: 24,
    zIndex: 10,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabTouchable: {
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center', alignItems: 'center',
  },
  fabMenu: {
    position: 'absolute', right: 24, bottom: 100,
    alignItems: 'flex-end', gap: 16,
    zIndex: 10
  },
  fabItem: {
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  fabText: {
    color: TEXT_MAIN, fontWeight: '600', fontSize: 14,
    backgroundColor: SURFACE_COLOR,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  fabIconWrapper: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  }
});