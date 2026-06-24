import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');
import OffersNotification from '../OffersNotification';

LocaleConfig.locales['fr'] = {
  monthNames: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  monthNamesShort: ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'],
  dayNames: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
  dayNamesShort: ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],
  today: "Aujourd'hui",
};
LocaleConfig.defaultLocale = 'fr';

const C = {
  bg:     '#F2F3F7',
  card:   '#FFFFFF',
  border: '#E2E5EC',
  text:   '#060E1E',
  text2:  '#6B7280',
  brand:  '#FF5500',
};

export default function AgendaHeader({ selectedDate, onDateSelect, showCalendar, toggleCalendar, markedDates }) {
  const isToday = selectedDate === dayjs().format('YYYY-MM-DD');

  return (
    <View style={styles.wrapper}>

      {/* ── BARRE PRINCIPALE ── */}
      <View style={styles.bar}>
        <View>
          <Text style={styles.title}>Planning</Text>
          <Text style={styles.subtitle}>
            {isToday ? "Aujourd'hui · " : ''}{dayjs(selectedDate).format('dddd D MMMM')}
          </Text>
        </View>

        <View style={styles.actions}>
          <OffersNotification />

          {!isToday && (
            <TouchableOpacity style={styles.todayBtn} onPress={() => onDateSelect(dayjs().format('YYYY-MM-DD'))}>
              <Text style={styles.todayBtnText}>Auj.</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={toggleCalendar}
            style={[styles.toggleBtn, showCalendar && styles.toggleBtnOn]}
          >
            <Ionicons
              name={showCalendar ? 'chevron-up' : 'calendar-outline'}
              size={20}
              color={showCalendar ? C.brand : C.text2}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── CALENDRIER ── */}
      {showCalendar && (
        <Calendar
          onDayPress={(d) => onDateSelect(d.dateString)}
          current={selectedDate}
          markingType="multi-dot"
          markedDates={{
            ...markedDates,
            [selectedDate]: {
              ...(markedDates?.[selectedDate] || {}),
              selected: true,
              selectedColor: C.brand,
            },
          }}
          style={styles.calendar}
          theme={{
            backgroundColor: C.card,
            calendarBackground: C.card,
            textSectionTitleColor: C.text2,
            selectedDayBackgroundColor: C.brand,
            selectedDayTextColor: '#FFF',
            todayTextColor: C.brand,
            todayBackgroundColor: '#FFF7ED',
            dayTextColor: C.text,
            textDisabledColor: '#CBD5E1',
            arrowColor: C.brand,
            monthTextColor: C.text,
            textDayFontWeight: '500',
            textMonthFontWeight: '800',
            textDayHeaderFontWeight: '700',
            dotColor: C.brand,
            selectedDotColor: '#FFF',
          }}
        />
      )}

      {/* ── PILL DATE (calendrier fermé) ── */}
      {!showCalendar && (
        <TouchableOpacity style={styles.datePill} onPress={toggleCalendar} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={13} color={C.brand} />
          <Text style={styles.datePillText}>
            {dayjs(selectedDate).format('dddd D MMMM YYYY')}
          </Text>
          <Ionicons name="chevron-down" size={13} color={C.text2} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: C.card,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: C.brand, fontWeight: '600', textTransform: 'capitalize', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayBtn: {
    backgroundColor: C.brand + '22',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.brand + '44',
  },
  todayBtnText: { color: C.brand, fontSize: 12, fontWeight: '700' },
  toggleBtn: {
    width: 38, height: 38,
    backgroundColor: '#F5F7FB',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleBtnOn: { borderColor: C.brand + '66', backgroundColor: C.brand + '11' },
  calendar: { backgroundColor: C.card },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F5F7FB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: 'flex-start',
  },
  datePillText: { fontSize: 13, color: C.text2, fontWeight: '600', textTransform: 'capitalize' },
});
