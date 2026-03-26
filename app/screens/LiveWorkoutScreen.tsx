import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ImageBackground,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { SlideInRight, SlideOutLeft, Layout, FadeIn } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import { CustomAlert } from '@/utils/CustomAlert';
import { LiveWorkoutSkeleton } from '@/components/SkeletonLoader';

const { width } = Dimensions.get('window');

const PRIMARY = "#ccff00";
const BG_DARK = "#12140a";
const SURFACE_DARK = "#1c1f0f";
const BORDER_DARK = "#2a2e18";
const TEXT_COLOR = "#f1f5f9";
const SUBTEXT_COLOR = "#94a3b8";

// API URL - Android Emulator üçün 10.0.2.2, digərləri üçün localhost
const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

// Updated interfaces to match new structure
interface Movement {
  category: string;
  exerciseId: string;
  name: string;
  reps: string;
  setsCount: number;
  image?: string;
  videoUrl?: string;
  instructions?: string;
  muscleGroups?: { name: string; imageUrl: string }[];
  muscleGroupName?: string;
  muscleGroupImage?: string;
}

interface WorkoutSet {
  label: string;
  movements: Movement[];
  rest: string;
}

interface ExerciseBlock {
  sets: WorkoutSet[];
}

interface FlattenedExerciseItem {
    movement: Movement;
    setLabel: string;
    blockIndex: number;
    setIndex: number;
    movementIndex: number;
    totalSets: number;
    currentSetNumber: number; // e.g. Set 1 of 4
}

