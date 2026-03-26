import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { checkStepAchievements } from './achievementManager';

const STORAGE_KEY_PREFIX = 'steps_';
const TRACKING_START_DATE_KEY = 'tracking_start_date';
export const BACKGROUND_STEP_TASK = 'BACKGROUND_STEP_TASK';

export interface DailySteps {
  date: string; // YYYY-MM-DD
  steps: number;
  goal: number;
}

// Format date to YYYY-MM-DD
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get steps for a specific date from storage
export const getStoredSteps = async (date: Date): Promise<number> => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${formatDate(date)}`;
    const stored = await AsyncStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  } catch (error) {
    console.error('Error reading steps from storage:', error);
    return 0;
  }
};

// Save steps for a specific date
export const saveSteps = async (date: Date, steps: number): Promise<void> => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${formatDate(date)}`;
    await AsyncStorage.setItem(key, steps.toString());

    // Check step achievements
    const history = await getAllHistory();
    const allTimeSteps = history.reduce((sum, d) => sum + d.steps, 0);
    
    // Calculate streak
    let streakDays = 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    for (let i = 0; i < history.length; i++) {
      // check backward from today
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayData = history.find(h => h.date === formatDate(d));
      if (dayData && dayData.steps >= dayData.goal) {
        streakDays++;
      } else if (i > 0) {
        // Break the streak if not today and goal not met
        break;
      }
    }

    await checkStepAchievements(steps, allTimeSteps, streakDays);
  } catch (error) {
    console.error('Error saving steps to storage:', error);
  }
};

// Check if Pedometer is available
export const isPedometerAvailable = async (): Promise<boolean> => {
  return await Pedometer.isAvailableAsync();
};

// Initialize or get tracking start date
export const getTrackingStartDate = async (): Promise<string> => {
    try {
        let start = await AsyncStorage.getItem(TRACKING_START_DATE_KEY);
        if (!start) {
            start = formatDate(new Date());
            await AsyncStorage.setItem(TRACKING_START_DATE_KEY, start);
        }
        return start;
    } catch (e) {
        return formatDate(new Date());
    }
};

// Get steps for the last 7 days (or from start date)
export const getLast7DaysSteps = async (): Promise<DailySteps[]> => {
  const startDateStr = await getTrackingStartDate();
  const startDate = new Date(startDateStr);
  const today = new Date();
  
  // Calculate the date 6 days ago
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  
  // The effective start date is the later of (trackingStartDate, sevenDaysAgo)
  // We want to show a maximum of 7 days, but not before trackingStartDate
  
  // Normalize dates to remove time
  startDate.setHours(0,0,0,0);
  sevenDaysAgo.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  
  const effectiveStart = startDate > sevenDaysAgo ? startDate : sevenDaysAgo;
  
  const days: DailySteps[] = [];
  
  // Loop from effectiveStart to today
  // We need to calculate how many days are in this range
  const diffTime = Math.abs(today.getTime() - effectiveStart.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  // Iterate from 0 to diffDays
  for (let i = 0; i <= diffDays; i++) {
      const d = new Date(effectiveStart);
      d.setDate(d.getDate() + i);
      
      // Safety check to not go beyond today (though logic should prevent it)
      if (d > today) break;

      const steps = await getStoredSteps(d);
      days.push({
          date: formatDate(d),
          steps,
          goal: 10000,
      });
  }
  
  // Sort chronological (Oldest first) as per user description "18, 19"
  return days.sort((a, b) => a.date.localeCompare(b.date));
};

// Get ALL recorded steps
export const getAllHistory = async (): Promise<DailySteps[]> => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const stepKeys = keys.filter(k => k.startsWith(STORAGE_KEY_PREFIX));
        
        const days: DailySteps[] = [];
        for (const key of stepKeys) {
            const dateStr = key.replace(STORAGE_KEY_PREFIX, '');
            const stepsStr = await AsyncStorage.getItem(key);
            const steps = stepsStr ? parseInt(stepsStr, 10) : 0;
            days.push({
                date: dateStr,
                steps,
                goal: 10000
            });
        }
        
        // Sort chronological
        return days.sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) {
        console.error("Error getting all history", e);
        return [];
    }
};

// Get steps for a specific month
export const getMonthSteps = async (year: number, month: number): Promise<DailySteps[]> => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: DailySteps[] = [];
  
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    const steps = await getStoredSteps(date);
    days.push({
      date: formatDate(date),
      steps,
      goal: 10000,
    });
  }
  return days;
};

// Define Background Task
TaskManager.defineTask(BACKGROUND_STEP_TASK, async () => {
  try {
    const isAvailable = await Pedometer.isAvailableAsync();
    if (!isAvailable) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // You can't actively watch in background via Pedometer without a foreground service in standard React Native.
    // However, if the device hardware supports step counting natively, we can fetch steps for 'today'
    // by asking Pedometer for steps between start of day and now.
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    
    // Attempt to get historical steps for today
    // Note: This requires specific permissions on iOS/Android to read historical data
    const result = await Pedometer.getStepCountAsync(start, end);
    
    if (result && result.steps) {
        const today = new Date();
        const storedSteps = await getStoredSteps(today);
        
        // If background fetched steps are higher than what we have, update it.
        // Or we can just overwrite it since it's the total from the device for today.
        if (result.steps > storedSteps) {
            await saveSteps(today, result.steps);
            return BackgroundFetch.BackgroundFetchResult.NewData;
        }
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("Background Fetch Error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register Background Task
export const registerBackgroundFetchAsync = async () => {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_STEP_TASK, {
    minimumInterval: 15 * 60, // 15 minutes
    stopOnTerminate: false, // android only,
    startOnBoot: true, // android only
  });
};

// Unregister Background Task
export const unregisterBackgroundFetchAsync = async () => {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_STEP_TASK);
};
