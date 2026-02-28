import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, Image, FlatList, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import DocumentScannerButton from '../DocumentScannerButton'; 
import moment from 'moment';

const THEME = { primary: '#FF6B00', card: '#FFFFFF', text: '#1F2937', textLight: '#9CA3AF', bg: '#F8F9FA', success: '#10B981', danger: '#EF4444', info: '#3B82F6', border: '#E5E7EB' };
const { height } = Dimensions.get('window');

// 1. MODAL FIN DE COURSE
export const FinishRideModal = ({ visible, onClose, data, setData, onConfirm }) => (
  <Modal visible={visible} animationType="fade" transparent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
      <View style={styles.bottomSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.bottomSheetTitle}>Fin de Course</Text>
        <View style={styles.inputRow}>
            <View style={{flex:1, marginRight:10}}>
                <Text style={styles.inputLabel}>KM RÉELS</Text>
                <TextInput style={styles.sheetInput} placeholder="Ex: 25" placeholderTextColor="#CCC" keyboardType="numeric" value={data.kmReel} onChangeText={t => setData({...data, kmReel: t})}/>
            </View>
            <View style={{flex:1}}>
                <Text style={styles.inputLabel}>PÉAGES (€)</Text>
                <TextInput style={styles.sheetInput} placeholder="0.00" placeholderTextColor="#CCC" keyboardType="numeric" value={data.peage} onChangeText={t => setData({...data, peage: t})}/>
            </View>
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
            <Text style={styles.confirmBtnText}>TERMINER LA COURSE</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{marginTop:15, alignSelf:'center'}}>
            <Text style={{color:THEME.textLight, fontSize: 16}}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// 2. MODAL RETOUR
export const ReturnRideModal = ({ visible, onClose, data, setData, tempDate, setTempDate, showPicker, setShowPicker, onConfirm }) => (
  <Modal visible={visible} animationType="slide" transparent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.bottomSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.bottomSheetTitle}>Planifier le Retour</Text>
            <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.timeSelectBtn}>
                <Ionicons name="time" size={24} color={THEME.primary} />
                <Text style={{fontSize:22, fontWeight:'700', marginLeft:10, color: THEME.text}}>{data.time || "--:--"}</Text>
            </TouchableOpacity>
            {showPicker && (<DateTimePicker value={tempDate} mode="time" is24Hour display="spinner" onChange={(e,d) => { setShowPicker(Platform.OS === 'ios'); if(d) { setTempDate(d); setData(p => ({...p, time: moment(d).format('HH:mm')})); } }} />)}
            <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: THEME.primary}]} onPress={onConfirm}>
                <Text style={styles.confirmBtnText}>VALIDER RETOUR</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{marginTop:15, alignSelf:'center'}}>
                <Text style={{color:THEME.textLight, fontSize: 16}}>Annuler</Text>
            </TouchableOpacity>
        </View>
    </KeyboardAvoidingView>
  </Modal>
);

