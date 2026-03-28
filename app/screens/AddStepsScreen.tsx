import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Platform, StatusBar, Dimensions, AppState, AppStateStatus, Alert } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Pedometer } from 'expo-sensors';
import * as IntentLauncher from 'expo-intent-launcher';
import { BatteryOptEnabled, RequestDisableOptimization } from 'react-native-battery-optimization-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredSteps, saveSteps, getLast7DaysSteps, getAllHistory, getMonthSteps, formatDate, DailySteps, registerBackgroundFetchAsync, unregisterBackgroundFetchAsync } from '../_utils/stepManager';
import { CustomAlert } from '@/utils/CustomAlert';

const PRIMARY = "#ccff00";
const BG_DARK = "#1f230f";
const { width } = Dimensions.get('window');

const GOAL_COUNT = 10000;
const R = 110;
const CIRC = 2 * Math.PI * R;

const levelStyles: any = {
  "border-low": { borderWidth: 2, borderColor: `${PRIMARY}33` },
  "border-mid": { borderWidth: 2, borderColor: `${PRIMARY}66` },
  "fill-low": { backgroundColor: `${PRIMARY}33` },
  "full-glow": { 
    backgroundColor: PRIMARY, 
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10
  },
  "fill-high": { backgroundColor: `${PRIMARY}99` },
  "border-full": { borderWidth: 2, borderColor: PRIMARY },
  "fill-xlow": { backgroundColor: `${PRIMARY}1a` },
  full: { backgroundColor: PRIMARY },
  "border-xlow": { borderWidth: 2, borderColor: `${PRIMARY}1a` },
  "fill-mid": { backgroundColor: `${PRIMARY}66` },
  "fill-xhigh": { backgroundColor: `${PRIMARY}cc` },
  empty: { backgroundColor: "#1e293b" },
};

const getLevelTextColor = (level: string) => {
    if (level === 'full' || level === 'full-glow' || level.includes('fill-high') || level.includes('fill-mid')) {
        return '#0f172a';
    }
    if (level === 'border-full') return PRIMARY;
    if (level === 'empty') return '#475569';
    return '#94a3b8';
}

const getLevelForSteps = (steps: number, goal: number) => {
    const p = steps / goal;
    if (p >= 1) return "full-glow"; // Met goal
    if (p >= 0.8) return "fill-high";
    if (p >= 0.6) return "fill-mid";
    if (p >= 0.4) return "fill-low";
    if (p >= 0.2) return "fill-xlow";
    if (p > 0) return "border-xlow";
    return "empty";
};

const weekDays = ["M", "T", "W", "T", "F", "S", "S"];

