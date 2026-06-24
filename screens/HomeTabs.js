import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, StatusBar, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import dayjs from 'dayjs';

import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import { extractSecuNumber } from '../services/ocrService';
import { calculatePrice } from '../utils/pricing';
import { useData } from '../contexts/DataContext';
import C from '../styles/tokens';

export default function HomeScreen({ navigation }) {
  const { allRides, loading, loadData } = useData();
  const [scanning, setScanning] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [stats, setStats] = useState({
    todayCount: 0,
    monthEarnings: 0,
    monthBilledEarnings: 0,
    nextRide: null,
  });

  const getGreeting = () => {
    const h = dayjs().hour();
    if (h < 6) return 'Bonne nuit,';
    if (h < 12) return 'Bonjour,';
    if (h < 18) return 'Bon après-midi,';
    return 'Bonsoir,';
  };

  useFocusEffect(useCallback(() => { loadData(false); }, [loadData]));

  useEffect(() => {
    if (!allRides?.length) return;
    const todayStr = dayjs().format('YYYY-MM-DD');
    const monthStr = selectedMonth.format('MM-YYYY');
    const now = dayjs();

    const todayRides = allRides.filter(r => dayjs(r.date).format('YYYY-MM-DD') === todayStr);
    const upcoming = todayRides
      .filter(r => r.status !== 'Terminée' && r.status !== 'Annulée' && dayjs(r.date).isAfter(now))
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    const monthDone = allRides.filter(r =>
      r.status === 'Terminée' && dayjs(r.date).format('MM-YYYY') === monthStr
    );
    const totalEarnings = monthDone.reduce((s, r) => s + parseFloat(calculatePrice(r)), 0);
    const billedEarnings = monthDone
      .filter(r => r.statuFacturation === 'Facturé')
      .reduce((s, r) => s + parseFloat(calculatePrice(r)), 0);

    setStats({
      todayCount: todayRides.filter(r => r.status !== 'Annulée').length,
      monthEarnings: totalEarnings.toFixed(2),
      monthBilledEarnings: billedEarnings.toFixed(2),
      nextRide: upcoming,
    });
  }, [allRides, selectedMonth]);

  // ─── Scanner Carte Vitale ────────────────────────────────────────────────
  const handleAntiFraudScan = async () => {
    const processImage = async (uri) => {
      try {
        setScanning(true);
        const nir = await extractSecuNumber(uri);
        if (nir) {
          await Clipboard.setStringAsync(nir);
          Alert.alert('NIR Copié', `${nir}\n\nOuvrir AmeliPro ?`, [
            { text: 'Non', style: 'cancel' },
            { text: 'Ouvrir', onPress: () => Linking.openURL('https://professionnels.ameli.fr/') },
          ]);
        } else {
          Alert.alert('Info', 'Aucun numéro détecté. Cadrez mieux la carte.');
        }
      } catch {
        Alert.alert('Erreur', 'Analyse impossible.');
      } finally {
        setScanning(false);
      }
    };
    Alert.alert('Scanner Carte Vitale', 'Choisir une source :', [
      { text: '📷 Appareil Photo', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status === 'granted') {
          const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 });
          if (!r.canceled) processImage(r.assets[0].uri);
        }
      }},
      { text: '🖼️ Galerie', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status === 'granted') {
          const r = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 1 });
          if (!r.canceled) processImage(r.assets[0].uri);
        }
      }},
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const goToPreviousMonth = () => setSelectedMonth(m => dayjs(m).subtract(1, 'month'));
  const goToNextMonth     = () => setSelectedMonth(m => dayjs(m).add(1, 'month'));

  // ─── Pourcentage facturé ──────────────────────────────────────────────────
  const billedPct = stats.monthEarnings > 0
    ? Math.round((stats.monthBilledEarnings / stats.monthEarnings) * 100)
    : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.hBg1} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => loadData(true)}
            tintColor={C.brand}
            colors={[C.brand]}
          />
        }
      >
        {/* ════════════════════════ HEADER GRADIENT ════════════════════════ */}
        <LinearGradient
          colors={[C.hBg1, C.hBg2, '#0D1A30']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Top row */}
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.dateText}>{dayjs().format('dddd D MMMM')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={styles.settingsBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={18} color={C.hText2} />
            </TouchableOpacity>
          </View>

          {/* ── STATS GLASS CARDS ── */}
          <View style={styles.statsRow}>

            {/* Courses du jour */}
            <View style={[styles.glassCard, { borderLeftWidth: 2, borderLeftColor: C.electric }]}>
              <View style={styles.glassCardTop}>
                <View style={[styles.glassIconBox, { backgroundColor: C.brand + '22' }]}>
                  <Ionicons name="car-sport" size={16} color={C.brand} />
                </View>
                <Text style={styles.glassLabel}>Aujourd'hui</Text>
              </View>
              <Text style={styles.glassValue}>{stats.todayCount}</Text>
              <Text style={styles.glassUnit}>courses</Text>
            </View>

            {/* CA mensuel */}
            <View style={[styles.glassCard, styles.glassCardAccent, { borderLeftWidth: 2, borderLeftColor: C.brand }]}>
              <View style={styles.glassCardTop}>
                {/* Sélecteur de mois */}
                <View style={styles.monthPicker}>
                  <TouchableOpacity onPress={goToPreviousMonth} hitSlop={{ top:8,right:8,bottom:8,left:8 }}>
                    <Ionicons name="chevron-back" size={14} color={C.hText2} />
                  </TouchableOpacity>
                  <Text style={styles.monthPickerText}>{selectedMonth.format('MMM YY')}</Text>
                  <TouchableOpacity onPress={goToNextMonth} hitSlop={{ top:8,right:8,bottom:8,left:8 }}>
                    <Ionicons name="chevron-forward" size={14} color={C.hText2} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.glassValue, { color: C.brand }]}>{stats.monthEarnings} €</Text>
              <Text style={styles.glassUnit}>CA estimé</Text>
            </View>

          </View>

          {/* ── BARRE FACTURATION ── */}
          <View style={styles.billingBar}>
            <View style={styles.billingLeft}>
              <View style={[styles.glassIconBox, { backgroundColor: C.green + '25', width: 28, height: 28, borderRadius: 8 }]}>
                <Ionicons name="checkmark-done" size={13} color={C.green} />
              </View>
              <View>
                <Text style={styles.billingLabel}>Facturé ce mois</Text>
                <Text style={styles.billingAmount}>{stats.monthBilledEarnings} €</Text>
              </View>
            </View>
            <View style={styles.billingRight}>
              <Text style={styles.billingPct}>{billedPct}%</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${billedPct}%` }]} />
              </View>
            </View>
          </View>

        </LinearGradient>

        {/* ════════════════════════ BODY ════════════════════════ */}
        <View style={styles.body}>

          {/* ── PROCHAIN DÉPART ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Prochain départ</Text>
            {stats.nextRide && (
              <TouchableOpacity onPress={() => navigation.navigate('Agenda')}>
                <Text style={styles.sectionLink}>Voir tout →</Text>
              </TouchableOpacity>
            )}
          </View>

          {stats.nextRide ? (
            <TouchableOpacity
              style={styles.nextRideCard}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('Agenda')}
            >
              {/* Bande gauche orange */}
              <LinearGradient
                colors={['#FF5500', '#FF0066']}
                style={styles.nextRideStripe}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <Text style={styles.nextRideTime}>
                  {dayjs(stats.nextRide.date).format('HH:mm')}
                </Text>
                <Text style={styles.nextRideTimeLabel}>DÉPART</Text>
              </LinearGradient>

              {/* Contenu */}
              <View style={styles.nextRideContent}>
                <View style={styles.nextRideHeader}>
                  <Text style={styles.nextRidePatient} numberOfLines={1}>
                    {stats.nextRide.patientName}
                  </Text>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>{stats.nextRide.type}</Text>
                  </View>
                </View>

                {/* Timer */}
                <Text style={styles.nextRideIn}>
                  Dans {dayjs(stats.nextRide.date).fromNow(true)}
                </Text>

                {/* Trajet */}
                <View style={styles.routeBlock}>
                  <View style={styles.routeRow}>
                    <View style={[styles.routeDot, { backgroundColor: C.green }]} />
                    <Text style={styles.routeAddr} numberOfLines={1}>{stats.nextRide.startLocation}</Text>
                  </View>
                  <View style={styles.routeConnector}>
                    <View style={styles.routeLine} />
                  </View>
                  <View style={styles.routeRow}>
                    <View style={[styles.routeDot, { backgroundColor: C.brand, borderRadius: 2 }]} />
                    <Text style={styles.routeAddr} numberOfLines={1}>{stats.nextRide.endLocation}</Text>
                  </View>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={16} color={C.text3} style={{ alignSelf: 'center', marginRight: 14 }} />
            </TouchableOpacity>
          ) : (
            <View style={styles.freeCard}>
              <LinearGradient
                colors={[C.brand + '18', C.brand + '08']}
                style={styles.freeCardInner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.freeIconWrap}>
                  <Ionicons name="sunny-outline" size={28} color={C.brand} />
                </View>
                <Text style={styles.freeTitle}>Journée libre</Text>
                <Text style={styles.freeSub}>Aucune course à venir aujourd'hui</Text>
              </LinearGradient>
            </View>
          )}

          {/* ── OUTIL SCANNER ── */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Outils</Text>
          <TouchableOpacity
            style={styles.scannerCard}
            onPress={handleAntiFraudScan}
            disabled={scanning}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={[C.green, '#0EA572']}
              style={styles.scannerGradIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {scanning
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Ionicons name="scan-outline" size={20} color="#FFF" />
              }
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.scannerTitle}>Scanner Droits Ameli</Text>
              <Text style={styles.scannerSub}>Carte Vitale · Attestation CPAM</Text>
            </View>
            <View style={styles.scannerArrow}>
              <Ionicons name="arrow-forward" size={14} color={C.green} />
            </View>
          </TouchableOpacity>

          {/* ── NAVIGATION GRID ── */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Navigation</Text>
          <View style={styles.grid}>

            <TouchableOpacity
              style={styles.gridItem}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('Agenda')}
            >
              <View style={[styles.gridIcon, { backgroundColor: C.blueDim }]}>
                <Ionicons name="calendar" size={22} color={C.blue} />
              </View>
              <Text style={styles.gridLabel}>Planning</Text>
              <Text style={styles.gridSub}>Agenda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('History')}
            >
              <View style={[styles.gridIcon, { backgroundColor: C.brandDim }]}>
                <Ionicons name="stats-chart" size={22} color={C.brand} />
              </View>
              <Text style={styles.gridLabel}>Activité</Text>
              <Text style={styles.gridSub}>Stats & CA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('Patients')}
            >
              <View style={[styles.gridIcon, { backgroundColor: C.greenDim }]}>
                <Ionicons name="people" size={22} color={C.green} />
              </View>
              <Text style={styles.gridLabel}>Patients</Text>
              <Text style={styles.gridSub}>Carnet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('Facturation')}
            >
              <View style={[styles.gridIcon, { backgroundColor: C.purpleDim }]}>
                <Ionicons name="receipt-outline" size={22} color={C.purple} />
              </View>
              <Text style={styles.gridLabel}>Facturation</Text>
              <Text style={styles.gridSub}>CPAM</Text>
            </TouchableOpacity>

          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 120 },

  // ── HEADER ──────────────────────────────────────────────────────────────
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 50,
    paddingHorizontal: 20,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    color: C.hText2,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  dateText: {
    color: C.hText,
    fontSize: 26,
    fontWeight: '800',
    textTransform: 'capitalize',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  settingsBtn: {
    width: 38, height: 38,
    borderRadius: 12,
    backgroundColor: C.hCard,
    borderWidth: 1, borderColor: C.hBorder,
    justifyContent: 'center', alignItems: 'center',
  },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  glassCard: {
    flex: 1,
    backgroundColor: C.hCard,
    borderWidth: 1, borderColor: C.hBorder,
    borderRadius: 18,
    padding: 14,
    gap: 2,
  },
  glassCardAccent: {
    borderColor: C.brand + '33',
    backgroundColor: 'rgba(255,107,0,0.06)',
  },
  glassCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  glassIconBox: {
    width: 30, height: 30,
    borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  glassLabel: { color: C.hText2, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  glassValue: { color: C.hText, fontSize: 26, fontWeight: '900', letterSpacing: -0.8 },
  glassUnit: { color: C.hText2, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Month picker
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthPickerText: { color: C.hText2, fontSize: 11, fontWeight: '700', textTransform: 'capitalize', minWidth: 44, textAlign: 'center' },

  // Billing bar
  billingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.hCard,
    borderWidth: 1, borderColor: C.hBorder,
    borderLeftWidth: 3, borderLeftColor: C.green,
    borderRadius: 16,
    padding: 12,
  },
  billingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  billingLabel: { color: C.hText2, fontSize: 11, fontWeight: '600' },
  billingAmount: { color: C.green, fontSize: 16, fontWeight: '800', marginTop: 1 },
  billingRight: { alignItems: 'flex-end', gap: 6 },
  billingPct: { color: C.hText, fontSize: 13, fontWeight: '800' },
  progressTrack: {
    width: 80, height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#00D68F',
    borderRadius: 2,
    maxWidth: '100%',
  },

  // ── BODY ──────────────────────────────────────────────────────────────────
  body: { paddingHorizontal: 18, paddingTop: 24 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17, fontWeight: '800', color: C.text,
    letterSpacing: -0.3, marginBottom: 12,
  },
  sectionLink: { fontSize: 13, fontWeight: '600', color: C.brand },

  // ── NEXT RIDE ──────────────────────────────────────────────────────────────
  nextRideCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 22,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  nextRideStripe: {
    width: 76,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 20,
  },
  nextRideTime: {
    fontSize: 22, fontWeight: '900', color: '#FFF',
    letterSpacing: -0.5,
  },
  nextRideTimeLabel: {
    fontSize: 8, color: 'rgba(255,255,255,0.75)',
    fontWeight: '800', letterSpacing: 1.5,
  },
  nextRideContent: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  nextRideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nextRidePatient: { fontSize: 16, fontWeight: '800', color: C.text, flex: 1, marginRight: 8 },
  typePill: {
    backgroundColor: C.brand + '18',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 20, borderWidth: 1, borderColor: C.brand + '33',
  },
  typePillText: { color: C.brand, fontSize: 10, fontWeight: '800' },
  nextRideIn: { fontSize: 12, color: C.electric, fontWeight: '600', marginBottom: 10 },
  routeBlock: { gap: 0 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  routeConnector: { paddingLeft: 3, paddingVertical: 2 },
  routeLine: { width: 1, height: 10, backgroundColor: C.border, marginLeft: 0 },
  routeAddr: { fontSize: 12, color: C.text2, flex: 1, fontWeight: '500' },

  // ── FREE CARD ──────────────────────────────────────────────────────────────
  freeCard: {
    borderRadius: 22,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.brand + '22',
  },
  freeCardInner: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  freeIconWrap: {
    width: 60, height: 60,
    borderRadius: 18,
    backgroundColor: C.brand + '20',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1, borderColor: C.brand + '30',
  },
  freeTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 4 },
  freeSub: { fontSize: 13, color: C.text2 },

  // ── SCANNER ──────────────────────────────────────────────────────────────
  scannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.card,
    padding: 14,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.green + '30',
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  scannerGradIcon: {
    width: 48, height: 48,
    borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  scannerTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  scannerSub: { fontSize: 12, color: C.text2, marginTop: 2 },
  scannerArrow: {
    width: 28, height: 28,
    borderRadius: 8,
    backgroundColor: C.green + '15',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.green + '25',
  },

  // ── GRID ──────────────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '47.5%',
    backgroundColor: C.card,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  gridIcon: {
    width: 50, height: 50,
    borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  gridLabel: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 2 },
  gridSub: { fontSize: 11, color: C.text3, fontWeight: '600' },
});