// 3. MODAL PARTAGE
export const ShareModal = ({ visible, onClose, note, setNote, onWhatsApp, contacts, onShareInternal }) => (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: THEME.card }}>
      <View style={styles.modalHeader}><Text style={styles.headerTitle}>Partager</Text><TouchableOpacity onPress={onClose}><Ionicons name="close-circle" size={32} color={THEME.textLight}/></TouchableOpacity></View>
      <View style={{padding: 20, flex: 1}}>
         <TextInput style={styles.noteInput} placeholder="Ajouter une note (code, étage...)" placeholderTextColor={THEME.textLight} multiline numberOfLines={3} value={note} onChangeText={setNote} textAlignVertical="top"/>
         <TouchableOpacity style={styles.whatsappBtn} onPress={onWhatsApp}>
            <Ionicons name="logo-whatsapp" size={22} color="#FFF" style={{marginRight: 10}}/>
            <Text style={styles.whatsappText}>Envoyer par WhatsApp</Text>
         </TouchableOpacity>
         <Text style={styles.sectionTitle}>Ou via l'application :</Text>
         <FlatList 
           data={contacts || []} 
           keyExtractor={(item) => item._id} 
           renderItem={({ item }) => {
             if (!item.contactId) return null;
             return (
               <TouchableOpacity style={styles.contactRow} onPress={() => onShareInternal(item)}>
                 <View style={{flexDirection:'row', alignItems:'center'}}>
                    <View style={{width:40, height:40, borderRadius:20, backgroundColor: THEME.bg, alignItems:'center', justifyContent:'center', marginRight: 12}}>
                      <Text style={{fontWeight:'bold', color: THEME.primary}}>{item.contactId.fullName ? item.contactId.fullName.charAt(0) : '?'}</Text>
                    </View>
                    <Text style={styles.contactName}>{item.contactId.fullName}</Text>
                 </View>
                 <Ionicons name="paper-plane-outline" size={20} color={THEME.primary} />
               </TouchableOpacity>
             );
           }} 
           ListEmptyComponent={<Text style={{color:THEME.textLight, textAlign:'center', marginTop: 20}}>Aucun collègue enregistré.</Text>} 
         />
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// 4. MODAL DOCS
export const DocsModal = ({ visible, onClose, docs, loading, onScan, uploading, onGallery }) => (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <View style={styles.modalHeader}>
          <Text style={styles.headerTitle}>Dossier Médical</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close-circle" size={32} color={THEME.textLight}/></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{padding: 20}}>
          {loading ? <ActivityIndicator size="large" color={THEME.primary}/> : docs.length === 0 ? 
            <View style={styles.emptyContainer}><Ionicons name="document-text-outline" size={50} color={THEME.textLight} /><Text style={styles.emptyText}>Aucun document.</Text></View> 
            : docs.map((d, i) => (
              <View key={i} style={styles.docCard}>
                  <View style={styles.docHeader}><Text style={styles.docTitle}>{d.type}</Text><Ionicons name="checkmark-circle" size={18} color={THEME.success} /></View>
                  <Image source={{ uri: d.imageData }} style={styles.docImage} resizeMode="contain"/>
              </View>
          ))}
          <View style={styles.addDocSection}>
             <Text style={styles.sectionTitle}>Ajouter un document</Text>
             <View style={styles.scanGrid}>
                {['PMT', 'CarteVitale', 'Mutuelle'].map((type) => (
                    <View key={type} style={styles.scanColumn}>
                        <DocumentScannerButton title={type} docType={type} color={type === 'PMT' ? THEME.primary : type === 'CarteVitale' ? THEME.success : THEME.info} onScan={onScan} isLoading={uploading}/>
                        <TouchableOpacity style={styles.importBtn} onPress={() => onGallery(type)}><Text style={styles.importText}>Galerie</Text></TouchableOpacity>
                    </View>
                ))}
             </View>
          </View>
      </ScrollView>
    </View>
  </Modal>
);

