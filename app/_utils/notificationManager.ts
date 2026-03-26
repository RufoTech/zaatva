import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    return false;
  }
  
  // Create a channel for Android 8.0+
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('hydration-reminders', {
      name: 'Hydration Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ccff00',
    });
  }
  
  return true;
}

export default function Dummy() { return null; }

export const cancelAllHydrationReminders = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

export const scheduleHydrationReminders = async (
  startTime: Date,
  endTime: Date,
  intervalMinutes: number
) => {
  // Cancel existing first
  await cancelAllHydrationReminders();

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return false;

  // Normalize start and end times to today for calculation
  const start = new Date();
  start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
  
  const end = new Date();
  end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

  // If end time is before start time, assume it ends next day (though for daily reminders we usually stick to one day cycle)
  // Let's assume strict daily window: e.g. 08:00 to 22:00
  if (end <= start) {
      end.setDate(end.getDate() + 1);
  }

  let currentTrigger = new Date(start);
  
  // Add first interval
  currentTrigger.setMinutes(currentTrigger.getMinutes() + intervalMinutes);

  let count = 0;

  // Loop until we reach end time
  while (currentTrigger < end) {
      const triggerHour = currentTrigger.getHours();
      const triggerMinute = currentTrigger.getMinutes();

      // Time interval trigger instead of daily specific time
      await Notifications.scheduleNotificationAsync({
          content: {
              title: "Time to hydrate! 💧",
              body: "Drink a glass of water to reach your daily goal.",
              sound: true,
              data: { time: currentTrigger.toISOString() }
          },
          trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: (count + 1) * intervalMinutes * 60,
              repeats: false,
          },
      });

      currentTrigger.setMinutes(currentTrigger.getMinutes() + intervalMinutes);
      count++;
      
      // Safety break to prevent infinite loops if interval is 0 or very small
      if (count > 50) break;
  }

  return true;
};
