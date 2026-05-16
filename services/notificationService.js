import * as Notifications from 'expo-notifications';
import moment from 'moment';
import 'moment/locale/fr';

const NEXT_RIDE_ID   = 'vsl-next-ride';
const REMINDER_PFX   = 'vsl-reminder-';
const CHANNEL_NEXT   = 'vsl_next_ride';
const CHANNEL_REMIND = 'vsl_reminders';

// ── Initialisation canaux Android ──────────────────────────────────────────────
export async function setupNotifications() {
  await Notifications.setNotificationChannelAsync(CHANNEL_NEXT, {
    name: 'Prochaine course',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: null,
    lightColor: '#FF6B00',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  }).catch(() => {});

  await Notifications.setNotificationChannelAsync(CHANNEL_REMIND, {
    name: 'Rappels courses',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B00',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  }).catch(() => {});

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Notification persistante "Prochaine course" ─────────────────────────────────
// Remplace la notification à chaque changement de rides.
// Sur Android : sticky = impossible à balayer → effet widget lock screen.
// Sur iOS : notification normale dans le centre de notifications.
export async function updateNextRideNotification(rides) {
  const now = new Date();

  const upcoming = rides
    .filter(r =>
      r.status !== 'Terminée' &&
      r.status !== 'Annulée' &&
      new Date(r.date) > now
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  // Retirer l'ancienne
  try { await Notifications.dismissNotificationAsync(NEXT_RIDE_ID); } catch {}

  if (!upcoming) return;

  const rideDate  = moment(upcoming.date);
  const isToday   = rideDate.isSame(moment(), 'day');
  const isTomorrow = rideDate.isSame(moment().add(1, 'day'), 'day');
  const dayLabel  = isToday
    ? "Aujourd'hui"
    : isTomorrow
    ? 'Demain'
    : rideDate.format('dddd DD/MM');

  const start = (upcoming.startLocation || '').split(',')[0].trim();
  const end   = (upcoming.endLocation   || '').split(',')[0].trim();

  await Notifications.scheduleNotificationAsync({
    identifier: NEXT_RIDE_ID,
    content: {
      title:  `🚖 ${dayLabel} à ${rideDate.format('HH:mm')}`,
      body:   `${upcoming.patientName}  ·  ${start} → ${end}`,
      data:   { type: 'next_ride', rideId: upcoming._id },
      sticky: true,       // Android : ne peut pas être balayée
      sound:  false,
      android: { channelId: CHANNEL_NEXT },
    },
    trigger: null,        // Affichage immédiat
  });
}

// ── Rappel 30 min avant une course ─────────────────────────────────────────────
export async function scheduleRideReminder(ride) {
  if (ride.status === 'Terminée' || ride.status === 'Annulée') return;

  const rideDate   = moment(ride.startTime || ride.date);
  const triggerDate = rideDate.clone().subtract(30, 'minutes');
  if (triggerDate.isBefore(moment())) return;

  const id = REMINDER_PFX + ride._id;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}

  const start = (ride.startLocation || '').split(',')[0].trim();
  const end   = (ride.endLocation   || '').split(',')[0].trim();

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title:   `🚖 Départ dans 30 min — ${rideDate.format('HH:mm')}`,
      body:    `${ride.patientName}  ·  ${start} → ${end}`,
      data:    { type: 'reminder', rideId: ride._id },
      sound:   true,
      vibrate: [0, 250, 250, 250],
      android: { channelId: CHANNEL_REMIND },
    },
    trigger: { date: triggerDate.toDate() },
  });
}

// ── Annuler le rappel d'une course ─────────────────────────────────────────────
export async function cancelRideReminder(rideId) {
  try { await Notifications.cancelScheduledNotificationAsync(REMINDER_PFX + rideId); } catch {}
}

// ── Synchroniser tous les rappels ──────────────────────────────────────────────
// Annule les rappels orphelins et programme ceux qui manquent.
export async function syncAllReminders(rides) {
  const upcomingIds = new Set(
    rides
      .filter(r => r.status !== 'Terminée' && r.status !== 'Annulée')
      .map(r => r._id)
  );

  // Annuler les rappels dont la course n'existe plus ou est terminée
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) {
    if (n.identifier.startsWith(REMINDER_PFX)) {
      const rideId = n.identifier.slice(REMINDER_PFX.length);
      if (!upcomingIds.has(rideId)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
    }
  }

  // Programmer les rappels manquants
  for (const ride of rides) {
    if (upcomingIds.has(ride._id)) await scheduleRideReminder(ride);
  }
}
