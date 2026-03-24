import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  Dimensions,
  ImageBackground,
  Alert
} from 'react-native';
import { MaterialIcons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { CustomAlert } from '@/utils/CustomAlert';

const { width } = Dimensions.get('window');

export default function ProgramsScreen() {
  const router = useRouter();
  const [activeProgram, setActiveProgram] = useState<any>(null);
  const user = auth().currentUser;

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      const unsubscribeUser = firestore()
        .collection('users')
        .doc(user.uid)
        .onSnapshot(async (doc) => {
          if (doc.exists) {
            const userData = doc.data();
            if (userData?.activeProgramId) {
              try {
                const programDoc = await firestore()
                  .collection('user_programs')
                  .doc(userData.activeProgramId)
                  .get();
                
                if (programDoc.exists) {
                  const data: any = programDoc.data();
                  let workoutCount = typeof data.workoutCount === 'number' ? data.workoutCount : 0;
                  let totalDuration = typeof data.totalDuration === 'number' ? data.totalDuration : 0;

                  if (data.weeks && (workoutCount === 0 || totalDuration === 0)) {
                    const weeks = Object.values(data.weeks);
                    for (const week of weeks as any[]) {
                      if (Array.isArray(week)) {
                        for (const day of week) {
                          if (day?.type === 'workout') {
                            workoutCount += 1;
                            if (day?.subtitle) {
                              const parts = String(day.subtitle).split('•');
                              if (parts.length > 1) {
                                const dur = parseInt(parts[1], 10);
                                if (!isNaN(dur)) totalDuration += dur;
                              }
                            }
                          }
                        }
                      }
                    }
                  }

                  let levelColor = '#ccff00';
                  if (data.focus === 'Lose Weight') levelColor = '#3b82f6';
                  else if (data.focus === 'Get Stronger') levelColor = '#ef4444';

                  setActiveProgram({ 
                    id: programDoc.id, 
                    ...data,
                    level: data.focus || 'General',
                    levelColor: levelColor,
                    workoutCount,
                    totalDuration
                  });
                } else {
                  setActiveProgram(null);
                }
              } catch (error) {
                console.error("Error fetching active program:", error);
              }
            } else {
              setActiveProgram(null);
            }
          }
        });

      return () => unsubscribeUser();
    }, [user])
  );

  const handleRemoveProgram = async () => {
    if (!user) return;
    
    CustomAlert.show(
      "Remove Program",
      "Are you sure you want to remove your active program? Your progress within the program will not be deleted, but it will be removed from your dashboard.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              await firestore().collection('users').doc(user.uid).update({
                activeProgramId: firestore.FieldValue.delete()
              });
            } catch (error) {
              console.error("Error removing program:", error);
              CustomAlert.show("Error", "Could not remove the program. Please try again.");
            }
          }
        }
      ]
    );
  };

  const [recommendedPrograms, setRecommendedPrograms] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      const fetchRecommendations = async () => {
        try {
          const snapshot = await firestore()
            .collection('recommendations')
            .orderBy('recommendedRank', 'desc')
            .limit(5)
            .get();
          
          const programs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setRecommendedPrograms(programs);
        } catch (error) {
          console.error("Error fetching recommendations:", error);
        }
      };

      fetchRecommendations();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f230f" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Programs</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Active Program Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR PROGRAM</Text>
          
          <TouchableOpacity 
            style={[styles.workoutCard, { borderColor: 'rgba(204, 255, 0, 0.1)' }]}
            activeOpacity={0.9}
            onPress={() => {
              if (activeProgram?.id) {
                router.push({ pathname: '/screens/WeeklyProgramScreen', params: { programId: activeProgram.id } });
              } else {
                router.push('/screens/CreateProgramScreen');
              }
            }}
          >
            <ImageBackground
              source={{ uri: activeProgram?.coverImage || activeProgram?.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCI3xrdrlqpd6zybsFzh1uoDJW_RAThN-65xFUKUjIeLQpnVnoiBdvHicM2Wbj3MXYdOpqO6j1E4pWY7v1pknlmw5HdeqLDK4incQqa9CJ1ohskwTOTK2lKi8S9Qut8s28hZ1Vj4kHJ0aLsON8HKXM8Z18gFXJvw3nD8r0vvUpsAklNhALnZgZNUuJmw900bxjwFNxIGpFWSFYAR35orgrs2JlRxN-pYuZbTYcTVDChxhRA_3JnNbcYqDUf7MyxIt5HdTKhCvsfG_o' }}
              style={styles.workoutImage}
            >
              <LinearGradient
                colors={['rgba(2, 6, 23, 0.9)', 'rgba(2, 6, 23, 0.4)', 'transparent']}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={styles.workoutGradient}
              />
              <View style={styles.workoutContent}>
                <View style={styles.startBadgeContainer}>
                  <View style={[styles.startBadge, activeProgram?.levelColor ? { backgroundColor: activeProgram.levelColor } : {}]}>
                    <Text style={[styles.startBadgeText, { color: activeProgram?.levelColor ? '#1f230f' : '#1f230f' }]}>{activeProgram?.level?.toUpperCase() || (activeProgram ? 'CONTINUE' : "LET'S START")}</Text>
                  </View>
                  <View style={styles.clockContainer}>
                    {activeProgram ? null : (
                      <>
                        <Feather name="clock" size={12} color="#cbd5e1" />
                        <Text style={styles.clockText}>{"Let's Start"}</Text>
                      </>
                    )}
                  </View>
                </View>
                
                <Text style={styles.workoutTitle}>{activeProgram?.name || 'Your First Program'}</Text>
                
                {activeProgram ? (
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <MaterialIcons name="fitness-center" size={14} color="#1f230f" />
                      <Text style={styles.metaText}>{activeProgram.weeks ? Object.keys(activeProgram.weeks).length : 4} Weeks</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <MaterialIcons name="list-alt" size={14} color="#1f230f" />
                      <Text style={styles.metaText}>{activeProgram.exercises || `${activeProgram.workoutCount || 0} workouts`}</Text>
                    </View>
                    {activeProgram.totalDuration ? (
                      <View style={styles.metaItem}>
                        <Feather name="clock" size={12} color="#1f230f" />
                        <Text style={styles.metaText}>{activeProgram.totalDuration} mins/week</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.workoutDescription} numberOfLines={1}>
                    Design your personalized training plan to get started on your fitness journey.
                  </Text>
                )}
                
                <TouchableOpacity 
                  style={styles.createProgramButton}
                  onPress={() => {
                    if (activeProgram?.id) {
                      router.push({ pathname: '/screens/WeeklyProgramScreen', params: { programId: activeProgram.id } });
                    } else {
                      router.push('/screens/CreateProgramScreen');
                    }
                  }}
                >
                  <MaterialIcons name="play-arrow" size={20} color="#1f230f" />
                  <Text style={styles.createProgramText}>{activeProgram ? 'Continue Program' : 'Create Training Program'}</Text>
                </TouchableOpacity>

                {activeProgram && (
                  <TouchableOpacity 
                    style={[styles.createProgramButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginTop: 8 }]}
                    onPress={handleRemoveProgram}
                  >
                    <MaterialIcons name="close" size={20} color="#f1f5f9" />
                    <Text style={[styles.createProgramText, { color: '#f1f5f9' }]}>Remove Program</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </View>

        {/* Create Custom Program Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => router.push('/screens/CreateCustomWorkoutScreen')}
            >
              <View style={styles.quickActionIcon}>
                <Feather name="edit" size={32} color="#ccff00" />
              </View>
              <Text style={styles.quickActionTitle}>Custom Workout</Text>
              <Text style={styles.quickActionSubtitle}>Design your own routine</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => router.push('/screens/CommunityMarketplaceScreen')}
            >
              <View style={styles.quickActionIcon}>
                <MaterialCommunityIcons name="store" size={32} color="#ccff00" />
              </View>
              <Text style={styles.quickActionTitle}>Community</Text>
              <Text style={styles.quickActionSubtitle}>Browse shared workouts</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Recommended Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECOMMENDED</Text>
            <TouchableOpacity style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See all</Text>
              <Feather name="chevron-right" size={16} color="#ccff00" />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedContainer}>
            {recommendedPrograms.map((program) => (
              <TouchableOpacity 
                key={program.id} 
                style={styles.recommendedCard}
                onPress={() => router.push({
                  pathname: '/screens/WorkoutDetailsScreen',
                  params: {
                    id: program.programId,
                    programId: program.programId,
                    type: 'program',
                    workoutId: program.exerciseId, // Using exerciseId as workoutId if needed
                    isRecommended: 'true'
                  }
                })}
              >
                <View style={styles.recommendedImageContainer}>
                  <Image source={{ uri: program.coverImage }} style={styles.recommendedImage} />
                  <LinearGradient
                    colors={['rgba(0,0,0,0.1)', 'transparent']}
                    style={styles.imageOverlay}
                  />
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>{program.level}</Text>
                  </View>
                </View>
                
                <View style={styles.recommendedContent}>
                  <Text style={styles.recommendedTitle}>{program.name}</Text>
                  <View style={styles.durationContainer}>
                    <Feather name="clock" size={14} color="#ccff00" />
                    <Text style={styles.durationText}>{program.duration} mins</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f230f',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(204, 255, 0, 0.1)',
    backgroundColor: 'rgba(31, 35, 15, 0.8)',
  },
  headerTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  userButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 20,
  },
  section: {
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  workoutCard: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  workoutImage: {
    width: '100%',
    height: '100%',
  },
  workoutGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  workoutContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  startBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  startBadge: {
    backgroundColor: '#ccff00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  startBadgeText: {
    color: '#1f230f',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  clockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clockText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  workoutTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  workoutDescription: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ccff00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  metaText: {
    color: '#1f230f',
    fontSize: 12,
    fontWeight: '600',
  },
  metaDot: {
    color: '#64748b',
    fontSize: 12,
  },
  createProgramButton: {
    backgroundColor: '#ccff00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  createProgramText: {
    color: '#1f230f',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  quickActionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    textTransform: 'uppercase',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    color: '#ccff00',
    fontSize: 14,
    fontWeight: 'bold',
  },
  recommendedContainer: {
    paddingRight: 16,
    gap: 20,
  },
  recommendedCard: {
    width: 260,
  },
  recommendedImageContainer: {
    width: '100%',
    aspectRatio: 4/5,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  recommendedImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    inset: 0,
  },
  levelBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(31, 35, 15, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  levelText: {
    color: '#ccff00',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  recommendedContent: {
    paddingHorizontal: 4,
  },
  recommendedTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
});
