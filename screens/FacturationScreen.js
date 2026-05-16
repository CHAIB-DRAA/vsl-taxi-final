import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/fr';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

import { useData } from '../contexts/DataContext';
import api from '../services/api';
import { calculatePrice } from '../utils/pricing';

const C = {
  bg:    '#F2F3F7',
  card:  '#FFFFFF',
  card2: '#F5F7FB',
  border:'#E2E5EC',
  text:  '#111827',
  text2: '#6B7280',
  text3: '#9CA3AF',
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

// Texte formaté pour Cofidoc (copier-coller)
function buildFicheCofidoc(r) {
  const price = calculatePrice(r);
  return [
    `TRANSPORT CPAM — ${moment(r.date).format('DD/MM/YYYY [à] HH:mm')}`,
    `Patient    : ${r.patientName}`,
    `Départ     : ${r.startLocation}`,
    `Arrivée    : ${r.endLocation}`,
    r.realDistance ? `Distance   : ${r.realDistance} km` : null,
    r.tolls > 0   ? `Péages     : ${parseFloat(r.tolls).toFixed(2)} €` : null,
    `Tarif CPAM : ${price} €`,
    r.motif       ? `Motif      : ${r.motif}` : null,
    r.bonTransport ? `BT n°      : ${r.bonTransport}` : null,
  ].filter(Boolean).join('\n');
}

export default function FacturationScreen() {
  const { allRides, updateLocalRide } = useData();
  const [activeTab, setActiveTab]     = useState('unbilled');
  const [markingId, setMarkingId]     = useState(null);
  const [generating, setGenerating]   = useState(false);
  // BT inline editing
  const [editingBtId, setEditingBtId] = useState(null);
  const [editingBtVal, setEditingBtVal] = useState('');

  const completed = useMemo(() =>
    allRides
      .filter(r => r.status === 'Terminée')
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [allRides]
  );

  const unbilled = useMemo(() => completed.filter(r => r.statuFacturation !== 'Facturé'), [completed]);
  const billed   = useMemo(() => completed.filter(r => r.statuFacturation === 'Facturé'),  [completed]);
  const display  = activeTab === 'unbilled' ? unbilled : billed;

  // Groupement par période CPAM avec prix CPAM recalculés
  const groups = useMemo(() => {
    const map = {};
    display.forEach(r => {
      const k = periodeKey(r.date);
      if (!map[k]) map[k] = { key: k, rides: [], km: 0, amount: 0, tolls: 0 };
      map[k].rides.push(r);
      map[k].km     += r.realDistance || 0;
      map[k].amount += parseFloat(calculatePrice(r));
      map[k].tolls  += r.tolls || 0;
    });
    return Object.values(map);
  }, [display]);

  // Totaux (onglet "À facturer") avec prix CPAM
  const totals = useMemo(() => ({
    count:  unbilled.length,
    km:     Math.round(unbilled.reduce((s, r) => s + (r.realDistance || 0), 0) * 10) / 10,
    amount: Math.round(unbilled.reduce((s, r) => s + parseFloat(calculatePrice(r)), 0) * 100) / 100,
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
      `Marquer ${group.rides.length} course${group.rides.length > 1 ? 's' : ''} comme facturées ?`,
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

  // ── Copier tout un groupe ──
  const copyGroup = useCallback(async (group) => {
    const lines = group.rides.map((r, i) =>
      `${i + 1}. ${buildFicheCofidoc(r)}`
    ).join('\n\n---\n\n');
    const header = `PÉRIODE : ${group.key}\n${group.rides.length} courses — ${group.amount.toFixed(2)} €\n\n`;
    await Clipboard.setStringAsync(header + lines);
    Alert.alert('Copié ✓', `${group.rides.length} fiche${group.rides.length > 1 ? 's' : ''} copiée${group.rides.length > 1 ? 's' : ''}`);
  }, []);

  // ── Sauvegarder bon de transport inline ──
  const saveBonTransport = useCallback(async (rideId) => {
    try {
      const res = await api.patch(`/rides/${rideId}`, { bonTransport: editingBtVal.trim() });
      updateLocalRide(res.data);
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    } finally {
      setEditingBtId(null);
    }
  }, [editingBtVal, updateLocalRide]);

  // ── Générer PDF bordereau ──
  const generatePDF = useCallback(async (rides, label) => {
    if (rides.length === 0) return;
    setGenerating(true);
    try {
      const totalKm     = rides.reduce((s, r) => s + (r.realDistance || 0), 0);
      const totalTolls  = rides.reduce((s, r) => s + (r.tolls || 0), 0);
      const totalAmount = rides.reduce((s, r) => s + parseFloat(calculatePrice(r)), 0);

      const rows = rides.map(r => {
        const price = parseFloat(calculatePrice(r));
        return `
        <tr>
          <td>${moment(r.date).format('DD/MM/YY HH:mm')}</td>
          <td><strong>${r.patientName}</strong>${r.bonTransport ? `<br><span class="bt">BT n° ${r.bonTransport}</span>` : ''}</td>
          <td>${r.motif || r.type || '—'}</td>
          <td>${r.startLocation || '—'}<br><span class="arr">▸ ${r.endLocation || '—'}</span></td>
          <td style="text-align:right">${r.realDistance ? r.realDistance + ' km' : '—'}</td>
          <td style="text-align:right">${r.tolls ? r.tolls.toFixed(2) + ' €' : '—'}</td>
          <td style="text-align:right;font-weight:700;color:#FF6B00">${price.toFixed(2)} €</td>
        </tr>`;
      }).join('');

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
          .bt{font-size:9px;color:#999;font-style:italic}
          .arr{color:#888;font-size:10px}
          .note{margin-top:24px;font-size:9px;color:#999;text-align:center}
        </style></head><body>
        <h1>BORDEREAU DE TRANSPORT — CPAM</h1>
        <p>Période : <strong>${label}</strong> &nbsp;·&nbsp; Généré le ${moment().format('DD/MM/YYYY à HH:mm')}</p>
        <table>
          <thead><tr><th>Date</th><th>Patient / BT</th><th>Motif</th><th>Trajet</th><th>Km</th><th>Péages</th><th>Montant</th></tr></thead>
          <tbody>
            ${rows}
            <tr class="foot">
              <td colspan="4">TOTAL — ${rides.length} course${rides.length > 1 ? 's' : ''}</td>
              <td style="text-align:right">${Math.round(totalKm * 10) / 10} km</td>
              <td style="text-align:right">${totalTolls.toFixed(2)} €</td>
              <td style="text-align:right">${totalAmount.toFixed(2)} €</td>
            </tr>
          </tbody>
        </table>
        <div class="note">Tarification conventionnée CPAM 2025-2029 — Taxi App · Dept 31</div>
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
    const mc    = MOTIF_COLOR[r.motif] || C.text2;
    const price = calculatePrice(r);
    const isEditingBt = editingBtId === r._id;

    const copyAddr = async (text, label) => {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copié ✓', label);
    };

    const copyFiche = async () => {
      await Clipboard.setStringAsync(buildFicheCofidoc(r));
      Alert.alert('Copié ✓', 'Fiche Cofidoc dans le presse-papier');
    };

    return (
      <View style={styles.rideRow}>

        {/* ── En-tête : date · motif · patient ── */}
        <View style={styles.rideHeader}>
          <View style={styles.rideTopLine}>
            <Text style={styles.rideTime}>{moment(r.date).format('DD/MM HH:mm')}</Text>
            {r.motif && (
              <View style={[styles.motifPill, { backgroundColor: mc + '18', borderColor: mc + '44' }]}>
                <Text style={[styles.motifText, { color: mc }]}>{r.motif}</Text>
              </View>
            )}
            {r.isRoundTrip && (
              <View style={styles.rtBadge}>
                <Ionicons name="repeat" size={9} color={C.text3} />
                <Text style={styles.rtText}>A/R</Text>
              </View>
            )}
          </View>
          <Text style={styles.rideName} numberOfLines={1}>{r.patientName}</Text>

          {/* Bon de transport */}
          {isEditingBt ? (
            <View style={styles.btEditRow}>
              <Ionicons name="document-text-outline" size={12} color={C.brand} />
              <TextInput
                style={styles.btInput}
                value={editingBtVal}
                onChangeText={setEditingBtVal}
                placeholder="N° du bon de transport"
                placeholderTextColor={C.text3}
                autoFocus
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={() => saveBonTransport(r._id)}
              />
              <TouchableOpacity onPress={() => saveBonTransport(r._id)} style={styles.btSaveBtn}>
                <Ionicons name="checkmark" size={14} color={C.green} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingBtId(null)} style={styles.btCancelBtn}>
                <Ionicons name="close" size={14} color={C.red} />
              </TouchableOpacity>
            </View>
          ) : r.bonTransport ? (
            <TouchableOpacity
              style={styles.btRow}
              onPress={() => { setEditingBtId(r._id); setEditingBtVal(r.bonTransport); }}
            >
              <Ionicons name="document-text-outline" size={11} color={C.text3} />
              <Text style={styles.btText}>BT n° {r.bonTransport}</Text>
              <Ionicons name="create-outline" size={11} color={C.text3} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.btAddRow}
              onPress={() => { setEditingBtId(r._id); setEditingBtVal(''); }}
            >
              <Ionicons name="add-circle-outline" size={11} color={C.text3} />
              <Text style={styles.btAddText}>Ajouter n° bon de transport</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Adresses cliquables ── */}
        <View style={styles.addrBlock}>
          <TouchableOpacity
            style={styles.addrRow}
            onPress={() => copyAddr(r.startLocation, 'Adresse de départ copiée')}
            activeOpacity={0.7}
          >
            <View style={[styles.addrDot, { backgroundColor: C.green }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>DÉPART</Text>
              <Text style={styles.addrText}>{r.startLocation}</Text>
            </View>
            <Ionicons name="copy-outline" size={13} color={C.text3} />
          </TouchableOpacity>

          <View style={styles.addrDivider} />

          <TouchableOpacity
            style={styles.addrRow}
            onPress={() => copyAddr(r.endLocation, 'Adresse d\'arrivée copiée')}
            activeOpacity={0.7}
          >
            <View style={[styles.addrDot, styles.addrDotSquare, { backgroundColor: C.brand }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>ARRIVÉE</Text>
              <Text style={styles.addrText}>{r.endLocation}</Text>
            </View>
            <Ionicons name="copy-outline" size={13} color={C.text3} />
          </TouchableOpacity>
        </View>

        {/* ── Méta + Prix ── */}
        <View style={styles.rideFooter}>
          <View style={styles.rideMeta}>
            {r.realDistance ? <Text style={styles.metaChip}>{r.realDistance} km</Text> : null}
            {r.tolls > 0   ? <Text style={styles.metaChip}>Péage {parseFloat(r.tolls).toFixed(2)} €</Text> : null}
            {r.nuit        ? <Text style={[styles.metaChip, { color: '#D97706' }]}>🌙 Nuit</Text> : null}
          </View>
          <Text style={styles.ridePrice}>{price} €</Text>
        </View>

        {/* ── Actions ── */}
        <View style={styles.rideActions}>
          <TouchableOpacity style={styles.cofidocBtn} onPress={copyFiche} activeOpacity={0.8}>
            <Ionicons name="clipboard-outline" size={12} color={C.brand} />
            <Text style={styles.cofidocBtnText}>Copier fiche</Text>
          </TouchableOpacity>

          {activeTab === 'unbilled' && (
            markingId === r._id
              ? <ActivityIndicator size="small" color={C.brand} />
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
  }, [activeTab, markingId, markBilled, editingBtId, editingBtVal, saveBonTransport]);

  const renderGroup = ({ item: g }) => (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupTitle}>{g.key}</Text>
          <Text style={styles.groupSub}>
            {g.rides.length} course{g.rides.length > 1 ? 's' : ''} · {Math.round(g.km * 10) / 10} km · {g.amount.toFixed(2)} €
            {g.tolls > 0 ? ` · péages ${g.tolls.toFixed(2)} €` : ''}
          </Text>
        </View>
        <View style={styles.groupActions}>
          <TouchableOpacity
            style={styles.groupCopyBtn}
            onPress={() => copyGroup(g)}
          >
            <Ionicons name="copy-outline" size={14} color={C.text2} />
          </TouchableOpacity>
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
            { val: totals.count,                    label: 'À facturer' },
            { val: `${totals.km} km`,               label: 'Distance' },
            { val: `${totals.amount.toFixed(2)} €`, label: 'Montant CPAM', highlight: true },
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
  summaryVal: { fontSize: 22, fontWeight: '900', color: C.text },
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
  groupCopyBtn: {
    backgroundColor: C.card2, width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
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
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  // Header
  rideHeader: { marginBottom: 10 },
  rideTopLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  rideTime: { fontSize: 12, fontWeight: '700', color: C.text2 },
  motifPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  motifText: { fontSize: 10, fontWeight: '700' },
  rtBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.card2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  rtText: { fontSize: 9, fontWeight: '700', color: C.text3 },
  rideName: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 6 },

  // Bon de transport
  btRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  btText: { fontSize: 11, color: C.text3, fontWeight: '600' },
  btAddRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  btAddText: { fontSize: 11, color: C.text3, fontStyle: 'italic' },
  btEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  btInput: {
    flex: 1, fontSize: 12, color: C.text,
    borderBottomWidth: 1, borderBottomColor: C.brand,
    paddingVertical: 3, paddingHorizontal: 4,
  },
  btSaveBtn: { padding: 4, backgroundColor: '#F0FDF4', borderRadius: 6 },
  btCancelBtn: { padding: 4, backgroundColor: '#FEF2F2', borderRadius: 6 },

  // Adresses
  addrBlock: {
    backgroundColor: C.card2, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  addrDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 2 },
  addrDotSquare: { borderRadius: 2 },
  addrLabel: { fontSize: 9, color: C.text3, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  addrText: { fontSize: 13, color: C.text, fontWeight: '500', marginTop: 1, lineHeight: 17 },
  addrDivider: { height: 1, backgroundColor: C.border, marginLeft: 18, marginVertical: 2 },

  // Footer méta + prix
  rideFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rideMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaChip: { fontSize: 11, color: C.text2, backgroundColor: C.card2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  ridePrice: { fontSize: 22, fontWeight: '900', color: C.brand },

  // Actions
  rideActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  cofidocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.brand + '12', paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: C.brand + '33',
  },
  cofidocBtnText: { fontSize: 11, fontWeight: '700', color: C.brand },
  factBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0',
  },
  factBtnText: { fontSize: 11, fontWeight: '700', color: C.green },
  billedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#BBF7D0',
  },
  billedChipText: { fontSize: 10, fontWeight: '700', color: C.green },

  // EMPTY
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text2, marginTop: 16, textAlign: 'center' },
  emptyHint: { fontSize: 13, color: C.text2, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
