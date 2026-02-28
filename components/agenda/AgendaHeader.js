import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import moment from 'moment';
import OffersNotification from '../../components/OffersNotification'; // Vérifie ton chemin d'import

// ... Config LocaleConfig inchangée ...

const THEME = { primary: '#FF6B00', card: '#FFFFFF', text: '#1F2937', bg: '#F8F9FA', textLight: '#9CA3AF' };

// 👇 AJOUTE "markedDates" DANS LES PROPS REÇUES
export default function AgendaHeader({ selectedDate, onDateSelect, showCalendar, toggleCalendar, markedDates }) {
  return (
    <View>
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>Mon Planning</Text>
            <Text style={styles.headerSubtitle}>{moment(selectedDate).format('dddd D MMMM').toUpperCase()}</Text>
        </View>
        <View style={styles.headerRightButtons}>
            <OffersNotification /> 
            <TouchableOpacity onPress={toggleCalendar} style={styles.calendarToggle}>
                <Ionicons name={showCalendar ? "chevron-up" : "calendar"} size={22} color={THEME.primary} />
            </TouchableOpacity>
        </View>
      </View>

      {showCalendar && (
          <View style={styles.calendarContainer}>
            <Calendar 
                onDayPress={(d) => onDateSelect(d.dateString)} 
                
                // 👇 C'EST ICI QUE LA MAGIE OPÈRE 👇
                markingType={'multi-dot'} // Important pour voir plusieurs points
                markedDates={markedDates} // On utilise les données calculées par le parent
                
                theme={{ 
                    backgroundColor: THEME.card,
                    calendarBackground: THEME.card,
                    textSectionTitleColor: THEME.textLight,
                    selectedDayBackgroundColor: THEME.primary,
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: THEME.primary,
                    dayTextColor: THEME.text,
                    arrowColor: THEME.primary,
                    monthTextColor: THEME.text,
                    textDayFontWeight: '500',
                    textMonthFontWeight: 'bold',
                    // Styles des points
                    dotColor: THEME.primary,
                    selectedDotColor: '#ffffff',
                }} 
            />
          </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: THEME.card, elevation: 4, zIndex: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: THEME.text, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: THEME.primary, fontWeight: '600', letterSpacing: 0.5 },
  headerRightButtons: { flexDirection: 'row', alignItems: 'center' },
  calendarToggle: { padding: 10, backgroundColor: THEME.bg, borderRadius: 12, marginLeft: 12 },
  calendarContainer: { borderRadius: 24, overflow: 'hidden', margin: 15, backgroundColor: THEME.card, elevation: 8 },
});