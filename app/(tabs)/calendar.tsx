import { FontAwesome6, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { getStoredSteps } from '../_utils/stepManager';
import { DailyWater, getWaterLogs } from '../_utils/waterManager';

const PRIMARY = "#ccff00";
const BG_DARK = "#1f230f";
const TEXT_WHITE = "#f1f5f9";
const TEXT_MUTED = "#94a3b8";
const BORDER_COLOR = "rgba(255, 255, 255, 0.05)";

const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export default function CalendarScreen() {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(currentDate.getDate());

  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<any>({});
  const [waterData, setWaterData] = useState<DailyWater | null>(null);
  const [steps, setSteps] = useState(0);
  const [nutritionData, setNutritionData] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, goalCalories: 2400 });
  const [loading, setLoading] = useState(true);

  const currentMonthName = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const daysInMonthCount = new Date(currentYear, currentDate.getMonth() + 1, 0).getDate();
  const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);
  const firstDayOfMonth = new Date(currentYear, currentDate.getMonth(), 1).getDay(); // 0-6

  const fetchNutritionForDate = async (dateObj: Date) => {
    try {
      const dateStr = dateObj.toISOString().split('T')[0];
      const storedMeals = await AsyncStorage.getItem(`meals_${dateStr}`);
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

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        const user = auth().currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        try {
          const selectedDateObj = new Date(currentYear, currentDate.getMonth(), selectedDay);
          const water = await getWaterLogs(selectedDateObj);
          setWaterData(water);

          const stps = await getStoredSteps(selectedDateObj);
          setSteps(stps);

          await fetchNutritionForDate(selectedDateObj);

          const userDoc = await firestore().collection('users').doc(user.uid).get();
          if (typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists) {
            const progId = userDoc.data()?.activeProgramId;
            setActiveProgramId(progId || null);

            if (progId) {
              const progDoc = await firestore().collection('users').doc(user.uid).collection('program_progress').doc(progId).get();
              if (typeof progDoc.exists === 'function' ? progDoc.exists() : progDoc.exists) {
                setCompletedWorkouts(progDoc.data() || {});
              }

              const token = await user.getIdToken();
              const response = await fetch(`${API_URL}/api/program-weeks?programId=${progId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                const data = await response.json();
                const week1 = data.weeks?.['1'] || [];
                const formattedSchedule = week1.map((item: any) => ({
                  id: item.id,
                  day: item.day,
                  title: item.title,
                  type: item.type || 'workout',
                  duration: item.subtitle ? parseInt(String(item.subtitle).split('•')[1] || '45') : 45,
                  note: item.subtitle || (item.type === 'rest' ? "Rest & Recover" : "")
                })).sort((a: any, b: any) => a.day - b.day);

                setSchedule(formattedSchedule);
              }
            } else {
              setSchedule([]);
            }
          }
        } catch (error) {
          console.error("Error loading calendar data:", error);
        } finally {
          setLoading(false);
        }
      };

      loadData();
    }, [])
  );

  const getDayStyle = (day: number) => {
    if (day === selectedDay && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()) {
      return styles.dayCellActive;
    }
    if (day === selectedDay) return styles.dayCellActive;
    return styles.dayCell;
  };

  const getTextStyle = (day: number) => {
    if (day === selectedDay) return styles.dayTextActive;
    return styles.dayText;
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
    setSelectedDay(1);
  };

  // When a specific day is pressed
  const handleDayPress = async (day: number) => {
    setSelectedDay(day);
    const selectedDateObj = new Date(currentYear, currentDate.getMonth(), day);

    // Update local data specifically for this day without reloading everything
    const water = await getWaterLogs(selectedDateObj);
    setWaterData(water);

    const stps = await getStoredSteps(selectedDateObj);
    setSteps(stps);

    await fetchNutritionForDate(selectedDateObj);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />

      {/* Top Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color={TEXT_WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar</Text>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="search" size={24} color={TEXT_WHITE} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Month Navigation Header */}
        <View style={styles.monthNav}>
          <Text style={styles.monthTitle}>{currentMonthName} {currentYear}</Text>
          <View style={styles.monthControls}>
            <TouchableOpacity style={styles.navButton} onPress={() => changeMonth(-1)}>
              <MaterialIcons name="chevron-left" size={24} color={TEXT_WHITE} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => changeMonth(1)}>
              <MaterialIcons name="chevron-right" size={24} color={TEXT_WHITE} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Grid View */}
        <View style={styles.calendarGrid}>
          {/* Days Header */}
          <View style={styles.weekHeader}>
            {daysOfWeek.map((day, index) => (
              <Text key={index} style={styles.weekDayText}>{day}</Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}

            {daysInMonth.map((day) => (
              <TouchableOpacity
                key={day}
                style={getDayStyle(day)}
                onPress={() => handleDayPress(day)}
              >
                <Text style={getTextStyle(day)}>{day}</Text>
              </TouchableOpacity>
            ))}

            {/* Trailing empty cells to fill the grid if necessary */}
            {Array.from({ length: (42 - (firstDayOfMonth + daysInMonthCount)) % 7 }).map((_, i) => (
              <Text key={`trailing-${i}`} style={styles.dayTextTrailing}>{i + 1}</Text>
            ))}
          </View>
        </View>

        {/* Daily Schedule Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{"Today's Schedule"}</Text>
            <Text style={styles.dateLabel}>{currentMonthName} {selectedDay}, {currentYear}</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={PRIMARY} style={{ marginTop: 20 }} />
          ) : !activeProgramId ? (
            <View style={{ alignItems: 'center', padding: 20 }}>
              <Text style={{ color: TEXT_MUTED }}>No active workout</Text>
            </View>
          ) : schedule.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 20 }}>
              <Text style={{ color: TEXT_MUTED }}>No schedule available</Text>
            </View>
          ) : (
            (() => {
              // Find the first incomplete workout to show the START button
              const nextWorkout = schedule.find(item => {
                if (item.type === 'rest') return false;
                const isCompleted = completedWorkouts && completedWorkouts['WEEK 1'] ? completedWorkouts['WEEK 1'][item.day] === true : false;
                return !isCompleted;
              });

              return schedule.map((item) => {
                const isCompleted = completedWorkouts && completedWorkouts['WEEK 1'] ? completedWorkouts['WEEK 1'][item.day] === true : false;
                const isNextWorkout = nextWorkout && item.day === nextWorkout.day;

                if (item.type === 'rest') {
                  return (
                    <Animated.View key={item.day} style={styles.restDayCard} entering={FadeInDown.delay(100).springify()} layout={Layout.springify()}>
                      <View style={styles.restIconBox}>
                        <MaterialIcons name="bedtime" size={24} color={TEXT_MUTED} />
                      </View>
                      <View>
                        <Text style={styles.restTitle}>Active Recovery - Day {item.day}</Text>
                        <Text style={styles.restSubtitle}>{item.note}</Text>
                      </View>
                    </Animated.View>
                  );
                }

                return (
                  <Animated.View key={item.day} style={isCompleted ? styles.scheduleCardCompleted : styles.scheduleCardUpcoming} entering={FadeInDown.delay(150).springify()} layout={Layout.springify()}>
                    <View style={styles.scheduleRow}>
                      <View>
                        <Text style={styles.scheduleTitle}>{item.title} - Day {item.day}</Text>
                        <View style={styles.scheduleMeta}>
                          <MaterialIcons name="schedule" size={14} color={TEXT_MUTED} />
                          <Text style={styles.scheduleMetaText}>{item.note}</Text>
                        </View>
                      </View>
                      {isCompleted ? (
                        <View style={styles.statusBadgeCompleted}>
                          <MaterialIcons name="check-circle" size={12} color={BG_DARK} />
                          <Text style={styles.statusTextCompleted}>COMPLETED</Text>
                        </View>
                      ) : isNextWorkout ? (
                        <TouchableOpacity
                          style={styles.startButton}
                          activeOpacity={0.8}
                          onPress={() => router.push({
                            pathname: '/screens/WeeklyProgramScreen',
                            params: { programId: activeProgramId }
                          })}
                        >
                          <Text style={styles.startButtonText}>START</Text>
                          <MaterialIcons name="play-arrow" size={16} color={BG_DARK} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.statusBadgeUpcoming}>
                          <Text style={styles.statusTextUpcoming}>UPCOMING</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                );
              });
            })()
          )}
        </View>

        {/* Daily Activity */}
        <Animated.View style={styles.section} entering={FadeIn.delay(300)}>
          <Text style={styles.sectionTitle}>Daily Activity</Text>

          {/* Energy Summary Card */}
          <Animated.View style={[styles.energyCard, { marginBottom: 16 }]} entering={FadeInUp.delay(400).springify()}>
            <View style={styles.activityHeader}>
              <MaterialIcons name="local-fire-department" size={20} color="#f97316" />
              <Text style={styles.activityLabel}>ENERGY</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
              <Text style={styles.activityValue}>{nutritionData.calories}</Text>
              <Text style={styles.activitySubtext}> / {nutritionData.goalCalories} kcal</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: TEXT_MUTED }}>Protein: {nutritionData.protein}g</Text>
              <Text style={{ fontSize: 12, color: TEXT_MUTED }}>Carbs: {nutritionData.carbs}g</Text>
              <Text style={{ fontSize: 12, color: TEXT_MUTED }}>Fat: {nutritionData.fat}g</Text>
            </View>
            <View style={[styles.progressBarBg, { marginTop: 12 }]}>
              <View style={[styles.progressBarFill, { width: `${Math.min((nutritionData.calories / nutritionData.goalCalories) * 100, 100)}%`, backgroundColor: '#f97316' }]} />
            </View>
          </Animated.View>

          <Animated.View style={styles.activityGrid} entering={FadeInUp.delay(500).springify()}>
            {/* Steps */}
            <View style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <FontAwesome6 name="shoe-prints" size={16} color={PRIMARY} />
                <Text style={styles.activityLabel}>STEPS</Text>
              </View>
              <View>
                <Text style={styles.activityValue}>{steps.toLocaleString()}</Text>
                <Text style={styles.activitySubtext}>/ 10,000 steps</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min((steps / 10000) * 100, 100)}%` }]} />
              </View>
            </View>

            {/* Hydration */}
            <View style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <MaterialIcons name="water-drop" size={20} color={PRIMARY} />
                <Text style={styles.activityLabel}>HYDRATION</Text>
              </View>
              <View>
                <Text style={styles.activityValue}>{waterData?.totalConsumed || 0} ml</Text>
                <Text style={styles.activitySubtext}>/ {waterData?.goal || 2500} ml</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(((waterData?.totalConsumed || 0) / (waterData?.goal || 2500)) * 100, 100)}%` }]} />
              </View>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Bottom Spacer */}
        <View style={{ height: 100 }} />

      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_WHITE,
  },
  content: {
    // padding: 16, // removed padding to match full width sections
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  monthTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_WHITE,
  },
  monthControls: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarGrid: {
    padding: 16,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94a3b8', // slate-400
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  dayCell: {
    width: '14.28%', // 100% / 7
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellActive: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 24, // Circle
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_WHITE,
  },
  dayTextActive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: BG_DARK,
  },
  dayTextTrailing: {
    width: '14.28%',
    height: 48,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b', // slate-500
    opacity: 0.3,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_WHITE,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
  scheduleCardCompleted: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
    marginBottom: 16,
  },
  scheduleCardUpcoming: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 16,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  scheduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleMetaText: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  statusBadgeCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTextCompleted: {
    fontSize: 10,
    fontWeight: 'bold',
    color: BG_DARK,
  },
  statusBadgeUpcoming: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTextUpcoming: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TEXT_MUTED,
  },
  restDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  restIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  restSubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  activityCard: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  energyCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  activityLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TEXT_WHITE,
    letterSpacing: 1,
  },
  activityValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_WHITE,
    marginBottom: 2,
  },
  activitySubtext: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 12,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  startButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: BG_DARK,
  },
});
