import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function GroupListModal({ visible, onClose, groups, onEdit, onDelete, onCreateNew }) {
  
  const confirmDelete = (group) => {
    Alert.alert(
      "Supprimer le groupe ?",
      `Voulez-vous vraiment supprimer "${group.name}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => onDelete(group._id) }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>Mes Groupes 🛠️</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close-circle" size={30} color="#999" /></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.createBtn} onPress={onCreateNew}>
            <Ionicons name="add-circle" size={24} color="#FFF" />
            <Text style={styles.createBtnText}>Créer un nouveau groupe</Text>
        </TouchableOpacity>

        <FlatList 
            data={groups}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
                <View style={styles.groupCard}>
                    <View style={styles.groupInfo}>
                        <Text style={styles.groupName}>{item.name}</Text>
                        <Text style={styles.groupCount}>{item.members?.length || 0} membres</Text>
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(item)}>
                            <Ionicons name="pencil" size={20} color="#1976D2" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(item)}>
                            <Ionicons name="trash" size={20} color="#D32F2F" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Aucun groupe créé.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  createBtn: { flexDirection: 'row', backgroundColor: '#4CAF50', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  createBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  groupCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center', justifyContent: 'space-between', elevation: 2 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  groupCount: { color: '#666', marginTop: 4 },
  actions: { flexDirection: 'row' },
  actionBtn: { padding: 10, marginLeft: 5, backgroundColor: '#F0F0F0', borderRadius: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 50, fontSize: 16 }
});