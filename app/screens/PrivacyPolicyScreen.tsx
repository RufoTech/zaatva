import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f230f" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} /> {/* Spacer for centering */}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last Updated: March 24, 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Introduction</Text>
          <Text style={styles.paragraph}>
            GreenFit ("we", "our", "us") respects your privacy and is committed to protecting it through our compliance with this policy. This Privacy Policy outlines our practices regarding the collection, use, and disclosure of your personal information when you use our mobile application (the "App"). We collect specific sensitive personal data to provide a personalized fitness experience, and we prioritize the security of that data.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information We Collect</Text>
          
          <Text style={styles.subTitle}>1. Personal and Sensitive Data</Text>
          <Text style={styles.paragraph}>
            To function as a health and fitness application, we explicitly request and securely store the following sensitive personal information:
          </Text>
          <Text style={styles.listItem}>• Identification: Full name, email address, profile picture (via Google Sign-In or manual registration).</Text>
          <Text style={styles.listItem}>• Physical Characteristics: Height, Weight, Age, Gender.</Text>
          <Text style={styles.listItem}>• Biometrics: Body measurements (neck, waist, hip), steps taken, daily activity levels.</Text>

          <Text style={styles.subTitle}>2. Device and Usage Data</Text>
          <Text style={styles.listItem}>• Device Sensors: We utilize the pedometer (steps sensor) and accelerometer to calculate your estimated daily activity, track your workout progress, and maintain health statistics.</Text>
          <Text style={styles.listItem}>• Log Data: Information on how the Service is accessed and used, including usage time, feature engagement, and crash reports.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How We Use Your Information</Text>
          <Text style={styles.paragraph}>We strictly use the collected data for the following core functionalities:</Text>
          <Text style={styles.listItem}>• Health Calculations: Your height, weight, gender, and age are used locally to calculate fitness metrics such as Body Fat Percentage, Daily Caloric limits, and Basal Metabolic Rate (BMR).</Text>
          <Text style={styles.listItem}>• Activity Tracking: Pedometer and sensor data are utilized strictly to count your real-time steps and estimate burned calories.</Text>
          <Text style={styles.listItem}>• Account Maintenance: We use your email and name (through Firebase Authentication) to securely log you in and save your configurations across devices.</Text>
          <Text style={styles.listItem}>• Community Features: If you explicitly choose to participate in our social features ("Share Profile", "Community Marketplace"), certain profile limits and user IDs are visible to your accepted friends.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Retention and Account Deletion</Text>
          <Text style={styles.paragraph}>
            We retain your personal data only for as long as is necessary for the purposes set out in this Privacy Policy.
          </Text>
          <Text style={styles.paragraph}>
            Account Deletion: You have the undeniable right to delete your personal data. You can delete your account entirely at any time directly through the App (Profile -&gt; Delete Account). Upon clicking "Delete Account", after a mandatory 10-second safety cooldown, your Firebase Authentication credentials and all corresponding primary cloud data are permanently and irrevocably deleted.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Third-Party Services</Text>
          <Text style={styles.paragraph}>We use third-party services that may collect information used to identify you:</Text>
          <Text style={styles.listItem}>• Firebase Authentication & Firestore: Used for secure login and encrypted data storage.</Text>
          <Text style={styles.listItem}>• Google Sign-in: Enables fast onboarding.</Text>
          <Text style={styles.paragraph}>
            These third-party services possess their own Privacy Policies dictating how they handle data. We do not sell, trade, or otherwise transfer your sensitive personal data to outside parties for marketing or advertising purposes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security of Data</Text>
          <Text style={styles.paragraph}>
            The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. We utilize Firebase (Google Cloud) security rules and authentication tokens to shield your data to acceptable commercial standards.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us at:
          </Text>
          <Text style={styles.contactEmail}>rainnovationsmmc@gmail.com</Text>
        </View>

        <View style={{ height: 40 }} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#1f230f',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    color: '#ccff00',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  paragraph: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  listItem: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 8,
    paddingLeft: 8,
  },
  contactEmail: {
    color: '#ccff00',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  }
});
