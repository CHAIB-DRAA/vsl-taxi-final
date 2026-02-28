import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. DÉFINITION DES COULEURS
export const themes = {
  light: {
    dark: false,
    colors: {
      background: '#F8F9FA',
      card: '#FFFFFF',
      text: '#333333',
      textSecondary: '#666666',
      border: '#EEEEEE',
      primary: '#FF6B00',
      danger: '#D32F2F',
      success: '#4CAF50',
      iconBg: '#F5F5F5',
    }
  },
  dark: {
    dark: true,
    colors: {
      background: '#121212',
      card: '#1E1E1E',
      text: '#FFFFFF',
      textSecondary: '#AAAAAA',
      border: '#333333',
      primary: '#FF8533', // Orange un peu plus clair pour le sombre
      danger: '#EF5350',
      success: '#66BB6A',
      iconBg: '#333333',
    }
  }
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme(); // Détecte 'light' ou 'dark' du téléphone
  const [themeMode, setThemeMode] = useState('system'); // 'light', 'dark', 'system'
  const [activeTheme, setActiveTheme] = useState(themes.light);

  // Charger le thème sauvegardé au démarrage
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('user_theme');
      if (savedTheme) {
        setThemeMode(savedTheme);
      }
    };
    loadTheme();
  }, []);

  // Mettre à jour les couleurs quand le mode ou le système change
  useEffect(() => {
    if (themeMode === 'system') {
      setActiveTheme(systemScheme === 'dark' ? themes.dark : themes.light);
    } else {
      setActiveTheme(themeMode === 'dark' ? themes.dark : themes.light);
    }
  }, [themeMode, systemScheme]);

  // Fonction pour changer le thème
  const changeTheme = async (mode) => {
    setThemeMode(mode);
    await AsyncStorage.setItem('user_theme', mode);
  };

  return (
    <ThemeContext.Provider value={{ 
      colors: activeTheme.colors, 
      isDark: activeTheme.dark, 
      themeMode, 
      changeTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);