// 5. MODAL CPAM CHECK
export const CpamCheckModal = ({ visible, onClose, prescriptionDate, setPrescriptionDate, showPicker, setShowPicker, rideDate, onValidate }) => (
    <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalOverlay}>
      <View style={[styles.finishCard, {backgroundColor: '#FFF'}]}>
        <View style={styles.finishHeader}>
            <Text style={[styles.finishTitle, {color: THEME.text}]}>🛡️ Vérification CPAM</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={THEME.text} /></TouchableOpacity>
        </View>
        <Text style={styles.cpamWarning}>La date de prescription doit être antérieure ou égale à la date de la course.</Text>
        <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.datePickerBtn}>
            <Ionicons name="calendar" size={20} color={THEME.primary} style={{marginRight:10}}/>
            <Text style={{fontSize:18, fontWeight:'bold', color: THEME.text}}>{moment(prescriptionDate).format('DD/MM/YYYY')}</Text>
        </TouchableOpacity>
        {showPicker && (<DateTimePicker value={prescriptionDate} mode="date" display="default" onChange={(event, date) => { if(Platform.OS === 'android') setShowPicker(false); if(date) setPrescriptionDate(date); }} />)}
        <View style={styles.comparisonRow}>
            <View><Text style={styles.compLabel}>COURSE</Text><Text style={styles.compValue}>{moment(rideDate).format('DD/MM')}</Text></View>
            <Ionicons name={moment(prescriptionDate).isAfter(moment(rideDate)) ? "alert-circle" : "arrow-forward-circle"} size={30} color={moment(prescriptionDate).isAfter(moment(rideDate)) ? THEME.danger : THEME.success} />
            <View><Text style={styles.compLabel}>PRESCRIPTION</Text><Text style={[styles.compValue, moment(prescriptionDate).isAfter(moment(rideDate)) && {color:THEME.danger}]}>{moment(prescriptionDate).format('DD/MM')}</Text></View>
        </View>
        <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: THEME.primary}]} onPress={onValidate}>
            <Text style={{color:'#FFF', fontWeight:'bold', fontSize: 16}}>VALIDER LE BT</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: THEME.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, paddingBottom: 50, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  modalHandle: { width: 50, height: 6, backgroundColor: THEME.border, borderRadius: 3, alignSelf: 'center', marginBottom: 25 },
  bottomSheetTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 30, color: THEME.text },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: THEME.textLight, marginBottom: 8, letterSpacing: 1 },
  sheetInput: { backgroundColor: THEME.bg, borderRadius: 16, padding: 18, fontSize: 20, fontWeight: '700', textAlign: 'center', color: THEME.text },
  confirmBtn: { backgroundColor: THEME.success, padding: 20, borderRadius: 20, alignItems: 'center', shadowColor: THEME.success, shadowOpacity: 0.4, shadowOffset: {width:0, height:6}, shadowRadius: 10, elevation: 6 },
  confirmBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  timeSelectBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.bg, padding: 24, borderRadius: 20, justifyContent: 'center', marginBottom: 30 },
  modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.card, borderBottomWidth: 1, borderColor: THEME.border },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  noteInput: { backgroundColor: THEME.bg, borderRadius: 16, padding: 18, height: 100, marginBottom: 20, borderWidth: 1, borderColor: THEME.border, fontSize: 16, color: THEME.text },
  whatsappBtn: { backgroundColor: '#25D366', padding: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30, elevation: 4 },
  whatsappText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.text, marginBottom: 15 },
  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1, borderColor: THEME.border },
  contactName: { fontSize: 16, fontWeight: '600', color: THEME.text },
  docCard: { backgroundColor: THEME.card, borderRadius: 20, marginBottom: 20, padding: 15, elevation: 4 },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  docTitle: { fontWeight: '700', fontSize: 16, color: THEME.text },
  docImage: { width: '100%', height: height * 0.3, borderRadius: 12, backgroundColor: THEME.bg },
  addDocSection: { marginTop: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: THEME.border },
  scanGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  scanColumn: { alignItems: 'center', width: '31%' },
  importBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: THEME.bg, borderRadius: 20 },
  importText: { fontSize: 11, color: THEME.textLight, marginLeft: 4, fontWeight: '700' },
  finishCard: { width: '85%', borderRadius: 24, padding: 25, elevation: 10, alignSelf:'center', marginTop:'50%' },
  finishHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  finishTitle: { fontSize: 20, fontWeight: '800' },
  cpamWarning: { fontSize: 14, color: THEME.textLight, marginBottom: 20, lineHeight: 22, textAlign: 'center' },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: THEME.bg, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: THEME.border },
  comparisonRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 30, backgroundColor: THEME.bg, padding: 15, borderRadius: 16 },
  compLabel: { fontSize: 10, color: THEME.textLight, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  compValue: { fontSize: 18, fontWeight: '800', color: THEME.text, textAlign: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, color: THEME.textLight, marginTop: 8 },
});