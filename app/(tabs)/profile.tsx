import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Clipboard from 'expo-clipboard';
import firestore from '@react-native-firebase/firestore';
import crashlytics from '@react-native-firebase/crashlytics';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { CustomAlert } from '@/utils/CustomAlert';
import {
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ActivityIndicator
} from 'react-native';
// MenuItem Component
const MenuItem = ({ icon, title, onPress, isLogout = false, index = 0 }: { icon: any, title: string, onPress?: () => void, isLogout?: boolean, index?: number }) => {
  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.menuItem,
        isLogout && styles.logoutItem
      ]}
    >
      <View style={[
        styles.menuIconContainer,
        isLogout ? styles.logoutIconContainer : styles.normalIconContainer
      ]}>
        <MaterialIcons 
          name={icon} 
          size={24} 
          color={isLogout ? '#ef4444' : '#ffffff'} 
        />
      </View>
      <Text style={[
        styles.menuText,
        isLogout && styles.logoutText
      ]}>{title}</Text>
      {!isLogout && (
        <MaterialIcons name="chevron-right" size={24} color="rgba(255, 255, 255, 0.5)" />
      )}
    </TouchableOpacity>
  );
};

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth().currentUser;

  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(10);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Configure GoogleSignin to prevent 'apiClient is null' error on sign out
    GoogleSignin.configure({
      webClientId: '802032521156-plrtru1qe837u5cr60nl2p5jtsik201b.apps.googleusercontent.com',
    });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isDeleteModalVisible && deleteCountdown > 0) {
      timer = setTimeout(() => setDeleteCountdown(deleteCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [isDeleteModalVisible, deleteCountdown]);

  const handleLogout = async () => {
    try {
      await GoogleSignin.signOut();
      await auth().signOut();
      router.replace('/login');
    } catch (error) {
      console.error(error);
      CustomAlert.show('Error', 'Failed to log out');
    }
  };

  const copyToClipboard = async () => {
    if (user?.uid) {
      await Clipboard.setStringAsync(user.uid);
      CustomAlert.show("Copied!", "User ID copied to clipboard.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await firestore().collection('user_about').doc(user.uid).delete();
      await user.delete();
      router.replace('/login');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
           CustomAlert.show('Xəta', 'Hesabı silmək üçün təhlükəsizlik məqsədilə hesabdan çıxıb yenidən daxil olmalısınız.');
           await auth().signOut();
           router.replace('/login');
      } else {
           CustomAlert.show('Xəta', 'Hesab silinərkən xəta baş verdi.');
      }
    } finally {
      setIsDeleting(false);
      setDeleteModalVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f230f" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            activeOpacity={0.8}
            onPress={() => router.push('/screens/AthleteProfileScreen')}
          >
            <View style={styles.avatarBorder}>
              <Image
                source={{ uri: user?.photoURL || 'https://lh3.googleusercontent.com/aida-public/AB6AXuB8mttEzcj68e2smSHj5-Poz8YBp9ORfWqUTtNtoWy9XwTnJ25F4N4zYevqy_BGLRYFbCRZiN92UOLn7gzGV8bgwRpkTf47Qxo3NfUAv_-RySfJS7qJSWMFn8H-QHov978AOxy1qOO_vB8rBJIAh4t6VpQj2E7uWlbZiNp0LYVOLxyvTCU0MfwzjX8xr0gccyI430Vagc3vqQeUEGUi0Lk92VB698zAw6V5T8_dPSRNBdOZetPy9v5NLYEQJ3x9ezNC4zL4nzM1WZM' }}
                style={styles.avatar}
              />
            </View>
            <View style={styles.editButton}>
              <MaterialIcons name="edit" size={16} color="#1f230f" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.displayName || 'Alex Johnson'}</Text>
            <TouchableOpacity onPress={copyToClipboard} style={styles.userIdContainer}>
              <Text style={styles.userIdText} numberOfLines={1} ellipsizeMode="middle">
                ID: {user?.uid || 'N/A'}
              </Text>
              <MaterialIcons name="content-copy" size={14} color="rgba(255, 255, 255, 0.5)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu List */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuHeader}>ACCOUNT SETTINGS</Text>
          
          <MenuItem 
            icon="badge" 
            title="Account Details" 
            index={0}
            onPress={() => router.push('/screens/AthleteProfileScreen')}
          />
          <MenuItem 
            icon="emoji-events" 
            title="Achievements" 
            index={1}
            onPress={() => router.push('/screens/AchievementsScreen')}
          />
          <MenuItem 
            icon="group" 
            title="Friends" 
            index={2}
            onPress={() => router.push('/screens/FriendsScreen')}
          />
          <MenuItem 
            icon="help" 
            title="Help & Support" 
            index={3}
            onPress={() => router.push('/screens/FAQScreen')}
          />
          <MenuItem 
            icon="privacy-tip" 
            title="Privacy Policy" 
            index={4}
            onPress={() => router.push('/screens/PrivacyPolicyScreen')}
          />
          <MenuItem 
            icon="bug-report" 
            title="Test Crash" 
            index={5}
            onPress={() => {
              CustomAlert.show(
                "Test Crash", 
                "Uygulama indi qəsdən dayandırılacaq (Crash testi). Davam edilsin?",
                [
                  { text: "Ləğv et", style: "cancel" },
                  { text: "Davam et", onPress: () => crashlytics().crash() }
                ]
              );
            }}
          />
          
          <View style={styles.divider} />
          
          <MenuItem 
            icon="logout" 
            title="Logout" 
            index={6}
            isLogout 
            onPress={handleLogout} 
          />
          <MenuItem 
            icon="person-remove" 
            title="Delete Account" 
            index={7}
            isLogout 
            onPress={() => { setDeleteCountdown(10); setDeleteModalVisible(true); }} 
          />
        </View>

        {/* Bottom Padding for TabBar */}
        <View style={{ height: 100 }} />

      </ScrollView>

      {/* Delete Account Modal */}
      <Modal visible={isDeleteModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
              <MaterialIcons name="warning" size={48} color="#ef4444" />
              <Text style={styles.modalTitle}>Hesabı Sil</Text>
              <Text style={styles.modalText}>
                Hesabınızı sildikdən sonra bütün məlumatlarınız həmişəlik silinəcək. Bu əməliyyatı geri qaytarmaq mümkün deyil.
              </Text>
              
              <View style={styles.modalActions}>
                 <TouchableOpacity 
                    style={styles.modalCancelBtn} 
                    onPress={() => { setDeleteModalVisible(false); setDeleteCountdown(10); }}
                    disabled={isDeleting}
                 >
                   <Text style={styles.modalCancelText}>Ləğv et</Text>
                 </TouchableOpacity>

                 <TouchableOpacity 
                   style={[styles.modalDeleteBtn, deleteCountdown > 0 ? styles.modalDeleteBtnDisabled : null]} 
                   disabled={deleteCountdown > 0 || isDeleting}
                   onPress={handleDeleteAccount}
                 >
                   {isDeleting ? (
                     <ActivityIndicator size="small" color="#ffffff" />
                   ) : (
                     <Text style={styles.modalDeleteText}>
                       {deleteCountdown > 0 ? `Sil (${deleteCountdown}s)` : 'Hesabı Sil'}
                     </Text>
                   )}
                 </TouchableOpacity>
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
    backgroundColor: '#1f230f',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1f230f',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    // paddingHorizontal: 16,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarBorder: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: '#ccff00',
    padding: 4,
    backgroundColor: '#1f230f',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  editButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ccff00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1f230f',
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
  },
  userIdText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    maxWidth: 150, // Ensures it truncates if too long
  },
  menuContainer: {
    paddingHorizontal: 16,
    gap: 4,
  },
  menuHeader: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  logoutItem: {
    marginTop: 8,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  normalIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoutIconContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  menuText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutText: {
    color: '#ef4444',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1f230f',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
  },
  modalText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteBtnDisabled: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  modalDeleteText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
