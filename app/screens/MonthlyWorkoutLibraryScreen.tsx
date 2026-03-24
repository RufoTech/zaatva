import { CustomAlert } from '@/utils/CustomAlert';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

const { width } = Dimensions.get('window');

// Theme Colors
const PRIMARY = "#ccff00";
const BACKGROUND_LIGHT = "#ffffff";
const BACKGROUND_DARK = "#12140a";
const SURFACE_DARK = "#1d2012";
const ACCENT_DARK = "#2a2e1a";
const TEXT_LIGHT = "#0f172a";
const TEXT_DARK = "#f1f5f9";
const TEXT_MUTED_DARK = "#94a3b8";

const CATEGORIES = ["All", "Gain Muscle", "Lose Weight", "Get Fitter", "Get Stronger", "Custom"];

export default function MonthlyWorkoutLibraryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState("All");
  const [userPrograms, setUserPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [activeProgram, setActiveProgram] = useState<string | null>(null);
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [sharedProgramIds, setSharedProgramIds] = useState<Set<string>>(new Set());

  const { openProgramId } = useLocalSearchParams();

  const handleProgramPress = (program: any) => {
    // If it's the active program, skip the modal and go directly to WeeklyProgramScreen
    if (activeProgram === program.id) {
      router.push({
        pathname: '/screens/WeeklyProgramScreen',
        params: { programId: program.id }
      });
      return;
    }

    setSelectedProgram(program);
    setModalVisible(true);
  };

  useFocusEffect(
    useCallback(() => {
      const user = auth().currentUser;
      if (!user) {
        setUserPrograms([]);
        setLoading(false);
        return () => { };
      }

      setLoading(true);

      // Fetch user's active program to check later
      const unsubscribeUser = firestore()
        .collection('users')
        .doc(user.uid)
        .onSnapshot((doc) => {
          if (doc.exists) {
            setActiveProgram(doc.data()?.activeProgramId || null);
          }
        });

      const unsubscribe = firestore()
        .collection('user_programs')
        .where('userId', '==', user.uid)
        .onSnapshot(
          (snapshot) => {
            const fetchedPrograms = snapshot.docs.map((doc) => {
              const data: any = doc.data();

              let workoutCount = typeof data.workoutCount === 'number' ? data.workoutCount : 0;
              let totalDuration = typeof data.totalDuration === 'number' ? data.totalDuration : 0;

              let programImage: string | null = data.coverImage || null;
              if (!programImage && data.weeks) {
                const weeks = Object.values(data.weeks);
                for (const week of weeks as any[]) {
                  if (Array.isArray(week)) {
                    for (const day of week) {
                      const img = day?.images?.[0];
                      // Daha esnek resim kontrolü
                      if (img && typeof img === 'string' && img.length > 5) {
                        programImage = img;
                        break;
                      }
                    }
                  }
                  if (programImage) break;
                }
              }

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

              if (data.weeks && data.weeksMigrated !== true) {
                firestore()
                  .collection('user_program_weeks')
                  .doc(doc.id)
                  .set(
                    {
                      userId: data.userId,
                      createdAt: firestore.FieldValue.serverTimestamp(),
                      weeks: data.weeks,
                    },
                    { merge: true }
                  )
                  .then(() =>
                    firestore()
                      .collection('user_programs')
                      .doc(doc.id)
                      .update({
                        weeks: firestore.FieldValue.delete(),
                        coverImage: programImage || null,
                        workoutCount,
                        totalDuration,
                        weeksMigrated: true,
                      })
                  )
                  .catch((e) => console.error('Program weeks migration error:', e));
              }

              let levelColor = PRIMARY;
              if (data.focus === 'Lose Weight') levelColor = '#3b82f6';
              else if (data.focus === 'Get Stronger') levelColor = '#ef4444';

              return {
                id: doc.id,
                ...data,
                name: data.name || 'Untitled Program',
                level: data.focus || 'Custom',
                levelColor: levelColor,
                duration: `${totalDuration} mins/week`,
                exercises: `${workoutCount} workouts`,
                image: programImage,
                isCustom: true,
                muscle: data.focus || 'General',
              };
            });

            setUserPrograms(fetchedPrograms);
            setLoading(false);

            // Check which programs are already shared to community
            if (user) {
              firestore()
                .collection('community_shared_programs')
                .where('authorId', '==', user.uid)
                .get()
                .then(sharedSnap => {
                  const ids = new Set<string>();
                  sharedSnap.docs.forEach(doc => {
                    const d = doc.data();
                    if (d.originalId) ids.add(d.originalId);
                  });
                  setSharedProgramIds(ids);
                })
                .catch(e => console.error('Error fetching shared programs:', e));
            }

            // Check if we need to open a specific program from navigation params
            if (openProgramId) {
              const programToOpen = fetchedPrograms.find(p => p.id === openProgramId);
              if (programToOpen) {
                setSelectedProgram(programToOpen);
                setModalVisible(true);
                // Reset param to avoid re-opening on simple re-focus? 
                // Expo router params might persist, but state reset handles it usually.
                // Or we can use setParams to clear it if needed.
                router.setParams({ openProgramId: '' });
              }
            }
          },
          (error) => {
            console.error('Error fetching user programs:', error);
            setLoading(false);
          }
        );

      return () => {
        unsubscribeUser();
        unsubscribe();
      };
    }, [openProgramId]) // Re-run if openProgramId changes
  );

  const handleStartProgram = async () => {
    if (selectedProgram?.id) {
      try {
        const user = auth().currentUser;
        if (user) {
          await firestore()
            .collection('users')
            .doc(user.uid)
            .set({ activeProgramId: selectedProgram.id }, { merge: true });
        }
      } catch (error) {
        console.error("Error setting active program:", error);
      }

      setWarningModalVisible(false);
      setModalVisible(false);

      router.push({
        pathname: '/screens/WeeklyProgramScreen',
        params: { programId: selectedProgram.id }
      });
    }
  };

  const onStartNowPress = () => {
    // If user has an active program and it's different from the selected one, show warning
    if (activeProgram && activeProgram !== selectedProgram?.id) {
      setWarningModalVisible(true);
    } else {
      handleStartProgram();
    }
  };

  const handleDeleteProgram = (programId: string) => {
    CustomAlert.show(
      "Delete Program",
      "Are you sure you want to delete this program?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth().currentUser;

              // Check if the deleted program is the currently active one
              if (user) {
                const userDoc = await firestore().collection('users').doc(user.uid).get();
                const userData = userDoc.data();

                if (userData?.activeProgramId === programId) {
                  // If it is, remove it from the user's active program
                  await firestore().collection('users').doc(user.uid).update({
                    activeProgramId: firestore.FieldValue.delete()
                  });
                }
              }

              await Promise.all([
                firestore().collection('user_programs').doc(programId).delete(),
                firestore().collection('user_program_weeks').doc(programId).delete(),
              ]);
              // Refresh list
              setUserPrograms(prev => prev.filter(p => p.id !== programId));
            } catch (error) {
              console.error("Error deleting program:", error);
              CustomAlert.show("Error", "Failed to delete program.");
            }
          }
        }
      ]
    );
  };

  const handleShareProgram = (program: any) => {
    if (sharedProgramIds.has(program.id)) {
      CustomAlert.show('Artıq paylaşılıb', 'Bu proqram artıq icmaya paylaşılıb.');
      return;
    }
    CustomAlert.show(
      "Share Program",
      "Do you want to share this program with the community?",
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
                originalId: program.id,
                authorName: user.displayName || user.email || 'Anonymous User',
                title: program.name || 'My Custom Program',
                focus: program.level || 'General',
                coverImage: program.image || null,
                workoutCount: program.workoutCount || 0,
                totalDuration: program.totalDuration || 0
              };

              const response = await fetch(`${API_URL}/api/community/share-program`, {
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
                throw new Error('Failed to share program');
              }

              // Mark as shared locally
              setSharedProgramIds(prev => new Set(prev).add(program.id));
              CustomAlert.show("Success", "Your program has been shared with the community!");
            } catch (error: any) {
              console.error("Error sharing program:", error);
              CustomAlert.show("DİQQƏT!", error.message || "Failed to share program. Please try again.");
            }
          }
        }
      ]
    );
  };

  const filteredPrograms = userPrograms.filter(prog => {
    const matchesSearch = prog.name.toLowerCase().includes(search.toLowerCase());

    let matchesCategory = true;
    if (activeCategory === "All") {
      matchesCategory = true;
    } else {
      matchesCategory = prog.focus === activeCategory;
    }

    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BACKGROUND_DARK} />

      {/* Top App Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monthly Workouts</Text>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="notifications" size={24} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={24} color={TEXT_MUTED_DARK} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your programs..."
            placeholderTextColor={TEXT_MUTED_DARK}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={[
                styles.categoryChip,
                activeCategory === cat ? styles.categoryChipActive : styles.categoryChipInactive
              ]}
            >
              <Text style={[
                styles.categoryText,
                activeCategory === cat ? styles.categoryTextActive : styles.categoryTextInactive
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Program List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 20 }} />
        ) : (
          filteredPrograms.length > 0 ? (
            filteredPrograms.map((program) => {
              const isNoImage = !program.image;

              if (isNoImage) {
                return (
                  <TouchableOpacity
                    key={program.id}
                    activeOpacity={0.9}
                    style={styles.noImageCard}
                    onPress={() => handleProgramPress(program)}
                  >
                    <View style={styles.noImageHeader}>
                      <View style={styles.noImageHeaderLeft}>
                        <Text style={[styles.noImageLevelText, { color: program.levelColor || '#ccff00' }]}>
                          {program.level}
                        </Text>
                        <Text style={styles.noImageTitle}>{program.name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {sharedProgramIds.has(program.id) ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, marginRight: 8 }}>
                            <MaterialIcons name="check-circle" size={18} color="#22c55e" />
                            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>Shared</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleShareProgram(program)}
                            style={{ padding: 4, marginRight: 8 }}
                          >
                            <MaterialIcons name="share" size={24} color="#3b82f6" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleDeleteProgram(program.id)}
                          style={{ padding: 4 }}
                        >
                          <MaterialIcons name="delete-outline" size={24} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Details Section */}
                    <View style={styles.noImageDetailsRow}>
                      <View style={styles.noImageDetailItem}>
                        <MaterialIcons name="fitness-center" size={16} color="#ccff00" />
                        <Text style={styles.noImageDetailText}>{program.weeks ? Object.keys(program.weeks).length : 4} Weeks</Text>
                      </View>
                      <View style={styles.noImageDetailItem}>
                        <MaterialIcons name="list-alt" size={16} color="#ccff00" />
                        <Text style={styles.noImageDetailText}>{program.exercises}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: -35 }}>
                      <TouchableOpacity
                        style={activeProgram === program.id ? styles.continueButton : styles.addButton}
                        onPress={() => handleProgramPress(program)}
                      >
                        {activeProgram === program.id ? (
                          <Text style={styles.continueButtonText}>Continue</Text>
                        ) : (
                          <MaterialIcons name="play-arrow" size={24} color="#1f230f" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={program.id}
                  activeOpacity={0.9}
                  style={styles.card}
                  onPress={() => handleProgramPress(program)}
                >
                  <ImageBackground
                    source={{ uri: program.image }}
                    style={styles.cardImage}
                    imageStyle={{ borderRadius: 16 }}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={styles.cardOverlay}
                    />
                    <View style={[styles.levelBadge, { backgroundColor: program.levelColor || '#ccff00' }]}>
                      <Text style={styles.levelText}>{program.level || 'General'}</Text>
                    </View>
                    {sharedProgramIds.has(program.id) ? (
                      <View style={[styles.shareButton, { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, width: 'auto', borderRadius: 12 }]}>
                        <MaterialIcons name="check-circle" size={16} color="#22c55e" />
                        <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>Shared</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.shareButton}
                        onPress={() => handleShareProgram(program)}
                      >
                        <MaterialIcons name="share" size={18} color="#3b82f6" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteProgram(program.id)}
                    >
                      <MaterialIcons name="delete" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </ImageBackground>

                  <View style={styles.cardFooter}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{program.name}</Text>
                      <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                          <MaterialIcons name="fitness-center" size={14} color="#ccff00" />
                          <Text style={styles.metaText}>{program.weeks ? Object.keys(program.weeks).length : 4} Weeks</Text>
                        </View>
                        <Text style={styles.metaDot}>•</Text>
                        <View style={styles.metaItem}>
                          <MaterialIcons name="list-alt" size={14} color="#ccff00" />
                          <Text style={styles.metaText}>{program.exercises}</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={activeProgram === program.id ? styles.continueButton : styles.addButton}
                      onPress={() => handleProgramPress(program)}
                    >
                      {activeProgram === program.id ? (
                        <Text style={styles.continueButtonText}>Continue</Text>
                      ) : (
                        <MaterialIcons name="play-arrow" size={24} color="#1f230f" />
                      )}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: TEXT_MUTED_DARK }}>No programs found.</Text>
            </View>
          )
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Empty State / Floating Button omitted */}
      {!loading && userPrograms.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={64} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyStateTitle}>No Programs Yet</Text>
          <Text style={styles.emptyStateDesc}>Create your first workout program to get started on your fitness journey.</Text>
        </View>
      )}

      {/* Program Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.fullScreenModal}>
          {/* Background Image with Blur */}
          <View style={styles.modalBackgroundContainer}>
            <Image
              source={{ uri: selectedProgram?.image || 'https://via.placeholder.com/400' }}
              style={styles.modalBackgroundImage}
              blurRadius={20}
            />
            <View style={styles.modalBackgroundOverlay} />
          </View>

          <SafeAreaView style={styles.modalSafeArea}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>

              {/* Header / Close Button */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                  <MaterialIcons name="close" size={24} color={TEXT_DARK} />
                </TouchableOpacity>
              </View>

              {/* Hero Section */}
              <View style={styles.heroSection}>
                <View style={styles.todaysGoalBadge}>
                  <Text style={styles.todaysGoalText}>{"TODAY'S GOAL"}</Text>
                </View>
                <Text style={styles.heroTitle}>Ready to start your workout?</Text>
              </View>

              {/* Workout Detail Card */}
              <View style={styles.workoutDetailCard}>
                <View style={styles.workoutCardContent}>
                  <View style={styles.workoutIconContainer}>
                    <MaterialIcons name="fitness-center" size={32} color={PRIMARY} />
                  </View>
                  <Text style={styles.workoutTitle}>{selectedProgram?.name || 'Untitled Program'}</Text>

                  <View style={styles.workoutStatsRow}>
                    <View style={styles.workoutStat}>
                      <MaterialIcons name="calendar-today" size={14} color={TEXT_MUTED_DARK} />
                      <Text style={styles.workoutStatText}>Day 1</Text>
                    </View>
                    <View style={styles.workoutStatDot} />
                    <View style={styles.workoutStat}>
                      <MaterialIcons name="schedule" size={14} color={TEXT_MUTED_DARK} />
                      <Text style={styles.workoutStatText}>{selectedProgram?.duration || '45 mins'}</Text>
                    </View>
                    <View style={styles.workoutStatDot} />
                    <View style={styles.workoutStat}>
                      <MaterialIcons name="list" size={14} color={TEXT_MUTED_DARK} />
                      <Text style={styles.workoutStatText}>{selectedProgram?.exercises || '8 exercises'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* First Exercise Preview */}
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>FIRST EXERCISE PREVIEW</Text>
                <View style={styles.previewCard}>
                  <View style={styles.previewImageContainer}>
                    <Image
                      source={{ uri: selectedProgram?.image || 'https://via.placeholder.com/150' }}
                      style={styles.previewImage}
                    />
                    <View style={styles.previewOverlay}>
                      <MaterialIcons name="play-circle-outline" size={32} color="rgba(204, 255, 0, 0.6)" />
                    </View>
                  </View>

                  <View style={styles.previewContent}>
                    <Text style={styles.previewExerciseName}>Barbell Bench Press</Text>
                    <View style={styles.previewStats}>
                      <View style={styles.previewTag}>
                        <Text style={styles.previewTagText}>4 SETS</Text>
                      </View>
                      <Text style={styles.previewX}>x</Text>
                      <View style={[styles.previewTag, { backgroundColor: '#334155' }]}>
                        <Text style={[styles.previewTagText, { color: '#cbd5e1' }]}>10 REPS</Text>
                      </View>
                    </View>
                  </View>

                  <MaterialIcons name="chevron-right" size={24} color={TEXT_MUTED_DARK} />
                </View>
              </View>

              <View style={{ flex: 1, minHeight: 40 }} />

              {/* Action Buttons */}
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={styles.startNowButton}
                  activeOpacity={0.8}
                  onPress={onStartNowPress}
                >
                  <Text style={styles.startNowButtonText}>START NOW</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.notNowButton}
                  activeOpacity={0.8}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.notNowButtonText}>NOT NOW</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Warning Modal */}
      <Modal
        visible={warningModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setWarningModalVisible(false)}
      >
        <View style={styles.warningModalOverlay}>
          <View style={styles.warningModalCard}>

            <View style={styles.warningModalIconContainer}>
              <View style={styles.warningModalIconBg}>
                <MaterialIcons name="warning" size={40} color="#ccff00" />
              </View>
            </View>

            <View style={styles.warningModalTextContent}>
              <Text style={styles.warningModalTitle}>Active Workout Detected</Text>
              <Text style={styles.warningModalDescription}>
                You currently have an active workout. If you start a new workout, your current one will be stopped. Are you sure you want to continue?
              </Text>
            </View>

            <View style={styles.warningModalActions}>
              <TouchableOpacity
                style={styles.warningModalYesBtn}
                onPress={handleStartProgram}
                activeOpacity={0.8}
              >
                <Text style={styles.warningModalYesText}>Yes, Continue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.warningModalCancelBtn}
                onPress={() => setWarningModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.warningModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_DARK,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(18, 20, 10, 0.8)',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 14,
    height: '100%',
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipActive: {
    backgroundColor: PRIMARY,
  },
  categoryChipInactive: {
    backgroundColor: SURFACE_DARK,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: BACKGROUND_DARK,
  },
  categoryTextInactive: {
    color: TEXT_DARK,
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  cardImage: {
    height: 160,
    justifyContent: 'flex-end',
    padding: 12,
    width: '100%',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  levelBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  levelText: {
    color: '#1f230f',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  metaDot: {
    color: '#64748b',
    fontSize: 12,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ccff00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButton: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ccff00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f230f',
  },
  noImageCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#2a2f16',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noImageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  noImageHeaderLeft: {
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  deleteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    position: 'absolute',
    top: 12,
    right: 52,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageLevelText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  noImageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    lineHeight: 24,
  },
  noImageDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 24,
    columnGap: 16,
    rowGap: 12,
  },
  noImageDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noImageDetailText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 64,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginTop: 16,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  modalBody: {
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  modalStatsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  modalStatsDot: {
    fontSize: 14,
    color: '#4B5563',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 32,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalStartButton: {
    width: '100%',
    backgroundColor: '#D0FD3E',
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalStartButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalNotNowButton: {
    width: '100%',
    backgroundColor: '#2C2C2E',
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
  },
  modalNotNowButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: BACKGROUND_DARK,
  },
  modalBackgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  modalBackgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    opacity: 0.6,
  },
  modalBackgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 20, 10, 0.4)',
  },
  modalSafeArea: {
    flex: 1,
    zIndex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  todaysGoalBadge: {
    backgroundColor: 'rgba(204, 255, 0, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  todaysGoalText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 40,
  },
  workoutDetailCard: {
    backgroundColor: '#1f230f', // Dark greenish card
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  workoutCardContent: {
    alignItems: 'center',
    gap: 12,
  },
  workoutIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff', // White text for dark card
    textAlign: 'center',
  },
  workoutStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  workoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workoutStatText: {
    fontSize: 14,
    color: '#94a3b8', // Muted text for dark card
    fontWeight: '500',
  },
  workoutStatDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569', // Darker dot
  },
  previewSection: {
    gap: 12,
  },
  previewTitle: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 35, 15, 0.8)',
    borderRadius: 16,
    padding: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  previewImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1e293b',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  previewContent: {
    flex: 1,
    gap: 4,
  },
  previewExerciseName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
  },
  previewTagText: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  previewX: {
    color: '#64748b',
    fontSize: 12,
  },
  actionButtonsContainer: {
    gap: 16,
    paddingTop: 24,
  },
  startNowButton: {
    backgroundColor: PRIMARY,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startNowButtonText: {
    color: BACKGROUND_DARK,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  notNowButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  notNowButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Warning Modal Styles
  warningModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  warningModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1c1f0f',
    borderRadius: 32,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  warningModalIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  warningModalIconBg: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(204, 255, 0, 0.2)',
  },
  warningModalTextContent: {
    alignItems: 'center',
    marginBottom: 40,
  },
  warningModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  warningModalDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
  warningModalActions: {
    flexDirection: 'column',
    gap: 16,
  },
  warningModalYesBtn: {
    width: '100%',
    backgroundColor: '#ccff00',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  warningModalYesText: {
    color: '#12140a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  warningModalCancelBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  warningModalCancelText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
