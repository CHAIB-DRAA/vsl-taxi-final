import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, StatusBar, Platform
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

const C = {
  bg:     '#F2F3F7',
  card:   '#FFFFFF',
  card2:  '#F5F7FB',
  border: '#E2E5EC',
  text:   '#111827',
  text2:  '#6B7280',
  text3:  '#9CA3AF',
  brand:  '#FF6B00',
  green:  '#16A34A',
  red:    '#EF4444',
};

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  // NOUVEAU : On stocke toutes les courses en mémoire pour des calculs ultra-rapides
  const [allRides, setAllRides] = useState([]);
  
  // NOUVEAU : État pour le mois sélectionné par l'utilisateur (Par défaut: ce mois-ci)
  const [selectedMonth, setSelectedMonth] = useState(moment());

  const [stats, setStats] = useState({
    todayCount: 0,
    monthEarnings: 0,
    monthBilledEarnings: 0,
    nextRide: null
  });

  const getGreeting = () => {
    const hour = moment().hour();
    return hour >= 18 ? "Bonsoir," : "Bonjour,";
  };

  // 1. On télécharge les données depuis l'API (Seulement au chargement ou "Pull-to-refresh")
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRides();
      setAllRides(data);
    } catch (error) {
      console.error("Erreur Dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  // 2. On calcule les statistiques localement à chaque fois que tu changes de mois ou que les données arrivent
  useEffect(() => {
    if (!allRides || allRides.length === 0) return;

    const todayStr = moment().format('YYYY-MM-DD');
    const targetMonthStr = selectedMonth.format('MM-YYYY'); // On utilise le mois choisi !
    const now = moment();

    // Courses du jour (Reste toujours sur la date d'aujourd'hui)
    const todayRides = allRides.filter(r => moment(r.date).format('YYYY-MM-DD') === todayStr);
    
    // Prochaine course (Future)
    const upcoming = todayRides
      .filter(r => moment(r.date || r.startTime).isAfter(now))
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    // CA Mois (Basé sur le mois sélectionné avec les flèches)
    const finishedRidesTargetMonth = allRides.filter(r => 
      r.status === 'Terminée' && 
      moment(r.date).format('MM-YYYY') === targetMonthStr
    );

    const totalEarnings = finishedRidesTargetMonth.reduce((acc, ride) => {
      return acc + parseFloat(calculatePrice(ride)); 
    }, 0);

    const billedEarnings = finishedRidesTargetMonth.reduce((acc, ride) => {
      if (ride.statuFacturation === 'Facturé') {
        return acc + parseFloat(calculatePrice(ride));
      }
      return acc;
    }, 0);

    setStats({
      todayCount: todayRides.length,
      monthEarnings: totalEarnings.toFixed(2),
      monthBilledEarnings: billedEarnings.toFixed(2),
      nextRide: upcoming
    });

  }, [allRides, selectedMonth]); // Le calcul se refait instantanément si selectedMonth change

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

  // Fonctions pour changer le mois
  const goToPreviousMonth = () => setSelectedMonth(moment(selectedMonth).subtract(1, 'month'));
  const goToNextMonth = () => setSelectedMonth(moment(selectedMonth).add(1, 'month'));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboardData} tintColor={C.brand}/>}
        showsVerticalScrollIndicator={false}
      >
        {/* === HEADER === */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.date}>{moment().format('dddd D MMMM')}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.avatarBtn}>
              <Ionicons name="settings-outline" size={20} color={C.text2} />
            </TouchableOpacity>
          </View>

          {/* STATS CARDS */}
          <View style={styles.statsContainer}>

            {/* Courses du jour */}
            <View style={styles.statCardRow}>
              <View style={styles.statCardHalf}>
                <View style={styles.statIconBox}>
                  <Ionicons name="car-sport-outline" size={18} color={C.brand} />
                </View>
                <Text style={styles.statLabelSmall}>Aujourd'hui</Text>
                <Text style={styles.statValueLarge}>{stats.todayCount}</Text>
              </View>

              {/* Sélecteur de mois + CA */}
              <View style={styles.statCardHalf}>
                <View style={styles.monthRow}>
                  <TouchableOpacity onPress={goToPreviousMonth} hitSlop={{top:8,right:8,bottom:8,left:8}}>
                    <Ionicons name="chevron-back" size={16} color={C.text2} />
                  </TouchableOpacity>
                  <Text style={styles.monthText}>{selectedMonth.format('MMM YY')}</Text>
                  <TouchableOpacity onPress={goToNextMonth} hitSlop={{top:8,right:8,bottom:8,left:8}}>
                    <Ionicons name="chevron-forward" size={16} color={C.text2} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.statValueLarge}>{stats.monthEarnings} €</Text>
                <Text style={styles.statLabelSmall}>CA estimé</Text>
              </View>
            </View>

            {/* Déjà facturé */}
            <View style={styles.billedCard}>
              <View style={styles.statIconBox}>
                <Ionicons name="checkmark-done-circle" size={18} color={C.green} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.statLabelSmall}>Déjà facturé</Text>
                <Text style={[styles.statValueLarge, { color: C.green }]}>{stats.monthBilledEarnings} €</Text>
              </View>
            </View>

          </View>
        </View>

        <View style={styles.bodyContainer}>

            {/* === PROCHAIN DÉPART === */}
            <Text style={styles.sectionTitle}>Prochain Départ</Text>
            {stats.nextRide ? (
                <TouchableOpacity
                    style={styles.nextRideCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Agenda')}
                >
                    <View style={styles.ticketLeft}>
                        <Text style={styles.bigTime}>{moment(stats.nextRide.date).format('HH:mm')}</Text>
                        <Text style={styles.timeLabel}>DÉPART</Text>
                    </View>

                    <View style={styles.ticketDivider}>
                        <View style={styles.dashedLine} />
                    </View>

                    <View style={styles.ticketRight}>
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 10}}>
                            <Text style={styles.patientName} numberOfLines={1}>{stats.nextRide.patientName}</Text>
                            <View style={styles.typeBadge}>
                                <Text style={styles.typeBadgeText}>{stats.nextRide.type}</Text>
                            </View>
                        </View>

                        <View style={styles.routeMini}>
                            <View style={styles.routePoint}>
                                <View style={[styles.routeDot, {backgroundColor: C.green}]}/>
                                <Text style={styles.routeText} numberOfLines={1}>{stats.nextRide.startLocation}</Text>
                            </View>
                            <View style={styles.routePoint}>
                                <View style={[styles.routeDot, {backgroundColor: C.brand, borderRadius: 2}]}/>
                                <Text style={styles.routeText} numberOfLines={1}>{stats.nextRide.endLocation}</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            ) : (
                <View style={styles.emptyCard}>
                    <View style={styles.emptyCircle}>
                      <Ionicons name="checkmark-circle-outline" size={32} color={C.brand} />
                    </View>
                    <Text style={styles.emptyText}>Journée libre</Text>
                    <Text style={styles.emptySubText}>Aucune course à venir aujourd'hui</Text>
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
                    {scanning ? <ActivityIndicator color="#FFF"/> : <Ionicons name="scan" size={22} color="#FFF" />}
                </View>
                <View style={{flex: 1}}>
                    <Text style={styles.scannerTitle}>Scanner Droits Ameli</Text>
                    <Text style={styles.scannerSub}>Vérification Carte Vitale / Attestation</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.text3} />
            </TouchableOpacity>

            {/* === GRILLE NAVIGATION === */}
            <View style={styles.gridMenu}>
                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Agenda')}>
                    <View style={[styles.menuIcon, {backgroundColor: '#3B82F6'+'22'}]}>
                      <Ionicons name="calendar" size={26} color="#3B82F6"/>
                    </View>
                    <Text style={styles.menuText}>Planning</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('History')}>
                    <View style={[styles.menuIcon, {backgroundColor: C.brand+'22'}]}>
                      <Ionicons name="stats-chart" size={26} color={C.brand}/>
                    </View>
                    <Text style={styles.menuText}>Activité</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Patients')}>
                    <View style={[styles.menuIcon, {backgroundColor: C.green+'22'}]}>
                      <Ionicons name="people" size={26} color={C.green}/>
                    </View>
                    <Text style={styles.menuText}>Patients</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Settings')}>
                    <View style={[styles.menuIcon, {backgroundColor: '#8B5CF6'+'22'}]}>
                      <Ionicons name="options" size={26} color="#8B5CF6"/>
                    </View>
                    <Text style={styles.menuText}>Réglages</Text>
                </TouchableOpacity>
            </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 120 },

  // ── HEADER ──
  header: {
    backgroundColor: C.bg,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 62 : 50,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  greeting: { color: C.text2, fontSize: 14, fontWeight: '500' },
  date: { color: C.text, fontSize: 24, fontWeight: '800', textTransform: 'capitalize', letterSpacing: -0.5, marginTop: 2 },
  avatarBtn: {
    width: 40, height: 40,
    backgroundColor: C.card,
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  // ── STATS ──
  statsContainer: { gap: 10 },

  statCardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCardHalf: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  statIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.card2,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1, borderColor: C.border,
  },
  statLabelSmall: { color: C.text3, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValueLarge: { color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  monthText: { color: C.text2, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  billedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.green + '11',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.green + '33',
  },

  // ── BODY ──
  bodyContainer: { paddingHorizontal: 18, paddingTop: 24 },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: C.text,
    marginBottom: 12, marginTop: 8, letterSpacing: -0.2,
  },

  // ── NEXT RIDE CARD ──
  nextRideCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 20,
    marginBottom: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 110,
  },
  ticketLeft: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.brand + '15',
    borderRightWidth: 1,
    borderRightColor: C.border,
    gap: 4,
  },
  bigTime: { fontSize: 22, fontWeight: '900', color: C.brand },
  timeLabel: { fontSize: 8, color: C.brand + 'AA', fontWeight: '800', letterSpacing: 1.2 },
  ticketDivider: { width: 1, backgroundColor: C.border, marginVertical: 12 },
  dashedLine: { flex: 1, borderLeftWidth: 1, borderLeftColor: C.border, borderStyle: 'dashed' },
  ticketRight: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center' },
  patientName: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  typeBadge: {
    backgroundColor: C.brand + '22', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: C.brand + '44',
  },
  typeBadgeText: { color: C.brand, fontWeight: '700', fontSize: 10 },
  routeMini: { gap: 6 },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  routeDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  routeText: { fontSize: 12, color: C.text2, flex: 1 },

  // ── EMPTY ──
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: C.brand + '15',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, borderWidth: 1, borderColor: C.brand + '22',
  },
  emptyText: { color: C.text, fontWeight: '800', fontSize: 16 },
  emptySubText: { color: C.text2, marginTop: 4, fontSize: 13 },

  // ── SCANNER ──
  scannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.card,
    padding: 14,
    borderRadius: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: C.green + '33',
  },
  scannerIconBox: {
    width: 46, height: 46,
    backgroundColor: C.green,
    borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  scannerTitle: { fontWeight: '700', fontSize: 15, color: C.text },
  scannerSub: { fontSize: 12, color: C.green, marginTop: 2 },

  // ── MENU GRILLE ──
  gridMenu: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  menuItem: {
    width: '47.5%',
    backgroundColor: C.card,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  menuIcon: {
    width: 54, height: 54,
    borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  menuText: { fontWeight: '700', color: C.text, fontSize: 13 },
});