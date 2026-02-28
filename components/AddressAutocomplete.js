import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

// Liste des départements d'Occitanie pour le filtrage
const OCCITANIE_DEPTS = ['31', '81', '82', '32', '09', '65', '46', '12', '11', '34', '66', '48', '30'];

export default function AddressAutocomplete({ 
  placeholder, 
  value, 
  onSelect, 
  icon, 
  style, // Pour récupérer les styles passés par le parent
  ...props // Pour récupérer le reste (placeholderTextColor, etc.)
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Synchroniser si la valeur change depuis le parent (ex: Swap)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const searchAddress = async (text) => {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      setShowResults(false);
      return;
    }

    try {
      setLoading(true);
      setShowResults(true);

      // API Gouv : Recherche large autour de Toulouse
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(text)}&limit=15&lat=43.6047&lon=1.4442`;
      const response = await axios.get(url);
      const rawResults = response.data.features || [];

      // Filtre Occitanie
      const filteredResults = rawResults.filter(item => {
        const postcode = item.properties.postcode; 
        if (!postcode) return false;
        const deptCode = postcode.substring(0, 2);
        return OCCITANIE_DEPTS.includes(deptCode);
      });

      setSuggestions(filteredResults.slice(0, 5));

    } catch (error) {
      console.error("Erreur adresse:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    const fullAddress = item.properties.label;
    setQuery(fullAddress);
    setShowResults(false);
    setSuggestions([]);
    if (onSelect) onSelect(fullAddress);
  };

  const clearInput = () => {
    setQuery('');
    onSelect('');
    setShowResults(false);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputRow}>
        {/* On affiche l'icône seulement si demandée (utile pour le design simple) */}
        {icon && <Ionicons name={icon} size={20} color="#666" style={styles.icon} />}
        
        <TextInput
          style={styles.input}
          placeholder={placeholder || "Adresse"}
          placeholderTextColor="#999" // Force le gris pour le placeholder
          value={query}
          onChangeText={searchAddress}
          onFocus={() => query.length >= 3 && setShowResults(true)}
          {...props} // Passe les autres props
        />
        
        {loading ? (
          <ActivityIndicator size="small" color="#FF6B00" />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={clearInput}>
            <Ionicons name="close-circle" size={18} color="#CCC" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* LISTE DÉROULANTE DES RÉSULTATS */}
      {showResults && suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((item, index) => (
            <TouchableOpacity 
              key={item.properties.id || index} 
              style={styles.suggestionItem}
              onPress={() => handleSelect(item)}
            >
              <Ionicons name="location" size={16} color="#FF6B00" style={{marginTop: 2}} />
              <View style={{marginLeft: 10, flex: 1}}>
                <Text style={styles.mainText} numberOfLines={1}>{item.properties.name}</Text>
                <Text style={styles.subText} numberOfLines={1}>{item.properties.city} ({item.properties.postcode})</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10, // Important pour passer au dessus
    position: 'relative',
    flex: 1, // Prend toute la place disponible
  },
  inputRow: {
    flexDirection: 'row', 
    alignItems: 'center', 
    // Fond transparent pour s'adapter au parent "stacked"
    backgroundColor: 'transparent', 
    height: '100%',
  },
  icon: { marginRight: 8 },
  input: { 
    flex: 1, 
    fontSize: 16, 
    color: '#000000', // ⚫️ FORCE LA COULEUR NOIRE
    fontWeight: '500',
    height: '100%'
  },
  suggestionsBox: {
    position: 'absolute', 
    top: 45, // Juste en dessous de l'input
    left: -10, // Ajustement pour alignement
    right: -10,
    backgroundColor: '#FFF', 
    borderRadius: 10, 
    elevation: 20, // Ombre très forte pour passer au dessus
    shadowColor: '#000', 
    shadowOpacity: 0.2, 
    shadowRadius: 10,
    borderWidth: 1, 
    borderColor: '#EEE', 
    maxHeight: 220, 
    zIndex: 9999 // Le plus haut possible
  },
  suggestionItem: {
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F5F5F5'
  },
  mainText: { 
    fontWeight: '700', 
    color: '#333', 
    fontSize: 14 
  },
  subText: { 
    fontSize: 12, 
    color: '#888',
    marginTop: 2
  }
});