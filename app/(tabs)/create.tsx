import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function CreateScreen() {
  const router = useRouter();

  const options = [
    {
      id: 'create-program',
      title: 'Create Program',
      subtitle: 'Design a structured multi-week training plan.',
      icon: 'calendar-plus',
      iconFam: 'FontAwesome5',
      route: '/screens/CreateProgramScreen',
      color: '#ccff00',
    },
    {
      id: 'custom-workout',
      title: 'Custom Workout',
      subtitle: 'Build a specific daily workout routine.',
      icon: 'dumbbell',
      iconFam: 'FontAwesome5',
      route: '/screens/CreateCustomWorkoutScreen',
      color: '#3b82f6',
    },
    {
      id: 'add-meal',
      title: 'Add Meal',
      subtitle: 'Log your daily nutrition or create custom food.',
      icon: 'utensils',
      iconFam: 'FontAwesome5',
      route: '/screens/AddMealScreen',
      color: '#f97316',
    },
    {
      id: 'log-water',
      title: 'Log Hydration',
      subtitle: 'Track your daily water intake.',
      icon: 'tint',
      iconFam: 'FontAwesome5',
      route: '/screens/LogWaterScreen',
      color: '#0ea5e9',
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create & Log</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={styles.pageDescription}>
          What would you like to do today? Choose an option below to start tracking your progress.
        </Animated.Text>

        <View style={styles.grid}>
          {options.map((item, index) => (
            <Animated.View key={item.id} entering={FadeInUp.delay(index * 150 + 200).springify()}>
              <TouchableOpacity 
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                  {item.iconFam === 'FontAwesome5' ? (
                    <FontAwesome5 name={item.icon} size={28} color={item.color} />
                  ) : (
                    <MaterialIcons name={item.icon as any} size={28} color={item.color} />
                  )}
                </View>
                <View style={styles.cardTextContainer}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f230f',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: '#f1f5f9',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    padding: 24,
  },
  pageDescription: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 32,
  },
  grid: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
});
