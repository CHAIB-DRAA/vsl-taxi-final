import * as Calendar from 'expo-calendar';
import { Alert, Platform, Linking } from 'react-native';
import moment from 'moment';

// ============================================================
// 🛠️ HELPER : TROUVER LE BON CALENDRIER (Le cœur du correctif)
// ============================================================
async function getWritableCalendarId() {
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    return defaultCalendar.id;
  }

  // Pour Android (Oppo, Samsung, etc.)
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  
  // 1. Priorité absolue : Un calendrier Google modifiable et Principal
  const googleCalendar = calendars.find(
    (cal) => cal.allowsModifications && cal.source.type === 'com.google' && cal.isPrimary
  );
  if (googleCalendar) return googleCalendar.id;

  // 2. Plan B : N'importe quel calendrier Google modifiable
  const anyGoogle = calendars.find((cal) => cal.allowsModifications && cal.source.type === 'com.google');
  if (anyGoogle) return anyGoogle.id;

  // 3. Plan C : Le premier calendrier modifiable du téléphone (Calendrier local constructeur)
  const localCalendar = calendars.find((cal) => cal.allowsModifications);
  if (localCalendar) return localCalendar.id;

  return null;
}

// ============================================================
// 1. EXPORTER UNE COURSE (Correction du bug d'ajout)
// ============================================================
export const addRideToCalendar = async (ride) => {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert("Permission refusée", "Vous devez autoriser l'accès au calendrier dans les paramètres de votre téléphone.");
    }

    const calendarId = await getWritableCalendarId();
    
    if (!calendarId) {
      return Alert.alert("Erreur", "Aucun calendrier modifiable n'a été trouvé sur ce téléphone.");
    }

    const startDate = new Date(ride.date);
    const endDate = moment(startDate).add(1, 'hour').toDate();

    await Calendar.createEventAsync(calendarId, {
      title: `🚑 ${ride.type || 'VSL'} - ${ride.patientName}`,
      startDate: startDate,
      endDate: endDate,
      location: `${ride.startLocation} ➔ ${ride.endLocation}`,
      notes: `📞 Téléphone: ${ride.patientPhone || 'Non renseigné'}\n📍 Trajet: ${ride.startLocation} -> ${ride.endLocation}\n📝 Notes: ${ride.notes || ''}`,
      timeZone: 'Europe/Paris',
    });

    Alert.alert(
        "Succès", 
        "Course ajoutée à votre Agenda ! 📅",
        [
            { text: "OK", style: "cancel" },
            { 
              text: "Ouvrir Agenda", 
              onPress: () => {
                if (Platform.OS === 'android') {
                  Linking.openURL('content://com.android.calendar/time/');
                } else {
                  Linking.openURL('calshow://');
                }
              }
            }
        ]
    );
  } catch (error) {
    Alert.alert("Erreur", "Impossible de créer l'événement. Vérifiez que votre application d'agenda est bien configurée.");
  }
};

// ============================================================
// 2. SYNCHRONISATION DE MASSE (Exporter toute la journée)
// ============================================================
export const syncBatchRides = async (rides) => {
  if (!rides || rides.length === 0) return;
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Permission refusée", "Accès au calendrier requis.");

    const calendarId = await getWritableCalendarId();
    if (!calendarId) return Alert.alert("Erreur", "Aucun calendrier modifiable trouvé.");

    let count = 0;
    for (const ride of rides) {
      const startDate = new Date(ride.date);
      await Calendar.createEventAsync(calendarId, {
        title: `🚑 ${ride.type || 'VSL'} - ${ride.patientName}`,
        startDate: startDate,
        endDate: moment(startDate).add(1, 'hour').toDate(),
        location: `${ride.startLocation} ➔ ${ride.endLocation}`,
        notes: `Auto-sync depuis l'app VSL.\nTrajet: ${ride.startLocation} -> ${ride.endLocation}`,
        timeZone: 'Europe/Paris',
      });
      count++;
    }

    Alert.alert("Succès", `${count} courses synchronisées dans votre calendrier !`);
  } catch (error) {
    Alert.alert("Erreur", "La synchronisation de masse a échoué.");
  }
};

// ============================================================
// 3. 🚀 NOUVEAU : IMPORTER DEPUIS L'AGENDA (Récupérer les anciens contacts)
// ============================================================
export const fetchGoogleCalendarEvents = async (daysInPast = 30, daysInFuture = 30) => {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Impossible de lire le calendrier pour importer les courses.');
      return [];
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysInPast);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysInFuture);

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    
    // Pour lire, on prend tous les calendriers intéressants
    const readableCalendarIds = calendars
      .filter(c => c.source.type === 'com.google' || c.allowsModifications)
      .map(c => c.id);

    if (readableCalendarIds.length === 0) return [];

    const events = await Calendar.getEventsAsync(readableCalendarIds, startDate, endDate);
    
    // On enlève les jours fériés (allDay) et on trie chronologiquement
    const validEvents = events
      .filter(e => !e.allDay)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    return validEvents;
  } catch (error) {
    return [];
  }
};