import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { CustomAlert } from '@/utils/CustomAlert';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
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

const BG_DARK = "#0d0f06";
const PRIMARY = "#ccff00";
const SURFACE_LOWEST = "#000000";
const SURFACE_CONTAINER = "#181b0f";
const SURFACE_CONTAINER_HIGH = "#1e2114";
const SURFACE_CONTAINER_HIGHEST = "#242719";
const TEXT_WHITE = "#fdfdec";
const TEXT_MUTED = "#abac9c";
const OUTLINE = "#757768";

export default function FriendsScreen() {
  const router = useRouter();
  const user = auth().currentUser;

  const [activeTab, setActiveTab] = useState<'Friends' | 'Requests'>('Friends');
  const [isAddFriendModalVisible, setIsAddFriendModalVisible] = useState(false);

  // Data states
  const [following, setFollowing] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Listen to friend requests where current user is the receiver and status is 'pending'
    const unsubscribeRequests = firestore()
      .collection('friend_requests')
      .where('receiverId', '==', user.uid)
      .where('status', '==', 'pending')
      .onSnapshot(async (snapshot) => {
        if (!snapshot) return;
        
        const reqs = [];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          // Fetch sender details from user_about
          const senderDoc = await firestore().collection('user_about').doc(data.senderId).get();
          if (senderDoc.exists) {
            reqs.push({
              id: doc.id,
              ...data,
              user: senderDoc.data()
            });
          }
        }
        setRequests(reqs);
      });

    // Listen to accepted friends (where current user is sender OR receiver)
    // To simplify, we can do two queries or just fetch all and filter locally
    const unsubscribeFollowing = firestore()
      .collection('friend_requests')
      .where('senderId', '==', user.uid)
      .where('status', '==', 'accepted')
      .onSnapshot(async (snapshot) => {
        if (!snapshot) return;
        const fings = [];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const receiverDoc = await firestore().collection('user_about').doc(data.receiverId).get();
          if (receiverDoc.exists) {
            fings.push({
              id: doc.id,
              ...data,
              user: receiverDoc.data()
            });
          }
        }
        setFollowing(fings);
      });

    const unsubscribeFollowers = firestore()
      .collection('friend_requests')
      .where('receiverId', '==', user.uid)
      .where('status', '==', 'accepted')
      .onSnapshot(async (snapshot) => {
        if (!snapshot) return;
        const fwers = [];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const senderDoc = await firestore().collection('user_about').doc(data.senderId).get();
          if (senderDoc.exists) {
            fwers.push({
              id: doc.id,
              ...data,
              user: senderDoc.data()
            });
          }
        }
        setFollowers(fwers);
        setLoading(false);
      });

    return () => {
      unsubscribeRequests();
      unsubscribeFollowing();
      unsubscribeFollowers();
    };
  }, [user]);

  // Search Users by UID or Email
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Basic search by exact UID or Email for simplicity in Firestore without external index
      const usersRef = firestore().collection('user_about');
      
      // Try finding by exact ID first
      const byId = await usersRef.doc(text.trim()).get();
      
      // Try finding by email
      const byEmail = await usersRef.where('mail', '==', text.trim().toLowerCase()).get();

      let results: any[] = [];

      if (byId.exists && byId.id !== user?.uid) {
        results.push({ id: byId.id, ...byId.data() });
      }

      byEmail.docs.forEach(doc => {
        if (doc.id !== user?.uid && !results.find(r => r.id === doc.id)) {
          results.push({ id: doc.id, ...doc.data() });
        }
      });

      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!user) return;
    
    try {
      // Check if request already exists
      const existingReq = await firestore()
        .collection('friend_requests')
        .where('senderId', '==', user.uid)
        .where('receiverId', '==', receiverId)
        .get();

      if (!existingReq.empty) {
        CustomAlert.show("Info", "Friend request already sent.");
        return;
      }

      await firestore().collection('friend_requests').add({
        senderId: user.uid,
        receiverId: receiverId,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp()
      });

      CustomAlert.show("Success", "Friend request sent!");
      setIsAddFriendModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error("Error sending request:", error);
      CustomAlert.show("Error", "Could not send friend request.");
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      await firestore().collection('friend_requests').doc(requestId).update({
        status: 'accepted',
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      CustomAlert.show("Success", "Friend request accepted!");
    } catch (error) {
      console.error("Error accepting:", error);
    }
  };

  const declineRequest = async (requestId: string) => {
    try {
      await firestore().collection('friend_requests').doc(requestId).delete();
      CustomAlert.show("Declined", "Friend request declined.");
    } catch (error) {
      console.error("Error declining:", error);
    }
  };

  const openChat = (friendId: string, friendName: string, friendPhoto: string) => {
    router.push({
      pathname: '/screens/ChatScreen',
      params: { 
        friendId, 
        friendName, 
        friendPhoto 
      }
    });
  };

  const renderFriendItem = (item: any, type: 'friends' | 'requests') => {
    const displayUser = item.user;
    if (!displayUser) return null;

    // Fallback to name/photo logic
    const displayName = displayUser.fullname || displayUser.displayName || displayUser.name || displayUser.mail || displayUser.email || 'User';
    const displayPhoto = displayUser.photoURL || displayUser.avatar || 'https://via.placeholder.com/150';

    return (
      // Change to TouchableOpacity to open chat on card tap
      <TouchableOpacity 
        key={item.id} 
        style={styles.friendItem} 
        activeOpacity={type === 'requests' ? 1 : 0.8}
        onPress={() => {
          if (type !== 'requests') {
            openChat(
              item.receiverId === user?.uid ? item.senderId : item.receiverId,
              displayName,
              displayPhoto
            );
          }
        }}
      >
        <View style={styles.friendInfo}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={styles.avatarContainer}>
              <Image 
                source={{ uri: displayPhoto }} 
                style={styles.avatar} 
              />
              <View style={[styles.onlineIndicator, { backgroundColor: displayUser.isOnline ? '#4ade80' : '#abac9c' }]} />
            </View>
            <TouchableOpacity 
              style={styles.viewProfileMiniBtn}
              onPress={(e) => {
                e.stopPropagation();
                router.push({
                  pathname: '/screens/AthleteProfileScreen',
                  params: { userId: item.receiverId === user?.uid ? item.senderId : item.receiverId }
                });
              }}
            >
              <Text style={styles.viewProfileMiniText}>View Profile</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{displayName}</Text>
            <Text style={styles.friendActivity}>
              {type === 'requests' ? 'Wants to be friends' : (displayUser.isOnline ? 'Online' : 'Offline')}
            </Text>
          </View>
        </View>
        
        <View style={styles.actionButtons}>
          {type === 'requests' ? (
            <>
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => acceptRequest(item.id)}>
                <MaterialIcons name="check" size={20} color="#4a5e00" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => declineRequest(item.id)}>
                <MaterialIcons name="close" size={20} color={TEXT_MUTED} />
              </TouchableOpacity>
            </>
          ) : (
             <TouchableOpacity 
               style={[styles.actionBtnPrimary, { backgroundColor: '#4a5e00' }]}
               onPress={(e) => {
                 e.stopPropagation();
                 openChat(
                   item.receiverId === user?.uid ? item.senderId : item.receiverId,
                   displayName,
                   displayPhoto
                 );
               }}
             >
                <MaterialIcons name="chat" size={20} color={PRIMARY} />
             </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Top Navigation Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Search and Filter Section */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={24} color={TEXT_MUTED} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Find athletes, friends, or squads..."
              placeholderTextColor={OUTLINE}
            />
          </View>

          {/* Custom Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Friends' && styles.activeTabButton]}
              onPress={() => setActiveTab('Friends')}
            >
              <Text style={[styles.tabText, activeTab === 'Friends' && styles.activeTabText]}>FRIENDS</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Requests' && styles.activeTabButton]}
              onPress={() => setActiveTab('Requests')}
            >
              <Text style={[styles.tabText, activeTab === 'Requests' && styles.activeTabText]}>
                REQUESTS {requests.length > 0 && `(${requests.length})`}
              </Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.addFriendButton} 
            activeOpacity={0.8}
            onPress={() => setIsAddFriendModalVisible(true)}
          >
            <MaterialIcons name="person-add" size={20} color={BG_DARK} />
            <Text style={styles.addFriendText}>ADD FRIEND</Text>
          </TouchableOpacity>
        </View>

        {/* Friends List Section */}
        <View style={styles.friendsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'Requests' ? 'Pending Requests' : 'Friends'}
            </Text>
            {activeTab !== 'Requests' && (
              <Text style={styles.onlineCount}>
                {(following.length + followers.length)} TOTAL
              </Text>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.friendsList}>
              {activeTab === 'Friends' && following.length === 0 && followers.length === 0 && (
                <Text style={{ color: TEXT_MUTED }}>You haven't added any friends yet.</Text>
              )}
              {activeTab === 'Requests' && requests.length === 0 && (
                <Text style={{ color: TEXT_MUTED }}>No pending requests.</Text>
              )}

              {activeTab === 'Friends' && (following.length > 0 || followers.length > 0) && (
                <>
                  {/* Active Friends */}
                  {[...following, ...followers].filter(item => item.user?.isOnline).length > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Active Friends</Text>
                        <Text style={styles.onlineCount}>
                          {[...following, ...followers].filter(item => item.user?.isOnline).length} ONLINE
                        </Text>
                      </View>
                      {[...following, ...followers].filter(item => item.user?.isOnline).map(item => renderFriendItem(item, 'friends'))}
                    </>
                  )}

                  {/* Offline Friends */}
                  {[...following, ...followers].filter(item => !item.user?.isOnline).length > 0 && (
                    <>
                      <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                        <Text style={styles.sectionTitle}>Offline Friends</Text>
                        <Text style={styles.onlineCount}>
                          {[...following, ...followers].filter(item => !item.user?.isOnline).length} OFFLINE
                        </Text>
                      </View>
                      {[...following, ...followers].filter(item => !item.user?.isOnline).map(item => renderFriendItem(item, 'friends'))}
                    </>
                  )}
                </>
              )}
              {activeTab === 'Requests' && requests.map(item => renderFriendItem(item, 'requests'))}
            </View>
          )}
        </View>

        {/* Invite Friends Section */}
        <View style={styles.inviteSection}>
          <View style={styles.inviteContent}>
            <Text style={styles.inviteTitle}>GROW YOUR SQUAD</Text>
            <Text style={styles.inviteText}>Invite friends to GreenFit and earn premium kinetic badges.</Text>
            
            <View style={styles.inviteButtons}>
              <TouchableOpacity style={styles.shareBtn}>
                <MaterialIcons name="share" size={16} color="#4a5e00" />
                <Text style={styles.shareBtnText}>SHARE LINK</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactsBtn}>
                <MaterialIcons name="contacts" size={20} color="#4a5e00" />
              </TouchableOpacity>
            </View>
          </View>
          {/* Abstract glow effect could be added here if needed */}
        </View>

      </ScrollView>

      {/* Add Friend Modal */}
      <Modal
        visible={isAddFriendModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAddFriendModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackground} 
            activeOpacity={1} 
            onPress={() => setIsAddFriendModalVisible(false)}
          />
          
          <View style={styles.modalContent}>
            {/* Search Input Container */}
            <View style={styles.modalSearchContainer}>
              <MaterialIcons name="search" size={24} color={PRIMARY} style={styles.modalSearchIcon} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search by User ID or Email..."
                placeholderTextColor={TEXT_MUTED}
                autoFocus={true}
                value={searchQuery}
                onChangeText={handleSearch}
                autoCapitalize="none"
              />
              {isSearching && <ActivityIndicator size="small" color={PRIMARY} />}
            </View>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                {searchResults.map((result) => {
                  const displayName = result.fullname || result.displayName || result.name || result.mail || result.email || 'User';
                  const displayPhoto = result.photoURL || result.avatar || 'https://via.placeholder.com/150';

                  return (
                    <View key={result.id} style={styles.searchResultItem}>
                      <View style={styles.friendInfo}>
                        <View style={{ alignItems: 'center', gap: 6 }}>
                          <Image 
                            source={{ uri: displayPhoto }} 
                            style={styles.avatar} 
                          />
                          <TouchableOpacity 
                            style={styles.viewProfileMiniBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              router.push({
                                pathname: '/screens/AthleteProfileScreen',
                                params: { userId: result.id }
                              });
                            }}
                          >
                            <Text style={styles.viewProfileMiniText}>View Profile</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.friendDetails}>
                          <Text style={styles.friendName}>{displayName}</Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={styles.actionBtnPrimary}
                        onPress={() => sendFriendRequest(result.id)}
                      >
                        <MaterialIcons name="person-add" size={20} color="#4a5e00" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Quick Search Tags */}
            <View style={styles.quickSearchContainer}>
              <Text style={styles.quickSearchTitle}>QUICK SEARCH</Text>
              <View style={styles.quickSearchTags}>
                {['@marcus_v', 'ELENA', 'Local Pros'].map((tag, index) => (
                  <TouchableOpacity key={index} style={styles.quickSearchTag}>
                    <Text style={styles.quickSearchTagText}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setIsAddFriendModalVisible(false)}
            >
              <MaterialIcons name="close" size={24} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    backgroundColor: 'rgba(13, 15, 6, 0.8)', // For blur effect, React Native usually needs BlurView, using opacity as fallback
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
    color: PRIMARY,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  searchSection: {
    marginBottom: 40,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_LOWEST,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: TEXT_WHITE,
    fontSize: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: SURFACE_CONTAINER,
    borderRadius: 12,
    padding: 4,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#cafd00', // primary-container
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: TEXT_MUTED,
  },
  activeTabText: {
    color: '#4a5e00', // on-primary-container
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  addFriendText: {
    color: BG_DARK,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  friendsSection: {
    marginBottom: 48,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY,
    letterSpacing: -0.5,
  },
  onlineCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    letterSpacing: 1,
  },
  friendsList: {
    gap: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_CONTAINER,
    padding: 16,
    borderRadius: 12,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    backgroundColor: PRIMARY,
    borderRadius: 8,
    borderWidth: 4,
    borderColor: SURFACE_CONTAINER,
  },
  viewProfileMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.3)',
  },
  viewProfileMiniText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: PRIMARY,
    textAlign: 'center',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  friendActivity: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MUTED,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnPrimary: {
    width: 40,
    height: 40,
    backgroundColor: '#cafd00', // primary-container
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSecondary: {
    width: 40,
    height: 40,
    backgroundColor: SURFACE_CONTAINER_HIGHEST,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteSection: {
    backgroundColor: '#cafd00', // primary-container
    borderRadius: 12,
    padding: 24,
    overflow: 'hidden',
  },
  inviteContent: {
    position: 'relative',
    zIndex: 10,
  },
  inviteTitle: {
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#4a5e00', // on-primary-container
    marginBottom: 8,
  },
  inviteText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#526900', // on-primary-fixed-variant
    maxWidth: 200,
    marginBottom: 24,
  },
  inviteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4a5e00', // on-primary-container
    borderRadius: 8,
    paddingVertical: 12,
  },
  shareBtnText: {
    color: '#cafd00', // primary-container
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  contactsBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 94, 0, 0.2)',
    backgroundColor: 'rgba(74, 94, 0, 0.1)',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  modalBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 15, 6, 0.7)', // #0d0f06 with opacity
  },
  modalContent: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_CONTAINER_HIGH,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(117, 119, 104, 0.2)', // outline-variant with opacity
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalSearchIcon: {
    marginRight: 12,
  },
  modalSearchInput: {
    flex: 1,
    color: TEXT_WHITE,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  searchResultsContainer: {
    width: '100%',
    marginTop: 16,
    backgroundColor: SURFACE_CONTAINER_HIGH,
    borderRadius: 16,
    padding: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  quickSearchContainer: {
    width: '100%',
    marginTop: 24,
  },
  quickSearchTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: TEXT_MUTED,
    marginBottom: 16,
  },
  quickSearchTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickSearchTag: {
    backgroundColor: SURFACE_CONTAINER_HIGHEST,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickSearchTagText: {
    color: TEXT_WHITE,
    fontSize: 12,
    fontWeight: '500',
  },
  modalCloseButton: {
    marginTop: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});