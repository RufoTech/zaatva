import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { LinearGradient } from 'expo-linear-gradient';
import { CustomAlert } from '@/utils/CustomAlert';

const BG_DARK = "#0d0f06";
const PRIMARY = "#ccff00";
const PRIMARY_GRADIENT_END = "#f3ffca";
const SURFACE_CONTAINER_LOWEST = "#000000";
const SURFACE_CONTAINER = "#181b0f";
const SURFACE_CONTAINER_HIGHEST = "#242719";
const TEXT_WHITE = "#fdfdec";
const TEXT_MUTED = "#abac9c";
const OUTLINE_VARIANT = "rgba(71, 73, 60, 0.3)";

export default function EditProfileScreen() {
  const router = useRouter();
  const currentUser = auth().currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Pro');
  const [photoURL, setPhotoURL] = useState('https://via.placeholder.com/150');

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;

      try {
        setFullName(currentUser.displayName || '');
        setPhotoURL(currentUser.photoURL || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDkeD_x2r3ljVDNoPYwntP1R3Nzn_InP6fDV7VXBU7agK8fAnge6HiLd_1POYdHdeLVPQP0BBAZ9-sPetpEBpN7zaEed1-_aY0H7vob3v_7E5fL_v7BAVoUHgKmsplNxwAJ5i4fUZNLS4Kwl-quflGIesXkcw7mYJLZ8xbJrbDDXm31K7zGuxSdHbRPvx2ssD7fUJE6GHA5yiZRJKQn1qFPVzEgNJ1i1spzrSjRgkSDMJXuCDZoVGnvKz46SRH-f8lPymzAL2V2W_s');

        const userDoc = await firestore().collection('user_about').doc(currentUser.uid).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          if (data?.fullname) setFullName(data.fullname);
          if (data?.bio) setBio(data.bio);
          if (data?.experienceLevel) setExperienceLevel(data.experienceLevel);
          if (data?.avatar) setPhotoURL(data.avatar);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    
    try {
      // Update Auth Profile
      await currentUser.updateProfile({
        displayName: fullName,
      });

      // Update Firestore user_about
      await firestore().collection('user_about').doc(currentUser.uid).set({
        fullname: fullName,
        bio: bio,
        experienceLevel: experienceLevel,
      }, { merge: true });

      // Assuming there's a wider "users" table that may also need the name
      await firestore().collection('users').doc(currentUser.uid).set({
        fullname: fullName,
      }, { merge: true });

      CustomAlert.show("Success", "Profile updated successfully!");
      router.back();
    } catch (error) {
      console.error("Error saving profile:", error);
      CustomAlert.show("Error", "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    router.back();
  };

  const toggleExperienceLevel = () => {
    // Simple rotation of experience levels for UX, since real Picker isn't standard here
    const levels = ['Beginner', 'Intermediate', 'Pro', 'Elite'];
    const currentIndex = levels.indexOf(experienceLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    setExperienceLevel(levels[nextIndex]);
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
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity hitSlop={{top:10, bottom:10, left:10, right:10}} onPress={handleDiscard}>
              <MaterialIcons name="arrow-back" size={24} color={TEXT_MUTED} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>EDIT PROFILE</Text>
          </View>
          <Text style={styles.logoText}>GREENFIT</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: photoURL }} style={styles.avatar} />
              <TouchableOpacity style={styles.editIconBtn}>
                <MaterialIcons name="edit" size={16} color="#4a5e00" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity>
              <Text style={styles.changePhotoText}>CHANGE PHOTO</Text>
            </TouchableOpacity>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={TEXT_MUTED}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            {/* Bio */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>BIO</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Share your fitness philosophy..."
                  placeholderTextColor={TEXT_MUTED}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Experience Level */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EXPERIENCE LEVEL</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={toggleExperienceLevel} style={styles.inputWrapper}>
                <View style={[styles.input, { justifyContent: 'center' }]}>
                  <Text style={{ color: TEXT_WHITE, fontSize: 16 }}>{experienceLevel}</Text>
                </View>
              </TouchableOpacity>
            </View>

          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <LinearGradient
                colors={[PRIMARY, PRIMARY_GRADIENT_END]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtnGradient}
              >
                {saving ? (
                  <ActivityIndicator color={BG_DARK} />
                ) : (
                  <>
                    <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
                    <MaterialIcons name="bolt" size={20} color={BG_DARK} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.discardBtn}
              onPress={handleDiscard}
            >
              <Text style={styles.discardBtnText}>DISCARD CHANGES</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(13, 15, 6, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(204, 255, 0, 0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTitle: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  logoText: {
    color: PRIMARY,
    fontSize: 18,
    fontStyle: 'italic',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 128,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  avatarContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: '#cafd00',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  editIconBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#cafd00',
    padding: 8,
    borderRadius: 20,
  },
  changePhotoText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  formSection: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginLeft: 4,
  },
  inputWrapper: {
    backgroundColor: SURFACE_CONTAINER_LOWEST,
    padding: 1,
    borderRadius: 8,
  },
  input: {
    backgroundColor: SURFACE_CONTAINER,
    color: TEXT_WHITE,
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 7,
  },
  textArea: {
    minHeight: 120,
  },
  actionSection: {
    marginTop: 32,
    gap: 16,
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 8,
    gap: 12,
  },
  saveBtnText: {
    color: BG_DARK,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  discardBtn: {
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: OUTLINE_VARIANT,
    borderRadius: 8,
    alignItems: 'center',
  },
  discardBtnText: {
    color: TEXT_MUTED,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
