import * as Calendar from 'expo-calendar';
import { Alert, Platform, Linking } from 'react-native';
import moment from 'moment';

// Fonction pour trouver le calendrier Google principal sur Android
async function getDefaultCalendarSource() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  
  // Sur Android, on cherche le calendrier lié au compte Google (com.google) qui est le propriétaire
  const defaultCalendar = calendars.find(
    (cal) => cal.accessLevel === Calendar.CalendarAccessLevel.OWNER && cal.source.type === 'com.google'
  );

  // Si on ne trouve pas de compte Google spécifique, on prend le premier disponible en écriture
  if (!defaultCalendar) {
      return calendars.find(cal => cal.accessLevel === Calendar.CalendarAccessLevel.OWNER || cal.accessLevel === Calendar.CalendarAccessLevel.EDITOR);
  }

  return defaultCalendar;
}

export const addRideToCalendar = async (ride) => {
  try {
    // 1. Demander la permission
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert("Permission refusée", "Impossible d'accéder au calendrier.");
      return;
    }

    // 2. Trouver le bon ID de calendrier
    let calendarId;
    
    if (Platform.OS === 'ios') {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      calendarId = defaultCalendar.id;
    } else {
      // LOGIQUE ANDROID/OPPO
      const calendarSource = await getDefaultCalendarSource();
      if (!calendarSource) {
          Alert.alert("Erreur", "Aucun calendrier Google trouvé synchronisé sur ce téléphone.");
          return;
      }
      calendarId = calendarSource.id;
    }

    // 3. Créer l'événement
    const startDate = new Date(ride.date);
    const endDate = moment(startDate).add(1, 'hour').toDate(); // Durée par défaut 1h

    await Calendar.createEventAsync(calendarId, {
      title: `🚑 ${ride.type} - ${ride.patientName}`,
      startDate: startDate,
      endDate: endDate,
      location: `${ride.startLocation} ➔ ${ride.endLocation}`,
      notes: `Téléphone: ${ride.patientPhone || 'Non renseigné'}\nTrajet: ${ride.startLocation} -> ${ride.endLocation}`,
      timeZone: 'Europe/Paris',
    });

    Alert.alert(
        "Succès", 
        "Ajouté à ton Google Agenda ! 📅",
        [
            { text: "OK" },
            // Petit bonus : bouton pour ouvrir l'appli Agenda directement
            { text: "Ouvrir Agenda", onPress: () => Linking.openURL('content://com.android.calendar/time/') }
        ]
    );

  } catch (error) {
    console.log(error);
    Alert.alert("Erreur", "Impossible d'ajouter l'événement.");
  }
};

export const syncBatchRides = async (rides) => {
    // Même logique pour la synchro de masse si besoin
    // ...
    Alert.alert("Info", "Utilise le bouton individuel pour le moment.");
};