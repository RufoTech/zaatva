import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    Image,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  useAnimatedProps, 
  useSharedValue, 
  withTiming, 
  Easing,
  useAnimatedStyle,
  withSequence,
  withSpring
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const { width } = Dimensions.get('window');
const PRIMARY = "#ccff00";
const BG_DARK = "#1f230f";
const BG_LIGHT = "#f8f8f5";

export default function RestTimerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Parse params
  const initialDuration = parseInt(params.duration as string || '45', 10);
  const nextExerciseName = params.nextExerciseName as string || 'Next Exercise';
  const nextExerciseSet = params.nextExerciseSet as string || '1';
  const nextExerciseImage = params.nextExerciseImage as string || 'https://via.placeholder.com/150';
  const nextExerciseReps = params.nextExerciseReps as string || '-';
  
  const [timeLeft, setTimeLeft] = useState(initialDuration);
  const totalDuration = useRef(initialDuration);
  
  // Reanimated values
  const progressSV = useSharedValue(1);
  const scaleSV = useSharedValue(1);
  
  useEffect(() => {
    totalDuration.current = initialDuration;
    setTimeLeft(initialDuration);
    progressSV.value = 1; // Reset progress
  }, [initialDuration]);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSkip();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newVal = prev - 1;
        // Update progress SV smoothly
        progressSV.value = withTiming(newVal / totalDuration.current, {
           duration: 1000,
           easing: Easing.linear
        });

        // Pulse scale on each tick
        scaleSV.value = withSequence(
          withTiming(1.05, { duration: 100 }),
          withTiming(1, { duration: 100 })
        );

        return newVal;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAdd30s = () => {
    setTimeLeft((prev) => prev + 30);
    totalDuration.current += 30;
    // Adjust progress SV immediately
    progressSV.value = timeLeft / totalDuration.current;
  };

  const handleSkip = () => {
    // Return "completed" status to previous screen
    router.back(); 
  };

  // SVG Circle props
  const size = 288; // w-72
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - progressSV.value * circumference;
    return {
      strokeDashoffset,
    };
  });

  const timerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleSV.value }]
  }));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(Math.max(0, seconds % 60));
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>İstirahət</Text>
      </View>

      <View style={styles.content}>
        {/* Timer Circle */}
        <View style={styles.timerContainer}>
          <Svg width={size} height={size} style={styles.svg}>
            {/* Background Circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress Circle */}
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={PRIMARY}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={animatedProps}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <Animated.View style={[styles.timerTextContainer, timerAnimatedStyle]}>
            <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>
            <Text style={styles.timerLabel}>Saniyə qalıb</Text>
          </Animated.View>
        </View>

        {/* Controls */}
        <Animated.View style={styles.controlsContainer} entering={FadeInDown.delay(200)}>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={handleAdd30s}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>+30s</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={handleSkip}
            activeOpacity={0.8}
          >
            <MaterialIcons name="fast-forward" size={24} color={BG_DARK} />
            <Text style={styles.skipButtonText}>İstirahəti ötür</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Next Exercise Card */}
        <Animated.View style={styles.nextCard} entering={FadeInDown.delay(400).springify()}>
          <View style={styles.nextCardHeader}>
            <Text style={styles.nextLabel}>NÖVBƏTİ MƏŞQ</Text>
            <Text style={styles.nextSetInfo}>{nextExerciseSet}</Text>
          </View>
          
          <View style={styles.nextExerciseContent}>
            <Image 
              source={{ uri: nextExerciseImage }} 
              style={styles.nextImage} 
              resizeMode="cover"
            />
            <View style={styles.nextExerciseInfo}>
              <Text style={styles.nextExerciseName} numberOfLines={2}>
                {nextExerciseName}
              </Text>
              <Text style={styles.nextExerciseMeta}>
                {nextExerciseReps} Təkrar
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
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
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(31, 35, 15, 0.5)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  timerContainer: {
    width: 288,
    height: 288,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
    position: 'relative',
  },
  svg: {
    position: 'absolute',
  },
  timerTextContainer: {
    alignItems: 'center',
  },
  timerValue: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -2,
  },
  timerLabel: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 384,
    gap: 16,
    marginBottom: 48,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  skipButtonText: {
    color: BG_DARK,
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextCard: {
    width: '100%',
    maxWidth: 384,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  nextCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextLabel: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nextSetInfo: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  nextExerciseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  nextImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  nextExerciseInfo: {
    flex: 1,
  },
  nextExerciseName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nextExerciseMeta: {
    color: '#94a3b8',
    fontSize: 14,
  },
});