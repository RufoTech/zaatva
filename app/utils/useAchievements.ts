import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import { checkEarlyBird, checkFlexibilityGuru } from './achievementManager';

const INSTALL_DATE_KEY = 'app_install_date';

export const useAchievements = () => {
  useEffect(() => {
    const checkInitialAchievements = async () => {
      try {
        const user = auth().currentUser;
        if (!user) return; // Do not check if no user is authenticated

        console.log(`[useAchievements Firebase] Checking initial achievements...`);
        
        // Check Early Bird
        await checkEarlyBird();

        // Manage Install Date for Flexibility Guru
        let installDateStr = await AsyncStorage.getItem(INSTALL_DATE_KEY);
        if (!installDateStr) {
          // First time running the app, save current time
          const now = Date.now();
          await AsyncStorage.setItem(INSTALL_DATE_KEY, now.toString());
          installDateStr = now.toString();
        }

        // Check Flexibility Guru
        const installDate = parseInt(installDateStr, 10);
        await checkFlexibilityGuru(installDate);

      } catch (error) {
        console.error("[useAchievements Local] Error checking initial achievements:", error);
      }
    };

    checkInitialAchievements();
  }, []);
};
