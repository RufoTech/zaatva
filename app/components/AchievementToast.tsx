import React, { useEffect, useState, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppEvents } from '../_utils/eventEmitter';
import { Achievement } from '../_utils/achievementManager';

const { width } = Dimensions.get('window');

export default function AchievementToast() {
  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const showToast = (newAchievement: Achievement) => {
      setAchievement(newAchievement);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset to top before animating down
      translateY.setValue(-150);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: Platform.OS === 'ios' ? 60 : 40,
          useNativeDriver: true,
          friction: 8,
          tension: 40
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();

      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, 4000);
    };

    AppEvents.on('ACHIEVEMENT_UNLOCKED', showToast);

    return () => {
      AppEvents.off('ACHIEVEMENT_UNLOCKED', showToast);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setAchievement(null);
    });
  };

  if (!achievement) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={hideToast} style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name={achievement.icon as any} size={24} color="#ccff00" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Achievement Unlocked!</Text>
          <Text style={styles.name}>{achievement.title}</Text>
          <Text style={styles.xp}>+{achievement.xpReward} XP</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 999999, // Ensure it's above everything
    elevation: 999999, // For Android
  },
  content: {
    backgroundColor: '#1c1f10',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccff00',
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#ccff00',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  name: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  xp: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  }
});
