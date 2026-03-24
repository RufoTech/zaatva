import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { CustomAlert } from '@/utils/CustomAlert';
import {
  ActivityIndicator,
  Alert,
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

const PRIMARY = "#ccff00";
const BG_DARK = "#0d0f06";
const SURFACE = "rgba(255, 255, 255, 0.05)";
const TEXT_MUTED = "#94a3b8";

export default function CreateCustomFoodScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  
  // Basic Info
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('Snacks'); // Can be Breakfast, Lunch, Dinner, Snacks
  
  // Serving Info
  const [servingSize, setServingSize] = useState('100');
  const [measureType, setMeasureType] = useState('gram');
  
  // Macros
  const [calories, setCalories] = useState('0');
  const [protein, setProtein] = useState('0');
  const [carbs, setCarbs] = useState('0');
  const [fat, setFat] = useState('0');
  
  // Micros
  const [fiber, setFiber] = useState('0');
  const [sugar, setSugar] = useState('0');
  const [cholesterol, setCholesterol] = useState('0');
  const [sodium, setSodium] = useState('0');
  const [potassium, setPotassium] = useState('0');

  const handleSave = async () => {
    if (!name.trim()) {
      CustomAlert.show("Error", "Please enter a food name.");
      return;
    }

    const user = auth().currentUser;
    if (!user) {
      CustomAlert.show("Error", "You must be logged in to create food.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        userId: user.uid,
        name: name.trim(),
        category: 'Custom', // Auto-assign 'Custom' category
        mealType: mealType,
        servingSize: parseFloat(servingSize) || 100,
        measureType: measureType, // Already strictly 'gram' or 'unit'
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        fiber: parseFloat(fiber) || 0,
        sugar: parseFloat(sugar) || 0,
        cholesterol: parseFloat(cholesterol) || 0,
        sodium: parseFloat(sodium) || 0,
        potassium: parseFloat(potassium) || 0,
        image: null,
        detailsImage: null,
        createdAt: new Date().toISOString()
      };

      await firestore().collection('customUserFoods').add(payload);
      
      CustomAlert.show("Success", "Custom food saved successfully!", [
        {
          text: "OK",
          onPress: () => router.back()
        }
      ]);

    } catch (error) {
      console.error("Error saving food:", error);
      CustomAlert.show("Error", "Failed to save the custom food.");
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label: string, value: string, setValue: (val: string) => void, keyboardType: any = 'default', placeholder: string = '') => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={TEXT_MUTED}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Custom Food</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          {renderInput("FOOD NAME", name, setName, "default", "e.g., Homemade Avocado Toast")}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>MEAL TYPE</Text>
            <View style={styles.chipsContainer}>
              {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, mealType === type && styles.chipActive]}
                  onPress={() => setMealType(type)}
                >
                  <Text style={[styles.chipText, mealType === type && styles.chipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portion Size</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              {renderInput("SERVING SIZE", servingSize, setServingSize, "numeric")}
            </View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>MEASURE TYPE</Text>
                <View style={styles.chipsContainer}>
                  {['gram', 'unit'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, measureType === type && styles.chipActive]}
                      onPress={() => setMeasureType(type)}
                    >
                      <Text style={[styles.chipText, measureType === type && styles.chipTextActive]}>
                        {type === 'gram' ? 'Gram' : 'Unit'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Main Macros</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{renderInput("CALORIES (kcal)", calories, setCalories, "numeric")}</View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>{renderInput("PROTEIN (g)", protein, setProtein, "numeric")}</View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{renderInput("CARBS (g)", carbs, setCarbs, "numeric")}</View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>{renderInput("FAT (g)", fat, setFat, "numeric")}</View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Micronutrients (Optional)</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{renderInput("SUGAR (g)", sugar, setSugar, "numeric")}</View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>{renderInput("FIBER (g)", fiber, setFiber, "numeric")}</View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{renderInput("SODIUM (mg)", sodium, setSodium, "numeric")}</View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>{renderInput("POTASSIUM (mg)", potassium, setPotassium, "numeric")}</View>
          </View>
          {renderInput("CHOLESTEROL (mg)", cholesterol, setCholesterol, "numeric")}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, loading && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#1f230f" />
          ) : (
            <Text style={styles.saveButtonText}>Save Food</Text>
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f8fafc',
    fontSize: 16,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1f230f',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: BG_DARK,
  },
  saveButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#1f230f',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
