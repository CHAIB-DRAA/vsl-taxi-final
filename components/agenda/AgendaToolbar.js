import React from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const THEME = { primary: '#FF6B00', card: '#FFFFFF', text: '#1F2937' };

export default function AgendaToolbar({ onImport, analyzing, onGroupList, onSettings }) {
  return (
    <View style={styles.toolbar}>
        <TouchableOpacity onPress={onImport} disabled={analyzing} style={styles.magicBtn}>
            {analyzing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="sparkles" size={18} color="#FFF" />}
            <Text style={styles.magicBtnText}>Magic Paste</Text>
        </TouchableOpacity>
        
        <View style={{flexDirection:'row'}}>
          <TouchableOpacity onPress={onGroupList} style={styles.iconBtn}>
              <Ionicons name="people" size={20} color={THEME.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSettings} style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={20} color={THEME.text} />
          </TouchableOpacity>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20, marginTop: 5 },
  magicBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, elevation: 6 },
  magicBtnText: { color: '#FFF', fontWeight: '700', marginLeft: 8, fontSize: 15 },
  iconBtn: { padding: 12, backgroundColor: THEME.card, borderRadius: 14, marginLeft: 12, elevation: 2 },
});