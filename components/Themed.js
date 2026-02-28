import React from 'react';
import { Text as DefaultText, View as DefaultView } from 'react-native';
import { useTheme } from '@react-navigation/native'; // On utilise le hook de navigation

// 1. Une View qui change de couleur toute seule
export function ThemedView(props) {
  const { colors } = useTheme();
  const { style, ...otherProps } = props;

  return (
    <DefaultView 
      style={[{ backgroundColor: colors.background }, style]} 
      {...otherProps} 
    />
  );
}

// 2. Un Text qui change de couleur tout seul
export function ThemedText(props) {
  const { colors } = useTheme();
  const { style, ...otherProps } = props;

  return (
    <DefaultText 
      style={[{ color: colors.text }, style]} 
      {...otherProps} 
    />
  );
}