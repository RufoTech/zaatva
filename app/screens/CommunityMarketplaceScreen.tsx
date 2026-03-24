import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  ScrollView
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { CustomAlert } from '@/utils/CustomAlert';
import { CommunityListSkeleton } from '@/components/SkeletonLoader';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

const PRIMARY = '#ccff00';
const BG_DARK = '#1f230f';

export default function CommunityMarketplaceScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'programs' | 'workouts'>('programs');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search, Filter, Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [visibleCount, setVisibleCount] = useState(10);

  const currentUser = auth().currentUser;

  useFocusEffect(
    useCallback(() => {
      fetchCommunityItems();
      // Reset search/filter/pagination when tab changes
      setSearchQuery('');
      setSelectedCategory('All');
      setVisibleCount(10);
    }, [activeTab])
  );

  const fetchCommunityItems = async () => {
    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const type = activeTab === 'programs' ? 'programs' : 'workouts';
      
      const response = await fetch(`${API_URL}/api/community/items?type=${type}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }

      let fetchedItems = await response.json() || [];

      // Check owned status
      try {
        const collectionName = activeTab === 'programs' ? 'user_programs' : 'customUserWorkouts';
        const snapshot = await firestore()
          .collection(collectionName)
          .where('userId', '==', user.uid)
          .get();
        
        const downloadedIds = new Set();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.communityItemId) {
                downloadedIds.add(data.communityItemId);
            }
        });

        fetchedItems = fetchedItems.map((item: any) => ({
            ...item,
            isDownloaded: downloadedIds.has(item.id)
        }));
      } catch (err) {
        console.error("Error checking downloaded items:", err);
      }

      setItems(fetchedItems);
    } catch (error) {
      console.error("Error fetching community items:", error);
      CustomAlert.show("Error", "Could not load community items.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (item: any) => {
    if (!currentUser) return;
    if (item.authorId === currentUser.uid) {
      CustomAlert.show("Notice", "You already own this item.");
      return;
    }

    setDownloadingId(item.id);
    try {
      const token = await currentUser.getIdToken();
      const endpoint = activeTab === 'programs' ? '/api/community/download-program' : '/api/community/download-workout';
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemId: item.id })
      });

      if (!response.ok) {
        throw new Error('Failed to download item');
      }

      CustomAlert.show("Success", `${activeTab === 'programs' ? 'Program' : 'Workout'} downloaded to your library!`);
      // Update local state to show incremented downloads and mark as downloaded locally
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, downloads: (i.downloads || 0) + 1, isDownloaded: true } : i));
    } catch (error) {
      console.error("Error downloading item:", error);
      CustomAlert.show("Error", "Could not download the item.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (item: any) => {
    CustomAlert.show(
      "Confirm Delete",
      "Are you sure you want to delete this from the community?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
             if (!currentUser) return;
             setDeletingId(item.id);
             try {
                const token = await currentUser.getIdToken();
                const endpoint = activeTab === 'programs' ? '/api/community/delete-program' : '/api/community/delete-workout';
                
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

                setItems(prev => prev.filter(i => i.id !== item.id));
                CustomAlert.show("Success", "Item deleted from community.");
             } catch (error) {
                console.error("Error deleting item:", error);
                CustomAlert.show("Error", "Could not delete the item.");
             } finally {
                setDeletingId(null);
             }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const isProgram = activeTab === 'programs';
    const subtitle = isProgram 
      ? `${item.workoutCount || 0} Workouts • ${item.focus || 'General'}`
      : `${item.duration || 0} Min • ${item.targetMuscle || 'Full Body'}`;

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          if (isProgram) {
            // Can be extended later if needed, but for now user just mentioned "Workouts" tab
            // router.push({ pathname: '/screens/WeeklyProgramScreen', params: { programId: item.originalId || item.id } });
          } else {
            router.push({
              pathname: '/screens/WorkoutDetailsScreen',
              params: {
                id: item.originalId || item.id, // community shared workouts store originalId
                isCustom: 'true', // shared workouts are custom
                fromLibrary: 'true', // hide share options
                hideAddToDay: 'true'
              }
            });
          }
        }}
      >
        <ImageBackground
          source={{ uri: item.coverImage || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop' }}
          style={styles.cardImage}
          imageStyle={{ borderRadius: 16 }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={styles.cardOverlay}
          />
          <View style={styles.authorBadge}>
            <MaterialIcons name="person" size={14} color="#1f230f" />
            <Text style={styles.authorText}>{item.authorName || 'Anonymous'}</Text>
          </View>
        </ImageBackground>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
          
          <View style={styles.cardFooter}>
            <View style={styles.statsContainer}>
              <View style={styles.stat}>
                <Feather name="download" size={14} color="#94a3b8" />
                <Text style={styles.statText}>{item.downloads || 0}</Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {item.authorId === currentUser?.uid && (
                <TouchableOpacity
                  style={[styles.downloadButton, { backgroundColor: '#ef4444' }]}
                  onPress={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="trash-2" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={[styles.downloadButton, (item.authorId === currentUser?.uid || item.isDownloaded) && { opacity: 0.5 }]}
                onPress={() => handleDownload(item)}
                disabled={downloadingId === item.id || item.authorId === currentUser?.uid || item.isDownloaded}
              >
                {downloadingId === item.id ? (
                  <ActivityIndicator size="small" color="#1f230f" />
                ) : (
                  <>
                    <Feather name="download" size={16} color="#1f230f" />
                    <Text style={styles.downloadButtonText}>
                      {item.authorId === currentUser?.uid || item.isDownloaded ? 'Owned' : 'Get'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'programs' && styles.activeTab]}
          onPress={() => setActiveTab('programs')}
        >
          <Text style={[styles.tabText, activeTab === 'programs' && styles.activeTabText]}>
            Monthly Programs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'workouts' && styles.activeTab]}
          onPress={() => setActiveTab('workouts')}
        >
          <Text style={[styles.tabText, activeTab === 'workouts' && styles.activeTabText]}>
            Workouts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={24} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeTab}...`}
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Category Filters */}
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {(() => {
            // Get unique categories for the active tab
            const categoriesSet = new Set<string>();
            categoriesSet.add('All');
            items.forEach(item => {
              const type = activeTab === 'programs' ? item.focus : item.targetMuscle;
              if (type) categoriesSet.add(type);
            });
            const categories = Array.from(categoriesSet);

            return categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategory === category && styles.activeCategoryChip
                ]}
                onPress={() => {
                  setSelectedCategory(category);
                  setVisibleCount(10); // Reset pagination on category change
                }}
              >
                <Text style={[
                  styles.categoryText,
                  selectedCategory === category && styles.activeCategoryText
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ));
          })()}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <CommunityListSkeleton count={4} />
      ) : items.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="public" size={64} color="#334155" />
          <Text style={styles.emptyText}>No {activeTab} shared yet.</Text>
          <Text style={styles.emptySubtext}>Be the first to share one!</Text>
        </View>
      ) : (
        <FlatList
          data={(() => {
            const filtered = items.filter(item => {
              const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
              const type = activeTab === 'programs' ? item.focus : item.targetMuscle;
              const matchesCategory = selectedCategory === 'All' || type === selectedCategory;
              return matchesSearch && matchesCategory;
            });
            return filtered.slice(0, visibleCount);
          })()}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={(() => {
            const filteredLength = items.filter(item => {
              const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
              const type = activeTab === 'programs' ? item.focus : item.targetMuscle;
              const matchesCategory = selectedCategory === 'All' || type === selectedCategory;
              return matchesSearch && matchesCategory;
            }).length;

            return filteredLength > visibleCount ? (
              <TouchableOpacity 
                style={styles.loadMoreButton}
                onPress={() => setVisibleCount(prev => prev + 10)}
              >
                <Text style={styles.loadMoreText}>Load More</Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color="#1f230f" />
              </TouchableOpacity>
            ) : null;
          })()}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  activeTab: {
    borderBottomColor: PRIMARY,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeTabText: {
    color: PRIMARY,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1108',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 16,
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f1108',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeCategoryChip: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  categoryText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeCategoryText: {
    color: '#1f230f',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },
  loadMoreText: {
    color: '#1f230f',
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0f1108',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardImage: {
    height: 180,
    width: '100%',
    justifyContent: 'space-between',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  authorBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f230f',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  downloadButton: {
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  downloadButtonText: {
    color: '#1f230f',
    fontWeight: '700',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
});
