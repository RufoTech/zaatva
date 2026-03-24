import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Theme
const SURFACE_DARK = '#1d2012';
const SHIMMER_BASE = 'rgba(255, 255, 255, 0.03)';
const SHIMMER_HIGHLIGHT = 'rgba(255, 255, 255, 0.08)';

// --- Core Skeleton Bone ---
interface SkeletonBoneProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

const SkeletonBone: React.FC<SkeletonBoneProps> = ({
  width: boneWidth,
  height,
  borderRadius = 8,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View
      style={[
        {
          width: boneWidth as any,
          height,
          borderRadius,
          backgroundColor: SHIMMER_BASE,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', SHIMMER_HIGHLIGHT, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

// ============================================================
//  PRE-BUILT SKELETON LAYOUTS
// ============================================================

// --- Exercise Card Skeleton (WorkoutLibraryScreen) ---
export const ExerciseCardSkeleton: React.FC = () => (
  <View style={skeletonStyles.exerciseCard}>
    <View style={{ flex: 1, gap: 12 }}>
      <SkeletonBone width="80%" height={18} borderRadius={6} />
      <SkeletonBone width="40%" height={12} borderRadius={4} />
      <SkeletonBone width="60%" height={14} borderRadius={4} />
      <SkeletonBone width={100} height={32} borderRadius={8} />
    </View>
    <SkeletonBone width={120} height={120} borderRadius={12} />
  </View>
);

export const ExerciseListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <View style={{ gap: 16 }}>
    {Array.from({ length: count }).map((_, i) => (
      <ExerciseCardSkeleton key={i} />
    ))}
  </View>
);

// --- Workout Detail Skeleton (WorkoutDetailsScreen) ---
export const WorkoutDetailSkeleton: React.FC = () => (
  <View style={{ flex: 1, backgroundColor: '#1f230f' }}>
    {/* Hero */}
    <View style={{ padding: 16 }}>
      <SkeletonBone width="100%" height={320} borderRadius={12} />
    </View>
    {/* Action Buttons */}
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12 }}>
      <SkeletonBone width="48%" height={48} borderRadius={12} />
      <SkeletonBone width="48%" height={48} borderRadius={12} />
    </View>
    {/* Summary */}
    <View style={{ flexDirection: 'row', padding: 16, gap: 12, marginTop: 16 }}>
      <SkeletonBone width="30%" height={60} borderRadius={8} />
      <SkeletonBone width="30%" height={60} borderRadius={8} />
      <SkeletonBone width="30%" height={60} borderRadius={8} />
    </View>
    {/* Exercise Blocks */}
    <View style={{ paddingHorizontal: 16, gap: 16, marginTop: 16 }}>
      <SkeletonBone width="50%" height={24} borderRadius={6} />
      {[1, 2, 3].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <SkeletonBone width={56} height={56} borderRadius={10} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBone width="70%" height={16} borderRadius={4} />
            <SkeletonBone width="40%" height={12} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  </View>
);

// --- WorkoutStart Skeleton ---
export const WorkoutStartSkeleton: React.FC = () => (
  <View style={{ flex: 1, backgroundColor: '#12140a' }}>
    {/* Hero area */}
    <SkeletonBone width="100%" height={400} borderRadius={0} />
    {/* Card */}
    <View style={{ paddingHorizontal: 16, marginTop: -40 }}>
      <View style={skeletonStyles.startCard}>
        <SkeletonBone width={64} height={64} borderRadius={32} style={{ alignSelf: 'center' }} />
        <SkeletonBone width="60%" height={22} borderRadius={6} style={{ alignSelf: 'center', marginTop: 16 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <SkeletonBone width={60} height={14} borderRadius={4} />
          <SkeletonBone width={60} height={14} borderRadius={4} />
          <SkeletonBone width={70} height={14} borderRadius={4} />
        </View>
      </View>
    </View>
    {/* Tip */}
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <SkeletonBone width="100%" height={80} borderRadius={16} />
    </View>
    {/* Preview */}
    <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
      <SkeletonBone width={160} height={12} borderRadius={4} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <SkeletonBone width={80} height={80} borderRadius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBone width="60%" height={16} borderRadius={4} />
          <SkeletonBone width="40%" height={12} borderRadius={4} />
        </View>
      </View>
    </View>
  </View>
);

// --- Monthly Workout / Program Card Skeleton ---
export const ProgramCardSkeleton: React.FC = () => (
  <View style={skeletonStyles.programCard}>
    <SkeletonBone width="100%" height={180} borderRadius={16} />
    <View style={{ padding: 16, gap: 8 }}>
      <SkeletonBone width="65%" height={18} borderRadius={6} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <SkeletonBone width={80} height={14} borderRadius={4} />
        <SkeletonBone width={90} height={14} borderRadius={4} />
      </View>
    </View>
  </View>
);

export const ProgramListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <View style={{ gap: 16 }}>
    {Array.from({ length: count }).map((_, i) => (
      <ProgramCardSkeleton key={i} />
    ))}
  </View>
);

// --- Live Workout Skeleton ---
export const LiveWorkoutSkeleton: React.FC = () => (
  <View style={{ flex: 1, backgroundColor: '#12140a' }}>
    {/* Progress bar area */}
    <View style={{ padding: 16, gap: 12 }}>
      <SkeletonBone width="50%" height={16} borderRadius={4} />
      <SkeletonBone width="100%" height={6} borderRadius={3} />
    </View>
    {/* Video area */}
    <SkeletonBone width="100%" height={220} borderRadius={0} style={{ marginBottom: 16 }} />
    {/* Set info */}
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <SkeletonBone width="40%" height={16} borderRadius={4} />
      <SkeletonBone width="70%" height={28} borderRadius={6} />
      <SkeletonBone width="90%" height={14} borderRadius={4} />
    </View>
    {/* Stats */}
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 24 }}>
      <SkeletonBone width="48%" height={80} borderRadius={12} />
      <SkeletonBone width="48%" height={80} borderRadius={12} />
    </View>
    {/* Muscle card */}
    <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
      <SkeletonBone width="100%" height={100} borderRadius={16} />
    </View>
  </View>
);

// --- Add Workout Card Skeleton ---
export const AddWorkoutCardSkeleton: React.FC = () => (
  <View style={skeletonStyles.addWorkoutCard}>
    <SkeletonBone width="100%" height={160} borderRadius={16} />
    <View style={{ padding: 16, gap: 8 }}>
      <SkeletonBone width="65%" height={18} borderRadius={6} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SkeletonBone width={70} height={14} borderRadius={4} />
        <SkeletonBone width={80} height={14} borderRadius={4} />
        <SkeletonBone width={70} height={14} borderRadius={4} />
      </View>
    </View>
  </View>
);

export const AddWorkoutListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <View style={{ gap: 0 }}>
    {Array.from({ length: count }).map((_, i) => (
      <AddWorkoutCardSkeleton key={i} />
    ))}
  </View>
);

// --- Weekly Program Skeleton ---
export const WeeklyProgramCardSkeleton: React.FC<{ isCurrent?: boolean }> = ({ isCurrent }) => (
  <View style={skeletonStyles.weeklyCard}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
      <View style={{ gap: 8 }}>
        {isCurrent && <SkeletonBone width={80} height={10} borderRadius={2} />}
        <SkeletonBone width={150} height={20} borderRadius={6} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonBone width={60} height={14} borderRadius={4} />
          <SkeletonBone width={80} height={14} borderRadius={4} />
        </View>
      </View>
      <SkeletonBone width={40} height={40} borderRadius={8} />
    </View>
    <SkeletonBone width="100%" height={200} borderRadius={8} style={{ marginBottom: 16 }} />
    <SkeletonBone width="100%" height={48} borderRadius={8} />
  </View>
);

export const WeeklyProgramListSkeleton: React.FC = () => (
  <View style={{ gap: 16, marginTop: 16 }}>
    <WeeklyProgramCardSkeleton isCurrent={true} />
    <WeeklyProgramCardSkeleton />
    <View style={skeletonStyles.restCard}>
      <SkeletonBone width={120} height={20} borderRadius={6} />
      <SkeletonBone width={80} height={14} borderRadius={4} style={{ marginTop: 8 }} />
    </View>
  </View>
);

// --- Community Item Skeleton ---
export const CommunityItemSkeleton: React.FC = () => (
  <View style={skeletonStyles.communityCard}>
    <SkeletonBone width="100%" height={180} borderRadius={0} />
    <View style={{ padding: 16 }}>
      <SkeletonBone width="60%" height={20} borderRadius={6} style={{ marginBottom: 6 }} />
      <SkeletonBone width="40%" height={14} borderRadius={4} style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBone width={40} height={14} borderRadius={4} />
        <SkeletonBone width={60} height={32} borderRadius={16} />
      </View>
    </View>
  </View>
);

export const CommunityListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <View style={{ gap: 20, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 100 }}>
    {Array.from({ length: count }).map((_, i) => (
      <CommunityItemSkeleton key={i} />
    ))}
  </View>
);

// ============================================================
const skeletonStyles = StyleSheet.create({
  exerciseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2e1a',
    gap: 16,
  },
  programCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  startCard: {
    backgroundColor: '#1f230f',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addWorkoutCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  weeklyCard: {
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2e1a',
  },
  restCard: {
    backgroundColor: 'rgba(28, 31, 15, 0.4)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2e1a',
    borderStyle: 'dashed',
    justifyContent: 'center',
    height: 80,
  },
  communityCard: {
    backgroundColor: '#0f1108',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
});

export default SkeletonBone;
