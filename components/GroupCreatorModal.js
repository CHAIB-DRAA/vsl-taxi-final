import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function GroupCreatorModal({ visible, onClose, contacts, onSaveGroup, groupToEdit }) {
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]); // On stocke les IDs des Utilisateurs (pas des contacts)

  // Initialisation (Mode Modification ou Création)
  useEffect(() => {
    if (visible) {
        if (groupToEdit) {
            setGroupName(groupToEdit.name);
            // On récupère les IDs des membres existants
            // groupToEdit.members contient déjà des objets User peuplés
            setSelectedUserIds(groupToEdit.members.map(m => m._id));
        } else {
            setGroupName('');
            setSelectedUserIds([]);
        }
    }
  }, [visible, groupToEdit]);

  const toggleContact = (userId) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSave = () => {
    if (!groupName.trim()) return Alert.alert("Erreur", "Donnez un nom au groupe.");
    if (selectedUserIds.length === 0) return Alert.alert("Erreur", "Sélectionnez au moins un membre.");

    // 👇 C'EST ICI LA CORRECTION MAJEURE
    // On doit retrouver les objets "Contacts" complets correspondant aux IDs utilisateurs sélectionnés
    const selectedMembers = contacts.filter(c => 
        c.contactId && selectedUserIds.includes(c.contactId._id)
    );

    const groupData = {
      name: groupName,
      members: selectedMembers, // On envoie les objets contacts
      _id: groupToEdit ? groupToEdit._id : null
    };

    onSaveGroup(groupData);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{groupToEdit ? "Modifier le Groupe ✏️" : "Nouveau Groupe 👥"}</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
            <Text style={styles.label}>Nom du groupe</Text>
            <TextInput 
                style={styles.input} 
                placeholder="Ex: Team Nuit..." 
                value={groupName}
                onChangeText={setGroupName}
            />
        </View>

        <Text style={styles.labelList}>Membres ({selectedUserIds.length}) :</Text>
        
        <FlatList
          data={contacts}
          // On utilise l'ID de l'utilisateur comme clé unique
          keyExtractor={item => item.contactId ? item.contactId._id : Math.random().toString()}
          renderItem={({ item }) => {
            if (!item.contactId) return null; // Sécurité si contact mal formé

            const userId = item.contactId._id;
            const isSelected = selectedUserIds.includes(userId);

            return (
              <TouchableOpacity style={[styles.contactRow, isSelected && styles.selectedRow]} onPress={() => toggleContact(userId)}>
                <View style={styles.rowLeft}>
                    <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={24} color={isSelected ? "#6200EE" : "#AAA"} />
                    <Text style={[styles.name, isSelected && {color: '#6200EE', fontWeight:'bold'}]}>{item.contactId.fullName}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>{groupToEdit ? "ENREGISTRER" : "CRÉER LE GROUPE"}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold' },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 12, padding: 15, fontSize: 16, backgroundColor: '#FAFAFA' },
  labelList: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  selectedRow: { backgroundColor: '#F3E5F5' },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  name: { marginLeft: 15, fontSize: 16, color: '#333' },
  saveBtn: { backgroundColor: '#6200EE', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }
});