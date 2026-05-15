import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import 'moment/locale/fr';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { useData } from '../contexts/DataContext';
import api from '../services/api';

const C = {
  bg:    '#F2F3F7',
  card:  '#FFFFFF',
  card2: '#F5F7FB',
  border:'#E2E5EC',
  text:  '#111827',
  text2: '#6B7280',
  brand: '#FF6B00',
  green: '#16A34A',
  red:   '#EF4444',
};

// Regroupe par période CPAM : 1-15 ou 16-fin du mois
function periodeKey(date) {
  const d = moment(date);
  return d.date() <= 15
    ? `1–15 ${d.format('MMMM YYYY')}`
    : `16–${d.daysInMonth()} ${d.format('MMMM YYYY')}`;
}

const MOTIF_COLOR = {
  Consultation:   '#3B82F6',
  Traitement:     '#8B5CF6',
  Hospitalisation:'#EF4444',
  HDJ:            '#06B6D4',
  Urgence:        '#F59E0B',
  Autre:          '#6B7280',
};

export default function FacturationScreen() {
  const { allRides, updateLocalRide } = useData();
  const [activeTab, setActiveTab]     = useState('unbilled');
  const [markingId, setMarkingId]     = useState(null);
  const [generating, setGenerating]   = useState(false);

  const completed = useMemo(() =>
    allRides
      .filter(r => r.status === 'Terminée')
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [allRides]
  );

  const unbilled = useMemo(() => completed.filter(r => r.statuFacturation !== 'Facturé'), [completed]);
  const billed   = useMemo(() => completed.filter(r => r.statuFacturation === 'Facturé'),  [completed]);
  const display  = activeTab === 'unbilled' ? unbilled : billed;

  // Groupement par période CPAM
  const groups = useMemo(() => {
    const map = {};
    display.forEach(r => {
      const k = periodeKey(r.date);
      if (!map[k]) map[k] = { key: k, rides: [], km: 0, amount: 0, tolls: 0 };
      map[k].rides.push(r);
      map[k].km     += r.realDistance || 0;
      map[k].amount += r.price || 0;
      map[k].tolls  += r.tolls || 0;
    });
    return Object.values(map);
  }, [display]);

  // Totaux (onglet "À facturer")
  const totals = useMemo(() => ({
    count:  unbilled.length,
    km:     Math.round(unbilled.reduce((s, r) => s + (r.realDistance || 0), 0) * 10) / 10,
    amount: Math.round(unbilled.reduce((s, r) => s + (r.price || 0), 0) * 100) / 100,
    tolls:  Math.round(unbilled.reduce((s, r) => s + (r.tolls || 0), 0) * 100) / 100,
  }), [unbilled]);

  // ── Marquer une course comme facturée ──
  const markBilled = useCallback(async (rideId) => {
    setMarkingId(rideId);
    try {
      const res = await api.put(`/rides/${rideId}/facturation`, { statuFacturation: 'Facturé' });
      updateLocalRide(res.data);
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour.');
    } finally {
      setMarkingId(null);
    }
  }, [updateLocalRide]);

  // ── Tout facturer d'un groupe ──
  const markGroupBilled = useCallback((group) => {
    Alert.alert(
      'Facturer la période',
      `Marquer ${group.rides.length} courses comme facturées ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer', onPress: async () => {
            for (const r of group.rides) {
              try {
                const res = await api.put(`/rides/${r._id}/facturation`, { statuFacturation: 'Facturé' });
                updateLocalRide(res.data);
              } catch { /* continue */ }
            }
          }
        }
      ]
    );
  }, [updateLocalRide]);

  // ── Générer PDF bordereau ──
  const generatePDF = useCallback(async (rides, label) => {
    if (rides.length === 0) return;
    setGenerating(true);
    try {
      const totalKm     = rides.reduce((s, r) => s + (r.realDistance || 0), 0);
      const totalTolls  = rides.reduce((s, r) => s + (r.tolls || 0), 0);
      const totalAmount = rides.reduce((s, r) => s + (r.price || 0), 0);

      const rows = rides.map(r => `
        <tr>
          <td>${moment(r.date).format('DD/MM/YY HH:mm')}</td>
          <td>${r.patientName}</td>
          <td>${r.motif || r.type || '—'}</td>
          <td>${(r.startLocation || '').split(',')[0]} → ${(r.endLocation || '').split(',')[0]}</td>
          <td style="text-align:right">${r.realDistance ? r.realDistance + ' km' : '—'}</td>
          <td style="text-align:right">${r.tolls ? r.tolls.toFixed(2) + ' €' : '—'}</td>
          <td style="text-align:right;font-weight:700;color:#FF6B00">${r.price ? r.price.toFixed(2) + ' €' : '—'}</td>
        </tr>`).join('');

      const html = `<html><head><meta charset="utf-8">
        <style>
          body{font-family:Helvetica,sans-serif;padding:30px;font-size:11px}
          h1{color:#FF6B00;border-bottom:2px solid #FF6B00;padding-bottom:8px;margin-bottom:4px}
          p{color:#555;margin:0 0 16px}
          table{width:100%;border-collapse:collapse}
          th{background:#FF6B00;color:#FFF;padding:8px 6px;text-align:left;font-size:10px}
          td{padding:7px 6px;border-bottom:1px solid #EEE;vertical-align:top}
          tr:nth-child(even) td{background:#F9FAFB}
          .foot td{font-weight:700;background:#FFF3E0;border-top:2px solid #FF6B00}
          .note{margin-top:24px;font-size:9px;color:#999;text-align:center}
        </style></head><body>
        <h1>BORDEREAU DE TRANSPORT — CPAM</h1>
        <p>Période : <strong>${label}</strong> &nbsp;·&nbsp; Généré le ${moment().format('DD/MM/YYYY à HH:mm')}</p>
        <table>
          <thead><tr><th>Date</th><th>Patient</th><th>Motif</th><th>Trajet</th><th>Km</th><th>Péages</th><th>Montant</th></tr></thead>
          <tbody>
            ${rows}
            <tr class="foot">
              <td colspan="4">TOTAL — ${rides.length} courses</td>
              <td style="text-align:right">${Math.round(totalKm*10)/10} km</td>
              <td style="text-align:right">${totalTolls.toFixed(2)} €</td>
              <td style="text-align:right">${totalAmount.toFixed(2)} €</td>
            </tr>
          </tbody>
        </table>
        <div class="note">Tarification conventionnée CPAM — Taxi App</div>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    } finally {
      setGenerating(false);
    }
  }, []);

  // ── Rendu d'une course ──
  const RideRow = useCallback(({ r }) => {
    const mc = MOTIF_COLOR[r.motif] || C.text2;
    return (
      <View style={styles.rideRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.rideTopLine}>
            <Text style={styles.rideTime}>{moment(r.date).format('DD/MM HH:mm')}</Text>
            {r.motif && (
              <View style={[styles.motifPill, { backgroundColor: mc + '18', borderColor: mc + '44' }]}>
                <Text style={[styles.motifText, { color: mc }]}>{r.motif}</Text>
              </View>
            )}
          </View>
          <Text style={styles.rideName} numberOfLines={1}>{r.patientName}</Text>
          <Text style={styles.rideRoute} numberOfLines={1}>
            {(r.startLocation || '').split(',')[0]} → {(r.endLocation || '').split(',')[0]}
          </Text>
          <View style={styles.rideMeta}>
            {r.realDistance ? <Text style={styles.metaChip}>{r.realDistance} km</Text> : null}
            {r.tolls > 0   ? <Text style={styles.metaChip}>Péage {r.tolls.toFixed(2)} €</Text> : null}
          </View>
        </View>
        <View style={styles.rideRight}>
          <Text style={styles.ridePrice}>{r.price ? `${r.price.toFixed(2)} €` : '—'}</Text>
          {activeTab === 'unbilled' && (
            markingId === r._id
              ? <ActivityIndicator size="small" color={C.brand} style={{ marginTop: 8 }} />
              : (
                <TouchableOpacity style={styles.factBtn} onPress={() => markBilled(r._id)}>
                  <Ionicons name="checkmark" size={13} color={C.green} />
                  <Text style={styles.factBtnText}>Facturer</Text>
                </TouchableOpacity>
              )
          )}
          {activeTab === 'billed' && (
            <View style={styles.billedChip}>
              <Ionicons name="checkmark-circle" size={11} color={C.green} />
              <Text style={styles.billedChipText}>Facturé</Text>
            </View>
          )}
        </View>
      </View>
    );
  }, [activeTab, markingId, markBilled]);

  const renderGroup = ({ item: g }) => (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View>
          <Text style={styles.groupTitle}>{g.key}</Text>
          <Text style={styles.groupSub}>
            {g.rides.length} courses · {Math.round(g.km * 10) / 10} km · {g.amount.toFixed(2)} €
            {g.tolls > 0 ? ` · péages ${g.tolls.toFixed(2)} €` : ''}
          </Text>
        </View>
        <View style={styles.groupActions}>
          <TouchableOpacity
            style={styles.groupPdfBtn}
            onPress={() => generatePDF(g.rides, g.key)}
            disabled={generating}
          >
            <Ionicons name="document-text-outline" size={15} color={C.brand} />
            <Text style={styles.groupPdfText}>PDF</Text>
          </TouchableOpacity>
          {activeTab === 'unbilled' && (
            <TouchableOpacity style={styles.groupBillBtn} onPress={() => markGroupBilled(g)}>
              <Ionicons name="checkmark-done" size={15} color={C.green} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {g.rides.map(r => <RideRow key={r._id} r={r} />)}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── RÉSUMÉ ── */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          {[
            { val: totals.count,                label: 'À facturer' },
            { val: `${totals.km} km`,           label: 'Distance' },
            { val: `${totals.amount.toFixed(2)} €`, label: 'Montant', highlight: true },
          ].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.summarySep} />}
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, s.highlight && { color: C.brand }]}>{s.val}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        {totals.tolls > 0 && (
          <Text style={styles.summaryTolls}>dont {totals.tolls.toFixed(2)} € de péages</Text>
        )}
        <TouchableOpacity
          style={[styles.pdfAllBtn, (generating || unbilled.length === 0) && { opacity: 0.5 }]}
          onPress={() => generatePDF(unbilled, 'Toutes les courses à facturer')}
          disabled={generating || unbilled.length === 0}
        >
          {generating
            ? <ActivityIndicator size="small" color="#FFF" />
            : <>
                <Ionicons name="document-text" size={16} color="#FFF" />
                <Text style={styles.pdfAllText}>Générer bordereau PDF complet</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* ── TABS ── */}
      <View style={styles.tabs}>
        {[
          { key: 'unbilled', label: `À facturer (${unbilled.length})` },
          { key: 'billed',   label: `Facturé (${billed.length})` },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── LISTE ── */}
      <FlatList
        data={groups}
        keyExtractor={g => g.key}
        renderItem={renderGroup}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={52} color={C.border} />
            <Text style={styles.emptyText}>
              {activeTab === 'unbilled' ? 'Aucune course à facturer' : 'Aucune course facturée'}
            </Text>
            {activeTab === 'unbilled' && (
              <Text style={styles.emptyHint}>
                Les courses apparaissent ici une fois terminées (bouton "Terminer" dans l'agenda).
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // RÉSUMÉ
  summary: {
    backgroundColor: C.card,
    margin: 16,
    marginBottom: 0,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  summaryItem: { alignItems: 'center' },
  summaryVal: { fontSize: 24, fontWeight: '900', color: C.text },
  summaryLabel: { fontSize: 11, color: C.text2, fontWeight: '600', marginTop: 2 },
  summarySep: { width: 1, backgroundColor: C.border },
  summaryTolls: { fontSize: 12, color: C.text2, textAlign: 'center', marginBottom: 12 },
  pdfAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.brand, borderRadius: 14, paddingVertical: 14, gap: 8,
  },
  pdfAllText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  // TABS
  tabs: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    backgroundColor: C.card2,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: C.text2 },
  tabTextActive: { color: C.text, fontWeight: '800' },

  // GROUPES
  group: {
    backgroundColor: C.card,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.card2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  groupTitle: { fontSize: 15, fontWeight: '800', color: C.text, textTransform: 'capitalize' },
  groupSub:   { fontSize: 12, color: C.text2, marginTop: 2 },
  groupActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  groupPdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.brand + '15', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.brand + '33',
  },
  groupPdfText: { color: C.brand, fontSize: 12, fontWeight: '700' },
  groupBillBtn: {
    backgroundColor: '#F0FDF4', width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#BBF7D0',
  },

  // RIDE ROW
  rideRow: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rideTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  rideTime:  { fontSize: 12, fontWeight: '700', color: C.text2 },
  motifPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  motifText: { fontSize: 10, fontWeight: '700' },
  rideName:  { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  rideRoute: { fontSize: 12, color: C.text2, marginBottom: 6 },
  rideMeta:  { flexDirection: 'row', gap: 6 },
  metaChip:  { fontSize: 11, color: C.text2, backgroundColor: C.card2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },

  rideRight: { alignItems: 'flex-end', justifyContent: 'center', marginLeft: 12, minWidth: 72 },
  ridePrice: { fontSize: 18, fontWeight: '900', color: C.brand, marginBottom: 6 },
  factBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0',
  },
  factBtnText: { fontSize: 11, fontWeight: '700', color: C.green },
  billedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: '#BBF7D0',
  },
  billedChipText: { fontSize: 10, fontWeight: '700', color: C.green },

  // EMPTY
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text2, marginTop: 16, textAlign: 'center' },
  emptyHint: { fontSize: 13, color: C.text2, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
