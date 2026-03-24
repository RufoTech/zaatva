import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, StatusBar, TextInput, ScrollView, Dimensions, Alert, Modal } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { getWaterLogs, createWaterLog, removeWaterLog, getDailyGoal, setDailyGoal, WaterLog, saveWaterLogs } from '../utils/waterManager';
import { scheduleHydrationReminders } from '../utils/notificationManager';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CustomAlert } from '@/utils/CustomAlert';

const PRIMARY = "#ccff00";
const BG_DARK = "#12140a"; 
const TEXT_COLOR = "#f1f5f9";
const SUBTEXT = "#94a3b8";
const { width, height } = Dimensions.get('window');

const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function LogWaterScreen() {
  const [consumed, setConsumed] = useState(0);
  const [goal, setGoal] = useState(2500);
  const [customAmount, setCustomAmount] = useState("");
  const [history, setHistory] = useState<WaterLog[]>([]);
  const [weekDays, setWeekDays] = useState<any[]>([]);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isGoalEditing, setIsGoalEditing] = useState(false);
  const [tempGoal, setTempGoal] = useState("");
  
  // Reminder State
  const [startTime, setStartTime] = useState(() => {
      const d = new Date();
      d.setHours(8, 0, 0, 0);
      return d;
  });
  const [endTime, setEndTime] = useState(() => {
      const d = new Date();
      d.setHours(22, 0, 0, 0);
      return d;
  });
  const [frequency, setFrequency] = useState(60); // minutes
  const [customFreq, setCustomFreq] = useState("");
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const router = useRouter();

  // Calculate percentage for ring
  const percentage = Math.min(Math.round((consumed / goal) * 100), 100);
  const R = 115; 
  const CIRC = 2 * Math.PI * R;
  const strokeDashoffset = CIRC - (percentage / 100) * CIRC;

  const loadData = async (date: Date) => {
      const data = await getWaterLogs(date);
      setConsumed(data.totalConsumed);
      setHistory(data.logs);
      
      // Goal is global, but we can update it if needed or just use current state if we want persistent global goal
      const storedGoal = await getDailyGoal();
      setGoal(storedGoal);
  };

  useFocusEffect(
      useCallback(() => {
          loadData(selectedDate);
      }, [selectedDate])
  );

  useEffect(() => {
    generateCalendar(selectedDate);
  }, [selectedDate]);

  const generateCalendar = (date: Date) => {
    const days = [];
    // Show 7 days window centering the selected date or just a week view?
    // User asked: "yuxarıdaki calendarda indiki günümüz qeyd olunsun ayın 18 indeyikse 18i aktiv olacaq.ve calendar teqvimide olsun yuxarıda aylara göre baxa bilek."
    // Let's make a simple week view for now that contains the selected Date.
    
    // Find Monday of the current week for the selected date
    const currentDay = date.getDay(); // 0-6
    const monday = new Date(date);
    monday.setDate(date.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push({
            dayName: dayNames[i],
            dayNumber: d.getDate(),
            fullDate: new Date(d),
            isSelected: d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear(),
            isToday: isSameDay(d, new Date())
        });
    }
    setWeekDays(days);
  };

  const isSameDay = (d1: Date, d2: Date) => {
      return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  }

  const handleDayPress = (date: Date) => {
      setSelectedDate(date);
  };

  const handlePrevWeek = () => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() - 7);
      setSelectedDate(newDate);
  };

  const handleNextWeek = () => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 7);
      setSelectedDate(newDate);
  };

  const addWater = (amount: number, label: string, icon: string) => {
    // Just update state, don't save to storage yet
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
    
    const newHistory = [newLog, ...history];
    setHistory(newHistory);
    
    // Calculate new total consumed
    const newTotal = newHistory.reduce((sum, item) => sum + item.amount, 0);
    setConsumed(newTotal);
  };

  const deleteItem = (id: number) => {
      // Just update state, don't save to storage yet
      const newHistory = history.filter(item => item.id !== id);
      setHistory(newHistory);
      
      // Calculate new total consumed
      const newTotal = newHistory.reduce((sum, item) => sum + item.amount, 0);
      setConsumed(newTotal);
  };

  const handleCustomAdd = () => {
    const val = parseInt(customAmount);
    if (val > 0) {
      addWater(val, `Custom amount`, "water-plus-outline");
      setCustomAmount("");
    }
  };

  const handleGoalUpdate = async () => {
      const newGoal = parseInt(tempGoal);
      if (newGoal > 0) {
          setGoal(newGoal);
          setIsGoalEditing(false);
      }
  };

  const handleSaveProgram = async () => {
      // Save everything to storage
      await saveWaterLogs(selectedDate, history, consumed);
      await setDailyGoal(goal);
      CustomAlert.show("Success", "Water log saved successfully!");
      router.back();
  };

  const handleSaveReminder = async () => {
      let interval = frequency;
      if (customFreq) {
          const custom = parseInt(customFreq);
          if (custom > 0) interval = custom;
      }

      const success = await scheduleHydrationReminders(startTime, endTime, interval);
      
      if (success) {
          setReminderVisible(false);
          CustomAlert.show("Success", `Hydration reminder set every ${interval} minutes!`);
      } else {
          CustomAlert.show("Permission Required", "Please enable notifications to set reminders.");
      }
  };

  const onStartTimeChange = (event: any, selectedTime?: Date) => {
      setShowStartTimePicker(false);
      if (selectedTime) {
          setStartTime(selectedTime);
      }
  };

  const onEndTimeChange = (event: any, selectedTime?: Date) => {
      setShowEndTimePicker(false);
      if (selectedTime) {
          setEndTime(selectedTime);
      }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Top App Bar */}
      <View style={styles.header}>
        <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Log Water</Text>
          <Text style={styles.headerSubtitle}>LOG YOUR WATER INTAKE</Text>
        </View>

        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="settings" size={24} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Month Navigation */}
        <View style={styles.monthNav}>
            <TouchableOpacity onPress={handlePrevWeek}>
                <MaterialIcons name="chevron-left" size={24} color={SUBTEXT} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}</Text>
            <TouchableOpacity onPress={handleNextWeek}>
                <MaterialIcons name="chevron-right" size={24} color={SUBTEXT} />
            </TouchableOpacity>
        </View>

        {/* Week View Calendar */}
        <View style={styles.calendarContainer}>
            {weekDays.map((day, index) => (
                <TouchableOpacity key={index} style={styles.dayColumn} onPress={() => handleDayPress(day.fullDate)}>
                    <Text style={[styles.dayName, day.isSelected && { color: PRIMARY }]}>{day.dayName}</Text>
                    <View style={[
                        styles.dayCircle, 
                        day.isSelected && styles.activeDayCircle,
                        day.isToday && !day.isSelected && styles.todayCircle
                    ]}>
                        <Text style={[
                            styles.dayNumber,
                            day.isSelected && styles.activeDayNumber
                        ]}>{day.dayNumber}</Text>
                    </View>
                </TouchableOpacity>
            ))}
        </View>

        {/* Central Visualization */}
        <View style={styles.progressSection}>
            <View style={styles.ringContainer}>
                <Svg width={256} height={256} viewBox="0 0 256 256" style={{ transform: [{ rotate: '-90deg' }] }}>
                    <Defs>
                        <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={PRIMARY} stopOpacity="0.4" />
                            <Stop offset="1" stopColor={PRIMARY} stopOpacity="1" />
                        </LinearGradient>
                    </Defs>
                    {/* Background Circle */}
                    <Circle
                        cx="128"
                        cy="128"
                        r={R}
                        fill="transparent"
                        stroke="#363a27"
                        strokeWidth="24"
                    />
                    {/* Progress Circle */}
                    <Circle
                        cx="128"
                        cy="128"
                        r={R}
                        fill="transparent"
                        stroke={PRIMARY}
                        strokeWidth="24"
                        strokeDasharray={CIRC}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </Svg>
                
                {/* Inner Content */}
                <View style={styles.ringContent}>
                    <MaterialIcons name="water-drop" size={48} color={PRIMARY} style={{ marginBottom: 8 }} />
                    <View style={styles.valueContainer}>
                        <Text style={styles.consumedText}>{(consumed / 1000).toFixed(1)}</Text>
                        <Text style={styles.separatorText}>/</Text>
                        
                        {isGoalEditing ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 8 }}>
                                <TextInput 
                                    value={tempGoal}
                                    onChangeText={setTempGoal}
                                    style={[styles.goalInput, { minWidth: 50, textAlign: 'center' }]}
                                    keyboardType="numeric"
                                    autoFocus
                                    onBlur={handleGoalUpdate}
                                    onSubmitEditing={handleGoalUpdate}
                                    selectionColor={PRIMARY}
                                />
                                <Text style={[styles.goalText, { fontSize: 16, marginLeft: 2 }]}>ml</Text>
                            </View>
                        ) : (
                            <TouchableOpacity 
                                onPress={() => {
                                    setTempGoal(goal.toString());
                                    setIsGoalEditing(true);
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(204,255,0,0.3)' }}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.goalText}>{(goal / 1000).toFixed(1)}L</Text>
                                <MaterialIcons name="edit" size={14} color={PRIMARY} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={styles.percentageText}>{percentage}% Completed</Text>
                </View>
            </View>

            <View style={styles.dailyGoalContainer}>
                <Text style={styles.dailyGoalTitle}>Daily Goal</Text>
                <Text style={styles.dailyGoalSubtitle}>Tap the value above to edit</Text>
            </View>
        </View>

        {/* Quick Add Section */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Add Water</Text>
                <View style={styles.quickLogBadge}>
                    <Text style={styles.quickLogText}>QUICK LOG</Text>
                </View>
            </View>

            <View style={styles.quickButtonsGrid}>
                {[
                    { amount: 250, icon: "water-outline", label: "+250ml" },
                    { amount: 500, icon: "bottle-soda-classic-outline", label: "+500ml" },
                    { amount: 750, icon: "water-percent", label: "+750ml" },
                ].map((item, index) => (
                    <TouchableOpacity 
                        key={index}
                        style={styles.quickButton}
                        onPress={() => addWater(item.amount, "Quick Add", item.icon)}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name={item.icon as any} size={28} color={PRIMARY} style={{ marginBottom: 4 }} />
                        <Text style={styles.quickButtonText}>{item.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Custom Input */}
            <View style={styles.customInputContainer}>
                <View style={styles.inputIconContainer}>
                    <MaterialIcons name="edit" size={20} color={customAmount ? PRIMARY : SUBTEXT} />
                </View>
                <TextInput
                    style={styles.input}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    placeholder="Custom amount (ml)"
                    placeholderTextColor={SUBTEXT}
                    keyboardType="numeric"
                    onSubmitEditing={handleCustomAdd}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleCustomAdd}>
                    <Text style={styles.addButtonText}>ADD</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* History List */}
        <View style={[styles.section, { paddingBottom: 20 }]}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>History ({isSameDay(selectedDate, new Date()) ? "Today" : monthNames[selectedDate.getMonth()] + " " + selectedDate.getDate()})</Text>
                <TouchableOpacity>
                    <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.historyList}>
                {history.length === 0 ? (
                    <Text style={{ color: SUBTEXT, textAlign: 'center', padding: 20 }}>No records for this day.</Text>
                ) : (
                    history.map((item) => (
                        <View key={item.id} style={styles.historyItem}>
                            <View style={styles.historyLeft}>
                                <View style={styles.historyIconContainer}>
                                    <MaterialCommunityIcons name={item.icon as any} size={20} color={PRIMARY} />
                                </View>
                                <View>
                                    <Text style={styles.historyLabel}>{item.label}</Text>
                                    <Text style={styles.historyTime}>{item.time}</Text>
                                </View>
                            </View>
                            <View style={styles.historyRight}>
                                <Text style={styles.historyAmount}>+{item.amount}ml</Text>
                                <TouchableOpacity onPress={() => deleteItem(item.id)}>
                                    <MaterialIcons name="delete" size={20} color={SUBTEXT} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>
            
            {/* Hydration Reminder Button (Moved here) */}
             <TouchableOpacity 
                style={[styles.reminderButton, { marginTop: 16 }]} 
                activeOpacity={0.9}
                onPress={() => setReminderVisible(true)}
             >
                  <MaterialIcons name="notifications-active" size={20} color={BG_DARK} />
                  <Text style={styles.reminderButtonText}>SAVE HYDRATION REMINDER</Text>
              </TouchableOpacity>
        </View>
        
        <View style={{ height: 100 }} />

      </ScrollView>
      
      {/* Sticky Bottom Save Button */}
      <View style={styles.stickyFooter}>
          <TouchableOpacity style={styles.saveProgramButton} activeOpacity={0.9} onPress={handleSaveProgram}>
              <MaterialCommunityIcons name="check-circle" size={24} color={BG_DARK} />
              <Text style={styles.saveProgramButtonText}>SAVE PROGRAM</Text>
          </TouchableOpacity>
      </View>

      {/* Reminder Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reminderVisible}
        onRequestClose={() => setReminderVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <TouchableOpacity 
                style={styles.modalBackdrop} 
                activeOpacity={1} 
                onPress={() => setReminderVisible(false)}
            />
            <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Set Hydration Reminder</Text>
                    <Text style={styles.modalSubtitle}>Stay consistent with your water intake</Text>
                </View>

                <View style={styles.timeSection}>
                    {/* Start Time */}
                    <View style={styles.timeRow}>
                        <View style={styles.timeLabelContainer}>
                            <MaterialIcons name="schedule" size={16} color={TEXT_COLOR} />
                            <Text style={styles.timeLabel}>Start Time</Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.timePickerButton}
                            onPress={() => setShowStartTimePicker(true)}
                        >
                            <Text style={styles.timePickerText}>
                                {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* End Time */}
                    <View style={styles.timeRow}>
                        <View style={styles.timeLabelContainer}>
                            <MaterialIcons name="bedtime" size={16} color={TEXT_COLOR} />
                            <Text style={styles.timeLabel}>End Time</Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.timePickerButton}
                            onPress={() => setShowEndTimePicker(true)}
                        >
                            <Text style={styles.timePickerText}>
                                {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Frequency */}
                    <View style={styles.freqSection}>
                        <View style={styles.timeLabelContainer}>
                            <MaterialIcons name="notifications-active" size={16} color={TEXT_COLOR} />
                            <Text style={styles.timeLabel}>Frequency (min)</Text>
                        </View>
                        <View style={styles.freqGrid}>
                            <TouchableOpacity 
                                style={[styles.freqButton, frequency === 30 && !customFreq && styles.freqButtonActive]}
                                onPress={() => { setFrequency(30); setCustomFreq(""); }}
                            >
                                <Text style={[styles.freqButtonText, frequency === 30 && !customFreq && styles.freqButtonTextActive]}>30m</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.freqButton, frequency === 60 && !customFreq && styles.freqButtonActive]}
                                onPress={() => { setFrequency(60); setCustomFreq(""); }}
                            >
                                <Text style={[styles.freqButtonText, frequency === 60 && !customFreq && styles.freqButtonTextActive]}>60m</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.freqButton, frequency === 120 && !customFreq && styles.freqButtonActive]}
                                onPress={() => { setFrequency(120); setCustomFreq(""); }}
                            >
                                <Text style={[styles.freqButtonText, frequency === 120 && !customFreq && styles.freqButtonTextActive]}>120m</Text>
                            </TouchableOpacity>
                        </View>
                        
                        {/* Custom Frequency Input */}
                        <View style={styles.customFreqContainer}>
                            <TextInput
                                style={styles.customFreqInput}
                                placeholder="Custom minutes"
                                placeholderTextColor={SUBTEXT}
                                keyboardType="numeric"
                                value={customFreq}
                                onChangeText={(text) => {
                                    setCustomFreq(text);
                                    if (text) setFrequency(0); // Deselect presets
                                }}
                            />
                        </View>
                    </View>
                </View>

                {showStartTimePicker && (
                    <DateTimePicker
                        value={startTime}
                        mode="time"
                        is24Hour={true}
                        display="default"
                        onChange={onStartTimeChange}
                    />
                )}

                {showEndTimePicker && (
                    <DateTimePicker
                        value={endTime}
                        mode="time"
                        is24Hour={true}
                        display="default"
                        onChange={onEndTimeChange}
                    />
                )}

                <TouchableOpacity 
                    style={styles.modalSaveButton} 
                    onPress={handleSaveReminder}
                >
                    <Text style={styles.modalSaveButtonText}>Save Reminder</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(18, 20, 10, 0.8)', // BG_DARK with opacity
    zIndex: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_COLOR,
    lineHeight: 22,
  },
  headerSubtitle: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(204, 255, 0, 0.7)',
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Month Nav
  monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      marginTop: 16,
      marginBottom: 8,
  },
  monthTitle: {
      color: TEXT_COLOR,
      fontSize: 16,
      fontWeight: '600',
  },
  // Calendar
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dayColumn: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  dayName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: SUBTEXT,
    textTransform: 'uppercase',
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDayCircle: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  todayCircle: {
    borderColor: PRIMARY,
    borderWidth: 1,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  activeDayNumber: {
    color: BG_DARK,
  },
  // Goal Input
  goalInput: {
      color: TEXT_COLOR,
      fontSize: 24,
      fontWeight: 'bold',
      padding: 0,
      margin: 0,
  },
  // Progress
  progressSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  ringContainer: {
    width: 256,
    height: 256,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 5,
  },
  ringContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  consumedText: {
    fontSize: 36,
    fontWeight: '800',
    color: TEXT_COLOR,
    letterSpacing: -1,
  },
  separatorText: {
    fontSize: 24,
    fontWeight: '500',
    color: SUBTEXT,
    marginHorizontal: 2,
  },
  goalText: {
    fontSize: 24,
    fontWeight: '500',
    color: SUBTEXT,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
    marginTop: 4,
  },
  dailyGoalContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  dailyGoalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  dailyGoalSubtitle: {
    color: SUBTEXT,
    fontSize: 14,
    marginTop: 4,
  },
  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  quickLogBadge: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  quickLogText: {
    fontSize: 10,
    fontWeight: '700',
    color: PRIMARY,
  },
  // Buttons Grid
  quickButtonsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // dark:bg-primary/5
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.2)',
  },
  quickButtonText: {
    fontWeight: '700',
    fontSize: 14,
    color: TEXT_COLOR,
  },
  // Input
  customInputContainer: {
    position: 'relative',
    marginTop: 8,
  },
  inputIconContainer: {
    position: 'absolute',
    left: 16,
    top: 18,
    zIndex: 1,
  },
  input: {
    width: '100%',
    paddingLeft: 48,
    paddingRight: 80,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: TEXT_COLOR,
    fontSize: 14,
  },
  addButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    bottom: 8,
    paddingHorizontal: 16,
    backgroundColor: PRIMARY,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: BG_DARK,
    fontWeight: '700',
    fontSize: 12,
  },
  // History
  viewAllText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(30, 41, 59, 0.8)',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(204, 255, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLabel: {
    fontWeight: '700',
    fontSize: 14,
    color: TEXT_COLOR,
  },
  historyTime: {
    fontSize: 11,
    color: SUBTEXT,
    marginTop: 2,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyAmount: {
    fontWeight: '700',
    color: PRIMARY,
    fontSize: 14,
  },
  // Footer
  footerSection: {
      paddingHorizontal: 16,
      paddingBottom: 20,
  },
  reminderButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  reminderButtonText: {
    color: BG_DARK,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  stickyFooter: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: 'rgba(18, 20, 10, 0.95)',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveProgramButton: {
      width: '100%',
      paddingVertical: 18,
      backgroundColor: PRIMARY,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      shadowColor: PRIMARY,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 8,
  },
  saveProgramButtonText: {
      color: BG_DARK,
      fontWeight: '900',
      fontSize: 16,
      letterSpacing: 1,
  },
  // Modal
  modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
  },
  modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
      backgroundColor: BG_DARK,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingBottom: 40,
      paddingTop: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      maxHeight: height * 0.8,
  },
  modalHandle: {
      width: 48,
      height: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 3,
      alignSelf: 'center',
      marginBottom: 24,
  },
  modalHeader: {
      alignItems: 'center',
      marginBottom: 32,
  },
  modalTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: TEXT_COLOR,
      marginBottom: 4,
  },
  modalSubtitle: {
      fontSize: 14,
      color: SUBTEXT,
  },
  timeSection: {
      gap: 24,
      marginBottom: 40,
  },
  timeRow: {
      gap: 12,
  },
  timeLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
  },
  timeLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: TEXT_COLOR,
  },
  timePickerButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
  },
  timePickerText: {
      color: PRIMARY,
      fontSize: 18,
      fontWeight: '700',
  },
  freqSection: {
      gap: 12,
  },
  freqGrid: {
      flexDirection: 'row',
      gap: 12,
  },
  freqButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
  },
  freqButtonText: {
      color: TEXT_COLOR,
      fontSize: 12,
      fontWeight: '500',
  },
  freqButtonActive: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: PRIMARY,
      backgroundColor: 'rgba(204, 255, 0, 0.1)',
      alignItems: 'center',
      shadowColor: PRIMARY,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 15,
      elevation: 5,
  },
  freqButtonTextActive: {
      color: PRIMARY,
      fontSize: 12,
      fontWeight: '700',
  },
  customFreqContainer: {
      marginTop: 4,
  },
  customFreqInput: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      color: TEXT_COLOR,
      paddingVertical: 12,
      paddingHorizontal: 16,
      fontSize: 14,
  },
  modalSaveButton: {
      width: '100%',
      paddingVertical: 16,
      backgroundColor: PRIMARY,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: PRIMARY,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
  },
  modalSaveButtonText: {
      color: BG_DARK,
      fontWeight: '700',
      fontSize: 16,
  },
});
