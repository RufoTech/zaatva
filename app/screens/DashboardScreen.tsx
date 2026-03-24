import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    ImageBackground,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { BatteryOptEnabled, RequestDisableOptimization } from 'react-native-battery-optimization-check';
import { getStoredSteps } from '../utils/stepManager';
import { useAchievements } from '../utils/useAchievements';
import { getWaterLogs } from '../utils/waterManager';
import { CustomAlert } from '@/utils/CustomAlert';

const { width } = Dimensions.get('window');

// Colors based on user's code
const theme = {
  light: {
    bg: '#f8f8f5',
    text: '#0f172a', // slate-900
    subtext: '#64748b', // slate-500
    cardBg: '#ffffff',
    cardBorder: '#e2e8f0', // slate-200
    primary: '#ccff00',
    navBg: 'rgba(255, 255, 255, 0.95)',
    navBorder: '#e2e8f0',
  },
  dark: {
    bg: '#1f230f',
    text: '#f1f5f9', // slate-100
    subtext: '#94a3b8', // slate-400
    cardBg: 'transparent',
    cardBorder: 'rgba(204, 255, 0, 0.2)',
    primary: '#ccff00',
    navBg: 'rgba(31, 35, 15, 0.95)',
    navBorder: 'rgba(204, 255, 0, 0.2)',
  }
};