export default function LiveWorkoutScreen() {
  const router = useRouter();
  const { workoutId, programId, week, day } = useLocalSearchParams();
  const [isExpanded, setIsExpanded] = useState(true);
  
  const [loading, setLoading] = useState(true);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutDuration, setWorkoutDuration] = useState("45"); // Default duration
  const [workoutEquipment, setWorkoutEquipment] = useState("None");
  const [workoutTarget, setWorkoutTarget] = useState("General");
  const [rawExercises, setRawExercises] = useState<ExerciseBlock[]>([]);
  
  // We need to flatten the nested structure into a linear list of "steps" for the live workout
  // Or handle it hierarchically. Linear is usually better for "Next/Prev" flow.
  // But we might want to group them by sets.
  // Let's flatten it: Each item in the array represents one "Set" of an exercise.
  // If an exercise has 4 sets, it will appear 4 times? 
  // Or we keep it as "Current Exercise" and track "Current Set".
  // The previous implementation had "currentIndex" pointing to an exercise.
  // Let's flatten to (Exercise + Set Number) so user clicks "Next" after each set.
  const [flatWorkoutQueue, setFlatWorkoutQueue] = useState<FlattenedExerciseItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuscleModalVisible, setIsMuscleModalVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [completedRestBlocks, setCompletedRestBlocks] = useState<string[]>([]); // Track completed rests by block index

  useEffect(() => {
    fetchWorkoutData();
  }, [workoutId]);

  const getYoutubeId = (url: string) => {
    if (!url) return null;
    const cleanUrl = url.replace(/[\s"`']/g, "");
    
    const patterns = [
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ 
    ];

    for (const pattern of patterns) {
        const match = cleanUrl.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
        if (match && match[0] && pattern.toString().includes('^')) {
             return match[0];
        }
    }
    return null;
  };

  const fetchWorkoutData = async () => {
    if (!workoutId) {
        setLoading(false);
        return;
    }

    try {
      const user = auth().currentUser;
      if (!user) {
          return;
      }

      // 1. First, check local state (WorkoutDetailsScreen logic) to avoid 404s
      // If the ID is a custom workout or a standard workout, fetch from Firestore directly
      // This is more robust than relying solely on the Go API which might not have the custom programs yet
      let rawData: any = null;
      let isFoundLocally = false;
      
      try {
        // Try standard workout_programs first
        const workoutDoc = await firestore().collection('workout_programs').doc(String(workoutId)).get();
        if (typeof workoutDoc.exists === 'function' ? workoutDoc.exists() : workoutDoc.exists) {
            rawData = workoutDoc.data();
            rawData.id = workoutDoc.id;
            isFoundLocally = true;
        } else {
            // Try customUserWorkouts next
            const customDoc = await firestore().collection('customUserWorkouts').doc(String(workoutId)).get();
            if (typeof customDoc.exists === 'function' ? customDoc.exists() : customDoc.exists) {
                rawData = customDoc.data();
                rawData.id = customDoc.id;
                isFoundLocally = true;
            }
        }
      } catch (err) {
      }

      let data: any;

      if (isFoundLocally && rawData) {
          data = rawData;
      } else {
          // Fallback to Go API if not found in Firestore directly
          const token = await user.getIdToken();
          const url = `${API_URL}/api/workout-plan?workoutId=${workoutId}`;

          const response = await fetch(url, {
              method: 'GET',
              headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              }
          });

          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }

          data = await response.json();

          // The Go API might only return { name, exercises } for nested plan generation.
          // Let's try to enrich it from Firestore if fields are missing.
          try {
              let enrichedDoc = await firestore().collection('workout_programs').doc(String(workoutId)).get();
              if (!(typeof enrichedDoc.exists === 'function' ? enrichedDoc.exists() : enrichedDoc.exists)) {
                  enrichedDoc = await firestore().collection('customUserWorkouts').doc(String(workoutId)).get();
              }
              
              if (typeof enrichedDoc.exists === 'function' ? enrichedDoc.exists() : enrichedDoc.exists) {
                  const enrichedData = enrichedDoc.data();
                  if (enrichedData) {
                      data.duration = data.duration || enrichedData.duration;
                      data.equipment = data.equipment || enrichedData.equipment;
                      data.targetMuscles = data.targetMuscles || enrichedData.targetMuscles;
                      data.name = data.name || enrichedData.name || enrichedData.title;
                  }
              }
          } catch (enrichErr) {
          }
      }



      setWorkoutName(data.name || data.title || "Workout");
      setWorkoutDuration(data.duration?.toString() || "45");
      
      const equip = Array.isArray(data.equipment) ? data.equipment.join(', ') : (data.equipment || "None");
      setWorkoutEquipment(equip);
      
      const target = Array.isArray(data.targetMuscles) ? data.targetMuscles.join(', ') : (data.targetMuscles || "General");
      setWorkoutTarget(target);

      // Flatten the structure
      const exercises: ExerciseBlock[] = (data.exercises || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setRawExercises(exercises);
      
      // Calculate total sets based on the label of the LAST set in the LAST block
      let totalSetsFromLabel = 0;
      if (exercises.length > 0) {
          const lastBlock = exercises[exercises.length - 1];
          if (lastBlock.sets.length > 0) {
              const lastSet = lastBlock.sets[lastBlock.sets.length - 1];
              // Extract number from label (e.g. "Set 10" -> 10)
              const match = lastSet.label.match(/\d+/);
              if (match) {
                  totalSetsFromLabel = parseInt(match[0], 10);
              } else {
                  // Fallback if no number found, maybe just count total sets?
                  // But user insisted on label. Let's use total count as fallback.
                  let count = 0;
                  exercises.forEach(b => count += b.sets.length);
                  totalSetsFromLabel = count;
              }
          }
      }

      // 6) Flatten queue oluştur: her movement için bir girdi (set label, indices, image mapping vs.)
      const queue: FlattenedExerciseItem[] = [];

      // !!! IMPORTANT FIX: We need to enrich movements with data from the 'workouts' collection
      // because the 'workout_programs' document only contains minimal info (name, reps).
      // We will fetch all unique exercise IDs first, then batch fetch their full details.
      
      const allMovements: any[] = [];
      exercises.forEach(block => {
        block.sets.forEach(set => {
            set.movements.forEach((m: any) => {
                allMovements.push(m);
            });
        });
      });

      // Extract unique names or IDs to fetch full details
      // It seems the movements in 'workout_programs' might NOT have the full data (like videoUrl, muscleGroups).
      // They might just have { name: "Bench Press", reps: "10" }.
      // So we need to query the 'workouts' collection for each unique exercise name.
      
      const uniqueNames = [...new Set(allMovements.map(m => m.name || m.title))].filter(Boolean);
      const workoutDetailsMap: Record<string, any> = {};

      if (uniqueNames.length > 0) {
          try {
              // Batch fetch is hard with 'where name in [...]' if list is long (>10).
              // For simplicity, let's fetch them one by one or in chunks. 
              // Or better: fetch all from 'workouts' where name is in the list.
              // Firestore 'in' query limit is 10.
              
              const chunks = [];
              for (let i = 0; i < uniqueNames.length; i += 10) {
                  chunks.push(uniqueNames.slice(i, i + 10));
              }

              for (const chunk of chunks) {
                  const snapshot = await firestore()
                      .collection('workouts')
                      .where('name', 'in', chunk)
                      .get();
                  
                  snapshot.forEach(doc => {
                      workoutDetailsMap[doc.data().name] = doc.data();
                  });

                  // Try to fetch missing details from custom user exercises
                  const customSnapshot = await firestore()
                      .collection('customUserExercises')
                      .where('name', 'in', chunk)
                      .get();
                  
                  customSnapshot.forEach(doc => {
                      if (!workoutDetailsMap[doc.data().name]) {
                          workoutDetailsMap[doc.data().name] = doc.data();
                      }
                  });
              }
          } catch (e) {
              console.error("Error fetching exercise details:", e);
          }
      }

      exercises.forEach((block, bIdx) => {
        (block.sets || []).forEach((set, sIdx) => {
            (set.movements || []).forEach((movement: any, mIdx) => {
                
                // Merge with detailed info from 'workouts' collection
                const details = workoutDetailsMap[movement.name || movement.title] || {};
                
                // Combine: Priority to movement specific overrides (like reps), but fallback to details for static info (video, image)
                const mergedMovement = {
                    ...details,      // Base details (videoUrl, muscleGroups, mainImage)
                    ...movement,     // Overrides from program (reps, setsCount)
                    // Ensure critical fields exist
                    videoUrl: details.videoUrl || movement.videoUrl || movement.videoLink,
                    muscleGroups: details.muscleGroups || movement.muscleGroups,
                    image: details.mainImage || movement.imageUrl || movement.image // Prefer mainImage from workouts collection
                };

                // targetMuscle və video url üçün əvvəlki dəyişənləri bərpa edirik
                const movementImage = mergedMovement.image || mergedMovement.mainImage || mergedMovement.imageUrl || null;
                
                const muscleGroup = Array.isArray(mergedMovement.muscleGroups) && mergedMovement.muscleGroups.length > 0 
                  ? mergedMovement.muscleGroups[0] 
                  : undefined;


                const enrichedMovement = {
                    ...mergedMovement,
                    image: movementImage,
                    muscleGroupName: muscleGroup?.name,
                    muscleGroupImage: muscleGroup?.imageUrl,
                    videoUrl: mergedMovement.videoUrl || null
                };
                
                // Restore based on data from Firestore
                queue.push({
                    movement: enrichedMovement,
                    setLabel: set.label,
                    blockIndex: bIdx,
                    setIndex: sIdx,
                    movementIndex: mIdx,
                    // If totalSetsFromLabel is 0, default to 1
                    totalSets: totalSetsFromLabel || 1,
                    // Simplify set number, safely handling null matches
                    currentSetNumber: parseInt((set.label?.match(/\d+/)?.[0]) || String(sIdx + 1), 10) || (sIdx + 1)
                });
            });
        });
      });

      setFlatWorkoutQueue(queue);

    } catch (error) {
      console.error("Error fetching live workout data:", error);
      CustomAlert.show("Error", "Failed to load workout data.");
    } finally {
      setLoading(false);
    }
  };

  const [lastClickTime, setLastClickTime] = useState(0);
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  const [isPrevDisabled, setIsPrevDisabled] = useState(false);

  const handleNext = () => {
    // Prevent clicking if currently disabled
    if (isNextDisabled) return;

    // Debounce: Prevent rapid clicks
    const now = Date.now();
    if (now - lastClickTime < 1500) {
      return;
    }
    setLastClickTime(now);

    // Temporarily disable the button
    setIsNextDisabled(true);
    setTimeout(() => {
      setIsNextDisabled(false);
    }, 1500);

    // Check if there is a rest timer for the current block/set
    const currentItem = flatWorkoutQueue[currentIndex];
    const currentSet = rawExercises[currentItem.blockIndex]?.sets[currentItem.setIndex];
    const restDuration = currentSet?.rest ? parseInt(currentSet.rest, 10) : 0;
    
    // Unique ID for this specific rest moment (Block + Set)
    const restId = `${currentItem.blockIndex}-${currentItem.setIndex}`;

    // Logic: Trigger rest ONLY if:
    // 1. There is a rest duration > 0
    // 2. We are at the LAST movement of the current set (if a set has multiple movements/supersets)
    // 3. This rest hasn't been completed yet
    
    // Check if we are at the last movement of this set
    const isLastMovementInSet = currentItem.movementIndex === (currentSet?.movements.length || 1) - 1;
    
    // BUT user said: "rest time ekrani hansi blockun icinde bir defe acildisa artiq complated ✔️ olacaq ve birde acilmayacaq"
    // This implies one rest per BLOCK? Or per Set? usually it's per set.
    // "hansi blockun icinde bir defe acildisa" -> "if opened once inside a block". 
    // This might mean if a block has 3 sets, and we rest after set 1, we don't rest after set 2?
    // OR it means "If we already did the rest for Set 1, don't show it again if we go back and forth".
    // Let's assume the latter (don't show again for the same ID).
    
    if (restDuration > 0 && isLastMovementInSet && !completedRestBlocks.includes(restId)) {
        // Mark as completed immediately (or pass a callback to mark it after timer)
        setCompletedRestBlocks(prev => [...prev, restId]);
        
        // Prepare next exercise data
        let nextItem = null;
        if (currentIndex < flatWorkoutQueue.length - 1) {
            nextItem = flatWorkoutQueue[currentIndex + 1];
        }
        
        router.push({
            pathname: '/screens/RestTimerScreen',
            params: {
                duration: restDuration.toString(),
                nextExerciseName: nextItem ? nextItem.movement.name : "Workout Complete",
                nextExerciseSet: nextItem ? `Set ${nextItem.currentSetNumber} / ${nextItem.totalSets}` : "-",
                nextExerciseImage: nextItem ? (nextItem.movement.image || "") : "",
                nextExerciseReps: nextItem ? nextItem.movement.reps : "-"
            }
        });
        
        // Advance to next step after navigating
        if (currentIndex < flatWorkoutQueue.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
             // If it was the last exercise but had a rest (rare), finish after rest?
             // Usually rest is between sets.
             // We'll just finish workout if no next item.
             CustomAlert.show("Workout Complete", "Great job! You've finished the workout.", [
                { text: "Finish", onPress: () => router.replace({
                    pathname: '/screens/WorkoutCompleteScreen',
                    params: {
                        calories: "0",
                        sets: "0",
                        programId: programId as string,
                        week: week as string,
                        day: day as string
                    }
                }) }
              ]);
        }
        return;
    }

    if (currentIndex < flatWorkoutQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Calculate total sets by summing up all movements in the rawExercises
      let totalSetsCount = 0;
      rawExercises.forEach(block => {
        block.sets.forEach(set => {
          totalSetsCount += set.movements.length;
        });
      });

      // Calculate basic stats to pass
      const duration = workoutDuration || "45";
      const cals = parseInt(duration) * 8; // Basic calculation: 8 kcal per minute

      router.replace({
        pathname: '/screens/WorkoutCompleteScreen',
        params: {
          calories: cals.toString(),
          sets: totalSetsCount.toString(),
          programId: programId as string,
          week: week as string,
          day: day as string
        }
      });
    }
  };

  const handlePrev = () => {
    // Prevent clicking if currently disabled
    if (isPrevDisabled) return;

    if (currentIndex > 0) {
      // Temporarily disable the button
      setIsPrevDisabled(true);
      setTimeout(() => {
        setIsPrevDisabled(false);
      }, 1500);

      setCurrentIndex(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
        <LiveWorkoutSkeleton />
      </SafeAreaView>
    );
  }

  if (flatWorkoutQueue.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: TEXT_COLOR }}>No exercises found for this workout.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: PRIMARY }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentItem = flatWorkoutQueue[currentIndex];
  const currentExercise = currentItem.movement;
  const progressPercent = flatWorkoutQueue.length > 1 ? Math.round((currentIndex / (flatWorkoutQueue.length - 1)) * 100) : 0;
  
  const videoId = currentExercise.videoUrl ? getYoutubeId(currentExercise.videoUrl) : null;
  // Check if it's a direct video URL (Cloudinary etc.) - not a YouTube URL
  const isDirectVideoUrl = currentExercise.videoUrl && !videoId && (
    currentExercise.videoUrl.includes('cloudinary') || 
    currentExercise.videoUrl.match(/\.(mp4|webm|mov|avi)(\?|$)/i) ||
    currentExercise.videoUrl.startsWith('http')
  );
  const hasAnyVideo = !!videoId || !!isDirectVideoUrl;
  const mainImage = currentExercise.image; 
  
  // Use muscleGroups from exercise data
  // User request: "targetMuscle img ve nameler "workouts" collectionunun "muscleGroups" arrayinin "imageUrl" fieldindan ve "name" fieldindan gelecek.image olarak ilk imageni gostereceksen digerlerine ehtiyac yoxdur"
  let targetMuscleName = currentExercise.muscleGroupName || "General";
  let targetMuscleImage = currentExercise.muscleGroupImage || null;

  if (!targetMuscleName || targetMuscleName === "General") {
      if (currentExercise.muscleGroups && currentExercise.muscleGroups.length > 0) {
          targetMuscleName = currentExercise.muscleGroups[0].name;
          targetMuscleImage = currentExercise.muscleGroups[0].imageUrl;
      } else if (currentExercise.category) {
          // Fallback to category if no muscle groups defined
          targetMuscleName = currentExercise.category;
      }
  }
  
  // Create Plyr HTML for YouTube
  const plyrHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
      <style>
        body { margin: 0; padding: 0; background-color: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
        .plyr { width: 100%; height: 100%; }
        .plyr__video-wrapper { height: 100%; }
      </style>
    </head>
    <body>
      <div class="plyr__video-embed" id="player">
        <iframe
          src="https://www.youtube.com/embed/${videoId}?origin=https://plyr.io&amp;iv_load_policy=3&amp;modestbranding=1&amp;playsinline=1&amp;showinfo=0&amp;rel=0&amp;enablejsapi=1"
          allowfullscreen
          allowtransparency
          allow="autoplay"
        ></iframe>
      </div>
      <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
      <script>
        const player = new Plyr('#player', {
             controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
             youtube: { noCookie: true, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1 }
        });
      </script>
    </body>
    </html>
  `;

  // Create HTML for direct video (Cloudinary etc.)
  const directVideoHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        body { margin: 0; padding: 0; background-color: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
        video { width: 100%; height: 100%; object-fit: contain; }
      </style>
    </head>
    <body>
      <video controls playsinline preload="auto">
        <source src="${currentExercise.videoUrl}" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </body>
    </html>
  `;
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header & Progress Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
                <MaterialIcons name="fitness-center" size={24} color={PRIMARY} />
                <Text style={styles.headerTitle}>{workoutName}</Text>
            </View>
            <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => router.back()}
            >
                <MaterialIcons name="close" size={24} color="#f1f5f9" />
            </TouchableOpacity>
        </View>
        
        <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>WORKOUT PROGRESS</Text>
                <Text style={styles.progressValue}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
            const offsetY = event.nativeEvent.contentOffset.y;
            setScrollY(offsetY);
        }}
        scrollEventThrottle={16}
      >
        <Animated.View key={`exercise-${currentIndex}`} entering={FadeIn.duration(300)}>
        {hasAnyVideo ? (
        <View style={styles.videoContainer}>
            {videoId ? (
                <View style={styles.videoWrapper}>
                    <WebView
                        style={styles.webView}
                        javaScriptEnabled={true}
                        allowsFullscreenVideo={true}
                        source={{ html: plyrHTML, baseUrl: "https://myapp.local" }}
                        mediaPlaybackRequiresUserAction={false}
                        renderLoading={() => (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={PRIMARY} />
                                <Text style={styles.loadingText}>
                                    Loading video player...
                                </Text>
                            </View>
                        )}
                    />
                </View>
            ) : isDirectVideoUrl ? (
                <View style={styles.videoWrapper}>
                    <WebView
                        style={styles.webView}
                        javaScriptEnabled={true}
                        allowsFullscreenVideo={true}
                        source={{ html: directVideoHTML, baseUrl: "https://myapp.local" }}
                        mediaPlaybackRequiresUserAction={false}
                        renderLoading={() => (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={PRIMARY} />
                                <Text style={styles.loadingText}>
                                    Loading video...
                                </Text>
                            </View>
                        )}
                    />
                </View>
            ) : null}
        </View>
        ) : null}

        {/* Set Info Banner */}
        <View style={styles.setInfoBanner}>
            <Text style={styles.setInfoText}>
                {currentItem.setLabel} • Set {currentItem.currentSetNumber} of {currentItem.totalSets}
            </Text>
        </View>

        {/* Exercise Title & Tip */}
        <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseTitle}>{currentExercise.name.toUpperCase()}</Text>
            <Text style={styles.exerciseTip}>{currentExercise.instructions?.slice(0, 100) || "Keep good form and control the movement"}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
            <View style={styles.statCard}>
                <Text style={styles.statLabel}>REPS</Text>
                <Text style={styles.statValue}>{currentExercise.reps || "-"}</Text>
            </View>
            <View style={styles.statCard}>
                <Text style={styles.statLabel}>SET</Text>
                <View style={styles.setsValueContainer}>
                    <Text style={[styles.statValue, { color: PRIMARY }]}>{currentItem.currentSetNumber}</Text>
                    <Text style={[styles.statValue, { fontSize: 20, color: SUBTEXT_COLOR }]}>/{currentItem.totalSets}</Text>
                </View>
            </View>
        </View>

        {/* Muscle Info Section (Simplified if no image) */}
        <TouchableOpacity 
            style={styles.muscleMapCard}
            onPress={() => {
                // Just toggle visibility, layout will handle centering
                setIsMuscleModalVisible(true);
            }}
        >
            <View style={styles.muscleMapCardHeader}>
                <View style={styles.muscleMapContainer}>
                     {targetMuscleImage ? (
                        <ImageBackground 
                            source={{ uri: targetMuscleImage }} 
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                     ) : (
                        <MaterialIcons name="accessibility" size={60} color="rgba(255,255,255,0.4)" />
                     )}
                </View>
                <View style={styles.muscleInfo}>
                    <View style={styles.muscleInfoHeader}>
                        <Text style={styles.muscleInfoTitle}>Target Muscles</Text>
                        <MaterialIcons name="info-outline" size={20} color={PRIMARY} />
                    </View>
                    <View style={styles.muscleTags}>
                        <View style={[styles.muscleTag, { backgroundColor: PRIMARY }]}>
                            <Text style={[styles.muscleTagText, { color: BG_DARK }]}>
                                {targetMuscleName.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
        </Animated.View>

        {/* Muscle Info Modal - Custom Implementation */}
        {isMuscleModalVisible && (
            <TouchableOpacity 
                style={styles.modalOverlayAbsolute} 
                activeOpacity={1} 
                onPress={() => setIsMuscleModalVisible(false)}
            >
                <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={() => {}} // Prevent close when clicking content
                    // Position modal relative to current scroll + half screen height to center in viewport
                    style={[styles.modalContent, { marginTop: scrollY + 100 }]}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Target Muscles</Text>
                        <TouchableOpacity onPress={() => setIsMuscleModalVisible(false)}>
                            <MaterialIcons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.modalBody}>
                        <View style={styles.modalImageContainer}>
                             {targetMuscleImage ? (
                                <Image 
                                    source={{ uri: targetMuscleImage }} 
                                    style={styles.modalImage}
                                    resizeMode="contain"
                                />
                             ) : (
                                <MaterialIcons name="accessibility" size={100} color={PRIMARY} />
                             )}
                        </View>
                        <Text style={styles.modalMuscleName}>{targetMuscleName}</Text>
                        <Text style={styles.modalDescription}>
                            This exercise primarily targets the {targetMuscleName.toLowerCase()}. 
                            Focus on feeling the contraction in this area during the movement.
                        </Text>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        )}

        {/* Workout List Section (Full List) */}
        <View style={styles.workoutListSection}>
            <TouchableOpacity 
                style={styles.workoutListHeader}
                onPress={() => setIsExpanded(!isExpanded)}
            >
                <View style={styles.workoutListTitleContainer}>
                    <MaterialIcons name="list-alt" size={20} color={PRIMARY} />
                    <Text style={styles.workoutListTitle}>WORKOUT PLAN</Text>
                </View>
                <MaterialIcons name={isExpanded ? "expand-less" : "expand-more"} size={24} color={PRIMARY} />
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.exercisesContainer}>
                    {rawExercises.map((block, blockIndex) => (
                        <View key={`block-${blockIndex}`} style={styles.exerciseBlock}>
                            <View style={styles.blockHeader}>
                                <View style={styles.blockHeaderIndicator} />
                                <Text style={styles.blockTitle}>Block {blockIndex + 1}</Text>
                            </View>

                            <View style={styles.blockContent}>
                                {block.sets.map((set, setIndex) => (
                                    <View key={`set-${blockIndex}-${setIndex}`} style={styles.setContainer}>
                                        <Text style={styles.setLabel}>{set.label}</Text>
                                        <View style={styles.movementsList}>
                                            {set.movements.map((movement, moveIndex) => {
                                                // Find corresponding items in flatWorkoutQueue
                                                const setSteps = flatWorkoutQueue
                                                    .map((q, idx) => ({ ...q, qIdx: idx }))
                                                    .filter(q => 
                                                        q.blockIndex === blockIndex && 
                                                        q.setIndex === setIndex && 
                                                        q.movementIndex === moveIndex
                                                    );
                                                
                                                return (
                                                    <View key={`move-group-${blockIndex}-${setIndex}-${moveIndex}`} style={{ gap: 8 }}>
                                                        {setSteps.map((qStep) => {
                                                            const isActive = currentIndex === qStep.qIdx;
                                                            return (
                                                                <TouchableOpacity 
                                                                    key={`step-${qStep.qIdx}`} 
                                                                    style={[
                                                                        styles.movementItem,
                                                                        isActive && { borderColor: PRIMARY, borderWidth: 1 }
                                                                    ]}
                                                                    onPress={() => {
                                                                        setCurrentIndex(qStep.qIdx);
                                                                    }}
                                                                >
                                                                    <ImageBackground 
                                                                        source={{ uri: qStep.movement.image || 'https://via.placeholder.com/150' }} 
                                                                        style={styles.movementImage}
                                                                        imageStyle={{ borderRadius: 8 }}
                                                                    />
                                                                    <View style={styles.movementInfo}>
                                                                        <View style={styles.movementHeader}>
                                                                            <Text style={styles.movementName} numberOfLines={1}>
                                                                                {qStep.movement.name}
                                                                            </Text>
                                                                            <View style={styles.categoryBadge}>
                                                                                <Text style={styles.categoryText}>
                                                                                    {qStep.movement.category}
                                                                                </Text>
                                                                            </View>
                                                                        </View>
                                                                        <Text style={styles.movementDetails}>
                                                                            Set {qStep.currentSetNumber}/{qStep.totalSets} • {qStep.movement.reps ? `${qStep.movement.reps} reps` : ''}
                                                                        </Text>
                                                                    </View>
                                                                    {isActive && (
                                                                        <MaterialIcons name="play-circle-filled" size={24} color={PRIMARY} />
                                                                    )}
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                        {set.rest ? (
                                            <View style={styles.restContainer}>
                                                <MaterialIcons name="timer" size={16} color={PRIMARY} />
                                                <Text style={styles.restText}>Rest: {set.rest}s</Text>
                                                {completedRestBlocks.includes(`${blockIndex}-${setIndex}`) && (
                                                    <MaterialIcons name="check-circle" size={16} color={PRIMARY} style={{ marginLeft: 4 }} />
                                                )}
                                            </View>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.footer}>
        <View style={styles.footerButtons}>
            {currentIndex > 0 ? (
                <TouchableOpacity 
                  style={[styles.prevButton, isPrevDisabled && { opacity: 0.5 }]} 
                  onPress={handlePrev}
                  disabled={isPrevDisabled}
                >
                    <MaterialIcons name="arrow-back" size={20} color="#f1f5f9" />
                    <Text style={styles.prevButtonText}>Previous</Text>
                </TouchableOpacity>
            ) : (
                <View style={{ flex: 1 }} /> // Spacer to keep Next button on right
            )}
            
            <TouchableOpacity 
              style={[styles.nextButton, isNextDisabled && { backgroundColor: '#64748b', opacity: 0.8 }]} 
              onPress={handleNext}
              disabled={isNextDisabled}
            >
                <Text style={styles.nextButtonText}>
                    {currentIndex === flatWorkoutQueue.length - 1 ? "Finish" : "Next Set"}
                </Text>
                <MaterialIcons name={currentIndex === flatWorkoutQueue.length - 1 ? "check" : "arrow-forward"} size={20} color={BG_DARK} />
            </TouchableOpacity>
        </View>
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
    padding: 16,
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    gap: 8,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  progressLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  progressValue: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 4/3,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    marginBottom: 16,
    position: 'relative',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  loadingText: {
    marginTop: 10,
    color: '#94a3b8',
    fontSize: 12,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  videoControls: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  videoTimeline: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoProgress: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  videoProgressFill: {
    width: '33%',
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 2,
    position: 'relative',
  },
  videoKnob: {
    position: 'absolute',
    right: -6,
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: BG_DARK,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  setInfoBanner: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.2)',
  },
  setInfoText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  exerciseHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  exerciseTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  exerciseTip: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
  },
  setsValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  muscleMapCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  muscleMapCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  muscleMapContainer: {
    width: 80,
    height: 100,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muscleInfo: {
    flex: 1,
  },
  muscleInfoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
  },
  muscleInfoTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  muscleTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  muscleTagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlayAbsolute: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 9999,
  },
  modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: '#1e293b',
      borderRadius: 16,
      overflow: 'hidden',
  },
  modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
  },
  modalBody: {
      padding: 24,
      alignItems: 'center',
  },
  modalImageContainer: {
      width: 200,
      height: 200,
      marginBottom: 16,
      justifyContent: 'center',
      alignItems: 'center',
  },
  modalImage: {
      width: '100%',
      height: '100%',
  },
  modalMuscleName: {
      color: PRIMARY,
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 12,
      textTransform: 'uppercase',
  },
  modalDescription: {
      color: '#cbd5e1',
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
  },
  workoutListSection: {
    marginTop: 8,
    paddingBottom: 24,
  },
  workoutListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  workoutListTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutListTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  exercisesContainer: {
    gap: 40,
  },
  exerciseBlock: {
    gap: 16,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blockHeaderIndicator: {
    height: 32,
    width: 4,
    backgroundColor: PRIMARY,
  },
  blockTitle: {
    fontSize: 24,
    fontWeight: '900',
    textTransform: 'uppercase',
    fontStyle: 'italic',
    color: '#f1f5f9',
    letterSpacing: -0.5,
  },
  blockContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  setContainer: {
    marginBottom: 16,
  },
  setLabel: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  movementsList: {
    gap: 12,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  movementImage: {
    width: 64,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f1f5f9',
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.2)',
  },
  categoryText: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  movementDetails: {
    fontSize: 14,
    color: '#94a3b8',
  },
  restContainer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.4)',
    borderStyle: 'dashed',
    padding: 10,
    borderRadius: 8,
  },
  restText: {
    fontSize: 12,
    fontWeight: '900',
    color: PRIMARY,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: BG_DARK,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  prevButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  prevButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  nextButtonText: {
    color: BG_DARK,
    fontSize: 14,
    fontWeight: '900',
  },
});
