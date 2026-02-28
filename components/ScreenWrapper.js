import React from 'react';
import { SafeAreaView, StyleSheet, Platform, StatusBar, View } from 'react-native';

export default function ScreenWrapper({ children, style }) {
  return (
    <SafeAreaView style={[styles.container, style]}>
      {/* On utilise StatusBar pour garantir que les icônes (batterie/wifi) soient visibles */}
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      {/* Le contenu de l'écran */}
      <View style={styles.content}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Ta couleur de fond globale
    // 👇 LE FIX MAGIC POUR ANDROID (Barre du haut)
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
    // Pas de paddingBottom ici pour laisser les listes scroller derrière les boutons,
    // on gère ça dans les FlatList/ScrollView directement (voir Étape 3).
  }
});