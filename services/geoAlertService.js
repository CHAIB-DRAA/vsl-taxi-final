import * as Notifications from 'expo-notifications';

export const CHANNEL_PROXIMITY = 'vsl_proximity';
const ALERT_MINUTES_BEFORE = 15;
const NOTIF_PREFIX = 'vsl-depart-';

export async function setupProximityChannel() {
  return Notifications.setNotificationChannelAsync(CHANNEL_PROXIMITY, {
    name: 'Alerte départ course',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 500, 200, 500],
    lightColor: '#FF6B00',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    enableLights: true,
    enableVibrate: true,
  }).catch(() => {});
}

export async function scheduleDepartureAlert(ride, minutesBefore = ALERT_MINUTES_BEFORE) {
  if (!ride?._id || !ride?.date || !ride?.startLocation) return false;

  const rideTime = new Date(ride.date);
  const alertTime = new Date(rideTime.getTime() - minutesBefore * 60 * 1000);

  if (alertTime <= new Date()) return false;

  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_PREFIX + ride._id).catch(() => {});

    const addrShort = (ride.startLocation || '').split(',')[0].trim();
    const hhmm = rideTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_PREFIX + ride._id,
      content: {
        title: `🚗 Départ dans ${minutesBefore} min — ${hhmm}`,
        body: `${ride.patientName || 'Patient'} · ${addrShort}\nAppuyez pour ouvrir Waze`,
        data: {
          type: 'departure_alert',
          rideId: ride._id,
          startLocation: ride.startLocation,
          patientName: ride.patientName || '',
        },
        sound: 'default',
        android: {
          channelId: CHANNEL_PROXIMITY,
          priority: 'max',
          vibrate: [0, 500, 200, 500, 200, 500],
        },
      },
      trigger: { date: alertTime },
    });

    return true;
  } catch (e) {
    return false;
  }
}

export async function cancelDepartureAlert(rideId) {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_PREFIX + rideId);
  } catch {}
}

export async function scheduleAllUpcomingAlerts(rides) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcoming = (rides || []).filter(r =>
    r.status === 'Planifiée' &&
    new Date(r.date) > now &&
    new Date(r.date) < in24h
  );

  for (const ride of upcoming) {
    await scheduleDepartureAlert(ride).catch(() => {});
  }
}

// Compatibilité avec l'ancien code DataContext
export async function startProximityAlert(ride) {
  return scheduleDepartureAlert(ride);
}

export async function stopProximityAlert() {}
