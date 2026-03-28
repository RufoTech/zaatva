import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { ACHIEVEMENTS, getUnlockedAchievements, getUserXp } from '../_utils/achievementManager';
import { AppEvents } from '../_utils/eventEmitter';

const { width } = Dimensions.get('window');

const PRIMARY = "#ccff00";
const BG_DARK = "#12140a";
const CARD_BG = "#1c1f10";
const LOCKED_GRAY = "#4a4a4a";
const TEXT_MUTED = "#94a3b8";

// Calculate level based on XP (e.g. 500 XP per level)
const getLevelInfo = (xp: number) => {
  const XP_PER_LEVEL = 500;
  const currentLevel = Math.floor(xp / XP_PER_LEVEL) + 1;
  const nextLevel = currentLevel + 1;
  const currentLevelXp = xp % XP_PER_LEVEL;
  const progress = (currentLevelXp / XP_PER_LEVEL) * 100;

  return {
    currentLevel,
    nextLevel,
    currentLevelXp,
    requiredXp: XP_PER_LEVEL,
    progress
  };
};

export default function AchievementsScreen() {
  const router = useRouter();
  const [unlockedAchievements, setUnlockedAchievements] = useState<any[]>([]);
  const [userXp, setUserXp] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const xp = await getUserXp();
      setUserXp(xp);

      const unlockedRecord = await getUnlockedAchievements();
      const unlockedArray = Object.values(unlockedRecord);
      
      console.log("[AchievementsScreen Local] Unlocked achievements:", unlockedArray.map(u => u.id));
      setUnlockedAchievements(unlockedArray);
    } catch (error) {
      console.error("Error loading local achievements", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for real-time updates when an achievement is unlocked while screen is open
    const handleUpdate = () => {
      loadData();
    };

    AppEvents.on('ACHIEVEMENTS_UPDATED', handleUpdate);

    return () => {
      AppEvents.off('ACHIEVEMENTS_UPDATED', handleUpdate);
    };
  }, []);

  const levelInfo = getLevelInfo(userXp);

  // Map our predefined ACHIEVEMENTS with unlock status
  const displayAchievements = Object.values(ACHIEVEMENTS).map(ach => {
    // Both unlockedData.id and ach.id should match exactly
    const unlockedData = unlockedAchievements.find(u => String(u.id) === String(ach.id));
    
    let statusText = 'Locked';
    if (unlockedData?.unlockedAt) {
      const date = new Date(unlockedData.unlockedAt);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      statusText = `Unlocked ${monthNames[date.getMonth()]} ${date.getDate()}`;
    } else if (unlockedData) {
      statusText = 'Unlocked';
    }

    return {
      ...ach,
      status: statusText,
      isUnlocked: !!unlockedData,
      customText: ach.id === 'first_10k' ? '10K' : undefined
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Hall of Fame</Text>
            <MaterialIcons name="emoji-events" size={28} color={PRIMARY} />
        </View>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.headerSubtitle}>Your Progress & Achievements</Text>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={{ color: TEXT_MUTED, marginTop: 12, fontWeight: 'bold' }}>Loading achievements...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Badges & Milestones</Text>

          <View style={styles.grid}>
            {displayAchievements.map((item) => (
              <View key={item.id} style={[styles.badgeContainer, !item.isUnlocked && styles.lockedOpacity]}>
                <View style={styles.badgeWrapper}>
                    <View style={[
                        styles.badgeCircle, 
                        item.isUnlocked ? styles.unlockedBorder : styles.lockedBorder,
                        item.isUnlocked && styles.glowEffect
                    ]}>
                      <MaterialIcons 
                          name={item.icon as any} 
                          size={36} 
                          color={item.isUnlocked ? PRIMARY : LOCKED_GRAY} 
                      />
                      {item.customText && (
                          <Text style={styles.customIconText}>{item.customText}</Text>
                      )}
                    </View>
                    {/* Locked Padlock Icon */}
                    {!item.isUnlocked && (
                        <View style={styles.lockIconContainer}>
                            <MaterialIcons name="lock" size={12} color="#ffffff" />
                        </View>
                    )}
                </View>
                <Text style={styles.badgeTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.badgeStatus}>{item.status}</Text>
              </View>
            ))}
          </View>
          
          {/* Spacer for footer */}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Progress Footer */}
      <View style={styles.footer}>
        <View style={styles.levelRow}>
            <Text style={styles.levelText}>Level {levelInfo.currentLevel}</Text>
            <Text style={styles.levelText}>Level {levelInfo.nextLevel}</Text>
        </View>
        
        <View style={styles.progressContainer}>
            <View style={[styles.progressFill, { width: `${levelInfo.progress}%` }]} />
            <View style={styles.progressOverlay}>
                <Text style={styles.progressValue}>{levelInfo.currentLevelXp} / {levelInfo.requiredXp} XP</Text>
                <Text style={styles.progressPercent}>{Math.round(levelInfo.progress)}%</Text>
            </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: TEXT_MUTED,
    fontSize: 16,
    paddingHorizontal: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeContainer: {
    width: (width - 48 - 32) / 3, // 3 columns, 24px padding sides, 16px gap
    alignItems: 'center',
    marginBottom: 32,
  },
  lockedOpacity: {
    opacity: 0.6,
  },
  badgeWrapper: {
      position: 'relative',
      marginBottom: 12,
  },
  badgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockedBorder: {
    borderColor: PRIMARY,
  },
  lockedBorder: {
    borderColor: LOCKED_GRAY,
  },
  glowEffect: {
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 10,
  },
  customIconText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: PRIMARY,
      marginTop: -4,
  },
  lockIconContainer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#374151',
      borderRadius: 12,
      padding: 4,
      borderWidth: 2,
      borderColor: CARD_BG,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 16,
  },
  badgeStatus: {
    fontSize: 10,
    color: TEXT_MUTED,
    marginTop: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: 'rgba(26, 29, 11, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(204, 255, 0, 0.1)',
  },
  levelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 8,
  },
  levelText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 'bold',
  },
  progressContainer: {
      width: '100%',
      height: 40,
      backgroundColor: '#3d422a',
      borderRadius: 20,
      position: 'relative',
      overflow: 'hidden',
  },
  progressFill: {
      height: '100%',
      backgroundColor: PRIMARY,
      borderRadius: 20,
  },
  progressOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
  },
  progressValue: {
      color: '#000000',
      fontWeight: '900',
      fontSize: 14,
      fontStyle: 'italic',
      flex: 1,
      textAlign: 'center',
      marginLeft: 30, // to offset the percentage width for perfect center
  },
  progressPercent: {
      color: '#000000',
      fontWeight: '900',
      fontSize: 14,
      fontStyle: 'italic',
  }
});
