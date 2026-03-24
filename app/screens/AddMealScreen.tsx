import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CustomAlert } from '@/utils/CustomAlert';

const PRIMARY = "#ccff00";
const BG_DARK = "#0d0f06";
const SURFACE_HIGH = "#1e2114";
const SURFACE_CONTAINER = "#181b0f";
const TEXT_MUTED = "#abac9c";
const SECONDARY = "#ece856";
const TERTIARY = "#edd13a";
const OUTLINE = "rgba(117, 119, 104, 0.1)";

interface MealItemProps {
    icon?: string;
    imageUrl?: string;
    name: string;
    detail: string;
    onAdd?: (item: any) => void;
    onDelete?: (id: string) => void; // New prop for deleting
    data: any; // Full food data
}

const MealItem = ({ icon, imageUrl, name, detail, onAdd, onDelete, data }: MealItemProps) => {
  const [added, setAdded] = useState(false);

  const router = useRouter();

  const handleMealPress = (item: any) => {
    router.push({
      pathname: "/screens/MealDetailsScreen",
      params: { 
        name: item.name, 
        detail: item.detail, 
        icon: item.icon, 
        imageUrl: item.imageUrl,
        // Pass nutritional data
        id: data.id,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        servingSize: data.servingSize,
        measureType: data.measureType,
        potassium: data.potassium,
        sodium: data.sodium,
        sugar: data.sugar,
        fiber: data.fiber,
        cholesterol: data.cholesterol,
        detailsImage: data.detailsImage,
        isCustom: data.isCustom ? 'true' : 'false' // Pass isCustom flag
      }
    });
  };

  const handleAdd = () => {
    setAdded(true);
    onAdd?.({ name, detail, icon, imageUrl, ...data });
    // Visual feedback duration
    setTimeout(() => setAdded(false), 1000);
  };


  return (
    <TouchableOpacity 
        style={styles.oldMealItem}
        onPress={() => handleMealPress({ name, detail, icon, imageUrl })}
        activeOpacity={0.7}
    >
      <View style={styles.oldMealLeft}>
        <View style={styles.oldMealIconContainer}>
          {imageUrl ? (
             <Image source={{ uri: imageUrl }} style={styles.oldMealImage} resizeMode="cover" />
          ) : (
             <MaterialIcons name={icon as any || "restaurant"} size={24} color={PRIMARY} />
          )}
        </View>
        <View style={styles.oldMealNameContainer}>
          <Text style={styles.oldMealName}>{name}</Text>
          {data.isCustom && onDelete && (
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={() => onDelete(data.id)}
            >
              <MaterialIcons name="delete-outline" size={20} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.oldMealDetail}>{detail}</Text>
      </View>
      <TouchableOpacity
        onPress={handleAdd}
        style={[
            styles.oldAddButton,
            added ? styles.oldAddButtonAdded : styles.oldAddButtonNormal
        ]}
        activeOpacity={0.8}
      >
        <MaterialIcons name={added ? "check" : "add"} size={24} color="#1f230f" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default function AddMealScreen() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [categories, setCategories] = useState<string[]>([]);
  const [foods, setFoods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addedItems, setAddedItems] = useState<any[]>([]);
  const [isOldUiVisible, setIsOldUiVisible] = useState(false);
  const [activeMealType, setActiveMealType] = useState<string>("BREAKFAST");
  
  // Takvim ve Gün Yönetimi
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [goalCalories, setGoalCalories] = useState("2400"); // Dinamik kalori hədəfi
  
  // Seçilen güne ait öğünler
  const [dailyMeals, setDailyMeals] = useState<{
    BREAKFAST: any[];
    LUNCH: any[];
    DINNER: any[];
    SNACKS: any[];
  }>({
    BREAKFAST: [],
    LUNCH: [],
    DINNER: [],
    SNACKS: []
  });

  const router = useRouter();

  // Load meals and goal from AsyncStorage when selectedDate changes
  useEffect(() => {
    const loadDailyData = async () => {
      try {
        const storedMeals = await AsyncStorage.getItem(`meals_${selectedDateStr}`);
        if (storedMeals) {
          setDailyMeals(JSON.parse(storedMeals));
        } else {
          setDailyMeals({ BREAKFAST: [], LUNCH: [], DINNER: [], SNACKS: [] });
        }

        const storedGoal = await AsyncStorage.getItem('userGoalCalories');
        if (storedGoal) {
          setGoalCalories(storedGoal);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadDailyData();
  }, [selectedDateStr]);

  useEffect(() => {
    const fetchFoods = async () => {
      try {
        setLoading(true);
        // Fetch global foods
        const snapshot = await firestore().collection('foods').get();
        let foodList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Fetch custom user foods
        const user = auth().currentUser;
        if (user) {
          const customSnapshot = await firestore().collection('customUserFoods').where('userId', '==', user.uid).get();
          const customFoods = customSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              isCustom: true,
              // Map measureType to detail or fallback to servingSize
              detail: `${data.servingSize || 100} ${data.measureType || 'g'} • ${data.calories || 0} kcal`,
              // Ensure mealType matches activeMealType case if needed
            };
          });
          foodList = [...foodList, ...customFoods];
        }
        
        // Extract unique categories (trim and handle casing to ensure no duplicates)
        const uniqueCategories = Array.from(
          new Set(
            foodList
              .map((item: any) => item.category?.trim())
              .filter(Boolean)
          )
        ) as string[];
        
        // Add "All" at the beginning
        setCategories(["All", ...uniqueCategories]);
        setFoods(foodList);
        
      } catch (error) {
        console.error("Error fetching foods:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFoods();
  }, [isOldUiVisible]);

  const getFilteredFoods = () => {
    let filtered = foods;
    
    // For "Custom" category, maybe also filter by mealType if you want them strictly bound to the meal you're adding to.
    // E.g., if activeCategory === 'Custom' && activeMealType matches food.mealType. 
    // Currently, it just shows all 'Custom' foods in the Custom tab.

    // Filter by category
    if (activeCategory && activeCategory !== "All") {
        filtered = filtered.filter(f => f.category?.trim() === activeCategory);
    }
    
    // Filter by search
    if (search) {
        filtered = filtered.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    }
    
    return filtered;
  };

  const handleAdd = (item: any) => {
    setAddedItems((prev) => [...prev, item]); // Modal içi sepet (isteğe bağlı kullanılabilir)
    
    // Aktif öğüne ekle
    setDailyMeals(prev => {
      const updated = {
        ...prev,
        [activeMealType]: [...prev[activeMealType as keyof typeof prev], item]
      };
      return updated;
    });
  };

  const handleDeleteCustomFood = (id: string) => {
    CustomAlert.show(
      "Delete Custom Food",
      "Are you sure you want to delete this custom food?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await firestore().collection('customUserFoods').doc(id).delete();
              // Remove from local state to update UI immediately
              setFoods(prev => prev.filter(f => f.id !== id));
            } catch (error) {
              console.error("Error deleting custom food:", error);
              CustomAlert.show("Error", "Could not delete food.");
            }
          }
        }
      ]
    );
  };

  const handleSaveGoal = async (text: string) => {
    setGoalCalories(text);
    try {
      await AsyncStorage.setItem('userGoalCalories', text);
    } catch (error) {
      console.error("Error saving goal calories:", error);
    }
  };

  const handleSaveMeals = async () => {
    try {
      await AsyncStorage.setItem(`meals_${selectedDateStr}`, JSON.stringify(dailyMeals));
      CustomAlert.show("Success", "Meals saved successfully!");
      setIsOldUiVisible(false);
      setAddedItems([]); // Modal sepetini sıfırla
    } catch (error) {
      console.error("Error saving meals:", error);
      CustomAlert.show("Error", "Could not save meals.");
    }
  };

  const removeMeal = (mealType: string, index: number) => {
    setDailyMeals(prev => {
      const updatedList = [...prev[mealType as keyof typeof prev]];
      updatedList.splice(index, 1);
      const updated = { ...prev, [mealType]: updatedList };
      // Save immediately on remove
      AsyncStorage.setItem(`meals_${selectedDateStr}`, JSON.stringify(updated)).catch(e => console.log(e));
      return updated;
    });
  };

  const openAddModal = (mealType: string) => {
    setActiveMealType(mealType);
    setAddedItems([]); // Modal açılırken sepeti sıfırla (sadece o an eklenenleri saysın diye)
    setIsOldUiVisible(true);
  };

  // Dinamik Hesaplamalar
  const calculateTotal = (key: string) => {
    let total = 0;
    Object.values(dailyMeals).forEach(mealList => {
      mealList.forEach(item => {
        total += Number(item[key]) || 0;
      });
    });
    return Math.round(total);
  };

  const calculateMealTotal = (mealList: any[], key: string) => {
    return Math.round(mealList.reduce((sum, item) => sum + (Number(item[key]) || 0), 0));
  };

  const totalCalories = calculateTotal('calories');
  const totalProtein = calculateTotal('protein');
  const totalCarbs = calculateTotal('carbs');
  const totalFat = calculateTotal('fat');
  
  const GOAL_CALORIES = parseInt(goalCalories) || 2400;
  const progressPercent = Math.min((totalCalories / GOAL_CALORIES) * 100, 100).toFixed(0);

  // Takvim günlerini oluştur
  const generateWeekDays = () => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(currentDate);
      d.setDate(currentDate.getDate() + i);
      days.push({
        dateObj: d,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        dateStr: d.toISOString().split('T')[0]
      });
    }
    return days;
  };

  const weekDays = generateWeekDays();


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
            <TouchableOpacity 
                style={styles.iconButton}
                onPress={() => router.back()}
            >
                <MaterialIcons name="arrow-back" size={24} color="#f1f5f9" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{currentDate.toLocaleString('default', { month: 'long' })}</Text>
              <Text style={styles.headerSubtitle}>WEEK {Math.ceil(currentDate.getDate() / 7)}</Text>
            </View>
            <View style={styles.placeholderButton} />
        </View>

        {/* Horizontal Calendar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarContainer}>
            {weekDays.map((dayObj, index) => {
                const isActive = dayObj.dateStr === selectedDateStr;
                return (
                    <TouchableOpacity 
                      key={dayObj.dateStr} 
                      style={[styles.dayCard, isActive && styles.dayCardActive]}
                      onPress={() => setSelectedDateStr(dayObj.dateStr)}
                    >
                        <Text style={[styles.dayName, isActive && styles.dayTextActive]}>{dayObj.dayName}</Text>
                        <Text style={[styles.dayNumber, isActive && styles.dayTextActive]}>{dayObj.dayNum}</Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Daily Nutrition Summary */}
        <View style={styles.nutritionCard}>
          <View style={styles.nutritionGlow} />
          
          <View style={styles.nutritionHeader}>
            <View>
              <Text style={styles.nutritionLabel}>DAILY ENERGY</Text>
              <View style={styles.caloriesRow}>
                <Text style={styles.caloriesValue}>{totalCalories}</Text>
                <Text style={styles.caloriesTarget}>/</Text>
                <TextInput 
                  style={styles.goalInput}
                  value={goalCalories}
                  onChangeText={handleSaveGoal}
                  keyboardType="numeric"
                  maxLength={5}
                />
                <Text style={styles.caloriesTarget}>kcal</Text>
              </View>
            </View>
            <View style={styles.targetBadge}>
              <Text style={styles.targetBadgeText}>{progressPercent}% TARGET</Text>
            </View>
          </View>

          {/* Main Progress Bar */}
          <View style={styles.mainProgressBarBg}>
            <View style={[styles.mainProgressBarFill, { width: `${progressPercent}%` as any }]} />
          </View>

          {/* Macro Breakdown */}
          <View style={styles.macrosContainer}>
            <View style={styles.macroCol}>
              <View style={styles.macroHeader}>
                <Text style={styles.macroLabel}>PROTEIN</Text>
                <Text style={styles.macroValue}>{totalProtein}g</Text>
              </View>
              <View style={styles.macroBarBg}>
                <View style={[styles.macroBarFill, { width: `${Math.min((totalProtein / 150) * 100, 100)}%` as any, backgroundColor: SECONDARY }]} />
              </View>
            </View>

            <View style={styles.macroCol}>
              <View style={styles.macroHeader}>
                <Text style={styles.macroLabel}>CARBS</Text>
                <Text style={styles.macroValue}>{totalCarbs}g</Text>
              </View>
              <View style={styles.macroBarBg}>
                <View style={[styles.macroBarFill, { width: `${Math.min((totalCarbs / 250) * 100, 100)}%` as any, backgroundColor: TERTIARY }]} />
              </View>
            </View>

            <View style={styles.macroCol}>
              <View style={styles.macroHeader}>
                <Text style={styles.macroLabel}>FATS</Text>
                <Text style={styles.macroValue}>{totalFat}g</Text>
              </View>
              <View style={styles.macroBarBg}>
                <View style={[styles.macroBarFill, { width: `${Math.min((totalFat / 80) * 100, 100)}%` as any, backgroundColor: TEXT_MUTED }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Meal List Sections */}
        <View style={styles.mealSections}>
          
          {/* Breakfast */}
          <View style={styles.mealSection}>
            <View style={styles.mealSectionHeader}>
              <View style={styles.mealSectionTitleRow}>
                <View style={[styles.mealSectionIndicator, { backgroundColor: dailyMeals.BREAKFAST.length > 0 ? PRIMARY : 'rgba(204,255,0,0.2)' }]} />
                <Text style={[styles.mealSectionTitle, { opacity: dailyMeals.BREAKFAST.length > 0 ? 1 : 0.4 }]}>BREAKFAST</Text>
              </View>
              <Text style={[styles.mealSectionCalories, { opacity: dailyMeals.BREAKFAST.length > 0 ? 1 : 0.4 }]}>
                {calculateMealTotal(dailyMeals.BREAKFAST, 'calories')} KCAL
              </Text>
            </View>

            {dailyMeals.BREAKFAST.length > 0 ? (
              <View style={styles.mealSectionItems}>
                {dailyMeals.BREAKFAST.map((item, index) => (
                  <View key={index} style={styles.newMealItem}>
                    <Image source={{ uri: item.image || item.imageUrl || 'https://via.placeholder.com/150' }} style={styles.newMealImage} />
                    <View style={styles.newMealInfo}>
                      <Text style={styles.newMealName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.newMealMacros}>P: {item.protein || 0}G • C: {item.carbs || 0}G • F: {item.fat || 0}G</Text>
                    </View>
                    <View style={styles.newMealCals}>
                      <Text style={styles.newMealCalsValue}>{item.calories || 0}</Text>
                      <Text style={styles.newMealCalsLabel}>KCAL</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeMeal('BREAKFAST', index)} style={{ padding: 8, marginLeft: 8 }}>
                      <MaterialIcons name="close" size={20} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={[styles.addSnackButton, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={() => openAddModal('BREAKFAST')}>
                  <MaterialIcons name="add-circle" size={18} color={PRIMARY} />
                  <Text style={styles.addSnackText}>ADD MORE</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptySnacksContainer}>
                <Text style={styles.emptySnacksText}>NO BREAKFAST LOGGED YET</Text>
                <TouchableOpacity style={styles.addSnackButton} onPress={() => openAddModal('BREAKFAST')}>
                  <MaterialIcons name="add-circle" size={18} color={PRIMARY} />
                  <Text style={styles.addSnackText}>ADD BREAKFAST</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Lunch */}
          <View style={styles.mealSection}>
            <View style={styles.mealSectionHeader}>
              <View style={styles.mealSectionTitleRow}>
                <View style={[styles.mealSectionIndicator, { backgroundColor: dailyMeals.LUNCH.length > 0 ? PRIMARY : 'rgba(204,255,0,0.2)' }]} />
                <Text style={[styles.mealSectionTitle, { opacity: dailyMeals.LUNCH.length > 0 ? 1 : 0.4 }]}>LUNCH</Text>
              </View>
              <Text style={[styles.mealSectionCalories, { opacity: dailyMeals.LUNCH.length > 0 ? 1 : 0.4 }]}>
                {calculateMealTotal(dailyMeals.LUNCH, 'calories')} KCAL
              </Text>
            </View>

            {dailyMeals.LUNCH.length > 0 ? (
              <View style={styles.mealSectionItems}>
                {dailyMeals.LUNCH.map((item, index) => (
                  <View key={index} style={[styles.newMealItem, { borderLeftWidth: 4, borderLeftColor: 'rgba(204,255,0,0.4)' }]}>
                    <Image source={{ uri: item.image || item.imageUrl || 'https://via.placeholder.com/150' }} style={styles.newMealImage} />
                    <View style={styles.newMealInfo}>
                      <Text style={styles.newMealName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.newMealMacros}>P: {item.protein || 0}G • C: {item.carbs || 0}G • F: {item.fat || 0}G</Text>
                    </View>
                    <View style={styles.newMealCals}>
                      <Text style={styles.newMealCalsValue}>{item.calories || 0}</Text>
                      <Text style={styles.newMealCalsLabel}>KCAL</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeMeal('LUNCH', index)} style={{ padding: 8, marginLeft: 8 }}>
                      <MaterialIcons name="close" size={20} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={[styles.addSnackButton, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={() => openAddModal('LUNCH')}>
                  <MaterialIcons name="add-circle" size={18} color={PRIMARY} />
                  <Text style={styles.addSnackText}>ADD MORE</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptySnacksContainer}>
                <Text style={styles.emptySnacksText}>NO LUNCH LOGGED YET</Text>
                <TouchableOpacity style={styles.addSnackButton} onPress={() => openAddModal('LUNCH')}>
                  <MaterialIcons name="add-circle" size={18} color={PRIMARY} />
                  <Text style={styles.addSnackText}>ADD LUNCH</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Dinner */}
          <View style={styles.mealSection}>
            <View style={styles.mealSectionHeader}>
              <View style={styles.mealSectionTitleRow}>
                <View style={[styles.mealSectionIndicator, { backgroundColor: dailyMeals.DINNER.length > 0 ? PRIMARY : 'rgba(204,255,0,0.2)' }]} />
                <Text style={[styles.mealSectionTitle, { opacity: dailyMeals.DINNER.length > 0 ? 1 : 0.4 }]}>DINNER</Text>
              </View>
              <Text style={[styles.mealSectionCalories, { opacity: dailyMeals.DINNER.length > 0 ? 1 : 0.4 }]}>
                {calculateMealTotal(dailyMeals.DINNER, 'calories')} KCAL
              </Text>
            </View>

            {dailyMeals.DINNER.length > 0 ? (
              <View style={styles.mealSectionItems}>
                {dailyMeals.DINNER.map((item, index) => (
                  <View key={index} style={styles.newMealItem}>
                    <Image source={{ uri: item.image || item.imageUrl || 'https://via.placeholder.com/150' }} style={styles.newMealImage} />
                    <View style={styles.newMealInfo}>
                      <Text style={styles.newMealName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.newMealMacros}>P: {item.protein || 0}G • C: {item.carbs || 0}G • F: {item.fat || 0}G</Text>
                    </View>
                    <View style={styles.newMealCals}>
                      <Text style={styles.newMealCalsValue}>{item.calories || 0}</Text>
                      <Text style={styles.newMealCalsLabel}>KCAL</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeMeal('DINNER', index)} style={{ padding: 8, marginLeft: 8 }}>
                      <MaterialIcons name="close" size={20} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={[styles.addSnackButton, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={() => openAddModal('DINNER')}>
                  <MaterialIcons name="add-circle" size={18} color={PRIMARY} />
                  <Text style={styles.addSnackText}>ADD MORE</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptySnacksContainer}>
                <Text style={styles.emptySnacksText}>NO DINNER LOGGED YET</Text>
                <TouchableOpacity style={styles.addSnackButton} onPress={() => openAddModal('DINNER')}>
                  <MaterialIcons name="add-circle" size={18} color={PRIMARY} />
                  <Text style={styles.addSnackText}>ADD DINNER</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Snacks */}
          <View style={styles.mealSection}>
            <View style={styles.mealSectionHeader}>
              <View style={styles.mealSectionTitleRow}>
                <View style={[styles.mealSectionIndicator, { backgroundColor: dailyMeals.SNACKS.length > 0 ? PRIMARY : 'rgba(204,255,0,0.2)' }]} />
                <Text style={[styles.mealSectionTitle, { opacity: dailyMeals.SNACKS.length > 0 ? 1 : 0.4 }]}>SNACKS</Text>
              </View>
              <Text style={[styles.mealSectionCalories, { opacity: dailyMeals.SNACKS.length > 0 ? 1 : 0.4 }]}>
                {calculateMealTotal(dailyMeals.SNACKS, 'calories')} KCAL
              </Text>
            </View>

            {dailyMeals.SNACKS.length > 0 ? (
              <View style={styles.mealSectionItems}>
                {dailyMeals.SNACKS.map((item, index) => (
                  <View key={index} style={styles.newMealItem}>
                    <Image source={{ uri: item.image || item.imageUrl || 'https://via.placeholder.com/150' }} style={styles.newMealImage} />
                    <View style={styles.newMealInfo}>
                      <Text style={styles.newMealName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.newMealMacros}>P: {item.protein || 0}G • C: {item.carbs || 0}G • F: {item.fat || 0}G</Text>
                    </View>
                    <View style={styles.newMealCals}>
                      <Text style={styles.newMealCalsValue}>{item.calories || 0}</Text>
                      <Text style={styles.newMealCalsLabel}>KCAL</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeMeal('SNACKS', index)} style={{ padding: 8, marginLeft: 8 }}>
                      <MaterialIcons name="close" size={20} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={[styles.addSnackButton, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={() => openAddModal('SNACKS')}>
                  <MaterialIcons name="add-circle" size={18} color={PRIMARY} />
                  <Text style={styles.addSnackText}>ADD MORE</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptySnacksContainer}>
                <Text style={styles.emptySnacksText}>NO SNACKS LOGGED YET</Text>
                <TouchableOpacity style={styles.addSnackButton} onPress={() => openAddModal('SNACKS')}>
                  <MaterialIcons name="add-circle" size={18} color={PRIMARY} />
                  <Text style={styles.addSnackText}>ADD SNACK</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => setIsOldUiVisible(true)}
      >
        <MaterialIcons name="add" size={32} color="#1f230f" />
      </TouchableOpacity>

      {/* Old UI Modal */}
      <Modal visible={isOldUiVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={[styles.container, { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
            <View style={[styles.header, { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>
                <View style={styles.oldHeaderTop}>
                    <TouchableOpacity 
                        style={styles.oldIconButton}
                        onPress={() => setIsOldUiVisible(false)}
                    >
                        <MaterialIcons name="close" size={24} color="#f1f5f9" />
                    </TouchableOpacity>
                    <Text style={styles.oldHeaderTitle}>Add Meal</Text>
                    {addedItems.length > 0 ? (
                        <View style={styles.oldCounterBadge}>
                            <Text style={styles.oldCounterText}>{addedItems.length}</Text>
                        </View>
                    ) : (
                        <View style={styles.oldPlaceholderButton} />
                    )}
                </View>

                {/* Search Input */}
                <View style={styles.oldSearchContainer}>
                    <View style={styles.oldSearchBar}>
                        <MaterialIcons name="search" size={24} color="rgba(204,255,0,0.6)" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.oldSearchInput}
                            placeholder="Search food"
                            placeholderTextColor="rgba(204,255,0,0.4)"
                            value={search}
                            onChangeText={setSearch}
                        />
                        <TouchableOpacity>
                            <MaterialIcons name="qr-code-scanner" size={24} color="rgba(204,255,0,0.6)" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Category Tabs */}
                <View style={{ height: 50 }}>
                    {loading ? (
                        <View style={{ paddingLeft: 16, justifyContent: 'center' }}>
                            <ActivityIndicator size="small" color={PRIMARY} />
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.oldTabsContainer}>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => setActiveCategory(cat)}
                                    style={[
                                        styles.oldTabButton,
                                        activeCategory === cat ? styles.oldTabButtonActive : styles.oldTabButtonInactive
                                    ]}
                                >
                                    <Text style={[
                                        styles.oldTabText,
                                        activeCategory === cat ? styles.oldTabTextActive : styles.oldTabTextInactive
                                    ]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(204,255,0,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(204,255,0,0.3)' }}
                    onPress={() => { 
                        setIsOldUiVisible(false); 
                        router.push('/screens/CreateCustomFoodScreen'); 
                    }}
                >
                    <MaterialIcons name="add-circle-outline" size={16} color="#ccff00" />
                    <Text style={{ color: '#ccff00', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>CREATE CUSTOM FOOD</Text>
                </TouchableOpacity>
            </View>

            {/* Content Section */}
            <ScrollView contentContainerStyle={styles.oldScrollContent}>
                {loading ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={PRIMARY} />
                        <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>Loading foods...</Text>
                    </View>
                ) : (
                    <View style={styles.oldMealsList}>
                        {getFilteredFoods().map((food: any) => (
                            <MealItem 
                                key={food.id} 
                                name={food.name || 'Unknown Food'}
                                detail={food.detail || `${food.measureType || 'g'} • ${food.calories || 0} kcal`}
                                imageUrl={food.image}
                                onAdd={handleAdd} 
                                onDelete={handleDeleteCustomFood}
                                data={food}
                            />
                        ))}
                        {getFilteredFoods().length === 0 && (
                            <Text style={styles.oldEmptyText}>No foods found for this category</Text>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Fixed Footer Action */}
            <View style={styles.oldFooter}>
                <TouchableOpacity 
                    style={styles.oldCustomMealButton} 
                    activeOpacity={0.9}
                    onPress={handleSaveMeals}
                >
                    <MaterialIcons name="save" size={24} color="#1f230f" />
                    <Text style={styles.oldCustomMealText}>Save Meals</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
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
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fdfdec',
    textTransform: 'uppercase',
    fontStyle: 'italic',
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    letterSpacing: 2,
  },
  placeholderButton: {
    width: 40,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingBottom: 8,
  },
  calendarContainer: {
    paddingBottom: 8,
    gap: 16,
  },
  dayCard: {
    width: 56,
    height: 80,
    borderRadius: 12,
    backgroundColor: SURFACE_CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: OUTLINE,
    opacity: 0.6,
  },
  dayCardActive: {
    backgroundColor: PRIMARY,
    opacity: 1,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 0,
  },
  dayName: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#fdfdec',
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fdfdec',
  },
  dayTextActive: {
    color: '#3a4a00',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120, // space for FAB
  },
  nutritionCard: {
    backgroundColor: SURFACE_HIGH,
    borderRadius: 12,
    padding: 24,
    marginBottom: 32,
    overflow: 'hidden',
  },
  nutritionGlow: {
    position: 'absolute',
    top: -96,
    right: -96,
    width: 192,
    height: 192,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderRadius: 96,
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  nutritionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    letterSpacing: 1,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  caloriesValue: {
    fontSize: 48,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: -2,
  },
  caloriesTarget: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_MUTED,
  },
  goalInput: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY,
    backgroundColor: 'rgba(204,255,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.3)',
    borderStyle: 'dashed',
  },
  targetBadge: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  targetBadgeText: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  mainProgressBarBg: {
    height: 16,
    backgroundColor: SURFACE_CONTAINER,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  mainProgressBarFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 8,
  },
  macrosContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  macroCol: {
    flex: 1,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    letterSpacing: 1,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fdfdec',
  },
  macroBarBg: {
    height: 4,
    backgroundColor: SURFACE_CONTAINER,
    borderRadius: 2,
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  mealSections: {
    gap: 32,
  },
  mealSection: {},
  mealSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  mealSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealSectionIndicator: {
    width: 32,
    height: 2,
    backgroundColor: PRIMARY,
  },
  mealSectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fdfdec',
    letterSpacing: 1,
  },
  mealSectionCalories: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    letterSpacing: 1,
  },
  mealSectionItems: {
    gap: 12,
  },
  newMealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_CONTAINER,
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  newMealImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  newMealInfo: {
    flex: 1,
  },
  newMealName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fdfdec',
    marginBottom: 4,
  },
  newMealMacros: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MUTED,
    letterSpacing: 1,
  },
  newMealCals: {
    alignItems: 'flex-end',
  },
  newMealCalsValue: {
    fontSize: 20,
    fontWeight: '900',
    color: PRIMARY,
  },
  newMealCalsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    letterSpacing: 1,
  },
  emptySnacksContainer: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: OUTLINE,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptySnacksText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TEXT_MUTED,
    letterSpacing: 2,
  },
  addSnackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SURFACE_HIGH,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addSnackText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fdfdec',
    letterSpacing: 2,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
  },
  
  // --- Old UI Styles for Modal ---
  oldHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  oldIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(204,255,0,0.1)',
  },
  oldHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
    flex: 1,
    textAlign: 'center',
  },
  oldCounterBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(204,255,0,0.2)',
  },
  oldCounterText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
  },
  oldPlaceholderButton: {
    width: 40,
    height: 40,
  },
  oldSearchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  oldSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(204,255,0,0.1)',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  oldSearchInput: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 16,
  },
  oldTabsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  oldTabButton: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oldTabButtonActive: {
    backgroundColor: PRIMARY,
  },
  oldTabButtonInactive: {
    backgroundColor: 'rgba(204,255,0,0.1)',
  },
  oldTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  oldTabTextActive: {
    color: '#1f230f',
  },
  oldTabTextInactive: {
    color: PRIMARY,
  },
  oldScrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  oldMealsList: {
    gap: 12,
  },
  oldMealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  oldMealLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  oldMealIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(204,255,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  oldMealImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  oldMealNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  oldMealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  deleteButton: {
    padding: 4,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 8,
  },
  oldMealDetail: {
    fontSize: 14,
    color: 'rgba(204,255,0,0.6)',
    marginTop: 2,
  },
  oldAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oldAddButtonNormal: {
    backgroundColor: PRIMARY,
  },
  oldAddButtonAdded: {
    backgroundColor: '#4ade80', // green-400
    transform: [{ scale: 1.1 }],
  },
  oldEmptyText: {
    color: 'rgba(204,255,0,0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  oldFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 32,
    backgroundColor: 'rgba(13,15,6,0.9)', 
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  oldCustomMealButton: {
    width: '100%',
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  oldCustomMealText: {
    color: '#1f230f',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
