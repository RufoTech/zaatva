import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { CustomAlert } from '@/utils/CustomAlert';
import * as Linking from 'expo-linking';
import {
    ActivityIndicator,
    Image,
    ImageBackground,
    Platform,
    SafeAreaView,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const BG_DARK = "#0d0f06";
const PRIMARY = "#ccff00";
const SECONDARY = "#ece856";
const TERTIARY = "#fce047";
const SURFACE_CONTAINER_LOW = "#12140a";
const SURFACE_CONTAINER = "#181b0f";
const SURFACE_CONTAINER_HIGH = "#1e2114";
const TEXT_WHITE = "#fdfdec";
const TEXT_MUTED = "#abac9c";
const OUTLINE_VARIANT = "rgba(71, 73, 60, 0.2)";

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export default function AthleteProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const currentUser = auth().currentUser;
  const isOwnProfile = !userId || userId === currentUser?.uid;
  const profileUserId = (isOwnProfile ? currentUser?.uid : userId) as string;

  const [activeTab, setActiveTab] = useState<'Workouts' | 'Monthly' | 'Badges'>('Workouts');
  const [userData, setUserData] = useState<any>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [sharedWorkouts, setSharedWorkouts] = useState<any[]>([]);
  const [sharedPrograms, setSharedPrograms] = useState<any[]>([]);
  const [completedAchievements, setCompletedAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted' | 'loading'>('loading');

  // Prevent unauthenticated users from viewing the profile screen
  useEffect(() => {
    if (!loading && !currentUser) {
      CustomAlert.show('Daxil Olun', 'Bu profili görmək üçün hesaba daxil olmalısınız.');
      router.replace('/login');
    }
  }, [currentUser, loading]);

  useFocusEffect(
    useCallback(() => {
    if (!profileUserId) return;

    const loadProfileData = async () => {
      try {
        // 1. Load User Info from user_about
        const userDoc = await firestore().collection('user_about').doc(profileUserId).get();
        const userExists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
        if (userExists) {
          setUserData(userDoc.data());
        }

        // 2. Count Friends (where status is 'accepted' and current user is either sender or receiver)
        const sentFriendsSnapshot = await firestore()
          .collection('friend_requests')
          .where('senderId', '==', profileUserId)
          .where('status', '==', 'accepted')
          .get();
          
        const receivedFriendsSnapshot = await firestore()
          .collection('friend_requests')
          .where('receiverId', '==', profileUserId)
          .where('status', '==', 'accepted')
          .get();
          
        setFriendsCount(sentFriendsSnapshot.size + receivedFriendsSnapshot.size);

        // 3. Load Shared Workouts from community_shared_workouts
        const workoutsSnapshot = await firestore()
          .collection('community_shared_workouts')
          .where('authorId', '==', profileUserId)
          .get();
        
        const workoutsList = workoutsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSharedWorkouts(workoutsList);

        // 4. Load Shared Monthly Programs (community_shared_programs) -> mapping to 'Posts' tab
        const programsSnapshot = await firestore()
          .collection('community_shared_programs')
          .where('authorId', '==', profileUserId)
          .get();
          
        const programsList = programsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSharedPrograms(programsList);

        // 5. Load Completed Achievements
        const achievementsSnapshot = await firestore()
          .collection('user_achievements')
          .where('userId', '==', profileUserId)
          .where('completed', '==', true)
          .get();
          
        const achievementsList = achievementsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCompletedAchievements(achievementsList);

        // 6. Check Friendship Status if NOT own profile
        if (!isOwnProfile && currentUser) {
          const checkStatus = async () => {
             const req1 = await firestore().collection('friend_requests')
               .where('senderId', '==', currentUser.uid)
               .where('receiverId', '==', profileUserId)
               .get();
             
             const req2 = await firestore().collection('friend_requests')
               .where('senderId', '==', profileUserId)
               .where('receiverId', '==', currentUser.uid)
               .get();

             if (!req1.empty) {
                setFriendshipStatus(req1.docs[0].data().status);
             } else if (!req2.empty) {
                const req2Status = req2.docs[0].data().status;
                // If it's pending and receiver is us, maybe show action? Keeping it 'pending' logic for now.
                setFriendshipStatus(req2Status);
             } else {
                setFriendshipStatus('none');
             }
          };
          await checkStatus();
        }

      } catch (error) {
        console.error("Error loading athlete profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [profileUserId]));

  const displayName = userData?.fullname || userData?.displayName || userData?.name || userData?.mail || currentUser?.email || 'Athlete';
  const displayPhoto = userData?.photoURL || userData?.avatar || 'https://via.placeholder.com/150';

  const handleDeleteActivity = (item: any, type: 'workout' | 'program') => {
    import('react-native').then(({ Alert }) => {
        CustomAlert.show(
          "Silinməni Təsdiqlə",
          "Bu məşqi profilinizdən və icmadan (community) silmək istədiyinizə əminsiniz?",
          [
            { text: "Ləğv et", style: "cancel" },
            { 
              text: "Sil", 
              style: "destructive",
              onPress: async () => {
                 if (!currentUser) return;
                 setDeletingId(item.id);
                 try {
                    const token = await currentUser.getIdToken();
                    const endpoint = type === 'program' ? '/api/community/delete-program' : '/api/community/delete-workout';
                    
                    const response = await fetch(`${API_URL}${endpoint}`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ itemId: item.id })
                    });
    
                    if (!response.ok) {
                      throw new Error('Failed to delete item');
                    }
    
                    if (type === 'workout') {
                        setSharedWorkouts(prev => prev.filter(i => i.id !== item.id));
                    } else {
                        setSharedPrograms(prev => prev.filter(i => i.id !== item.id));
                    }
                 } catch (error) {
                    console.error("Error deleting item:", error);
                    CustomAlert.show("Xəta", "Silinmə zamanı xəta baş verdi.");
                 } finally {
                    setDeletingId(null);
                 }
              }
            }
          ]
        );
    });
  };

  const handleShareProfile = async () => {
    try {
      const url = Linking.createURL('/screens/AthleteProfileScreen', { queryParams: { userId: profileUserId } });
      await Share.share({
        message: `Mənim GreenFit profilimə baxın! ${url}`,
      });
    } catch (error) {
      console.error(error);
      CustomAlert.show('Xəta', 'Paylaşılarkən xəta baş verdi.');
    }
  };

  const handleAddFriend = async () => {
    if (!currentUser) return;
    try {
      setFriendshipStatus('loading');
      await firestore().collection('friend_requests').add({
        senderId: currentUser.uid,
        receiverId: profileUserId,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp()
      });
      setFriendshipStatus('pending');
      CustomAlert.show("Success", "Friend request sent!");
    } catch (error) {
      console.error("Error sending request:", error);
      CustomAlert.show("Error", "Could not send friend request.");
      setFriendshipStatus('none');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ATHLETE PROFILE</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Profile Info Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarGradient}>
              <Image 
                source={{ uri: displayPhoto }} 
                style={styles.avatar} 
              />
            </View>
            <View style={styles.eliteBadge}>
              <Text style={styles.eliteBadgeText}>ELITE ATHLETE</Text>
            </View>
          </View>

          <Text style={styles.profileName}>{displayName}</Text>
          
          <Text style={styles.profileBio}>
            {userData?.bio || "Fitness enthusiast. Ready to crush goals!"}
          </Text>

          <View style={styles.actionButtons}>
            {isOwnProfile ? (
              <>
                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => router.push('/screens/EditProfileScreen')}
                >
                  <Text style={styles.actionBtnText}>EDIT PROFILE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={handleShareProfile}>
                  <Text style={styles.actionBtnText}>SHARE PROFILE</Text>
                </TouchableOpacity>
              </>
            ) : currentUser ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {friendshipStatus === 'none' && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: PRIMARY, borderColor: PRIMARY }]} onPress={handleAddFriend}>
                    <Text style={[styles.actionBtnText, { color: BG_DARK, fontSize: 13 }]}>ADD FRIEND +</Text>
                  </TouchableOpacity>
                )}
                {friendshipStatus === 'pending' && (
                  <TouchableOpacity style={styles.actionBtn} disabled>
                    <Text style={[styles.actionBtnText, { color: TEXT_MUTED }]}>REQUEST SENT</Text>
                  </TouchableOpacity>
                )}
                {friendshipStatus === 'accepted' && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'transparent', borderColor: PRIMARY }]} disabled>
                    <Text style={[styles.actionBtnText, { color: PRIMARY }]}>FRIENDS</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{friendsCount}</Text>
            <Text style={styles.statLabel}>FRIENDS</Text>
          </View>
        </View>

        {/* Achievements Section */}
        <View style={styles.achievementsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <TouchableOpacity onPress={() => router.push('/screens/AchievementsScreen')}>
              <Text style={styles.viewAllText}>VIEW ALL</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesList}>
            {completedAchievements.length > 0 ? (
              completedAchievements.map((achievement, index) => (
                <View key={achievement.id || index} style={styles.badgeCard}>
                  <View style={[styles.badgeIconWrapper, { backgroundColor: 'rgba(204,255,0,0.1)' }]}>
                    <MaterialIcons name="emoji-events" size={32} color={PRIMARY} />
                  </View>
                  <Text style={styles.badgeText}>{achievement.title || 'ACHIEVEMENT'}</Text>
                </View>
              ))
            ) : (
              <View style={[styles.badgeCard, { opacity: 0.4, width: 200 }]}>
                <Text style={[styles.badgeText, { color: TEXT_MUTED }]}>No achievements yet</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Activity Tabs */}
        <View style={styles.tabsContainer}>
          {(['Workouts', 'Monthly', 'Badges'] as const).map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabBtn, activeTab === tab && styles.activeTabBtn]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.activeTabBtnText]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Workouts Content */}
        {activeTab === 'Workouts' && (
          <View style={styles.workoutsList}>
            {sharedWorkouts.length > 0 ? (
              sharedWorkouts.map((workout) => (
                <TouchableOpacity 
                  key={workout.id} 
                  style={styles.workoutCard} 
                  activeOpacity={0.9}
                  onPress={() => router.push({
                    pathname: '/screens/WorkoutDetailsScreen',
                    params: { id: workout.id, fromLibrary: 'true' }
                  })}
                >
                  <ImageBackground 
                    source={{ uri: workout.coverImage || workout.image || 'https://via.placeholder.com/400x200' }}
                    style={styles.workoutImage}
                  >
                    <View style={styles.workoutImageOverlay} />
                    <View style={styles.workoutTags}>
                      <View style={styles.workoutTagPrimary}>
                        <Text style={styles.workoutTagPrimaryText}>WORKOUT</Text>
                      </View>
                      <View style={styles.workoutTagDark}>
                        <Text style={styles.workoutTagDarkText}>{workout.duration || 0} MIN</Text>
                      </View>
                    </View>
                  </ImageBackground>
                  <View style={styles.workoutInfo}>
                    <View style={styles.workoutTitleRow}>
                      <Text style={styles.workoutTitle}>{workout.title || workout.name || 'Untitled'}</Text>
                      {isOwnProfile && (
                        <TouchableOpacity 
                          onPress={(e) => { e.stopPropagation(); handleDeleteActivity(workout, 'workout'); }}
                          disabled={deletingId === workout.id}
                          style={{ padding: 4 }}
                        >
                          {deletingId === workout.id ? (
                             <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                             <MaterialIcons name="delete" size={20} color="#ef4444" />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.workoutDetailsRow}>
                      <View style={styles.workoutDetailItem}>
                        <MaterialIcons name="fitness-center" size={14} color={PRIMARY} />
                        <Text style={[styles.workoutDetailText, { color: TEXT_MUTED }]}>{workout.difficulty || 'General'}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.endOfActivity}>
                <Text style={[styles.endText, { color: TEXT_MUTED }]}>NO SHARED WORKOUTS YET</Text>
              </View>
            )}

            <View style={styles.endOfActivity}>
              <View style={styles.endLine} />
              <Text style={styles.endText}>END OF RECENT ACTIVITY</Text>
            </View>
          </View>
        )}

        {/* Posts Content (Monthly Programs) */}
        {activeTab === 'Monthly' && (
          <View style={styles.workoutsList}>
            {sharedPrograms.length > 0 ? (
              sharedPrograms.map((program) => (
                <TouchableOpacity 
                  key={program.id} 
                  style={styles.workoutCard} 
                  activeOpacity={0.9}
                  onPress={() => router.push({
                    pathname: '/screens/WeeklyProgramScreen',
                    params: { programId: program.id }
                  })}
                >
                  <ImageBackground 
                    source={{ uri: program.coverImage || 'https://via.placeholder.com/400x200' }}
                    style={styles.workoutImage}
                  >
                    <View style={styles.workoutImageOverlay} />
                    <View style={styles.workoutTags}>
                      <View style={[styles.workoutTagPrimary, { backgroundColor: SECONDARY }]}>
                        <Text style={[styles.workoutTagPrimaryText, { color: '#565400' }]}>PROGRAM</Text>
                      </View>
                      <View style={styles.workoutTagDark}>
                        <Text style={styles.workoutTagDarkText}>{program.workoutCount || 0} WORKOUTS</Text>
                      </View>
                    </View>
                  </ImageBackground>
                  <View style={styles.workoutInfo}>
                    <View style={styles.workoutTitleRow}>
                      <Text style={styles.workoutTitle}>{program.name || 'Untitled Program'}</Text>
                      {isOwnProfile && (
                        <TouchableOpacity 
                          onPress={(e) => { e.stopPropagation(); handleDeleteActivity(program, 'program'); }}
                          disabled={deletingId === program.id}
                          style={{ padding: 4 }}
                        >
                          {deletingId === program.id ? (
                             <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                             <MaterialIcons name="delete" size={20} color="#ef4444" />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.workoutDetailsRow}>
                      <View style={styles.workoutDetailItem}>
                        <Text style={styles.workoutDetailText}>{program.goal || 'General'}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.endOfActivity}>
                <Text style={[styles.endText, { color: TEXT_MUTED }]}>NO SHARED PROGRAMS YET</Text>
              </View>
            )}

            <View style={styles.endOfActivity}>
              <View style={styles.endLine} />
              <Text style={styles.endText}>END OF RECENT ACTIVITY</Text>
            </View>
          </View>
        )}

      </ScrollView>
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
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(13, 15, 6, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: 'bold',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  content: {
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 24,
  },
  avatarGradient: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: PRIMARY, // Simplified gradient for now
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    borderWidth: 4,
    borderColor: BG_DARK,
  },
  eliteBadge: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eliteBadgeText: {
    color: '#4a5e00',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  profileName: {
    color: TEXT_WHITE,
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: -1,
    marginBottom: 16,
  },
  profileBio: {
    color: TEXT_MUTED,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: '90%',
    marginBottom: 32,
  },
  bioHighlight: {
    color: PRIMARY,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    maxWidth: 320,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: OUTLINE_VARIANT,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionBtnText: {
    color: TEXT_WHITE,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: SURFACE_CONTAINER_LOW,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: OUTLINE_VARIANT,
    paddingVertical: 24,
    marginBottom: 40,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: OUTLINE_VARIANT,
  },
  statValue: {
    color: PRIMARY,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  achievementsSection: {
    marginBottom: 48,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    color: TEXT_WHITE,
    fontSize: 20,
    fontWeight: 'bold',
    fontStyle: 'italic',
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
    paddingLeft: 12,
    textTransform: 'uppercase',
  },
  viewAllText: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  badgesList: {
    paddingHorizontal: 24,
    gap: 16,
  },
  badgeCard: {
    width: 112,
    height: 144,
    backgroundColor: SURFACE_CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OUTLINE_VARIANT,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  badgeIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeText: {
    color: TEXT_WHITE,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: OUTLINE_VARIANT,
    paddingHorizontal: 24,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabBtn: {
    borderBottomColor: PRIMARY,
  },
  tabBtnText: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  activeTabBtnText: {
    color: PRIMARY,
    fontWeight: '900',
  },
  workoutsList: {
    padding: 24,
    gap: 24,
  },
  workoutCard: {
    backgroundColor: SURFACE_CONTAINER_HIGH,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OUTLINE_VARIANT,
    overflow: 'hidden',
  },
  workoutImage: {
    height: 192,
    justifyContent: 'flex-end',
    padding: 16,
  },
  workoutImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  workoutTags: {
    flexDirection: 'row',
    gap: 8,
  },
  workoutTagPrimary: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  workoutTagPrimaryText: {
    color: '#4a5e00',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  workoutTagDark: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  workoutTagDarkText: {
    color: TEXT_WHITE,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  workoutInfo: {
    padding: 20,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  workoutTitle: {
    flex: 1,
    color: TEXT_WHITE,
    fontSize: 18,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  workoutDetailsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  workoutDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workoutDetailText: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  endOfActivity: {
    alignItems: 'center',
    marginTop: 32,
    opacity: 0.3,
  },
  endLine: {
    width: 40,
    height: 1,
    backgroundColor: PRIMARY,
    marginBottom: 16,
  },
  endText: {
    color: TEXT_WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
  },
});