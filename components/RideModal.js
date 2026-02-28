import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import moment from 'moment';

const RideModal = ({ visible, ride, formData, setFormData, onSave, onDelete, onClose }) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20 }}>
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 10 }}>Modifier la course</Text>
        {['patientName', 'startLocation', 'endLocation', 'type', 'date'].map((field, i) => (
          <TextInput
            key={i}
            placeholder={field === 'patientName' ? 'Nom du patient' : field === 'startLocation' ? 'Départ' : field === 'endLocation' ? 'Arrivée' : field === 'type' ? 'Type' : 'Date (YYYY-MM-DD HH:mm)'}
            value={field === 'date' ? moment(formData.date).format('YYYY-MM-DD HH:mm') : formData[field]}
            onChangeText={text => setFormData(prev => ({ ...prev, [field]: field === 'date' ? new Date(text).toISOString() : text }))}
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 }}
          />
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <TouchableOpacity onPress={onSave} style={{ padding: 10, backgroundColor: '#2196F3', borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Enregistrer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={{ padding: 10, backgroundColor: 'red', borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Supprimer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ padding: 10, backgroundColor: '#555', borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export default RideModal;