export default function AddStepsScreen() {
  const [calOpen, setCalOpen] = useState(true);
  const router = useRouter();
  
  // Pedometer State
  const [currentSteps, setCurrentSteps] = useState(0);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState('checking');
  const [pastDays, setPastDays] = useState<DailySteps[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isBlocked, setIsBlocked] = useState(false);
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  const subscription = useRef<Pedometer.Subscription | null>(null);
  const appState = useRef(AppState.currentState);

  // Load initial data
  useEffect(() => {
    const init = async () => {
      // 1. Önce İzin Kontrolü Yap
      if (Platform.OS === 'android') {
        const { status } = await Pedometer.requestPermissionsAsync();
        if (status !== 'granted') {
          CustomAlert.show(
            "İcazə Lazımdır",
            "Addım sayarın işləməsi üçün fiziki aktivlik icazəsi verməlisiniz.",
            [
              { 
                text: "Geri qayıt", 
                onPress: () => router.back(),
                style: "cancel"
              },
              { 
                text: "Ayarlara get", 
                onPress: () => {
                  IntentLauncher.startActivityAsync(
                    IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
                    { data: 'package:com.radevolopment.greenfit' }
                  );
                  router.back();
                } 
              }
            ]
          );
          return; // İzin yoksa diğer işlemleri yapma
        }
      }

      const available = await Pedometer.isAvailableAsync();
      setIsPedometerAvailable(String(available));

      if (available) {
        // Load today's stored steps first
        const today = new Date();
        const stored = await getStoredSteps(today);
        setCurrentSteps(stored);
        
        // Start tracking
        subscribe();
        
        // Setup background fetch
        await registerBackgroundFetchAsync();
      }

      // Load history
      loadHistory();
    };

    init();

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  const checkBatteryOptimization = async () => {
      if (Platform.OS === 'android') {
          try {
              const isEnabled = await BatteryOptEnabled();
              if (isEnabled) {
                  setIsBlocked(true);
                  CustomAlert.show(
                      "Arxa Plan Məhdudiyyəti Açıqdır!",
                      "Addım sayarın arxa planda düzgün işləməsi üçün tətbiqin pil təsarüfü (Battery Optimization) məhdudiyyətini ləğv etməlisiniz.",
                      [
                          { 
                              text: "Geri qayıt", 
                              onPress: () => router.back(),
                              style: "cancel"
                          },
                          { 
                              text: "Məhdudiyyəti Qaldır", 
                              onPress: () => {
                                  RequestDisableOptimization();
                              } 
                          }
                      ],
                      { cancelable: false }
                  );
              } else {
                  setIsBlocked(false);
              }
          } catch (error) {
              console.log("Battery optimization check error:", error);
          }
      }
  };

  useFocusEffect(
    useCallback(() => {
      checkBatteryOptimization();
    }, [])
  );

  // Effect to update calendar when month changes or steps update
  useEffect(() => {
    loadCalendarData();
  }, [currentMonth, currentSteps]); // Reload when steps update to reflect today's progress in calendar

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground
      // We might want to refresh data here
      loadHistory();
    }
    appState.current = nextAppState;
  };

  const subscribe = async () => {
    const isAvailable = await Pedometer.isAvailableAsync();
    if (isAvailable) {
      if (subscription.current) return;
      
      const today = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // 1. Önce bugünün donanım geçmişini (toplam adım) çekmeyi dene
      try {
          const pastSteps = await Pedometer.getStepCountAsync(startOfDay, today);
          if (pastSteps && pastSteps.steps > 0) {
              const stored = await getStoredSteps(today);
              // Cihazın saydığı adım, bizim kaydettiğimizden fazlaysa güncelle
              if (pastSteps.steps > stored) {
                  setCurrentSteps(pastSteps.steps);
                  await saveSteps(today, pastSteps.steps);
              }
          }
      } catch (e) {
          console.log("Geçmiş adımlar alınamadı", e);
      }

      let previousStepCount: number | null = null;
      let lastDateString = formatDate(new Date());

      // Use a slightly different approach: just trust the delta from the pedometer
      subscription.current = Pedometer.watchStepCount(result => {
        const now = new Date();
        const currentDateString = formatDate(now);
        const stepsSinceSubscription = result.steps;
        
        if (previousStepCount === null) {
            previousStepCount = stepsSinceSubscription;
            return;
        }

        const delta = stepsSinceSubscription - previousStepCount;
        previousStepCount = stepsSinceSubscription;

        if (delta > 0) {
            setCurrentSteps(prev => {
                // Check for day change
                if (currentDateString !== lastDateString) {
                    lastDateString = currentDateString;
                    const newTotal = delta;
                    saveSteps(now, newTotal);
                    return newTotal;
                } else {
                    const newTotal = prev + delta;
                    saveSteps(now, newTotal);
                    return newTotal;
                }
            });
        }
      });
    }
  };

  const unsubscribe = () => {
    subscription.current && subscription.current.remove();
    subscription.current = null;
  };

  const loadHistory = async () => {
    let days: DailySteps[] = [];
    if (showAllHistory) {
      days = await getAllHistory();
    } else {
      days = await getLast7DaysSteps();
    }
    setPastDays(days);
  };

  useEffect(() => {
    loadHistory();
  }, [showAllHistory]);

  const loadCalendarData = async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get stored steps for the month
    const monthSteps = await getMonthSteps(year, month);
    
    // Calculate leading empty days
    // getDay() returns 0 for Sunday. We want Monday to be 0 if possible, or adjust.
    // The UI has "M T W T F S S". So Monday is first.
    // Standard getDay: Sun=0, Mon=1...Sat=6.
    // To make Mon=0: (day + 6) % 7
    const firstDay = new Date(year, month, 1).getDay();
    const leadingEmpty = (firstDay + 6) % 7;

    const days = monthSteps.map((d, index) => ({
      day: index + 1,
      level: getLevelForSteps(d.steps, d.goal)
    }));
    
    // If we are in the current month, update today's entry with live data
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === month) {
        const todayDay = today.getDate();
        const todayIndex = days.findIndex(d => d.day === todayDay);
        if (todayIndex !== -1) {
            days[todayIndex].level = getLevelForSteps(currentSteps, GOAL_COUNT);
        }
    }

    setCalendarDays({ leadingEmpty, days });
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentMonth(newDate);
  };

  const pct = Math.min(Math.round((currentSteps / GOAL_COUNT) * 100), 100);
  const offset = CIRC - (pct / 100) * CIRC;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const monthNamesAz = [
    "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
    "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"
  ];

  const currentMonthName = `${monthNames[currentMonth.getMonth()]} | ${monthNamesAz[currentMonth.getMonth()]}`;

  if (isBlocked) {
      return (
          <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
              <StatusBar barStyle="light-content" backgroundColor="#1f230f" />
              <View style={{ padding: 24, alignItems: 'center' }}>
                  <MaterialIcons name="battery-alert" size={64} color={PRIMARY} style={{ marginBottom: 16 }} />
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 }}>
                      Arxa Plan Məhdudiyyəti Açıqdır!
                  </Text>
                  <Text style={{ fontSize: 16, color: '#ccc', textAlign: 'center', marginBottom: 24 }}>
                      Addım sayarın arxa planda işləməsi üçün tətbiqin pil təsarüfü (Battery Optimization) məhdudiyyətini ləğv etməlisiniz.
                  </Text>
                  
                  <TouchableOpacity 
                      style={{ backgroundColor: PRIMARY, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginBottom: 12, width: '100%' }}
                      onPress={() => {
                          RequestDisableOptimization();
                      }}
                  >
                      <Text style={{ color: '#000', fontWeight: 'bold', textAlign: 'center' }}>Məhdudiyyəti Qaldır</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                      style={{ paddingVertical: 12, paddingHorizontal: 24, width: '100%' }}
                      onPress={() => router.back()}
                  >
                      <Text style={{ color: '#ccc', fontWeight: 'bold', textAlign: 'center' }}>Geri Qayıt</Text>
                  </TouchableOpacity>
              </View>
          </SafeAreaView>
      );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f230f" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Steps </Text>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="settings" size={24} color="#f1f5f9" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Circular Progress */}
        <View style={styles.progressSection}>
            <View style={styles.circleContainer}>
                <Svg width={256} height={256} viewBox="0 0 256 256" style={{ transform: [{ rotate: '-90deg' }] }}>
                    <Circle
                        cx="128"
                        cy="128"
                        r={R}
                        fill="transparent"
                        stroke="#1e293b"
                        strokeWidth="12"
                    />
                    <Circle
                        cx="128"
                        cy="128"
                        r={R}
                        fill="transparent"
                        stroke={PRIMARY}
                        strokeWidth="12"
                        strokeDasharray={CIRC}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                    />
                </Svg>
                <View style={styles.progressTextContainer}>
                    <Text style={styles.stepsText}>{currentSteps.toLocaleString()}</Text>
                    <Text style={styles.goalText}>/ {GOAL_COUNT.toLocaleString()}</Text>
                </View>
            </View>
            <View style={styles.motivationContainer}>
                <Text style={styles.motivationTitle}>
                    {pct >= 100 ? "Goal Reached!" : "Keep moving!"}
                </Text>
            </View>
        </View>

        {/* Goal Progress Bar */}
        <View style={styles.section}>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardLabel}>Daily Goal</Text>
                    <Text style={styles.percentageText}>{pct}%</Text>
                </View>
                <View style={styles.barBackground}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
            </View>
        </View>

        {/* Calendar */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>Monthly Activity</Text>
                    <TouchableOpacity 
                        style={styles.expandButton}
                        onPress={() => setCalOpen(!calOpen)}
                    >
                        <MaterialIcons 
                            name={calOpen ? "expand-less" : "expand-more"} 
                            size={24} 
                            color="#f1f5f9" 
                        />
                    </TouchableOpacity>
                </View>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                    <TouchableOpacity onPress={() => changeMonth(-1)}>
                        <MaterialIcons name="chevron-left" size={24} color={PRIMARY} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>{currentMonthName}</Text>
                    <TouchableOpacity onPress={() => changeMonth(1)}>
                        <MaterialIcons name="chevron-right" size={24} color={PRIMARY} />
                    </TouchableOpacity>
                </View>
            </View>

            {calOpen && calendarDays.days && (
                <View style={styles.calendarCard}>
                    <View style={styles.weekDaysGrid}>
                        {weekDays.map((d, i) => (
                            <Text key={i} style={styles.weekDayText}>{d}</Text>
                        ))}
                    </View>
                    <View style={styles.daysGrid}>
                        {Array.from({ length: calendarDays.leadingEmpty || 0 }, (_, i) => (
                            <View key={`e-${i}`} style={styles.dayCell} />
                        ))}
                        {calendarDays.days.map(({ day, level }: any) => (
                            <View 
                                key={day} 
                                style={[styles.dayCell, styles.dayCircle, levelStyles[level]]}
                            >
                                <Text style={[styles.dayText, { color: getLevelTextColor(level) }]}>{day}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.legendContainer}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: PRIMARY }]} />
                            <Text style={styles.legendText}>Goal Met</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { borderWidth: 1, borderColor: PRIMARY }]} />
                            <Text style={styles.legendText}>Partial</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{showAllHistory ? "All Activity | Bütün Aktivlik" : "Last 7 Days | Son 7 gün"}</Text>
                <TouchableOpacity 
                    style={styles.expandButton}
                    onPress={() => setShowAllHistory(!showAllHistory)}
                >
                    <Text style={{color: PRIMARY, fontWeight: 'bold'}}>{showAllHistory ? "Son 7 gün" : "Bütün Günlər"}</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.recentList}>
                {pastDays.map(({ date, steps: s, goal: g }, index) => {
                    const p = Math.min((s / g) * 100, 100);
                    const met = s >= g;
                    return (
                        <View key={index} style={styles.recentCard}>
                            <View style={styles.recentHeader}>
                                <Text style={styles.recentDate}>{date}</Text>
                                <Text style={[styles.recentSteps, { color: met ? PRIMARY : "#94a3b8" }]}>
                                    {s.toLocaleString()} steps
                                </Text>
                            </View>
                            <View style={styles.barBackground}>
                                <View 
                                    style={[
                                        styles.barFill, 
                                        { width: `${p}%`, backgroundColor: met ? PRIMARY : `${PRIMARY}66` }
                                    ]} 
                                />
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b', // slate-800
    backgroundColor: BG_DARK,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  progressSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  circleContainer: {
    width: 256,
    height: 256,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsText: {
    fontSize: 40, // 4xl equivalent approx
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  goalText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#94a3b8', // slate-400
    marginTop: 4,
  },
  motivationContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  motivationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)', // slate-800/40
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b', // slate-800
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  percentageText: {
    fontSize: 24,
    fontWeight: '900',
    color: PRIMARY,
  },
  barBackground: {
    height: 12,
    backgroundColor: '#334155', // slate-700
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  expandButton: {
    padding: 4,
    borderRadius: 12,
  },
  monthText: {
    fontSize: 14,
    fontWeight: '500',
    color: PRIMARY,
  },
  calendarCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)', // slate-800/30
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
  },
  weekDaysGrid: {
    flexDirection: 'row',
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  weekDayText: {
    width: (width - 64) / 7, // approximate width calculation
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b', // slate-500
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // justifyContent: 'space-between',
  },
  dayCell: {
    width: (width - 70) / 7, // width minus padding / 7
    aspectRatio: 1,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    borderRadius: 999,
  },
  dayText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recentList: {
    gap: 16,
  },
  recentCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1', // slate-300
  },
  recentSteps: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
