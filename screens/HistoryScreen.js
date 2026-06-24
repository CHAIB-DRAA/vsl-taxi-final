import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, TextInput, StatusBar, Platform, RefreshControl, Modal, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import api, { getRides, updateRide } from '../services/api';
import { calculatePrice } from '../utils/pricing';
import C from '../styles/tokens';

// Import des nouveaux sous-composants
import RideHistoryCard from '../components/RideHistoryCard';
import RideDetailsModal from '../components/RideDetailsModal';


export default function HistoryScreen() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [currentDate, setCurrentDate] = useState(dayjs());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedRide, setSelectedRide] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- ÉTATS POUR L'AUDIT INTELLIGENT ---
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditProposals, setAuditProposals] = useState([]);
  const [isAuditing, setIsAuditing] = useState(false);

  // --- FOCUS SEARCH & ERROR STATE ---
  const [focusSearch, setFocusSearch] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // --- EFFET DEBOUNCE (Performance) ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchText]);

  // --- CHARGEMENT ---
  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setLoadError(false);
    try {
      const allRides = await getRides();
      const history = allRides.filter(r => r.status === 'Terminée');
      history.sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date));
      setRides(history);
    } catch(e) { console.error("Erreur historique:", e); setLoadError(true); }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // --- LOGIQUE MÉTIER ---
  const conflictingRideIds = useMemo(() => {
    const conflicts = new Set();
    const sortedRides = [...rides].sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date));

    for (let i = 0; i < sortedRides.length - 1; i++) {
      const currentRide = sortedRides[i];
      const nextRide = sortedRides[i + 1];

      if (dayjs(currentRide.date).isSame(dayjs(nextRide.date), 'day')) {
          if (currentRide.endTime && (nextRide.startTime || nextRide.date)) {
            const endCurrent = dayjs(currentRide.endTime);
            const startNext = dayjs(nextRide.startTime || nextRide.date);
            const diffMinutes = startNext.diff(endCurrent, 'minute');

            if (diffMinutes < 10 && diffMinutes >= 0) {
              conflicts.add(currentRide._id);
              conflicts.add(nextRide._id);
            }
          }
      }
    }
    return conflicts;
  }, [rides]);

  const filteredRides = useMemo(() => {
    return rides.filter(r => {
      if (debouncedSearch.trim().length === 0) {
        return dayjs(r.date).isSame(currentDate, 'day');
      }
      const query = debouncedSearch.toLowerCase();
      return (
        (r.patientName && r.patientName.toLowerCase().includes(query)) ||
        (r.startLocation && r.startLocation.toLowerCase().includes(query)) ||
        (r.endLocation && r.endLocation.toLowerCase().includes(query))
      );
    });
  }, [rides, currentDate, debouncedSearch]);

  const stats = useMemo(() => {
    return filteredRides.reduce((acc, curr) => {
        const estimatedPrice = parseFloat(calculatePrice(curr));
        return { km: acc.km + (curr.realDistance || curr.distance || 0), ca: acc.ca + estimatedPrice, count: acc.count + 1 };
    }, { km: 0, ca: 0, count: 0 });
  }, [filteredRides]);

  // Statistiques globales (toutes courses terminées)
  const globalStats = useMemo(() => {
    return rides.reduce((acc, curr) => {
      const p = parseFloat(calculatePrice(curr));
      return { total: acc.total + 1, ca: acc.ca + p };
    }, { total: 0, ca: 0 });
  }, [rides]);

  // =========================================================================
  // --- L'ALGORITHME DE LISSAGE STRICT (Séquençage absolu pour la CPAM) ---
  // =========================================================================
  const runSmartAudit = async () => {
    if (filteredRides.length === 0) return Alert.alert("Info", "Aucune course terminée à analyser.");

    setIsAuditing(true);
    setShowAuditModal(true);

    try {
      let proposals = [];
      let sortedRides = [...filteredRides].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      // 1. Outil de géocodage silencieux
      const getCoords = async (address) => {
        try {
          const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address + ", France")}&limit=1`);
          const data = await res.json();
          if (data?.features?.length > 0) return { lon: data.features[0].geometry.coordinates[0], lat: data.features[0].geometry.coordinates[1] };
        } catch(e) {}
        return null;
      };

      for (let i = 0; i < sortedRides.length; i++) {
        let ride = sortedRides[i];

        let origDuration = dayjs(ride.endTime).diff(dayjs(ride.startTime), 'minute');
        if (origDuration <= 0 || isNaN(origDuration)) origDuration = 15;

        let proposedStartTime = dayjs(ride.startTime);
        let proposedEndTime = dayjs(ride.endTime);
        let isOverlap = false;
        let approachMinutes = 0;

        if (i > 0) {
          const prevRide = proposals[i - 1];
          const prevEndTime = dayjs(prevRide.proposedEndTime);

          const prevEndLoc = (prevRide.endLocation || "").trim().toLowerCase();
          const currStartLoc = (ride.startLocation || "").trim().toLowerCase();

          if (prevEndLoc === currStartLoc || currStartLoc.includes(prevEndLoc) || prevEndLoc.includes(currStartLoc)) {
            approachMinutes = 0;
          } else {
            approachMinutes = 15;

            const startC = await getCoords(prevRide.endLocation);
            const endC = await getCoords(ride.startLocation);

            if (startC && endC) {
              try {
                const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startC.lon},${startC.lat};${endC.lon},${endC.lat}?overview=false`;
                const routeRes = await fetch(osrmUrl);
                const routeData = await routeRes.json();
                if (routeData.code === "Ok" && routeData.routes.length > 0) {
                  let calcMins = Math.ceil(routeData.routes[0].duration / 60);
                  if (calcMins > 0 && calcMins <= 45) approachMinutes = calcMins;
                }
              } catch(e) {}
            }
          }

          const earliestPossibleStart = prevEndTime.add(approachMinutes, 'minute');

          if (proposedStartTime.isBefore(earliestPossibleStart)) {
            isOverlap = true;
            proposedStartTime = earliestPossibleStart;
            proposedEndTime = proposedStartTime.add(origDuration, 'minute');
          }
        }

        proposals.push({
          ...ride,
          proposedStartTime: proposedStartTime.toISOString(),
          proposedEndTime: proposedEndTime.toISOString(),
          hasConflict: isOverlap,
          theoreticalMinutes: origDuration,
          approachMinutes
        });
      }

      setAuditProposals(proposals);
    } catch (e) {
      Alert.alert("Erreur", "L'audit intelligent a échoué.");
      setShowAuditModal(false);
    } finally {
      setIsAuditing(false);
    }
  };

  const applyAuditCorrections = async () => {
    setLoading(true);
    try {
      for (const prop of auditProposals) {
        if (prop.startTime !== prop.proposedStartTime || prop.endTime !== prop.proposedEndTime) {
          await updateRide(prop._id, {
            startTime: prop.proposedStartTime,
            endTime: prop.proposedEndTime
          });
        }
      }
      Alert.alert("Succès", "Le planning a été lissé et mis aux normes CPAM !");
      setShowAuditModal(false);
      loadHistory();
    } catch (e) {
      Alert.alert("Erreur", "La sauvegarde des corrections a échoué.");
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS STANDARDS ---
  const generateCSV = async () => {
    if (filteredRides.length === 0) return Alert.alert("Info", "Rien à exporter.");
    try {
      let csvContent = "Date;Patient;Type;Départ;Arrivée;Km;Péages;Prix Convention 2025 (€);Facturé;Origine\n";
      filteredRides.forEach(ride => {
        const price = calculatePrice(ride);
        const origin = ride.isShared ? `Partagé par ${ride.sharedByName || 'Collègue'}` : 'Perso';
        const typeCourse = ride.type || 'Standard';
        csvContent += `${dayjs(ride.date).format('DD/MM/YYYY')};${ride.patientName};${typeCourse};${ride.startLocation};${ride.endLocation};${ride.realDistance};${ride.tolls};${price};${ride.statuFacturation};${origin}\n`;
      });

      const fileName = debouncedSearch.trim().length > 0 ? 'Recherche_Globale' : currentDate.format('DD_MM_YYYY');
      const fileUri = FileSystem.cacheDirectory + `Facturation_${fileName}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, '﻿' + csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exporter Excel' });
    } catch (error) { Alert.alert("Erreur", "Export impossible."); }
  };

  const handleSaveEdit = async (rideToEdit, editData) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const updates = {
        realDistance: parseFloat(editData.realDistance) || 0,
        tolls: parseFloat(editData.tolls) || 0
      };

      if (editData.startTime.includes(':')) {
        const [h, m] = editData.startTime.split(':');
        updates.startTime = dayjs(rideToEdit.date).hour(parseInt(h)).minute(parseInt(m)).toISOString();
      }

      if (editData.endTime.includes(':')) {
        const [h, m] = editData.endTime.split(':');
        updates.endTime = dayjs(rideToEdit.date).hour(parseInt(h)).minute(parseInt(m)).toISOString();
      }

      const tempRide = { ...rideToEdit, ...updates };
      updates.price = parseFloat(calculatePrice(tempRide));

      await updateRide(rideToEdit._id, updates);

      const finalRide = { ...rideToEdit, ...updates };
      setSelectedRide(finalRide);
      setRides(prev =>
        prev.map(r => r._id === finalRide._id ? finalRide : r)
          .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date))
      );

      Alert.alert("Succès", `Mise à jour réussie !\nNouveau Prix : ${updates.price} €`);
    } catch (err) {
      Alert.alert("Erreur", "Mise à jour échouée.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRide = (id) => {
    Alert.alert("Supprimer ?", "Irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
          await api.delete(`/rides/${id}`);
          setSelectedRide(null);
          loadHistory();
      }}
    ]);
  };

  const handleToggleBilling = async (ride) => {
    try {
     const newStatus = ride.statuFacturation === 'Facturé' ? 'Non facturé' : 'Facturé';
     setRides(prev => prev.map(r => r._id === ride._id ? { ...r, statuFacturation: newStatus } : r));
     if (selectedRide && selectedRide._id === ride._id) setSelectedRide({ ...selectedRide, statuFacturation: newStatus });
     await updateRide(ride._id, { statuFacturation: newStatus });
   } catch (err) { Alert.alert("Erreur", "Impossible."); loadHistory(); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.hBg1} />

      {/* ── HEADER GRADIENT SOMBRE ── */}
      <LinearGradient
        colors={[C.hBg1, C.hBg2, '#0D1A30']}
        style={styles.header}
      >
        {/* Titre + actions */}
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Historique</Text>
            <Text style={styles.headerDate}>
              {debouncedSearch.length > 0
                ? 'Recherche globale'
                : currentDate.format('dddd D MMMM').replace(/^./, s => s.toUpperCase())}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={runSmartAudit}>
              <Ionicons name="color-wand-outline" size={16} color={C.brand} />
              <Text style={styles.headerBtnText}>Lissage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={generateCSV}>
              <Ionicons name="download-outline" size={16} color={C.brand} />
              <Text style={styles.headerBtnText}>CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sélecteur de jour */}
        <View style={styles.daySelector}>
          <TouchableOpacity
            onPress={() => setCurrentDate(currentDate.subtract(1, 'day'))}
            style={styles.daySelectorArrow}
          >
            <Ionicons name="chevron-back" size={22} color={C.hText} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={styles.daySelectorBtn}
          >
            <Ionicons name="calendar-outline" size={15} color={C.brand} style={{ marginRight: 8 }} />
            <Text style={styles.daySelectorText}>
              {currentDate.format('dddd DD MMMM').replace(/^./, s => s.toUpperCase())}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCurrentDate(currentDate.add(1, 'day'))}
            style={styles.daySelectorArrow}
          >
            <Ionicons name="chevron-forward" size={22} color={C.hText} />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={currentDate.toDate()}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setCurrentDate(dayjs(date));
            }}
          />
        )}

        {/* Stats du jour */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <LinearGradient colors={[C.brand, '#E55A00']} style={styles.statIcon}>
              <Ionicons name="car-outline" size={14} color="#FFF" />
            </LinearGradient>
            <View>
              <Text style={styles.statValue}>{stats.count}</Text>
              <Text style={styles.statLabel}>COURSES</Text>
            </View>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <LinearGradient colors={[C.blue, '#2563EB']} style={styles.statIcon}>
              <Ionicons name="navigate-outline" size={14} color="#FFF" />
            </LinearGradient>
            <View>
              <Text style={styles.statValue}>{stats.km}</Text>
              <Text style={styles.statLabel}>KM</Text>
            </View>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <LinearGradient colors={[C.green, '#00B87A']} style={styles.statIcon}>
              <Ionicons name="cash-outline" size={14} color="#FFF" />
            </LinearGradient>
            <View>
              <Text style={[styles.statValue, { color: C.green }]}>{stats.ca.toFixed(0)} €</Text>
              <Text style={styles.statLabel}>CA ESTIMÉ</Text>
            </View>
          </View>
        </View>

        {/* Résumé global */}
        {rides.length > 0 && (
          <View style={styles.globalBanner}>
            <Ionicons name="stats-chart-outline" size={13} color={C.hText2} />
            <Text style={styles.globalBannerText}>
              Total : {globalStats.total} courses · {globalStats.ca.toFixed(0)} € CA cumulé
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* ── BANNIÈRE ERREUR ── */}
      {loadError && !loading && rides.length === 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Impossible de charger les données. Tirez pour réessayer.</Text>
        </View>
      )}

      {/* ── BARRE DE RECHERCHE ── */}
      <View style={[styles.searchContainer, { borderColor: focusSearch ? C.brand : C.border }]}>
        <Ionicons name="search" size={18} color={C.text3} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher patient, ville..."
          placeholderTextColor={C.text3}
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => setFocusSearch(true)}
          onBlur={() => setFocusSearch(false)}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={18} color={C.text3} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── LISTE ── */}
      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={styles.loaderText}>Chargement de l'historique...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRides}
          keyExtractor={i => i._id}
          renderItem={({ item }) => (
            <RideHistoryCard
              item={item}
              hasConflict={conflictingRideIds.has(item._id)}
              onPress={setSelectedRide}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} colors={[C.brand]} tintColor={C.brand} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <LinearGradient colors={[C.brand + '20', C.brand + '10']} style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={32} color={C.brand} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>
                {debouncedSearch.length > 0 ? 'Aucun résultat' : 'Aucune course terminée'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {debouncedSearch.length > 0
                  ? 'Aucun résultat trouvé dans la base.'
                  : 'Les courses terminées ce jour apparaîtront ici.'}
              </Text>
            </View>
          }
        />
      )}

      <RideDetailsModal
        visible={!!selectedRide}
        selectedRide={selectedRide}
        hasConflict={selectedRide ? conflictingRideIds.has(selectedRide._id) : false}
        onClose={() => setSelectedRide(null)}
        onSave={handleSaveEdit}
        onDelete={handleDeleteRide}
        onToggleBilling={handleToggleBilling}
      />

      {/* ── MODAL AUDIT INTELLIGENT ── */}
      <Modal visible={showAuditModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.auditContainer}>

          {/* Header audit */}
          <LinearGradient colors={[C.hBg1, C.hBg2]} style={styles.auditHeader}>
            <TouchableOpacity onPress={() => setShowAuditModal(false)} style={styles.auditCloseBtn}>
              <Ionicons name="close" size={22} color={C.hText} />
            </TouchableOpacity>
            <Text style={styles.auditTitle}>Lissage Intelligent</Text>
            <View style={{ width: 36 }} />
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.auditContent}>
            <View style={styles.auditDescCard}>
              <Ionicons name="information-circle-outline" size={18} color={C.blue} />
              <Text style={styles.auditDescText}>
                Analyse du temps de trajet réel et correction des chevauchements pour la conformité CPAM.
              </Text>
            </View>

            {isAuditing ? (
              <View style={styles.auditLoadingContainer}>
                <LinearGradient colors={[C.brand, '#E55A00']} style={styles.auditLoadingIcon}>
                  <Ionicons name="navigate" size={28} color="#FFF" />
                </LinearGradient>
                <ActivityIndicator size="large" color={C.brand} style={{ marginTop: 20 }} />
                <Text style={styles.auditLoadingText}>Calcul des trajectoires via OSRM...</Text>
              </View>
            ) : (
              auditProposals.map((prop, idx) => {
                const isChanged = dayjs(prop.startTime).diff(dayjs(prop.proposedStartTime)) !== 0 ||
                                  dayjs(prop.endTime).diff(dayjs(prop.proposedEndTime)) !== 0;

                return (
                  <View key={prop._id} style={[styles.auditCard, isChanged && styles.auditCardChanged]}>
                    <View style={styles.auditCardHeader}>
                      <View style={styles.auditCardIndex}>
                        <Text style={styles.auditCardIndexText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.auditCardName} numberOfLines={1}>{prop.patientName}</Text>
                      {prop.hasConflict && (
                        <View style={styles.conflictPill}>
                          <Text style={styles.conflictPillText}>Conflit</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.auditTimeRow}>
                      <View style={styles.auditTimeBlock}>
                        <Text style={styles.auditTimeLabel}>ACTUEL</Text>
                        <Text style={[styles.auditTimeValue, isChanged && styles.auditTimeStrike]}>
                          {dayjs(prop.startTime).format('HH:mm')} → {dayjs(prop.endTime).format('HH:mm')}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={18} color={C.text3} />
                      <View style={[styles.auditTimeBlock, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.auditTimeLabel, isChanged && { color: C.brand }]}>
                          PROPOSÉ ({prop.theoreticalMinutes} min)
                        </Text>
                        <Text style={[styles.auditTimeValue, isChanged && { color: C.brand, fontWeight: '800' }]}>
                          {dayjs(prop.proposedStartTime).format('HH:mm')} → {dayjs(prop.proposedEndTime).format('HH:mm')}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            {!isAuditing && auditProposals.length > 0 && (
              <TouchableOpacity style={styles.applyBtnWrapper} onPress={applyAuditCorrections} activeOpacity={0.85}>
                <LinearGradient colors={[C.brand, '#E55A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.applyBtn}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.applyBtnText}>APPLIQUER LES CORRECTIONS</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: C.hText,
    letterSpacing: -0.5,
  },
  headerDate: {
    fontSize: 13,
    color: C.brand,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  headerActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.hCard,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.hBorder,
  },
  headerBtnText: { color: C.brand, fontWeight: '700', fontSize: 12 },

  // Sélecteur de jour
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: C.hCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.hBorder,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  daySelectorArrow: { padding: 8 },
  daySelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  daySelectorText: {
    color: C.hText,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.hCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.hBorder,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: C.hText,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.hText2,
    letterSpacing: 0.8,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: C.hBorder,
  },

  // Global banner
  globalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.hCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.hBorder,
  },
  globalBannerText: {
    fontSize: 12,
    color: C.hText2,
    fontWeight: '600',
  },

  // Recherche
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },

  errorBanner: {
    backgroundColor: C.red,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: { color: '#FFF', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Loader
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { color: C.text2, fontSize: 14, fontWeight: '600' },

  // Empty
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 14, color: C.text2, textAlign: 'center', paddingHorizontal: 40 },

  // ── Modal Audit ──
  auditContainer: { flex: 1, backgroundColor: C.bg },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  auditCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.hCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.hBorder,
  },
  auditTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.hText,
    letterSpacing: -0.3,
  },
  auditContent: { padding: 20, gap: 12 },
  auditDescCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.blue + '15',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.blue + '30',
    marginBottom: 8,
  },
  auditDescText: {
    flex: 1,
    color: C.text2,
    fontSize: 13,
    lineHeight: 19,
  },
  auditLoadingContainer: { alignItems: 'center', paddingTop: 40, gap: 6 },
  auditLoadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auditLoadingText: {
    marginTop: 8,
    color: C.brand,
    fontWeight: '700',
    fontSize: 14,
  },
  auditCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  auditCardChanged: {
    borderColor: C.brand,
    borderWidth: 1.5,
  },
  auditCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  auditCardIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.brand + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  auditCardIndexText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.brand,
  },
  auditCardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
  conflictPill: {
    backgroundColor: C.red + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.red + '40',
  },
  conflictPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.red,
  },
  auditTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card2,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  auditTimeBlock: { flex: 1 },
  auditTimeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.text3,
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  auditTimeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text2,
  },
  auditTimeStrike: {
    textDecorationLine: 'line-through',
    color: C.text3,
  },
  applyBtnWrapper: { marginTop: 8 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  applyBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
