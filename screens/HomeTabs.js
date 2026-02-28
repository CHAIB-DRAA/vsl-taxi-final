import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, 
  ActivityIndicator, Alert, StatusBar, Platform, Dimensions 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/fr';

// --- MODULES ---
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

// --- SERVICES ---
import { getRides } from '../services/api';
import { extractSecuNumber } from '../services/ocrService';
import { calculatePrice } from '../utils/pricing'; 

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  const [stats, setStats] = useState({
    todayCount: 0,
    monthEarnings: 0,
    nextRide: null
  });

  // Salutation dynamique (Bonjour / Bonsoir)
  const getGreeting = () => {
    const hour = moment().hour();
    return hour >= 18 ? "Bonsoir," : "Bonjour,";
  };

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRides();
      
      const todayStr = moment().format('YYYY-MM-DD');
      const currentMonthStr = moment().format('MM-YYYY');
      const now = moment();

      // 1. Courses du jour
      const todayRides = data.filter(r => moment(r.date).format('YYYY-MM-DD') === todayStr);
      
      // 2. Prochaine course (Future)
      const upcoming = todayRides
        .filter(r => moment(r.date || r.startTime).isAfter(now))
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

      // 3. CA Mois (Basé sur Convention 2025)
      const finishedRidesThisMonth = data.filter(r => 
        r.status === 'Terminée' && 
        moment(r.date).format('MM-YYYY') === currentMonthStr
      );

      const totalEarnings = finishedRidesThisMonth.reduce((acc, ride) => {
        return acc + parseFloat(calculatePrice(ride)); 
      }, 0);

      setStats({
        todayCount: todayRides.length,
        monthEarnings: totalEarnings.toFixed(2),
        nextRide: upcoming
      });

    } catch (error) {
      console.error("Erreur Dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  // --- SCANNER ANTI-FRAUDE ---
  const handleAntiFraudScan = async () => {
    const processImage = async (uri) => {
      try {
        setScanning(true);
        const nir = await extractSecuNumber(uri); 
        
        if (nir) {
          await Clipboard.setStringAsync(nir);
          Alert.alert(
            "✅ NIR Copié !",
            `Numéro : ${nir}\n\nOuvrir AmeliPro maintenant ?`,
            [
              { text: "Non", style: "cancel" },
              { text: "Oui, ouvrir", onPress: () => Linking.openURL('https://professionnels.ameli.fr/') }
            ]
          );
        } else {
          Alert.alert("Info", "Aucun numéro détecté. Essayez de mieux cadrer.");
        }
      } catch (e) {
        Alert.alert("Erreur", "Analyse impossible.");
      } finally {
        setScanning(false);
      }
    };

    Alert.alert(
      "Scanner Carte Vitale",
      "Sélectionnez une méthode :",
      [
        {
          text: "📷 Appareil Photo",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status === 'granted') {
                const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 });
                if (!result.canceled) processImage(result.assets[0].uri);
            }
          }
        },
        {
          text: "🖼️ Galerie",
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status === 'granted') {
                const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 1 });
                if (!result.canceled) processImage(result.assets[0].uri);
            }
          }
        },
        { text: "Annuler", style: "cancel" }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#E65100" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDashboard} tintColor="#FFF"/>}
        showsVerticalScrollIndicator={false}
      >
        {/* === HEADER PREMIUM === */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.date}>{moment().format('dddd D MMMM')}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.avatarBtn}>
              <Ionicons name="settings-outline" size={22} color="#E65100" />
            </TouchableOpacity>
          </View>

          {/* STATS CARDS */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="speedometer-outline" size={20} color="#FFF" />
              </View>
              <View>
                <Text style={styles.statValue}>{stats.todayCount}</Text>
                <Text style={styles.statLabel}>Courses du jour</Text>
              </View>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="cash-outline" size={20} color="#FFF" />
              </View>
              <View>
                <Text style={styles.statValue}>{stats.monthEarnings} €</Text>
                <Text style={styles.statLabel}>CA Estimé</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bodyContainer}>
            
            {/* === PROCHAIN DÉPART (HERO SECTION) === */}
            <Text style={styles.sectionTitle}>Prochain Départ</Text>
            {stats.nextRide ? (
                <TouchableOpacity 
                    style={styles.nextRideCard}
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('Agenda')} 
                >
                    <View style={styles.ticketLeft}>
                        <View style={styles.timeBlock}>
                            <Text style={styles.bigTime}>{moment(stats.nextRide.date).format('HH:mm')}</Text>
                            <Text style={styles.timeLabel}>DÉPART</Text>
                        </View>
                    </View>

                    <View style={styles.ticketDivider}>
                        <View style={[styles.notch, {top: -10}]} />
                        <View style={styles.dashedLine} />
                        <View style={[styles.notch, {bottom: -10}]} />
                    </View>

                    <View style={styles.ticketRight}>
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start'}}>
                            <Text style={styles.patientName} numberOfLines={1}>{stats.nextRide.patientName}</Text>
                            <View style={[styles.typeBadge, {backgroundColor: stats.nextRide.type === 'Ambulance' ? '#FFEBEE' : '#E3F2FD'}]}>
                                <Text style={{color: stats.nextRide.type === 'Ambulance' ? '#D32F2F' : '#1565C0', fontWeight:'bold', fontSize:10}}>
                                    {stats.nextRide.type}
                                </Text>
                            </View>
                        </View>
                        
                        <View style={styles.routeMini}>
                            <View style={styles.routePoint}>
                                <View style={[styles.dot, {backgroundColor:'#4CAF50'}]}/>
                                <Text style={styles.routeText} numberOfLines={1}>{stats.nextRide.startLocation}</Text>
                            </View>
                            <View style={styles.routePoint}>
                                <View style={[styles.dot, {backgroundColor:'#FF6B00'}]}/>
                                <Text style={styles.routeText} numberOfLines={1}>{stats.nextRide.endLocation}</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            ) : (
                <View style={styles.emptyCard}>
                    <Ionicons name="checkmark-circle-outline" size={48} color="#CCC" />
                    <Text style={styles.emptyText}>Aucune course à venir aujourd'hui.</Text>
                    <Text style={styles.emptySubText}>Profitez de votre pause ! ☕</Text>
                </View>
            )}

            {/* === OUTIL SCANNER === */}
            <Text style={styles.sectionTitle}>Outils Rapides</Text>
            <TouchableOpacity 
                style={styles.scannerCard} 
                onPress={handleAntiFraudScan} 
                disabled={scanning}
                activeOpacity={0.8}
            >
                <View style={styles.scannerIconBox}>
                    {scanning ? <ActivityIndicator color="#FFF"/> : <Ionicons name="scan" size={24} color="#FFF" />}
                </View>
                <View style={{flex: 1}}>
                    <Text style={styles.scannerTitle}>Scanner Droits Ameli</Text>
                    <Text style={styles.scannerSub}>Vérification Carte Vitale / Attestation</Text>
                </View>
                <View style={styles.arrowContainer}>
                     <Ionicons name="chevron-forward" size={20} color="#2E7D32" />
                </View>
            </TouchableOpacity>

            {/* === GRILLE NAVIGATION === */}
            <View style={styles.gridMenu}>
                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Agenda')}>
                    <View style={[styles.menuIcon, {backgroundColor:'#E3F2FD'}]}><Ionicons name="calendar" size={26} color="#1565C0"/></View>
                    <Text style={styles.menuText}>Planning</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('History')}>
                    <View style={[styles.menuIcon, {backgroundColor:'#FFF3E0'}]}><Ionicons name="stats-chart" size={26} color="#EF6C00"/></View>
                    <Text style={styles.menuText}>Activité</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Patients')}>
                    <View style={[styles.menuIcon, {backgroundColor:'#E8F5E9'}]}><Ionicons name="people" size={26} color="#2E7D32"/></View>
                    <Text style={styles.menuText}>Patients</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Settings')}>
                    <View style={[styles.menuIcon, {backgroundColor:'#F3E5F5'}]}><Ionicons name="options" size={26} color="#6A1B9A"/></View>
                    <Text style={styles.menuText}>Réglages</Text>
                </TouchableOpacity>
            </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' }, // Fond très légèrement gris pour le contraste
  
  // SCROLL CONTENT : LE FIX EST ICI 👇
  scrollContent: {
    paddingBottom: 100, 
  },

  // HEADER AVANCÉ
  header: { 
    backgroundColor: '#FF6B00', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 50, 
    paddingBottom: 30, 
    borderBottomLeftRadius: 35, 
    borderBottomRightRadius: 35,
    elevation: 8,
    shadowColor: '#FF6B00', shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:8
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  greeting: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '500' },
  date: { color: '#FFF', fontSize: 24, fontWeight: '800', textTransform: 'capitalize' },
  avatarBtn: { width: 44, height: 44, backgroundColor: '#FFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  statCard: { 
    flex: 1, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 20, 
    padding: 15, 
    flexDirection: 'row', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  iconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statValue: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '500' },

  bodyContainer: { padding: 20, marginTop: -10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#333', marginBottom: 15, marginLeft: 5, marginTop: 10 },

  // NEXT RIDE CARD STYLE BILLET
  nextRideCard: { 
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, elevation: 4, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, height: 110
  },
  ticketLeft: { width: 90, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  timeBlock: { alignItems: 'center' },
  bigTime: { fontSize: 22, fontWeight: '900', color: '#333' },
  timeLabel: { fontSize: 10, color: '#999', fontWeight: 'bold', marginTop: 2 },
  
  ticketDivider: { width: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  notch: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F4F6F8', position: 'absolute', zIndex: 1 },
  dashedLine: { width: 1, height: '80%', borderLeftWidth: 1, borderLeftColor: '#DDD', borderStyle: 'dashed' },

  ticketRight: { flex: 1, padding: 15, justifyContent: 'center' },
  patientName: { fontSize: 16, fontWeight: 'bold', color: '#333', maxWidth: '75%' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  
  routeMini: { marginTop: 10 },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  routeText: { fontSize: 13, color: '#555', flex: 1 },

  emptyCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 30, alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#EEE', marginBottom: 20 },
  emptyText: { color: '#555', marginTop: 10, fontWeight: 'bold', fontSize: 16 },
  emptySubText: { color: '#999', marginTop: 5, fontSize: 13 },

  // SCANNER CARD PRO
  scannerCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F8E9', 
    padding: 12, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#C8E6C9'
  },
  scannerIconBox: { width: 44, height: 44, backgroundColor: '#2E7D32', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15, elevation: 2 },
  scannerTitle: { fontWeight: 'bold', fontSize: 15, color: '#1B5E20' },
  scannerSub: { fontSize: 12, color: '#388E3C', marginTop: 2 },
  arrowContainer: { backgroundColor: '#FFF', borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },

  // GRID MENU RECTANGLES
  gridMenu: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuItem: { 
    width: '48%', backgroundColor: '#FFF', borderRadius: 20, padding: 15, alignItems: 'center', marginBottom: 15, 
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5
  },
  menuIcon: { width: 55, height: 55, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  menuText: { fontWeight: '700', color: '#444', fontSize: 14 }
});