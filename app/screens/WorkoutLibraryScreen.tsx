import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { ExerciseListSkeleton } from '@/components/SkeletonLoader';

// Cloudinary config
const CLOUDINARY_CLOUD_NAME = 'dplgyvrof';
const CLOUDINARY_UPLOAD_PRESET = 'ml_default';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

const { width } = Dimensions.get('window');

// Theme Colors
const PRIMARY = "#ccff00";
const BACKGROUND_LIGHT = "#f8f8f5";
const BACKGROUND_DARK = "#12140a";
const SURFACE_DARK = "#1d2012";
const ACCENT_DARK = "#2a2e1a";
const TEXT_LIGHT = "#0f172a"; // slate-900
const TEXT_DARK = "#f1f5f9"; // slate-100
const TEXT_MUTED_LIGHT = "#64748b"; // slate-500
const TEXT_MUTED_DARK = "#94a3b8"; // slate-400

interface MuscleGroup {
  name: string;
}

interface Workout {
  id: string;
  name: string;
  type: string;
  muscleGroups: MuscleGroup[];
  mainImage: string;
  videoUrl?: string;
  reps?: string;
  sets?: string;
  isMulti?: boolean; // Optional, derived or from DB
}

import { SelectionStore } from '../utils/SelectionStore';

export default function WorkoutLibraryScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(true);

  // Custom exercise modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formTargetMuscles, setFormTargetMuscles] = useState('');
  const [formTargetMuscleImage, setFormTargetMuscleImage] = useState('');
  const [formIconUrl, setFormIconUrl] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [iconLocalUri, setIconLocalUri] = useState('');
  const [videoLocalUri, setVideoLocalUri] = useState('');
  const [targetMuscleLocalUri, setTargetMuscleLocalUri] = useState('');
  const [formYoutubeUrl, setFormYoutubeUrl] = useState('');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingTargetMuscle, setUploadingTargetMuscle] = useState(false);
  
  // Parse parameters
  const params = useLocalSearchParams();
  const selectionMode = params.selectionMode === 'true';
  const returnScreen = params.returnTo as string;
  const replaceId = params.replaceId as string;

  const handleSelect = (exercise: Workout) => {
    if (selectionMode && returnScreen) {
      SelectionStore.setData(exercise, replaceId ? 'replace' : 'add', replaceId);
      router.back();
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormTargetMuscles('');
    setFormTargetMuscleImage('');
    setFormIconUrl('');
    setFormVideoUrl('');
    setFormYoutubeUrl('');
    setIconLocalUri('');
    setVideoLocalUri('');
    setTargetMuscleLocalUri('');
  };

  const uploadToCloudinary = async (uri: string, resourceType: 'image' | 'video' = 'image'): Promise<string | null> => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'upload';
      const ext = filename.split('.').pop()?.toLowerCase() || (resourceType === 'video' ? 'mp4' : 'jpg');
      const mimeType = resourceType === 'video' ? `video/${ext}` : `image/${ext === 'png' ? 'png' : 'jpeg'}`;

      formData.append('file', {
        uri,
        type: mimeType,
        name: filename,
      } as any);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('resource_type', resourceType);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.secure_url) {
        return data.secure_url;
      } else {
        console.error('Cloudinary error:', data);
        return null;
      }
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const pickIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setIconLocalUri(uri);
      setUploadingIcon(true);
      const url = await uploadToCloudinary(uri, 'image');
      if (url) {
        setFormIconUrl(url);
      } else {
        Alert.alert('Error', 'Failed to upload icon image. Please try again.');
        setIconLocalUri('');
      }
      setUploadingIcon(false);
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.7,
      videoMaxDuration: 120,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setVideoLocalUri(uri);
      setFormYoutubeUrl(''); // Clear YouTube URL when picking device video
      setUploadingVideo(true);
      const url = await uploadToCloudinary(uri, 'video');
      if (url) {
        setFormVideoUrl(url);
      } else {
        Alert.alert('Error', 'Failed to upload video. Please try again.');
        setVideoLocalUri('');
      }
      setUploadingVideo(false);
    }
  };

  const pickTargetMuscleImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setTargetMuscleLocalUri(uri);
      setUploadingTargetMuscle(true);
      const url = await uploadToCloudinary(uri, 'image');
      if (url) {
        setFormTargetMuscleImage(url);
      } else {
        Alert.alert('Error', 'Failed to upload target muscle image. Please try again.');
        setTargetMuscleLocalUri('');
      }
      setUploadingTargetMuscle(false);
    }
  };

  const handleSaveExercise = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Exercise name is required.');
      return;
    }
    if (!formTargetMuscles.trim()) {
      Alert.alert('Error', 'Target muscle is required.');
      return;
    }
    setSaving(true);
    try {
      const muscleNames = formTargetMuscles.split(',').map(m => m.trim()).filter(Boolean);
      const muscleGroups = muscleNames.map(name => ({
        name,
        ...(formTargetMuscleImage.trim() ? { imageUrl: formTargetMuscleImage.trim() } : {}),
      }));

      const docData: any = {
        name: formName.trim(),
        type: muscleNames[0] || 'Custom',
        muscleGroups,
        mainImage: formIconUrl.trim() || 'https://via.placeholder.com/150',
        createdAt: firestore.FieldValue.serverTimestamp(),
        isCustomExercise: true,
      };

      // Only add optional fields if filled
      if (formYoutubeUrl.trim()) {
        docData.videoUrl = formYoutubeUrl.trim();
      } else if (formVideoUrl.trim()) {
        docData.videoUrl = formVideoUrl.trim();
      }
      if (formIconUrl.trim()) {
        docData.mainImage = formIconUrl.trim();
      }

      const user = auth().currentUser;
      if (user) {
        docData.createdBy = user.uid;
      }

      await firestore().collection('workouts').add(docData);

      resetForm();
      setModalVisible(false);
      Alert.alert('Success', 'Exercise added successfully!');
    } catch (error) {
      console.error('Error saving exercise:', error);
      Alert.alert('Error', 'Failed to save exercise. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('workouts')
      .onSnapshot(querySnapshot => {
        const fetchedWorkouts: Workout[] = [];
        const fetchedCategories = new Set<string>(["All"]);

        querySnapshot.forEach(doc => {
          const data = doc.data();
          const workout: Workout = {
            id: doc.id,
            name: data.name || 'Untitled Workout',
            type: data.type || 'General',
            muscleGroups: data.muscleGroups || [],
            mainImage: data.mainImage || 'https://via.placeholder.com/150',
            videoUrl: data.videoUrl || '',
            reps: data.reps || '-',
            sets: data.sets || '-',
            isMulti: false // You might want to calculate this or fetch it if exists
          };
          fetchedWorkouts.push(workout);

          if (workout.type) {
            fetchedCategories.add(workout.type);
          }
        });

        setWorkouts(fetchedWorkouts);
        // Sort categories to have specific order if needed, or just alphabetical after 'All'
        const sortedCategories = Array.from(fetchedCategories).sort((a, b) => {
            if (a === 'All') return -1;
            if (b === 'All') return 1;
            return a.localeCompare(b);
        });
        setCategories(sortedCategories);
        setLoading(false);
      }, error => {
        console.error("Error fetching workouts:", error);
        setLoading(false);
      });

    return () => unsubscribe();
  }, []);

  const filteredWorkouts = workouts.filter(workout => {
    const matchesCategory = selectedCategory === "All" || workout.type === selectedCategory;
    const matchesSearch = workout.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BACKGROUND_DARK} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={28} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exercises Library</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <View style={styles.searchIcon}>
            <MaterialIcons name="search" size={24} color={PRIMARY} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
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
          {categories.map((cat, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.categoryChip,
                cat === selectedCategory 
                  ? styles.categoryChipActive 
                  : styles.categoryChipInactive
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[
                styles.categoryText,
                cat === selectedCategory 
                  ? styles.categoryTextActive 
                  : styles.categoryTextInactive
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Exercises</Text>
        <Text style={styles.resultsText}>{filteredWorkouts.length} Results</Text>
      </View>

      {/* Add Custom Exercise Button */}
      <TouchableOpacity style={styles.addCustomButton} onPress={() => setModalVisible(true)}>
        <MaterialIcons name="add-circle-outline" size={20} color={PRIMARY} />
        <Text style={styles.addCustomButtonText}>Add Custom Exercise</Text>
      </TouchableOpacity>

      {/* Exercise List */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {loading ? (
           <ExerciseListSkeleton count={5} />
        ) : (
            <View style={styles.exerciseList}>
            {filteredWorkouts.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.cardInfo}>
                    <View style={styles.cardHeader}>
                    <View style={styles.titleRow}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        {exercise.isMulti && (
                        <View style={styles.multiBadge}>
                            <Text style={styles.multiText}>MULTI</Text>
                        </View>
                        )}
                    </View>
                    <Text style={styles.targetLabel}>TARGET</Text>
                    <Text style={styles.targetText}>
                        {exercise.muscleGroups && exercise.muscleGroups.length > 0 
                            ? exercise.muscleGroups.map(m => m.name).join(', ') 
                            : 'General'}
                    </Text>
                    </View>
                    
                    {selectionMode ? (
                      <TouchableOpacity 
                        style={styles.addButton}
                        onPress={() => handleSelect(exercise)}
                      >
                        <MaterialIcons name="add" size={24} color={BACKGROUND_DARK} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.viewDetailsButton}
                        onPress={() => {
                          const exerciseData = {
                            name: exercise.name,
                            category: exercise.type,
                            videoUrl: exercise.videoUrl,
                            reps: exercise.reps,
                            sets: exercise.sets,
                            targetMuscleImage: exercise.mainImage,
                            muscleNames: exercise.muscleGroups.map(m => m.name)
                          };
                          router.push({
                            pathname: '/screens/ExerciseDetailScreen',
                            params: { exercise: JSON.stringify(exerciseData) }
                          });
                        }}
                      >
                      <Text style={styles.viewDetailsText}>View Details</Text>
                      <MaterialIcons name="chevron-right" size={18} color={PRIMARY} />
                      </TouchableOpacity>
                    )}
                </View>

                <View style={styles.imageContainer}>
                    <Image 
                    source={{ uri: exercise.mainImage }} 
                    style={styles.exerciseImage}
                    />
                </View>
                </View>
            ))}
            </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Custom Exercise Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => { if (!saving) { setModalVisible(false); resetForm(); } }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => { if (!saving) { setModalVisible(false); resetForm(); } }}
                style={styles.backButton}
              >
                <MaterialIcons name="close" size={24} color={TEXT_DARK} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Custom Exercise</Text>
              <View style={{ width: 48 }} />
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {/* Exercise Name - Required */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Exercise Name <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Bench Press"
                  placeholderTextColor="#64748b"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              {/* Target Muscles - Required */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Target Muscle(s) <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Chest, Triceps"
                  placeholderTextColor="#64748b"
                  value={formTargetMuscles}
                  onChangeText={setFormTargetMuscles}
                />
                <Text style={styles.formHint}>Comma-separated for multiple muscles</Text>
              </View>

              {/* Divider */}
              <View style={styles.formDivider}>
                <View style={styles.formDividerLine} />
                <Text style={styles.formDividerText}>Optional</Text>
                <View style={styles.formDividerLine} />
              </View>

              {/* Target Muscle Image - Optional (pick from phone) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Target Muscle Image</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={pickTargetMuscleImage} disabled={uploadingTargetMuscle}>
                  {uploadingTargetMuscle ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : targetMuscleLocalUri ? (
                    <View style={styles.pickerPreviewRow}>
                      <Image source={{ uri: targetMuscleLocalUri }} style={styles.pickerPreviewImage} />
                      <Text style={styles.pickerPreviewText} numberOfLines={1}>Image selected ✓</Text>
                    </View>
                  ) : (
                    <View style={styles.pickerPlaceholderRow}>
                      <MaterialIcons name="image" size={22} color={TEXT_MUTED_DARK} />
                      <Text style={styles.pickerPlaceholderText}>Pick from gallery</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {formTargetMuscleImage ? <Text style={styles.formHint}>Uploaded ✓</Text> : null}
              </View>

              {/* Exercise Icon/Image - Optional (pick from phone) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Exercise Icon / Image</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={pickIcon} disabled={uploadingIcon}>
                  {uploadingIcon ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : iconLocalUri ? (
                    <View style={styles.pickerPreviewRow}>
                      <Image source={{ uri: iconLocalUri }} style={styles.pickerPreviewImage} />
                      <Text style={styles.pickerPreviewText} numberOfLines={1}>Image selected ✓</Text>
                    </View>
                  ) : (
                    <View style={styles.pickerPlaceholderRow}>
                      <MaterialIcons name="image" size={22} color={TEXT_MUTED_DARK} />
                      <Text style={styles.pickerPlaceholderText}>Pick from gallery</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {formIconUrl ? <Text style={styles.formHint}>Uploaded ✓</Text> : null}
              </View>

              {/* YouTube Video URL - Optional */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>YouTube Video URL</Text>
                <TextInput
                  style={[styles.formInput, !!formVideoUrl && styles.formInputDisabled]}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor="#64748b"
                  value={formYoutubeUrl}
                  onChangeText={(text) => {
                    setFormYoutubeUrl(text);
                    if (text.trim()) {
                      setFormVideoUrl('');
                      setVideoLocalUri('');
                    }
                  }}
                  autoCapitalize="none"
                  keyboardType="url"
                  editable={!formVideoUrl}
                />
                {!!formVideoUrl && <Text style={styles.formHint}>Disabled — device video is selected</Text>}
              </View>

              {/* OR text */}
              <View style={{ alignItems: 'center', marginVertical: 4 }}>
                <Text style={{ color: TEXT_MUTED_DARK, fontSize: 12, fontWeight: '600' }}>OR</Text>
              </View>

              {/* Exercise Video from Device - Optional */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Pick Video from Device</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, !!formYoutubeUrl && { opacity: 0.4 }]}
                  onPress={pickVideo}
                  disabled={uploadingVideo || !!formYoutubeUrl}
                >
                  {uploadingVideo ? (
                    <View style={styles.pickerPlaceholderRow}>
                      <ActivityIndicator size="small" color={PRIMARY} />
                      <Text style={styles.pickerPlaceholderText}>Uploading video...</Text>
                    </View>
                  ) : videoLocalUri ? (
                    <View style={styles.pickerPreviewRow}>
                      <MaterialIcons name="videocam" size={22} color={PRIMARY} />
                      <Text style={styles.pickerPreviewText} numberOfLines={1}>Video selected ✓</Text>
                    </View>
                  ) : (
                    <View style={styles.pickerPlaceholderRow}>
                      <MaterialIcons name="videocam" size={22} color={TEXT_MUTED_DARK} />
                      <Text style={styles.pickerPlaceholderText}>Pick from gallery</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {formVideoUrl ? <Text style={styles.formHint}>Uploaded ✓</Text> : null}
                {!!formYoutubeUrl && <Text style={styles.formHint}>Disabled — YouTube URL is entered</Text>}
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveExercise}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={BACKGROUND_DARK} />
                ) : (
                  <>
                    <MaterialIcons name="check" size={20} color={BACKGROUND_DARK} />
                    <Text style={styles.saveButtonText}>Save Exercise</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
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
    paddingVertical: 12,
    backgroundColor: BACKGROUND_DARK,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_DARK,
    textAlign: 'center',
    flex: 1,
  },
  headerRight: {
    width: 48,
  },
  addCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ACCENT_DARK,
    borderStyle: 'dashed',
  },
  addCustomButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    height: 56,
    borderWidth: 1,
    borderColor: ACCENT_DARK,
  },
  searchIcon: {
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: TEXT_DARK,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  categoriesContainer: {
    paddingBottom: 8,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryChipInactive: {
    backgroundColor: SURFACE_DARK,
    borderColor: ACCENT_DARK,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  resultsText: {
    fontSize: 14,
    fontWeight: '500',
    color: PRIMARY,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  exerciseList: {
    gap: 16,
  },
  exerciseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: ACCENT_DARK,
    gap: 16,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 16,
  },
  cardHeader: {
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  multiBadge: {
    backgroundColor: 'rgba(204, 255, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  multiText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: PRIMARY,
    textTransform: 'uppercase',
  },
  targetLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MUTED_DARK,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  targetText: {
    fontSize: 14,
    color: '#cbd5e1', // slate-300
  },
  addButton: {
    backgroundColor: PRIMARY,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_DARK,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    alignSelf: 'flex-start',
    height: 36,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
  imageContainer: {
    width: 120, // w-32 or w-40 equivalent
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: BACKGROUND_DARK,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ACCENT_DARK,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 8,
  },
  requiredStar: {
    color: '#ef4444',
  },
  formInput: {
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: TEXT_DARK,
    borderWidth: 1,
    borderColor: ACCENT_DARK,
  },
  formInputDisabled: {
    opacity: 0.4,
  },
  formHint: {
    fontSize: 12,
    color: TEXT_MUTED_DARK,
    marginTop: 6,
  },
  formDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 12,
  },
  formDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: ACCENT_DARK,
  },
  formDividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED_DARK,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: ACCENT_DARK,
  },
  saveButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BACKGROUND_DARK,
  },
  // Picker styles
  pickerButton: {
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: ACCENT_DARK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  pickerPreviewImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  pickerPreviewText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
    flex: 1,
  },
  pickerPlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerPlaceholderText: {
    fontSize: 14,
    color: TEXT_MUTED_DARK,
  },
});
