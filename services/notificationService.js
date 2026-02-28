import notifee, { AndroidImportance, TriggerType, AndroidCategory } from '@notifee/react-native';
import moment from 'moment';

// 1. Demander la permission (Obligatoire sur Android 13+)
export async function requestNotificationPermission() {
  await notifee.requestPermission();
}

// 2. Programmer le rappel
export async function scheduleRideReminder(ride) {
  // Si la course est déjà finie ou annulée, on ne fait rien
  if (ride.status === 'Terminée' || ride.status === 'Annulée') return;
  if (!ride.startTime && !ride.date) return;

  // On calcule l'heure de départ
  const rideDate = moment(ride.startTime || ride.date);
  // On retire 10 minutes
  const triggerDate = rideDate.clone().subtract(10, 'minutes');

  // Si l'heure est déjà passée, on ne programme pas
  if (triggerDate.isBefore(moment())) return;

  // On crée un ID unique pour cette notif basé sur l'ID de la course
  const notificationId = ride._id; 

  // Configuration du canal (Sonnerie, Vibration)
  const channelId = await notifee.createChannel({
    id: 'taxi_alerts',
    name: 'Rappels Courses',
    importance: AndroidImportance.HIGH,
    sound: 'default', 
    vibration: true,
  });

  try {
    await notifee.createTriggerNotification(
      {
        id: notificationId,
        title: '🚖 Départ dans 10 min !',
        body: `Patient : ${ride.patientName}\nTrajet : ${ride.startLocation}`,
        data: { 
            rideId: ride._id,
            phoneNumber: ride.patientPhone // On stocke le numéro ici pour l'utiliser plus tard
        },
        android: {
          channelId,
          category: AndroidCategory.ALARM, // Pour réveiller l'écran
          pressAction: {
            id: 'default',
          },
          // 👇 LE BOUTON MAGIQUE POUR APPELER
          actions: ride.patientPhone ? [
            {
              title: '📞 APPELER PATIENT',
              pressAction: { 
                  id: 'call_patient',
                  launchActivity: 'default', // Ouvre l'appli pour exécuter l'action
              }, 
            }
          ] : [],
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.valueOf(), // L'heure calculée (Unix timestamp)
      },
    );
    console.log(`⏰ Rappel programmé pour ${ride.patientName} à ${triggerDate.format('HH:mm')}`);
  } catch (e) {
    console.error("Erreur programmation notif:", e);
  }
}

// 3. Annuler un rappel (si la course est annulée ou supprimée)
export async function cancelRideReminder(rideId) {
    await notifee.cancelNotification(rideId);
}