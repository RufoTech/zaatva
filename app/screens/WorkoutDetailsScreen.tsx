import { WorkoutDetailSkeleton } from '@/components/SkeletonLoader';
import { CustomAlert } from '@/utils/CustomAlert';
import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeInUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SelectionStore } from '../_utils/SelectionStore';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

const { width } = Dimensions.get('window');

// Define types for new data structure
interface Movement {
  category: string;
  exerciseId: string;
  name: string;
  reps: string;
  setsCount: number;
  image?: string;
  videoUrl?: string;
  instructions?: string;
}

interface WorkoutSet {
  label: string;
  movements: Movement[];
  rest: string;
}

interface ExerciseBlock {
  sets: WorkoutSet[];
}

interface WorkoutDetails {
  id: string;
  name: string;
  level: string;
  duration: string;
  equipment: string[];
  targetMuscles: string[];
  coverImage: string;
  exercises: ExerciseBlock[];
  workoutTarget: string;
  workout_type_name: string;
  createdAt: string;
}

export default function WorkoutDetailsScreen() {
  const router = useRouter();
  const { id, isCustom, hideAddToDay, isRecommended, fromLibrary } = useLocalSearchParams();
  const [workout, setWorkout] = useState<WorkoutDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [isShared, setIsShared] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [-100, 0],
      [1.5, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 300],
      [0, -50],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }, { translateY }],
    };
  });

  useEffect(() => {
    if (!id) return;

    const user = auth().currentUser;
    const userId = user?.uid;

    const checkSavedStatus = async () => {
      if (!userId) return;
      try {
        const snapshot = await firestore()
          .collection('saved_workouts')
          .where('originalId', '==', String(id))
          .where('userId', '==', userId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          setIsSaved(true);
          setSavedDocId(snapshot.docs[0].id);
        } else {
          setIsSaved(false);
          setSavedDocId(null);
        }
      } catch (err) {
        console.error("Error checking saved status:", err);
      }
    };

    const checkSharedStatus = async () => {
      if (!userId) return;
      try {
        const shareSnap = await firestore()
          .collection('community_shared_workouts')
          .where('originalId', '==', String(id))
          .where('authorId', '==', userId)
          .limit(1)
          .get();
        if (!shareSnap.empty) {
          setIsShared(true);
        }
      } catch (err) {
        console.error("Error checking shared status:", err);
      }
    };

    const fetchWorkoutDetails = async () => {
      try {
        let data: any;
        let docId = String(id);
        let rawData: any;

        if (isCustom === 'true') {
          const customDoc = await firestore().collection('customUserWorkouts').doc(docId).get();
          const customExists = typeof customDoc.exists === 'function' ? customDoc.exists() : customDoc.exists;
          if (customExists) {
            rawData = customDoc.data() || {};
            rawData.id = customDoc.id;
          }
        } else {
          // First check workout_programs
          let workoutDoc = await firestore().collection('workout_programs').doc(docId).get();

          const workoutExists = typeof workoutDoc.exists === 'function' ? workoutDoc.exists() : workoutDoc.exists;

          // If not found, fallback to community_shared_workouts
          if (!workoutExists) {
            const sharedDoc = await firestore().collection('community_shared_workouts').doc(docId).get();
            const sharedExists = typeof sharedDoc.exists === 'function' ? sharedDoc.exists() : sharedDoc.exists;

            if (sharedExists) {
              const sharedData = sharedDoc.data() || {};
              if (sharedData.originalId) {
                const originalDoc = await firestore().collection('workout_programs').doc(sharedData.originalId).get();
                const originalExists = typeof originalDoc.exists === 'function' ? originalDoc.exists() : originalDoc.exists;
                if (originalExists) {
                  workoutDoc = originalDoc;
                } else {
                  const customOriginalDoc = await firestore().collection('customUserWorkouts').doc(sharedData.originalId).get();
                  const customOriginalExists = typeof customOriginalDoc.exists === 'function' ? customOriginalDoc.exists() : customOriginalDoc.exists;
                  if (customOriginalExists) {
                    workoutDoc = customOriginalDoc;
                  } else {
                    workoutDoc = sharedDoc;
                  }
                }
              } else {
                workoutDoc = sharedDoc;
              }
            }
          }

          const finalExists = typeof workoutDoc.exists === 'function' ? workoutDoc.exists() : workoutDoc.exists;
          if (workoutDoc && finalExists) {
            rawData = workoutDoc.data() || {};
            rawData.id = workoutDoc.id;

            // DEBUG: Let user see what fields are caught by rawData
            // CustomAlert.show("Debug Payload", JSON.stringify({ name: rawData.name, title: rawData.title, duration: rawData.duration }));
          }
        }

        if (rawData) {
          // Transform raw data to match the new structure if needed, or use directly if it matches
          // We assume the incoming data matches the new structure provided in the prompt
          // But we need to enrich movements with images/videos from the 'workouts' collection

          const exercises: ExerciseBlock[] = rawData.exercises || [];

          // Process exercises to fetch images for movements
          const processedExercises = await Promise.all(exercises.map(async (block) => {
            const processedSets = await Promise.all((block.sets || []).map(async (set) => {
              const processedMovements = await Promise.all((set.movements || []).map(async (movement: any) => {
                let imageUrl = 'https://via.placeholder.com/150';
                let videoUrl = '';
                let instructions = '';

                try {
                  // Try to fetch by exerciseId first if available
                  let exerciseQuery;
                  if (movement.exerciseId) {
                    const exerciseDoc = await firestore().collection('workouts').doc(movement.exerciseId).get();
                    if (typeof exerciseDoc.exists === 'function' ? exerciseDoc.exists() : exerciseDoc.exists) {
                      const exData = exerciseDoc.data();
                      imageUrl = exData?.mainImage || exData?.imageUrl || imageUrl;
                      videoUrl = exData?.videoUrl || '';
                      instructions = exData?.instructions || '';
                    } else {
                      // Fallback to name search if ID not found or invalid
                      exerciseQuery = await firestore()
                        .collection('workouts')
                        .where('name', '==', movement.name)
                        .limit(1)
                        .get();
                    }
                  } else {
                    exerciseQuery = await firestore()
                      .collection('workouts')
                      .where('name', '==', movement.name)
                      .limit(1)
                      .get();
                  }

                  if (exerciseQuery && !exerciseQuery.empty) {
                    const exData = exerciseQuery.docs[0].data();
                    imageUrl = exData.mainImage || exData.imageUrl || imageUrl;
                    videoUrl = exData.videoUrl || '';
                    instructions = exData.instructions || '';
                  }
                } catch (e) {
                  console.log('Error fetching exercise details', e);
                }

                return {
                  ...movement,
                  image: imageUrl,
                  videoUrl,
                  instructions
                };
              }));

              return {
                ...set,
                movements: processedMovements
              };
            }));

            return {
              ...block,
              sets: processedSets
            };
          }));

          setWorkout({
            id: rawData.id,
            name: rawData.name || rawData.title || 'Untitled Workout',
            level: rawData.level || rawData.difficulty || 'General',
            duration: String(rawData.duration || '0'),
            equipment: Array.isArray(rawData.equipment) ? rawData.equipment : (rawData.equipment ? [rawData.equipment] : []),
            targetMuscles: Array.isArray(rawData.targetMuscles) ? rawData.targetMuscles : (rawData.targetMuscles ? [rawData.targetMuscles] : (rawData.targetMuscle ? [rawData.targetMuscle] : [])),
            coverImage: rawData.coverImage || rawData.image || 'https://via.placeholder.com/300',
            exercises: processedExercises,
            workoutTarget: rawData.workoutTarget || '',
            workout_type_name: rawData.workout_type_name || '',
            createdAt: rawData.createdAt || new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Error fetching workout details:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSavedStatus();
    fetchWorkoutDetails();
    checkSharedStatus();
  }, [id, isCustom]);

  const handleToggleLibrary = async () => {
    if (!workout) return;

    const user = auth().currentUser;
    if (!user) {
      CustomAlert.show("Please log in to save workouts.");
      return;
    }
    const userId = user.uid;

    try {
      if (isSaved && savedDocId) {
        await firestore().collection('saved_workouts').doc(savedDocId).delete();
        setIsSaved(false);
        setSavedDocId(null);
        CustomAlert.show('Workout removed from library!');
      } else {
        const savedWorkout = {
          userId: userId,
          originalId: id,
          title: workout.name,
          level: workout.level,
          target: workout.targetMuscles.join(', '),
          exerciseCount: workout.exercises.reduce((acc, block) => acc + block.sets.reduce((sAcc, set) => sAcc + set.movements.length, 0), 0),
          duration: workout.duration,
          image: workout.coverImage,
          savedAt: firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await firestore().collection('saved_workouts').add(savedWorkout);
        setIsSaved(true);
        setSavedDocId(docRef.id);
        CustomAlert.show('Workout saved to library!');
        router.push('/screens/ProgramLibraryScreen');
      }
    } catch (error) {
      console.error("Error toggling library status:", error);
      CustomAlert.show('Operation failed.');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this workout: ${workout?.name}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleCommunityShare = () => {
    if (!workout) return;
    CustomAlert.show(
      "Share with Community",
      "Do you want to share this workout to the community marketplace?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Share",
          onPress: async () => {
            try {
              const user = auth().currentUser;
              if (!user) return;

              const token = await user.getIdToken();

              const payload = {
                originalId: workout.id,
                authorName: user.displayName || user.email || 'Anonymous User',
                title: workout.name,
                coverImage: workout.coverImage || null,
                difficulty: workout.level || 'Intermediate',
                duration: parseInt(workout.duration, 10) || 30,
                targetMuscle: Array.isArray(workout.targetMuscles) ? workout.targetMuscles.join(', ') : (workout.targetMuscles || 'Full Body'),
                exercises: workout.exercises || [],
              };

              const response = await fetch(`${API_URL}/api/community/share-workout`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
              });

              if (!response.ok) {
                if (response.status === 403) {
                  const errorText = await response.text();
                  throw new Error(errorText.trim());
                }
                throw new Error('Failed to share workout');
              }

              setIsShared(true);
              CustomAlert.show("Success", "Your workout has been shared with the community!");
            } catch (error: any) {
              console.error("Error sharing workout:", error);
              CustomAlert.show("DİQQƏT!", error.message || "Failed to share workout.");
            }
          }
        }
      ]
    );
  };

  const handleAddToDay = () => {
    if (!workout) return;

    // CreateProgramScreen handles the logic to check if there are 7 days already.
    // However, since we can't easily query CreateProgramScreen's local state from here,
    // we just use SelectionStore. The limit check will happen in CreateProgramScreen 
    // when it receives the data.

    const totalExercises = workout.exercises.reduce((acc, block) =>
      acc + block.sets.reduce((sAcc, set) => sAcc + set.movements.length, 0), 0
    );

    SelectionStore.setData(
      {
        id: workout.id,
        title: workout.name,
        subtitle: `${totalExercises} exercises • ${workout.duration} Min`,
        images: [workout.coverImage],
        extraCount: 0,
      },
      'add',
      'program_workout'
    );
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1f230f" />
        <WorkoutDetailSkeleton />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#1f230f" />
        <Text style={{ color: '#f1f5f9', fontSize: 18 }}>Workout not found</Text>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.back()}>
          <Text style={{ color: '#ccff00', fontSize: 16 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f230f" />

      {/* Top Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Workout Details</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {fromLibrary !== 'true' && (
            isShared ? (
              <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>Shared</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.navButton}
                onPress={handleCommunityShare}
              >
                <MaterialIcons name="public" size={24} color="#f1f5f9" />
              </TouchableOpacity>
            )
          )}
          {fromLibrary !== 'true' && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={handleShare}
            >
              <MaterialIcons name="share" size={24} color="#f1f5f9" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <View style={styles.heroImageWrapper}>
            <Animated.View style={[StyleSheet.absoluteFill, headerAnimatedStyle]}>
              <ImageBackground
                source={{ uri: workout.coverImage }}
                style={styles.heroImage}
                imageStyle={{ borderRadius: 12 }}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(31, 35, 15, 0.8)']}
                  style={styles.heroOverlay}
                />
                <View style={styles.heroContent}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>{workout.level}</Text>
                  </View>
                  <Text style={styles.workoutTitle}>{workout.name}</Text>
                </View>
              </ImageBackground>
            </Animated.View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {(hideAddToDay !== 'true' && isRecommended !== 'true') && (
            <TouchableOpacity style={styles.addToDayButton} onPress={handleAddToDay}>
              <Text style={styles.addToDayText}>Add to Day</Text>
            </TouchableOpacity>
          )}
          {fromLibrary !== 'true' && (
            <TouchableOpacity
              style={[styles.saveToLibraryButton, isSaved && styles.savedButton]}
              onPress={handleToggleLibrary}
            >
              <Text style={[styles.saveToLibraryText, isSaved && styles.savedButtonText]}>
                {isSaved ? 'Remove from Library' : 'Add to Library'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Workout Summary Info */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <MaterialIcons name="schedule" size={24} color="#ccff00" style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{workout.duration} min</Text>
          </View>
          <View style={[styles.summaryItem, styles.summaryBorder]}>
            <MaterialIcons name="fitness-center" size={24} color="#ccff00" style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>Equipment</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {Array.isArray(workout.equipment) ? workout.equipment.join(', ') : (workout.equipment || 'None')}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <MaterialIcons name="adjust" size={24} color="#ccff00" style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>Target</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {Array.isArray(workout.targetMuscles) ? workout.targetMuscles.join(', ') : (workout.targetMuscles || 'General')}
            </Text>
          </View>
        </View>

        {/* Workout List (Exercise Blocks) */}
        <View style={styles.exercisesContainer}>
          {workout.exercises.map((block, blockIndex) => (
            <View key={`block-${blockIndex}`} style={styles.exerciseBlock}>
              <View style={styles.blockHeader}>
                <View style={styles.blockHeaderIndicator} />
                <Text style={styles.blockTitle}>Exercise Block {blockIndex + 1}</Text>
              </View>

              <View style={styles.blockContent}>
                {block.sets.map((set, setIndex) => (
                  <View key={`set-${blockIndex}-${setIndex}`} style={styles.setContainer}>
                    <Text style={styles.setLabel}>{set.label}</Text>
                    <View style={styles.movementsList}>
                      {set.movements.map((movement, moveIndex) => (
                        <Animated.View key={`move-${blockIndex}-${setIndex}-${moveIndex}`} entering={FadeInUp.delay(moveIndex * 100).springify()}>
                          <TouchableOpacity
                            style={styles.movementItem}
                            onPress={() => router.push({
                              pathname: '/screens/ExerciseDetailScreen',
                              params: {
                                exercise: JSON.stringify({
                                  ...movement,
                                  sets: movement.setsCount,
                                  muscles: [movement.category]
                                })
                              }
                            })}
                          >
                            <Image source={{ uri: movement.image }} style={styles.movementImage} />
                            <View style={styles.movementInfo}>
                              <View style={styles.movementHeader}>
                                <Text style={styles.movementName} numberOfLines={1}>{movement.name}</Text>
                                <View style={styles.categoryBadge}>
                                  <Text style={styles.categoryText}>{movement.category}</Text>
                                </View>
                              </View>
                              <Text style={styles.movementDetails}>
                                {movement.setsCount} sets {movement.reps ? `x ${movement.reps} reps` : ''}
                              </Text>
                            </View>
                            <MaterialIcons name="play-circle-outline" size={24} color="#ccff00" />
                          </TouchableOpacity>
                        </Animated.View>
                      ))}
                    </View>
                    {set.rest ? (
                      <View style={styles.restContainer}>
                        <MaterialIcons name="timer" size={16} color="#ccff00" />
                        <Text style={styles.restText}>Rest: {set.rest}s</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f230f', // bg-background-dark
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1f230f',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)', // border-white/10
  },
  navButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9', // text-slate-100
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#1f230f',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroContainer: {
    padding: 16,
    paddingBottom: 12,
  },
  heroImageWrapper: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#334155', // bg-slate-700 placeholder
  },
  heroImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    padding: 24,
  },
  levelBadge: {
    backgroundColor: '#ccff00', // bg-primary
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  levelText: {
    color: '#1f230f', // text-background-dark
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  workoutTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  addToDayButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#ccff00',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addToDayText: {
    color: '#1f230f',
    fontSize: 14,
    fontWeight: 'bold',
  },
  saveToLibraryButton: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // bg-white/10
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveToLibraryText: {
    color: '#ccff00', // text-primary
    fontSize: 14,
    fontWeight: 'bold',
  },
  savedButton: {
    backgroundColor: '#ccff00',
    borderWidth: 0,
  },
  savedButtonText: {
    color: '#1f230f',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)', // border-white/10
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryIcon: {
    marginBottom: 4,
    color: '#ccff00', // text-primary
  },
  summaryLabel: {
    color: '#94a3b8', // text-slate-400
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    color: '#f1f5f9', // text-slate-100
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  exercisesContainer: {
    paddingHorizontal: 16,
    gap: 40, // space-y-10
  },
  exerciseBlock: {
    gap: 16, // space-y-4
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blockHeaderIndicator: {
    height: 32,
    width: 4,
    backgroundColor: '#ccff00',
  },
  blockTitle: {
    fontSize: 24,
    fontWeight: '900', // font-black
    textTransform: 'uppercase',
    fontStyle: 'italic',
    color: '#f1f5f9', // text-slate-100
    letterSpacing: -0.5, // tracking-tighter
  },
  blockContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // bg-white/5
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)', // border-white/10
  },
  setContainer: {
    marginBottom: 16,
  },
  setLabel: {
    color: '#ccff00', // text-primary
    fontSize: 12,
    fontWeight: '900', // font-black
    textTransform: 'uppercase',
    letterSpacing: 2, // tracking-widest
    marginBottom: 16,
  },
  movementsList: {
    gap: 12, // space-y-3
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1f230f', // bg-background-dark (or slightly lighter if needed, but per HTML it's bg-background-dark inside)
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)', // border-white/5
  },
  movementImage: {
    width: 64, // size-16
    height: 64,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  movementInfo: {
    flex: 1,
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  movementName: {
    fontSize: 16, // slightly adjusted
    fontWeight: 'bold',
    color: '#f1f5f9', // text-slate-100
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)', // bg-primary/10
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.2)', // border-primary/20
  },
  categoryText: {
    color: '#ccff00', // text-primary (lighter for dark bg)
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  movementDetails: {
    fontSize: 14,
    color: '#94a3b8', // text-slate-400
  },
  restContainer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(204, 255, 0, 0.1)', // bg-primary/10
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.4)', // border-primary/40
    borderStyle: 'dashed',
    padding: 10,
    borderRadius: 8,
  },
  restText: {
    fontSize: 12,
    fontWeight: '900', // font-black
    color: '#ccff00', // text-primary
    textTransform: 'uppercase',
  },
});
