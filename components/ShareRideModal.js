import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

const ShareRideModal = ({ visible, userId, onSelectContact, onClose }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Récupérer tous les contacts sauf le chauffeur connecté ---
  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email');

      if (error) throw error;

      const filteredContacts = (data || []).filter(contact => contact.id !== userId);
      setContacts(filteredContacts);
    } catch (err) {
      console.error('Erreur fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) fetchContacts();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Partager la course</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 20 }} />
          ) : contacts.length === 0 ? (
            <Text>Aucun contact disponible</Text>
          ) : (
            contacts.map(contact => (
              <TouchableOpacity
                key={contact.id}
                onPress={() => onSelectContact(contact)}
                style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}
              >
                <Text>{contact.full_name || contact.email}</Text>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity onPress={onClose} style={{ marginTop: 10 }}>
            <Text style={{ textAlign: 'center', color: 'red', fontWeight: 'bold' }}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ShareRideModal;
