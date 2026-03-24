import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkHydrationHero } from './achievementManager';

const WATER_STORAGE_KEY_PREFIX = 'water_';
const DAILY_GOAL_KEY = 'water_daily_goal';

export interface WaterLog {
  id: number;
  label: string;
  time: string;
  amount: number;
  icon: string;
  timestamp: number; // for sorting
}

export interface DailyWater {
  date: string; // YYYY-MM-DD
  logs: WaterLog[];
  totalConsumed: number;
  goal: number;
}

// Format date to YYYY-MM-DD
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get Daily Goal
export const getDailyGoal = async (): Promise<number> => {
    try {
        const goal = await AsyncStorage.getItem(DAILY_GOAL_KEY);
        return goal ? parseInt(goal, 10) : 2500; // Default 2.5L
    } catch (e) {
        return 2500;
    }
};

// Set Daily Goal
export const setDailyGoal = async (goal: number): Promise<void> => {
    try {
        await AsyncStorage.setItem(DAILY_GOAL_KEY, goal.toString());
    } catch (e) {
        console.error("Error saving daily goal", e);
    }
};

// Get Water Logs for a specific date
export const getWaterLogs = async (date: Date): Promise<DailyWater> => {
    try {
        const dateStr = formatDate(date);
        const key = `${WATER_STORAGE_KEY_PREFIX}${dateStr}`;
        const stored = await AsyncStorage.getItem(key);
        const goal = await getDailyGoal();
        
        if (stored) {
            const parsed = JSON.parse(stored);
            // Ensure compatibility if we add fields later
            return {
                date: dateStr,
                logs: parsed.logs || [],
                totalConsumed: parsed.totalConsumed || 0,
                goal: goal // Always return current goal or saved goal? Let's use current goal for consistency across days or saved? Usually current settings apply.
            };
        }
        
        return {
            date: dateStr,
            logs: [],
            totalConsumed: 0,
            goal: goal
        };
    } catch (e) {
        console.error("Error getting water logs", e);
        return { date: formatDate(date), logs: [], totalConsumed: 0, goal: 2500 };
    }
};

// Save Water Logs for a specific date
export const saveWaterLogs = async (date: Date, logs: WaterLog[], totalConsumed: number): Promise<void> => {
    try {
        const dateStr = formatDate(date);
        const key = `${WATER_STORAGE_KEY_PREFIX}${dateStr}`;
        const data = {
            logs,
            totalConsumed
        };
        await AsyncStorage.setItem(key, JSON.stringify(data));

        // Check water achievements locally
        const goal = await getDailyGoal();
        // Yalnız bugünün tarixidirsə başarım yoxlanılsın
        const todayStr = formatDate(new Date());
        if (dateStr === todayStr) {
            await checkHydrationHero(totalConsumed, goal);
        }
    } catch (e) {
        console.error("Error saving water logs", e);
    }
};

// Add a water log (returns new state but doesn't save to storage)
export const createWaterLog = (currentData: DailyWater, amount: number, label: string, icon: string): DailyWater => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    
    const newLog: WaterLog = {
        id: Date.now(),
        label,
        time,
        amount,
        icon,
        timestamp: now.getTime()
    };
    
    const newLogs = [newLog, ...currentData.logs];
    const newTotal = currentData.totalConsumed + amount;
    
    return {
        ...currentData,
        logs: newLogs,
        totalConsumed: newTotal
    };
};

// Remove a water log (returns new state but doesn't save to storage)
export const removeWaterLog = (currentData: DailyWater, logId: number): DailyWater => {
    const logToDelete = currentData.logs.find(l => l.id === logId);
    
    if (!logToDelete) return currentData;
    
    const newLogs = currentData.logs.filter(l => l.id !== logId);
    const newTotal = Math.max(0, currentData.totalConsumed - logToDelete.amount);
    
    return {
        ...currentData,
        logs: newLogs,
        totalConsumed: newTotal
    };
};