export default function DashboardScreen() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);
  const currentTheme = isDark ? theme.dark : theme.light;
  const user = auth().currentUser;
  
  // Initialize initial achievements check
  useAchievements();
  
  const [waterData, setWaterData] = useState<{ today: number; yesterday: number }>({ today: 0, yesterday: 0 });
  const [stepsData, setStepsData] = useState<{ today: number; yesterday: number }>({ today: 0, yesterday: 0 });
  const [nutritionData, setNutritionData] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, goalCalories: 2400 });

  useFocusEffect(
    useCallback(() => {
      const loadActivityData = async () => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        // Water
        const waterToday = await getWaterLogs(today);
        const waterYesterday = await getWaterLogs(yesterday);
        setWaterData({
          today: waterToday.totalConsumed,
          yesterday: waterYesterday.totalConsumed
        });

        // Steps
        const stepsToday = await getStoredSteps(today);
        const stepsYesterday = await getStoredSteps(yesterday);
        setStepsData({
          today: stepsToday,
          yesterday: stepsYesterday
        });

        // Nutrition (Meals)
        try {
          const todayStr = today.toISOString().split('T')[0];
          const storedMeals = await AsyncStorage.getItem(`meals_${todayStr}`);
          const storedGoal = await AsyncStorage.getItem('goalCalories');
          
          let cals = 0, prot = 0, car = 0, f = 0;
          if (storedMeals) {
            const parsedMeals = JSON.parse(storedMeals);
            Object.values(parsedMeals).forEach((mealList: any) => {
              mealList.forEach((item: any) => {
                cals += Number(item.calories) || 0;
                prot += Number(item.protein) || 0;
                car += Number(item.carbs) || 0;
                f += Number(item.fat) || 0;
              });
            });
          }
          
          setNutritionData({
            calories: Math.round(cals),
            protein: Math.round(prot),
            carbs: Math.round(car),
            fat: Math.round(f),
            goalCalories: storedGoal ? parseInt(storedGoal) : 2400
          });
        } catch (error) {
          console.error("Error loading nutrition data:", error);
        }
      };

      loadActivityData();
    }, [])
  );

  const [activeProgram, setActiveProgram] = useState<any>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [dailyTips, setDailyTips] = useState<any[]>([]);

  useEffect(() => {
    const fetchDailyTips = async () => {
      try {
        const tipsSnapshot = await firestore()
          .collection('dailyTips')
          .limit(5)
          .get();
        
        const tips = tipsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setDailyTips(tips);
      } catch (error) {
        console.error("Error fetching daily tips:", error);
      }
    };

    fetchDailyTips();
  }, []);

  const handleRemoveProgram = async () => {
    if (!user) return;
    
    try {
      await firestore().collection('users').doc(user.uid).update({
        activeProgramId: firestore.FieldValue.delete()
      });
      setDeleteModalVisible(false);
    } catch (error) {
      console.error("Error removing program:", error);
      CustomAlert.show("Error", "Could not remove the program. Please try again.");
    }
  };

  const handleAddStepsPress = async () => {
    if (Platform.OS === 'android') {
        try {
            const isEnabled = await BatteryOptEnabled();
            if (isEnabled) {
                CustomAlert.show(
                    "Arxa Plan Məhdudiyyəti Açıqdır!",
                    "Addım sayarın arxa planda düzgün işləməsi üçün tətbiqin pil təsarüfü (Battery Optimization) məhdudiyyətini ləğv etməlisiniz.",
                    [
                        { text: "Ləğv et", style: "cancel" },
                        { 
                            text: "Məhdudiyyəti Qaldır", 
                            onPress: () => {
                                RequestDisableOptimization();
                            } 
                        }
                    ],
                    { cancelable: false }
                );
                return; // prevent navigation
            }
        } catch (error) {
            console.log("Battery optimization check error:", error);
        }
    }
    router.push('/screens/AddStepsScreen');
  };

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      const unsubscribeUser = firestore()
        .collection('users')
        .doc(user.uid)
        .onSnapshot(async (doc) => {
          if (doc.exists) {
            const userData = doc.data();
            if (userData?.activeProgramId) {
              // Fetch the active program details
              try {
                const programDoc = await firestore()
                  .collection('user_programs')
                  .doc(userData.activeProgramId)
                  .get();
                
                if (programDoc.exists) {
                  const data: any = programDoc.data();
                  let workoutCount = typeof data.workoutCount === 'number' ? data.workoutCount : 0;
                  let totalDuration = typeof data.totalDuration === 'number' ? data.totalDuration : 0;

                  if (data.weeks && (workoutCount === 0 || totalDuration === 0)) {
                    const weeks = Object.values(data.weeks);
                    for (const week of weeks as any[]) {
                      if (Array.isArray(week)) {
                        for (const day of week) {
                          if (day?.type === 'workout') {
                            workoutCount += 1;
                            if (day?.subtitle) {
                              const parts = String(day.subtitle).split('•');
                              if (parts.length > 1) {
                                const dur = parseInt(parts[1], 10);
                                if (!isNaN(dur)) totalDuration += dur;
                              }
                            }
                          }
                        }
                      }
                    }
                  }

                  let levelColor = theme.light.primary;
                  if (data.focus === 'Lose Weight') levelColor = '#3b82f6';
                  else if (data.focus === 'Get Stronger') levelColor = '#ef4444';

                  setActiveProgram({ 
                    id: programDoc.id, 
                    ...data,
                    level: data.focus || 'General',
                    levelColor: levelColor,
                    workoutCount,
                    totalDuration
                  });
                } else {
                  setActiveProgram(null);
                }
              } catch (error) {
                console.error("Error fetching active program:", error);
              }
            } else {
              setActiveProgram(null);
            }
          }
        });

      return () => unsubscribeUser();
    }, [user])
  );



  // Helper to calculate trend
  const getTrend = (current: number, previous: number, unit: string = '') => {
    if (previous === 0) return { text: current > 0 ? `+${current}${unit}` : '0', color: current > 0 ? '#22c55e' : '#94a3b8', icon: current > 0 ? 'trending-up' : 'remove' };
    
    const diff = current - previous;
    const percentage = Math.round((diff / previous) * 100);
    const isPositive = diff >= 0;
    
    return {
      text: `${isPositive ? '+' : ''}${percentage}%`,
      color: isPositive ? '#22c55e' : '#f87171',
      icon: isPositive ? 'trending-up' : 'trending-down'
    };
  };

  const waterTrend = getTrend(waterData.today, waterData.yesterday);
  const stepsTrend = getTrend(stepsData.today, stepsData.yesterday);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={currentTheme.bg} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: currentTheme.bg }}
      >
        
        {/* Header Section */}
        <View style={[styles.header, { backgroundColor: isDark ? 'rgba(31, 35, 15, 0.8)' : 'rgba(248, 248, 245, 0.8)' }]}>
          <View style={styles.headerLeft}>
            <View style={styles.profileContainer}>
              <View style={[styles.profileImageWrapper, { borderColor: currentTheme.primary }]}>
                <Image 
                  source={{ uri: user?.photoURL || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDST2ZsxuyNBNuOE4nUWskzn2dek6SkdNpRK-1V8eizyLFPuaDbSrFEYADilFjH73A8aPVJ-3pXHh0_ejVcQyewR8L_MitP5x5soBY-hiBfIxZkHAy3I6wyegKa1SZmU6_hm8nNv9DPGKDenheErnoO88ZCM3DaUSGwqxhlBw8uZ9mwA7B7grgfO2jRxb0VxJQXm94Jy7xfCx2EKk-Ux532x5Isar263C3QiJwA9xzKRHw1aDgKwh24iVDy8FxKJ3Z2kfE7gPybSTE' }} 
                  style={styles.profileImage}
                />
              </View>
              <View style={[styles.onlineStatus, { borderColor: currentTheme.bg }]} />
            </View>
            <View>
              <Text style={[styles.welcomeText, { color: currentTheme.subtext }]}>WELCOME BACK</Text>
              <Text style={[styles.userName, { color: currentTheme.text }]}>Hello, {user?.displayName ? user.displayName.split(' ')[0] : 'Alex'}!</Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            
          </View>
        </View>

        {/* Weekly Summary Section */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryContainer}>
          {/* Energy Card */}
          <View style={[styles.summaryCard, { backgroundColor: isDark ? currentTheme.cardBg : '#ffffff', borderColor: isDark ? currentTheme.cardBorder : '#e2e8f0' }]}>
            <View style={styles.summaryHeader}>
              <MaterialIcons name="local-fire-department" size={20} color="#f97316" />
              <Text style={[styles.summaryTitle, { color: currentTheme.subtext }]}>Energy</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[styles.summaryValue, { color: currentTheme.text }]}>{nutritionData.calories}</Text>
              <Text style={{ fontSize: 12, color: currentTheme.subtext, marginLeft: 2 }}>/ {nutritionData.goalCalories} kcal</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontSize: 10, color: currentTheme.subtext }}>P: {nutritionData.protein}g</Text>
              <Text style={{ fontSize: 10, color: currentTheme.subtext }}>C: {nutritionData.carbs}g</Text>
              <Text style={{ fontSize: 10, color: currentTheme.subtext }}>F: {nutritionData.fat}g</Text>
            </View>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: isDark ? currentTheme.cardBg : '#ffffff', borderColor: isDark ? currentTheme.cardBorder : '#e2e8f0' }]}>
            <View style={styles.summaryHeader}>
              <MaterialIcons name="water-drop" size={20} color="#3b82f6" />
              <Text style={[styles.summaryTitle, { color: currentTheme.subtext }]}>Water Intake</Text>
            </View>
            <Text style={[styles.summaryValue, { color: currentTheme.text }]}>{(waterData.today / 1000).toFixed(1)} L</Text>
            <View style={styles.trendContainer}>
              <MaterialIcons name={waterTrend.icon as any} size={16} color={waterTrend.color} />
              <Text style={[styles.trendText, { color: waterTrend.color }]}>{waterTrend.text}</Text>
            </View>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: isDark ? currentTheme.cardBg : '#ffffff', borderColor: isDark ? currentTheme.cardBorder : '#e2e8f0' }]}>
            <View style={styles.summaryHeader}>
              <MaterialCommunityIcons name="shoe-print" size={20} color={isDark ? '#22c55e' : '#15803d'} />
              <Text style={[styles.summaryTitle, { color: currentTheme.subtext }]}>Daily Steps</Text>
            </View>
            <Text style={[styles.summaryValue, { color: currentTheme.text }]}>{stepsData.today.toLocaleString()}</Text>
            <View style={styles.trendContainer}>
              <MaterialIcons name={stepsTrend.icon as any} size={16} color={stepsTrend.color} />
              <Text style={[styles.trendText, { color: stepsTrend.color }]}>{stepsTrend.text}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Quick Actions Carousel */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: currentTheme.subtext }]}>QUICK ACTIONS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleAddStepsPress}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <MaterialCommunityIcons name="shoe-print" size={24} color={currentTheme.text} />
              </View>
              <Text style={[styles.actionText, { color: currentTheme.text }]}>Add Steps</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/screens/LogWaterScreen')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <MaterialIcons name="water-drop" size={24} color={currentTheme.text} />
              </View>
              <Text style={[styles.actionText, { color: currentTheme.text }]}>Log Water</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/screens/AddMealScreen')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <MaterialIcons name="restaurant" size={24} color={currentTheme.text} />
              </View>
              <Text style={[styles.actionText, { color: currentTheme.text }]}>Add Meal</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/screens/BodyFatCalculatorScreen')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <MaterialCommunityIcons name="percent" size={24} color={currentTheme.text} />
              </View>
              <Text style={[styles.actionText, { color: currentTheme.text }]}>Body Fat</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/screens/CommunityMarketplaceScreen')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <MaterialIcons name="public" size={24} color={currentTheme.text} />
              </View>
              <Text style={[styles.actionText, { color: currentTheme.text }]}>Community</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/screens/WorkoutLibraryScreen')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <MaterialIcons name="fitness-center" size={24} color={currentTheme.text} />
              </View>
              <Text style={[styles.actionText, { color: currentTheme.text }]}>Workouts Library</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Featured Workout Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitleLarge, { color: currentTheme.text }]}>
              {"Today's Workout"}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.workoutCard, { borderColor: isDark ? 'rgba(204, 255, 0, 0.1)' : '#e2e8f0' }]}
            activeOpacity={0.9}
            onPress={() => {
              if (activeProgram?.id) {
                router.push({ pathname: '/screens/WeeklyProgramScreen', params: { programId: activeProgram.id } });
              } else {
                router.push('/screens/CreateProgramScreen');
              }
            }}
          >
            <ImageBackground
              source={{ uri: activeProgram?.coverImage || activeProgram?.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCI3xrdrlqpd6zybsFzh1uoDJW_RAThN-65xFUKUjIeLQpnVnoiBdvHicM2Wbj3MXYdOpqO6j1E4pWY7v1pknlmw5HdeqLDK4incQqa9CJ1ohskwTOTK2lKi8S9Qut8s28hZ1Vj4kHJ0aLsON8HKXM8Z18gFXJvw3nD8r0vvUpsAklNhALnZgZNUuJmw900bxjwFNxIGpFWSFYAR35orgrs2JlRxN-pYuZbTYcTVDChxhRA_3JnNbcYqDUf7MyxIt5HdTKhCvsfG_o' }}
              style={styles.workoutImage}
            >
              <LinearGradient
                colors={['rgba(2, 6, 23, 0.9)', 'rgba(2, 6, 23, 0.4)', 'transparent']}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={styles.workoutGradient}
              />
              <View style={styles.workoutContent}>
                <View style={styles.startBadgeContainer}>
                  <View style={[styles.startBadge, activeProgram?.levelColor ? { backgroundColor: activeProgram.levelColor } : {}]}>
                    <Text style={[styles.startBadgeText, { color: activeProgram?.levelColor ? '#1f230f' : '#1f230f' }]}>{activeProgram?.level?.toUpperCase() || (activeProgram ? 'CONTINUE' : "LET'S START")}</Text>
                  </View>
                  <View style={styles.clockContainer}>
                    {activeProgram ? null : (
                      <>
                        <Feather name="clock" size={12} color="#cbd5e1" />
                        <Text style={styles.clockText}>{"Let's Start"}</Text>
                      </>
                    )}
                  </View>
                </View>
                
                <Text style={styles.workoutTitle}>{activeProgram?.name || 'Your First Program'}</Text>
                
                {activeProgram ? (
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <MaterialIcons name="fitness-center" size={14} color="#1f230f" />
                      <Text style={styles.metaText}>{activeProgram.weeks ? Object.keys(activeProgram.weeks).length : 4} Weeks</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <MaterialIcons name="list-alt" size={14} color="#1f230f" />
                      <Text style={styles.metaText}>{activeProgram.exercises || `${activeProgram.workoutCount || 0} workouts`}</Text>
                    </View>
                    {activeProgram.totalDuration ? (
                      <View style={styles.metaItem}>
                        <Feather name="clock" size={12} color="#1f230f" />
                        <Text style={styles.metaText}>{activeProgram.totalDuration} mins/week</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.workoutDescription} numberOfLines={1}>
                    Design your personalized training plan to get started on your fitness journey.
                  </Text>
                )}
                
                <TouchableOpacity 
                  style={styles.createProgramButton}
                  onPress={() => {
                    if (activeProgram?.id) {
                      router.push({ pathname: '/screens/WeeklyProgramScreen', params: { programId: activeProgram.id } });
                    } else {
                      router.push('/screens/CreateProgramScreen');
                    }
                  }}
                >
                  <MaterialIcons name="play-arrow" size={20} color="#1f230f" />
                  <Text style={styles.createProgramText}>{activeProgram ? 'Continue Program' : 'Create Training Program'}</Text>
                </TouchableOpacity>

                {activeProgram && (
                  <TouchableOpacity 
                    style={[styles.createProgramButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginTop: 8 }]}
                    onPress={() => setDeleteModalVisible(true)}
                  >
                    <MaterialIcons name="close" size={20} color="#f1f5f9" />
                    <Text style={[styles.createProgramText, { color: '#f1f5f9' }]}>Remove Program</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </View>

        {/* Pro Tips Section */}
        {dailyTips.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitleLarge, { color: currentTheme.text }]}>
                Pro Tips
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tipsContainer}>
              {dailyTips.map(tip => (
                <View key={tip.id} style={[styles.tipCard, { backgroundColor: isDark ? currentTheme.cardBg : '#ffffff', borderColor: isDark ? currentTheme.cardBorder : '#e2e8f0' }]}>
                  {tip.image ? (
                    <Image source={{ uri: tip.image }} style={styles.tipImage} />
                  ) : (
                    <View style={[styles.tipImagePlaceholder, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                      <MaterialCommunityIcons name="lightbulb-on" size={32} color={currentTheme.primary} />
                    </View>
                  )}
                  <View style={styles.tipContent}>
                    <Text style={[styles.tipTitle, { color: currentTheme.text }]} numberOfLines={2}>
                      {tip.title}
                    </Text>
                    <Text style={[styles.tipDescription, { color: currentTheme.subtext }]} numberOfLines={3}>
                      {tip.description}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom Padding for TabBar */}
        <View style={{ height: 100 }} />

      </ScrollView>

      {/* Warning Modal for Deleting Program */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            
            <View style={styles.deleteModalIconContainer}>
              <View style={styles.deleteModalIconBg}>
                <MaterialIcons name="warning" size={40} color="#ccff00" />
              </View>
            </View>

            <View style={styles.deleteModalTextContent}>
              <Text style={styles.deleteModalTitle}>Delete Workout?</Text>
              <Text style={styles.deleteModalDescription}>
                Are you sure you want to delete this workout? This action cannot be undone.
              </Text>
            </View>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity 
                style={styles.deleteModalYesBtn}
                onPress={handleRemoveProgram}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteModalYesText}>Delete Workout</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.deleteModalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteModalCancelText}>Keep Workout</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileContainer: {
    position: 'relative',
  },
  profileImageWrapper: {
    padding: 2,
    borderRadius: 50,
    borderWidth: 2,
    backgroundColor: 'rgba(204, 255, 0, 0.2)',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  onlineStatus: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
  },
  welcomeText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 20,
    paddingTop: 10,
  },
  summaryCard: {
    width: 160,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
    paddingLeft: 4,
  },
  actionsContainer: {
    gap: 12,
    paddingBottom: 8,
  },
  actionButton: {
    alignItems: 'center',
    gap: 8,
    minWidth: 84,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#ccff00",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5.46,
    elevation: 3,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleLarge: {
    fontSize: 20,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  workoutCard: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  workoutImage: {
    width: '100%',
    height: '100%',
  },
  workoutGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  workoutContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  startBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  startBadge: {
    backgroundColor: '#ccff00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  startBadgeText: {
    color: '#1f230f',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  clockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clockText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  workoutTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  workoutDescription: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ccff00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  metaText: {
    color: '#1f230f',
    fontSize: 12,
    fontWeight: '600',
  },
  metaDot: {
    color: '#64748b',
    fontSize: 12,
  },
  createProgramButton: {
    backgroundColor: '#ccff00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  createProgramText: {
    color: '#1f230f',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingBottom: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#12140a',
    borderRadius: 40,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center',
  },
  deleteModalIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  deleteModalIconBg: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalTextContent: {
    alignItems: 'center',
    marginBottom: 40,
  },
  deleteModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalDescription: {
    fontSize: 16,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 24,
  },
  deleteModalActions: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  deleteModalYesBtn: {
    width: '100%',
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  deleteModalYesText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteModalCancelBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ccff00',
  },
  deleteModalCancelText: {
    color: '#ccff00',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tipsContainer: {
    gap: 16,
    paddingBottom: 8,
  },
  tipCard: {
    width: 240,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tipImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  tipImagePlaceholder: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipContent: {
    padding: 16,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  tipDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
});
