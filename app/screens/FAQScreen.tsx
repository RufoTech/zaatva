import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const BG_DARK = "#11140b";
const SURFACE_CONTAINER_LOW = "#1a1d13";
const SURFACE_CONTAINER = "#1e2117";
const SURFACE_CONTAINER_HIGH = "#282b21";
const SURFACE_BRIGHT = "#373a2f";
const PRIMARY_CONTAINER = "#c6f333";
const ON_PRIMARY = "#283500";
const SECONDARY = "#b9d073";
const TEXT_ON_SURFACE = "#e2e4d4";
const TEXT_MUTED = "#c4c9ae";
const BORDER_COLOR = "rgba(255, 255, 255, 0.1)";

const FAQ_ITEMS = [
  {
    id: 1,
    question: "How do I sync my wearable device?",
    answer: "To sync your wearable device, navigate to Settings > Connected Devices. Select your manufacturer (Garmin, Apple, or Whoop) and follow the secure OAuth login prompt. Syncing typically happens automatically every 15 minutes."
  },
  {
    id: 2,
    question: "Can I share my badges on social media?",
    answer: "Yes! You can share your earned badges directly to Instagram, Twitter, or Facebook from the Achievements screen by tapping the 'Share' icon on any unlocked badge."
  },
  {
    id: 3,
    question: "How are calorie burns calculated?",
    answer: "Calorie burns are estimated using a combination of your profile data (age, weight, height, gender), the duration of your workout, and your heart rate data if a wearable device is connected."
  },
  {
    id: 4,
    question: "What happens if I miss a training day?",
    answer: "Don't worry! Your program will automatically adjust. You can either make up the missed workout on a rest day, or simply continue with the next scheduled session."
  }
];

export default function FAQScreen() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<number | null>(1);

  const toggleAccordion = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={TEXT_ON_SURFACE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support & FAQ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Search & Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>How can we <Text style={styles.heroHighlight}>help?</Text></Text>
          <Text style={styles.heroSubtitle}>Browse our knowledge base or categories below.</Text>
        </View>

        {/* Categories Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CATEGORIES</Text>
          <View style={styles.categoriesGrid}>
            
            <TouchableOpacity style={styles.categoryCard}>
              <View style={[styles.categoryIconWrapper, { backgroundColor: 'rgba(198, 243, 51, 0.1)' }]}>
                <MaterialIcons name="fitness-center" size={24} color={PRIMARY_CONTAINER} />
              </View>
              <Text style={styles.categoryText}>Workouts</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.categoryCard}>
              <View style={[styles.categoryIconWrapper, { backgroundColor: 'rgba(185, 208, 115, 0.1)' }]}>
                <MaterialIcons name="military-tech" size={24} color={SECONDARY} />
              </View>
              <Text style={styles.categoryText}>Badges</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.categoryCard}>
              <View style={[styles.categoryIconWrapper, { backgroundColor: 'rgba(227, 224, 245, 0.1)' }]}>
                <MaterialIcons name="payments" size={24} color="#e3e0f5" />
              </View>
              <Text style={styles.categoryText}>Billing</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.categoryCard}>
              <View style={[styles.categoryIconWrapper, { backgroundColor: 'rgba(196, 201, 174, 0.1)' }]}>
                <MaterialIcons name="person" size={24} color={TEXT_MUTED} />
              </View>
              <Text style={styles.categoryText}>Account</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Accordion Section */}
        <View style={styles.section}>
          <View style={styles.accordionHeaderRow}>
            <Text style={styles.sectionHeader}>COMMON QUESTIONS</Text>
            <View style={styles.topBadge}>
                <Text style={styles.topBadgeText}>TOP 5</Text>
            </View>
          </View>

          <View style={styles.accordionContainer}>
            {FAQ_ITEMS.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <View 
                  key={item.id} 
                  style={[
                    styles.accordionItem, 
                    isExpanded ? styles.accordionItemActive : styles.accordionItemInactive
                  ]}
                >
                  <TouchableOpacity 
                    style={styles.accordionHeader} 
                    onPress={() => toggleAccordion(item.id)}
                    activeOpacity={1}
                  >
                    <Text style={styles.accordionTitle}>
                      {item.question}
                    </Text>
                    <MaterialIcons 
                      name={isExpanded ? "expand-less" : "expand-more"} 
                      size={24} 
                      color={isExpanded ? PRIMARY_CONTAINER : TEXT_MUTED} 
                    />
                  </TouchableOpacity>
                  
                  {isExpanded && (
                    <View style={styles.accordionBody}>
                      <Text style={styles.accordionText}>{item.answer}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Contact Support CTA */}
        <View style={styles.ctaContainer}>
          <View style={styles.ctaContent}>
            <Text style={styles.ctaTitle}>Still need help?</Text>
            <Text style={styles.ctaSubtitle}>Our fitness experts are available 24/7 for technical support.</Text>
          </View>
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={() => Linking.openURL('mailto:rainnovationsmmc@gmail.com')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="chat" size={20} color={ON_PRIMARY} />
            <Text style={styles.ctaButtonText}>Contact Us</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_ON_SURFACE,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  heroSection: {
    marginBottom: 24, // Reduced from 48 to remove empty space
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
  },
  heroHighlight: {
    color: PRIMARY_CONTAINER,
  },
  heroSubtitle: {
    fontSize: 16,
    color: TEXT_MUTED,
    opacity: 0.8,
    marginBottom: 8, // Reduced from 32
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_CONTAINER_LOW,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 60,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: TEXT_ON_SURFACE,
    fontSize: 16,
  },
  section: {
    marginBottom: 48,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  accordionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: SECONDARY,
    letterSpacing: 1.5,
  },
  topBadge: {
      backgroundColor: 'rgba(198, 243, 51, 0.1)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 16,
  },
  topBadgeText: {
      color: PRIMARY_CONTAINER,
      fontSize: 10,
      fontWeight: 'bold',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '47%', // roughly half width with gap
    backgroundColor: SURFACE_CONTAINER,
    padding: 24,
    borderRadius: 16,
    alignItems: 'flex-start',
    gap: 16,
  },
  categoryIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  accordionContainer: {
    gap: 16,
  },
  accordionItem: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  accordionItemActive: {
    backgroundColor: SURFACE_CONTAINER,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY_CONTAINER,
  },
  accordionItemInactive: {
    backgroundColor: SURFACE_CONTAINER_LOW,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    paddingRight: 16,
  },
  accordionBody: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  accordionText: {
    color: '#ffffff',
    lineHeight: 24,
    fontSize: 14,
  },
  ctaContainer: {
    backgroundColor: SURFACE_CONTAINER_HIGH,
    padding: 32,
    borderRadius: 32,
    marginBottom: 32,
  },
  ctaContent: {
    marginBottom: 24,
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  ctaSubtitle: {
    color: TEXT_MUTED,
    fontSize: 14,
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: PRIMARY_CONTAINER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  ctaButtonText: {
    color: ON_PRIMARY,
    fontSize: 16,
    fontWeight: 'bold',
  }
});
