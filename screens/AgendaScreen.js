import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Alert, Vibration, StatusBar, View, Text, 
  TouchableOpacity, ActivityIndicator, FlatList, Clipboard 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/fr';

// --- CONTEXTE & API ---
import { useData } from '../contexts/DataContext'; 
import api from '../services/api';

// --- COMPOSANTS UI ---
import ScreenWrapper from '../components/ScreenWrapper';
import AgendaHeader from '../components/agenda/AgendaHeader';
import AgendaList from '../components/agenda/AgendaList';
import RideOptionsModal from '../components/RideOptionsModal';

const PRIMARY_COLOR = '#FF6B00';
const TEXT_MAIN = '#111827';

export default function AgendaScreen({ navigation }) {
  const { allRides, loading, loadData } = useData();
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [showCalendar, setShowCalendar] = useState(true);
  const [activeRide, setActiveRide] = useState(null);
  const [analyzing, setAnalyzing] = useState(false); 
  const [modals, setModals] = useState({ options: false });

  // Rafraîchir les données quand on revient sur l'écran
  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [])
  );

  // --- 🪄 LOGIQUE MAGIC PASTE (REMISE À ZÉRO ET BOOSTÉE) ---
  const handleMagicPaste = async () => {
    setAnalyzing(true);
    try {
      // 1. On récupère ce que tu as copié
      const text = await Clipboard.getString();
      
      if (!text || text.trim().length < 5) {
        Vibration.vibrate(100);
        setAnalyzing(false);
        return Alert.alert("Rien à coller", "Copie d'abord un SMS ou un message de course.");
      }

      // 2. Envoi à l'IA pour analyse
      const response = await api.post('/ai/parse-ride', { text: text.trim() });
      
      // On vérifie si l'IA a trouvé une course (format objet ou tableau)
      const data = response.data.rides ? response.data.rides[0] : response.data;

      if (data && data.patientName) {
        Vibration.vibrate([0, 70, 50, 70]); // Double vibration de succès
        
        // 3. Navigation vers CreateRide avec les données
        navigation.navigate('CreateRide', { 
          importedData: data 
        });
      } else {
        throw new Error("Format non reconnu");
      }
    } catch (e) {
      Vibration.vibrate(200);
      Alert.alert("Échec de l'IA", "Je n'ai pas pu lire cette course. Vérifie ton texte et réessaie.");
    } finally {
      setAnalyzing(false);
    }
  };

  const dailyRides = useMemo(() => 
    allRides.filter(r => moment(r.date).format('YYYY-MM-DD') === selectedDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date)), 
  [allRides, selectedDate]);

  return (
    <ScreenWrapper style={{backgroundColor: '#F3F4F6'}}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER & CALENDRIER */}
      <AgendaHeader 
        selectedDate={selectedDate} 
        onDateSelect={setSelectedDate} 
        showCalendar={showCalendar} 
        toggleCalendar={() => setShowCalendar(!showCalendar)} 
      />
      
      {/* 🚀 BARRE D'OUTILS : LE RETOUR DU BOUTON MAGIQUE */}
      <View style={styles.toolbar}>
        <TouchableOpacity 
          style={[styles.magicBtn, analyzing && { opacity: 0.7 }]} 
          onPress={handleMagicPaste}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#FFF" />
              <Text style={styles.magicBtnText}>MAGIC PASTE</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.addManualBtn} 
          onPress={() => navigation.navigate('CreateRide')}
        >
          <Ionicons name="add" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      {/* LISTE DES MISSIONS */}
      <AgendaList 
        rides={dailyRides} 
        loading={loading} 
        onRefresh={() => loadData(false)} 
        onCardPress={(r) => { setActiveRide(r); setModals({ options: true }); }} 
      />

      {/* MODAL OPTIONS */}
      <RideOptionsModal 
        visible={modals.options} 
        ride={activeRide} 
        onClose={() => setModals({ options: false })} 
        onEdit={() => { 
          const rideToEdit = activeRide;
          setModals({ options: false }); 
          navigation.navigate('EditRide', { ride: rideToEdit }); 
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  toolbar: { 
    flexDirection: 'row', 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    gap: 12,
    alignItems: 'center'
  },
  magicBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: PRIMARY_COLOR, 
    height: 55, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  magicBtnText: { 
    color: '#FFF', 
    fontWeight: '900', 
    marginLeft: 10, 
    fontSize: 14,
    letterSpacing: 1
  },
  addManualBtn: { 
    width: 55, 
    height: 55, 
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2
  }
});