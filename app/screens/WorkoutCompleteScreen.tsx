import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Dimensions,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming, 
  withSpring,
  useDerivedValue,
  runOnJS
} from 'react-native-reanimated';
import { checkMuscleMaster } from '../utils/achievementManager';

const AnimatedMaterialIcons = Animated.createAnimatedComponent(MaterialIcons);

const { width } = Dimensions.get('window');

const PRIMARY = '#ccff00';
const BG_DARK = '#1f230f';
const CARD_BG = '#1e293b'; // slate-800
const TEXT_LIGHT = '#f1f5f9'; // slate-100
const TEXT_MUTED = '#94a3b8'; // slate-400

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Reanimated values
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  // Get passed stats or use defaults
  const calories = parseInt(params.calories as string || '0', 10) || 340;
  const sets = parseInt(params.sets as string || '0', 10) || 18;

  const countValue = useSharedValue(0);
  useEffect(() => {
    countValue.value = withTiming(1, { duration: 2000 });
  }, []);

  const animatedCalories = useDerivedValue(() => {
    return Math.floor(countValue.value * calories);
  });

  const animatedSets = useDerivedValue(() => {
    return Math.floor(countValue.value * sets);
  });

  const StatItem = ({ label, value, index, icon }: { label: string, value: any, index: number, icon: string }) => {
    return (
      <Animated.View 
        entering={FadeInUp.delay(600 + index * 100).springify()}
        style={styles.statCard}
      >
        <MaterialIcons name={icon as any} size={20} color={PRIMARY} style={{ marginBottom: 8 }} />
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </Animated.View>
    );
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.1,
  }));

  const trophyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(countValue.value) }],
  }));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      <View style={styles.contentWrapper}>
        {/* Top App Bar */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => router.replace('/')}
          >
            {/* Empty TouchableOpacity for spacing/alignment if needed, or remove completely */}
          </TouchableOpacity>
          {/* Removed battery icon */}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero Section / Celebration Header */}
          <Animated.View style={styles.heroContainer} entering={FadeInDown.delay(200).springify()}>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>SUCCESS</Text>
            </View>
            <Text style={styles.heroTitle}>WORKOUT COMPLETE!</Text>
            <Text style={styles.heroSubtitle}>MƏŞQ TAMAMLANDI!</Text>
          </Animated.View>

          {/* Central Graphic */}
          <View style={styles.graphicContainer}>
            <View style={styles.graphicBox}>
              <View style={styles.radialBackground}>
                 <Animated.View style={[styles.radialCircle1, pulseStyle]} />
                 <Animated.View style={[styles.radialCircle2, pulseStyle]} />
                 <Animated.View style={[styles.radialCircle3, pulseStyle]} />
              </View>
              
              <Animated.View style={[styles.trophyWrapper, trophyStyle]}>
                <MaterialIcons name="emoji-events" size={120} color={PRIMARY} style={styles.trophyIcon} />
                <View style={styles.starsContainer}>
                  <MaterialIcons name="star" size={24} color="rgba(204, 255, 0, 0.6)" />
                  <MaterialIcons name="star" size={24} color={PRIMARY} />
                  <MaterialIcons name="star" size={24} color="rgba(204, 255, 0, 0.6)" />
                </View>
              </Animated.View>
            </View>
          </View>

          {/* Statistics Grid */}
          <View style={styles.statsContainer}>
            <StatItem 
              label="CALORIES" 
              value={calories} 
              index={0} 
              icon="local-fire-department" 
            />
            <StatItem 
              label="SETS" 
              value={sets} 
              index={1} 
              icon="fitness-center" 
            />
            <StatItem 
              label="XP GAINED" 
              value={Math.round(calories / 10)} 
              index={2} 
              icon="trending-up" 
            />
          </View>
        </ScrollView>

        {/* Action Buttons (Fixed at bottom) */}
        <Animated.View style={styles.actionsContainer} entering={FadeInUp.delay(1000)}>
          <TouchableOpacity 
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => {
              if (params.programId) {
                router.replace({ 
                  pathname: '/screens/WeeklyProgramScreen', 
                  params: { programId: params.programId } 
                });
              } else {
                router.replace('/');
              }
            }}
          >
            <MaterialIcons name="dashboard" size={24} color="#000" />
            <Text style={styles.primaryButtonText}>
              {params.programId ? "Back to Program" : "Dashboard"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            activeOpacity={0.8}
            // Share logic can be added here
          >
            <MaterialIcons name="share" size={24} color={TEXT_LIGHT} />
            <Text style={styles.secondaryButtonText}>Share Progress</Text>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Subtle Background Glow at bottom */}
        <View style={styles.bottomGlow} pointerEvents="none" />
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
  contentWrapper: {
    flex: 1,
    maxWidth: 448, // max-w-md equivalent
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: TEXT_LIGHT,
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    paddingTop: 16, // Reduced top padding to move it higher up
    paddingBottom: 16,
    paddingHorizontal: 16,
    marginTop: -20, // Negative margin to pull it closer to header
  },
  badgeContainer: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.2)',
    marginBottom: 16,
  },
  badgeText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: TEXT_LIGHT,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  graphicContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    width: '100%',
    flex: 1,
    minHeight: 300,
  },
  graphicBox: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden', // Ensure circles don't spill out
  },
  radialBackground: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    top: -45 // Adjust this value to align perfectly behind the trophy
  },
  radialCircle1: {
    position: 'absolute',
    width: 900,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(204, 255, 0, 0.03)', // Very faint outer ring
  },
  radialCircle2: {
    position: 'absolute',
    width: 2000,
    height: 200,
    borderRadius: 1000,
    backgroundColor: 'rgba(204, 255, 0, 0.06)', // Middle ring
  },
  radialCircle3: {
    position: 'absolute',
    width: 140, // Increased size slightly to frame the trophy better
    height: 140,
    borderRadius: 70,
    backgroundColor: PRIMARY, // Changed to Dashboard button color (PRIMARY)
    opacity: 0.2, // Keep some transparency so it doesn't hide the trophy
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 0,
  },
  trophyWrapper: {
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center', // Center vertically
  },
  trophyIcon: {
    marginBottom: 16,
    textShadowColor: 'rgba(204, 255, 0, 0.4)', // Yüngül kubok parıltısı
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // bg-slate-800/50
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)', // border-slate-700/50
    gap: 4,
  },
  statCardBorderPrimary: {
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(204, 255, 0, 0.5)',
  },
  statLabel: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    color: TEXT_LIGHT,
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    paddingTop: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    height: 56,
    borderRadius: 12,
    gap: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    height: 56,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 1)',
  },
  secondaryButtonText: {
    color: TEXT_LIGHT,
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: '-10%',
    left: '50%',
    transform: [{ translateX: -width * 0.6 }], // Approximation of -translate-x-1/2 for a 120% width
    width: width * 1.2,
    height: '30%',
    backgroundColor: 'rgba(204, 255, 0, 0.05)',
    borderRadius: width,
    // Add shadow to simulate blur
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 80,
    elevation: 20,
  }
});
