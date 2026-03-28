import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ActivityIndicator
} from 'react-native';
import { SelectionStore } from '../_utils/SelectionStore';
import { CustomAlert } from '@/utils/CustomAlert';

const { width } = Dimensions.get('window');

// Interfaces matching WorkoutDetailsScreen structure
interface Movement {
  _id: string; // Internal unique ID for UI handling
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
  _id: string; // Internal ID
  label: string;
  movements: Movement[];
  rest: string;
}

interface ExerciseBlock {
  _id: string; // Internal ID
  sets: WorkoutSet[];
}

export default function CreateCustomWorkoutScreen() {
  const router = useRouter();
  
  const [programName, setProgramName] = useState('');
  const [duration, setDuration] = useState('');
  const [equipment, setEquipment] = useState('');
  const [targetMuscle, setTargetMuscle] = useState('');
  const [level, setLevel] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  
  // Nested structure state
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([
    {
      _id: Math.random().toString(36).substr(2, 9),
      sets: [
        {
          _id: Math.random().toString(36).substr(2, 9),
          label: 'Set 1',
          movements: [],
          rest: '60'
        }
      ]
    }
  ]);

  // Track where we are adding/replacing an exercise
  const [selectionContext, setSelectionContext] = useState<{
    blockIndex: number;
    setIndex: number;
    movementId?: string; // If replacing
  } | null>(null);

  const [visibleDropdown, setVisibleDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{top: number, right: number} | null>(null);
  
  // Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successProgramName, setSuccessProgramName] = useState('');
  const [successProgramId, setSuccessProgramId] = useState('');

  // Check for selected exercise when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const { data, action } = SelectionStore.getData();
      
      if (data && action && selectionContext) {
        const { blockIndex, setIndex, movementId } = selectionContext;

        const newMovement: Movement = {
          _id: Math.random().toString(36).substr(2, 9),
          category: data.type || data.category || 'General',
          exerciseId: data.id,
          name: data.name,
          reps: data.reps && data.reps !== '-' ? data.reps : '1',
          setsCount: data.sets ? (isNaN(parseInt(String(data.sets))) ? 1 : parseInt(String(data.sets))) : 1,
          image: data.mainImage || data.image || 'https://via.placeholder.com/150',
          videoUrl: data.videoUrl || '',
          instructions: data.instructions || ''
        };

        setBlocks(prevBlocks => {
          const newBlocks = [...prevBlocks];
          const targetSet = newBlocks[blockIndex].sets[setIndex];

          if (action === 'add') {
            targetSet.movements.push(newMovement);
          } else if (action === 'replace' && movementId) {
            targetSet.movements = targetSet.movements.map(m => 
              m._id === movementId ? { ...newMovement, _id: movementId } : m // Keep old ID if replacing? No, new ID is fine or keep old.
            );
          }
          return newBlocks;
        });
        
        // Clear store and context
        SelectionStore.clear();
        setSelectionContext(null);
      }
    }, [selectionContext])
  );

  const [isUploading, setIsUploading] = useState(false);

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const uri = result.assets[0].uri;
      if (!uri) return;
      setIsUploading(true);
      
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: uri,
          type: 'image/jpeg',
          name: 'upload.jpg',
        } as any);
        formData.append('upload_preset', 'ml_default');

        const response = await fetch('https://api.cloudinary.com/v1_1/dplgyvrof/image/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        
        if (data.secure_url) {
          setCoverImage(data.secure_url);
        } else {
          CustomAlert.show("Upload Error", "Failed to get image URL from Cloudinary.");
        }
      } catch (error) {
        console.error("Cloudinary upload error:", error);
        CustomAlert.show("Upload Error", "Could not upload image to Cloudinary.");
      } finally {
        setIsUploading(false);
      }
    } catch (err) {
      console.warn("Image picker error:", err);
    }
  };

  // --- Actions ---

  const handleAddBlock = () => {
    setBlocks(prev => [
      ...prev,
      {
        _id: Math.random().toString(36).substr(2, 9),
        sets: [
          {
            _id: Math.random().toString(36).substr(2, 9),
            label: 'Set 1',
            movements: [],
            rest: '60'
          }
        ]
      }
    ]);
  };

  const handleAddSet = (blockIndex: number) => {
    setBlocks(prev => {
      const newBlocks = [...prev];
      const currentSetsCount = newBlocks[blockIndex].sets.length;
      newBlocks[blockIndex].sets.push({
        _id: Math.random().toString(36).substr(2, 9),
        label: `Set ${currentSetsCount + 1}`,
        movements: [],
        rest: '60'
      });
      return newBlocks;
    });
  };

  const handleAddMovement = (blockIndex: number, setIndex: number) => {
    setSelectionContext({ blockIndex, setIndex });
    router.push({
      pathname: '/screens/WorkoutLibraryScreen',
      params: { 
        selectionMode: 'true',
        returnTo: '/screens/CreateCustomWorkoutScreen'
      }
    });
  };

  const handleReplaceMovement = (blockIndex: number, setIndex: number, movementId: string) => {
    // Need to find indices, but since we pass them from render, it's easier.
    // However, the dropdown is global. We need to store context in dropdown.
    // For simplicity, let's just close dropdown and use the ID to find it?
    // Actually, I can store the context when opening the dropdown.
    // But current dropdown state only stores ID.
    // Let's modify toggleDropdown to store context or find indices later.
    
    // Easier: Just set context and go. We need to find blockIndex/setIndex for this movementId.
    // A helper function to find location by movementId would be good.
    const location = findMovementLocation(movementId);
    if (location) {
      setSelectionContext({ ...location, movementId });
      closeDropdown();
      router.push({
        pathname: '/screens/WorkoutLibraryScreen',
        params: { 
          selectionMode: 'true',
          returnTo: '/screens/CreateCustomWorkoutScreen',
          replaceId: movementId
        }
      });
    }
  };

  const handleDeleteMovement = (movementId: string) => {
    setBlocks(prev => prev.map(block => ({
      ...block,
      sets: block.sets.map(set => ({
        ...set,
        movements: set.movements.filter(m => m._id !== movementId)
      }))
    })));
    closeDropdown();
  };

  const findMovementLocation = (movementId: string) => {
    for (let b = 0; b < blocks.length; b++) {
      for (let s = 0; s < blocks[b].sets.length; s++) {
        const found = blocks[b].sets[s].movements.find(m => m._id === movementId);
        if (found) return { blockIndex: b, setIndex: s };
      }
    }
    return null;
  };

  const handleUpdateMovement = (movementId: string, field: 'setsCount' | 'reps', value: string) => {
    setBlocks(prev => prev.map(block => ({
      ...block,
      sets: block.sets.map(set => ({
        ...set,
        movements: set.movements.map(m => {
          if (m._id === movementId) {
            return {
              ...m,
              [field]: field === 'setsCount' ? (isNaN(parseInt(value)) ? 0 : parseInt(value)) : value
            };
          }
          return m;
        })
      }))
    })));
  };

  const handleUpdateSetRest = (blockIndex: number, setIndex: number, value: string) => {
    setBlocks(prev => {
      const newBlocks = [...prev];
      newBlocks[blockIndex].sets[setIndex].rest = value.replace(/[^0-9]/g, '');
      return newBlocks;
    });
  };

  const handleUpdateSetLabel = (blockIndex: number, setIndex: number, value: string) => {
    setBlocks(prev => {
      const newBlocks = [...prev];
      newBlocks[blockIndex].sets[setIndex].label = value;
      return newBlocks;
    });
  };

  // --- Dropdown ---

  const toggleDropdown = (id: string, event: any) => {
    if (visibleDropdown === id) {
      closeDropdown();
    } else {
      const { pageY } = event.nativeEvent;
      setDropdownPosition({ top: pageY + 10, right: 16 });
      setVisibleDropdown(id);
    }
  };

  const closeDropdown = () => {
    setVisibleDropdown(null);
  };

  // --- Publish ---

  const handlePublish = async () => {
    if (!programName.trim()) {
      CustomAlert.show("Error", "Please enter a program name.");
      return;
    }
    
    // Validate at least one movement
    let hasExercises = false;
    blocks.forEach(b => b.sets.forEach(s => {
      if (s.movements.length > 0) hasExercises = true;
    }));

    if (!hasExercises) {
      CustomAlert.show("Error", "Please add at least one exercise.");
      return;
    }

    try {
      const user = auth().currentUser;
      if (!user) {
        CustomAlert.show("Error", "You must be logged in to create a workout.");
        return;
      }
      const userId = user.uid;
      
      // Clean up internal IDs before saving
      const cleanedExercises = blocks.map(block => ({
        sets: block.sets.map(set => ({
          label: set.label,
          rest: set.rest,
          movements: set.movements.map(m => ({
            category: m.category,
            exerciseId: m.exerciseId,
            name: m.name,
            reps: m.reps,
            setsCount: m.setsCount,
            // We don't necessarily need to save image/videoUrl if we fetch it, 
            // but saving it acts as a cache or override. 
            // The prompt's example structure didn't explicitly forbid it, 
            // but usually we save minimal data. 
            // However, for custom workouts, it's safer to save what we see.
            // Let's save minimal identifiers + user overrides.
          }))
        }))
      }));

      // Calculate total exercise count
      const exerciseCount = blocks.reduce((acc, b) => acc + b.sets.reduce((sAcc, s) => sAcc + s.movements.length, 0), 0);

      // --- Use Go Backend ---
      const token = await user.getIdToken();
      
      const payload = {
        name: programName,
        level: level || 'Custom',
        targetMuscles: targetMuscle ? [targetMuscle] : ['Full Body'],
        equipment: equipment ? [equipment] : ['None'],
        duration: duration || '45',
        coverImage: coverImage || 'https://via.placeholder.com/300',
        exercises: cleanedExercises
      };

      const response = await fetch('http://10.0.2.2:8080/api/create-custom-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to save program');
      }

      const responseData = await response.json();
      console.log("Workout saved via Go backend:", responseData);

      setSuccessProgramName(programName);
      setSuccessProgramId(responseData.id || responseData.workoutId || ''); // Fallback IDs just in case
      setShowSuccessModal(true);

    } catch (error) {
      console.error("Error saving program:", error);
      CustomAlert.show("Error", "Failed to save program.");
    }
  };

  const handleDurationChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setDuration(numericValue);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f230f" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Custom Program</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Program Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Program Details</Text>
          
          <TouchableOpacity style={styles.addImageContainer} onPress={pickImage} disabled={isUploading}>
            {isUploading ? (
              <View style={styles.addImagePlaceholder}>
                <ActivityIndicator size="large" color="#ccff00" />
                <Text style={styles.addImageText}>Uploading...</Text>
              </View>
            ) : coverImage ? (
              <Image source={{ uri: coverImage }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={styles.addImagePlaceholder}>
                <MaterialIcons name="add-photo-alternate" size={32} color="#ccff00" />
                <Text style={styles.addImageText}>Add Cover Image</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>PROGRAM NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Extreme Chest"
              placeholderTextColor="#64748b"
              value={programName}
              onChangeText={setProgramName}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <Text style={styles.label}>DURATION (MIN)</Text>
              <TextInput
                style={styles.input}
                placeholder="45"
                placeholderTextColor="#64748b"
                value={duration}
                onChangeText={handleDurationChange}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <Text style={styles.label}>TARGET MUSCLE</Text>
              <TextInput
                style={styles.input}
                placeholder="Chest"
                placeholderTextColor="#64748b"
                value={targetMuscle}
                onChangeText={setTargetMuscle}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>EQUIPMENT</Text>
            <TextInput
              style={styles.input}
              placeholder="Dumbbells, Bench"
              placeholderTextColor="#64748b"
              value={equipment}
              onChangeText={setEquipment}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>LEVEL</Text>
            <TextInput
              style={styles.input}
              placeholder="Professional"
              placeholderTextColor="#64748b"
              value={level}
              onChangeText={setLevel}
            />
          </View>
        </View>

        {/* Workout Builder Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Workout Structure</Text>
          </View>

          {blocks.map((block, blockIndex) => (
            <View key={block._id} style={styles.blockContainer}>
              <View style={styles.blockHeader}>
                <View style={styles.blockHeaderIndicator} />
                <Text style={styles.blockTitle}>Exercise Block {blockIndex + 1}</Text>
                {/* Option to delete block could go here */}
              </View>

              <View style={styles.blockContent}>
                {block.sets.map((set, setIndex) => (
                  <View key={set._id} style={styles.setContainer}>
                    <View style={styles.setHeader}>
                        <TextInput
                            style={styles.setTitleInput}
                            value={set.label}
                            onChangeText={(text) => handleUpdateSetLabel(blockIndex, setIndex, text)}
                            placeholder="Set Name"
                            placeholderTextColor="#64748b"
                        />
                        {/* Option to delete set could go here */}
                    </View>

                    <View style={styles.movementsList}>
                      {set.movements.map((movement, moveIndex) => (
                        <View key={movement._id} style={styles.movementItem}>
                          <View style={styles.movementImageContainer}>
                            <Image 
                              source={{ uri: movement.image }} 
                              style={styles.movementImage} 
                            />
                          </View>
                          <View style={styles.movementInfo}>
                            <Text style={styles.movementName} numberOfLines={1}>{movement.name}</Text>
                            <View style={styles.setsRepsContainer}>
                              <View style={styles.setRepInputContainer}>
                                <TextInput
                                  style={styles.setRepInput}
                                  value={String(movement.setsCount)}
                                  onChangeText={(val) => handleUpdateMovement(movement._id, 'setsCount', val)}
                                  keyboardType="numeric"
                                />
                                <Text style={styles.setRepLabel}>Sets</Text>
                              </View>
                              <Text style={styles.xDivider}>×</Text>
                              <View style={styles.setRepInputContainer}>
                                <TextInput
                                  style={styles.setRepInput}
                                  value={movement.reps}
                                  onChangeText={(val) => handleUpdateMovement(movement._id, 'reps', val)}
                                  placeholder="1"
                                  placeholderTextColor="#64748b"
                                />
                                <Text style={styles.setRepLabel}>Reps</Text>
                              </View>
                            </View>
                          </View>
                          <TouchableOpacity onPress={(e) => toggleDropdown(movement._id, e)} style={styles.moreButton}>
                            <MaterialIcons name="more-vert" size={24} color="#94a3b8" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      
                      <TouchableOpacity 
                        style={styles.addMovementButton}
                        onPress={() => handleAddMovement(blockIndex, setIndex)}
                      >
                        <MaterialIcons name="add" size={20} color="#ccff00" />
                        <Text style={styles.addMovementText}>Add Exercise</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.restContainer}>
                        <MaterialIcons name="timer" size={16} color="#ccff00" />
                        <Text style={styles.restLabel}>Rest (sec):</Text>
                        <TextInput
                            style={styles.restInput}
                            value={set.rest}
                            onChangeText={(text) => handleUpdateSetRest(blockIndex, setIndex, text)}
                            keyboardType="numeric"
                            placeholder="60"
                            placeholderTextColor="#64748b"
                        />
                    </View>
                  </View>
                ))}

                <TouchableOpacity 
                    style={styles.addSetButton}
                    onPress={() => handleAddSet(blockIndex)}
                >
                    <Text style={styles.addSetText}>+ Add Set Group</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity 
            style={styles.addBlockButton}
            onPress={handleAddBlock}
          >
            <Text style={styles.addBlockText}>+ Add New Block</Text>
          </TouchableOpacity>

        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Close Dropdown Overlay */}
      {visibleDropdown && (
        <TouchableWithoutFeedback onPress={closeDropdown}>
          <View style={styles.dropdownOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Global Dropdown Menu */}
      {visibleDropdown && dropdownPosition && (
        <View style={[styles.dropdownMenu, { top: dropdownPosition.top, right: dropdownPosition.right }]}>
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => {
                const loc = findMovementLocation(visibleDropdown);
                if (loc) handleReplaceMovement(loc.blockIndex, loc.setIndex, visibleDropdown);
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="loop" size={20} color="#f1f5f9" />
            <Text style={styles.dropdownText}>Replace</Text>
          </TouchableOpacity>
          <View style={styles.dropdownDivider} />
          <TouchableOpacity 
            style={styles.dropdownItem} 
            onPress={() => handleDeleteMovement(visibleDropdown)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
            <Text style={[styles.dropdownText, { color: '#ef4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Actions */}
      <LinearGradient
        colors={['transparent', '#1f230f']}
        style={styles.bottomActionsContainer}
        pointerEvents="box-none"
      >
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.draftButton}>
            <Text style={styles.draftButtonText}>Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.publishButton} onPress={handlePublish}>
            <Text style={styles.publishButtonText}>Publish</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Success Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
            <View style={[styles.successModal, { backgroundColor: '#12140a', borderColor: 'rgba(204, 255, 0, 0.2)' }]}>
                {/* Visual Ornament */}
                <View style={styles.modalHandle} />
                
                <View style={styles.successContent}>
                    {/* Checkmark */}
                    <View style={styles.checkmarkContainer}>
                        <MaterialIcons name="check-circle" size={60} color="#ccff00" />
                    </View>

                    <Text style={[styles.successTitle, { color: '#ffffff' }]}>Program Saved Successfully!</Text>
                    <Text style={[styles.successMessage, { color: '#a1a1aa' }]}>
                        {`Your new custom workout "${successProgramName}" is now ready in your library.`}
                    </Text>

                    <View style={styles.successActions}>
                        <TouchableOpacity 
                            style={[styles.successButtonPrimary, { backgroundColor: '#ccff00' }]}
                            onPress={() => {
                                setShowSuccessModal(false);
                                // For custom workouts, maybe route to library or start it directly
                                router.replace('/screens/AddWorkoutScreen');
                            }}
                        >
                            <MaterialIcons name="list-alt" size={24} color="#1f230f" />
                            <Text style={styles.successButtonTextPrimary}>Go to Library</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.successButtonSecondary, { borderColor: '#ccff00' }]}
                            onPress={() => {
                                setShowSuccessModal(false);
                                router.replace('/(tabs)/');
                            }}
                        >
                            <MaterialIcons name="home" size={24} color="#ccff00" />
                            <Text style={[styles.successButtonTextSecondary, { color: '#ccff00' }]}>Dashboard</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Optional Thumbnail Card */}
                <View style={[styles.thumbnailContainer, { backgroundColor: 'rgba(204, 255, 0, 0.05)', borderTopColor: 'rgba(204, 255, 0, 0.1)' }]}>
                    <View style={styles.thumbnailContent}>
                        <View style={[styles.thumbnailImage, { borderColor: 'rgba(204, 255, 0, 0.2)', backgroundColor: '#333' }]}>
                             <MaterialIcons name="fitness-center" size={24} color="#ccff00" />
                        </View>
                        <View>
                            <Text style={[styles.thumbnailTitle, { color: '#ffffff' }]}>{successProgramName}</Text>
                            <Text style={[styles.thumbnailSubtitle, { color: '#a1a1aa' }]}>Custom Workout • {blocks.reduce((acc, b) => acc + b.sets.reduce((sAcc, s) => sAcc + s.movements.length, 0), 0)} Exercises</Text>
                        </View>
                    </View>
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
    backgroundColor: '#1f230f', // Matches WorkoutDetailsScreen
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1f230f',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ccff00',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  addImageContainer: {
    height: 180,
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  addImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  addImageText: {
    color: '#ccff00',
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  // Block Styles
  blockContainer: {
    marginBottom: 24,
    gap: 12,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  blockHeaderIndicator: {
    height: 24,
    width: 4,
    backgroundColor: '#ccff00',
  },
  blockTitle: {
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
    fontStyle: 'italic',
    color: '#f1f5f9',
  },
  blockContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
  },
  // Set Styles
  setContainer: {
    backgroundColor: '#1f230f',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  setTitleInput: {
    color: '#ccff00',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: 0,
    flex: 1,
  },
  movementsList: {
    gap: 12,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  movementImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#334155',
  },
  movementImage: {
    width: '100%',
    height: '100%',
  },
  movementInfo: {
    flex: 1,
  },
  movementName: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  setsRepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setRepInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  setRepInput: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: 'bold',
    minWidth: 20,
    textAlign: 'center',
    padding: 0,
  },
  setRepLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginLeft: 4,
  },
  xDivider: {
    color: '#64748b',
    fontSize: 12,
  },
  moreButton: {
    padding: 4,
  },
  addMovementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: 'rgba(204, 255, 0, 0.05)',
  },
  addMovementText: {
    color: '#ccff00',
    fontSize: 12,
    fontWeight: 'bold',
  },
  restContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  restLabel: {
    color: '#ccff00',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  restInput: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: 'bold',
    padding: 0,
    minWidth: 40,
  },
  addSetButton: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  addSetText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  addBlockButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#ccff00',
    borderStyle: 'dashed',
    borderRadius: 16,
    marginTop: 8,
  },
  addBlockText: {
    color: '#ccff00',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  // Dropdown
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: '#1d2012',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 2000,
    paddingVertical: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 900,
  },
  // Bottom Actions
  bottomActionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40,
    zIndex: 1000,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
  },
  draftButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  draftButtonText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: 'bold',
  },
  publishButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#ccff00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  publishButtonText: {
    color: '#1f230f',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Success Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  successModal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 32,
  },
  successContent: {
    alignItems: 'center',
  },
  checkmarkContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(204, 255, 0, 0.2)',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  successActions: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  successButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  successButtonTextPrimary: {
    color: '#12140a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    gap: 8,
  },
  successButtonTextSecondary: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  thumbnailContainer: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  thumbnailContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  thumbnailImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  thumbnailSubtitle: {
    fontSize: 12,
  },
});
