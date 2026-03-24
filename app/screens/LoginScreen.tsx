import GoogleIcon from '@/components/GoogleIcon';
import { colors } from '@/constants/theme';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { CustomAlert } from '@/utils/CustomAlert';
import {
  Alert,
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

export default function LoginScreen() {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '802032521156-plrtru1qe837u5cr60nl2p5jtsik201b.apps.googleusercontent.com',
    });
  }, []);

  async function onGoogleButtonPress() {
    try {
      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Get the users ID token
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      
      if (!idToken) {
        throw new Error('No ID token found');
      }

      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign-in the user with the credential
      const userCredential = await auth().signInWithCredential(googleCredential);
      const user = userCredential.user;

      if (user) {
        // Force creating or updating user_about
        await firestore().collection('user_about').doc(user.uid).set({
          fullname: user.displayName || 'Google User',
          mail: user.email || '',
          photoURL: user.photoURL || '',
          provider: 'google',
          lastLoginAt: firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Force creating or updating users
        await firestore().collection('users').doc(user.uid).set({
          displayName: user.displayName || 'Google User',
          email: user.email || '',
          photoURL: user.photoURL || '',
          provider: 'google',
          lastLoginAt: firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      
      // Navigate to GoalSelection screen upon successful login
      router.replace('/screens/GoalSelectionScreen');
    } catch (error) {
      console.error(error);
      CustomAlert.show('Giriş Xətası', 'Google ilə daxil olarkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.');
    }
  }

  // Normal login fonksiyonu
  const handleNormalLogin = async () => {
    if (!email || !password) {
      setErrorModalVisible(true);
      return;
    }
    setLoading(true);
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      if (user.emailVerified) {
        router.replace('/screens/GoalSelectionScreen');
      } else {
        CustomAlert.show(
          'Təsdiqləmə Tələb Olunur',
          'Hesabınıza daxil olmaq üçün ilk öncə e-poçt ünvanınızı təsdiqləməlisiniz. E-poçtunuza göndərilən linkə daxil olun.',
          [
            { 
              text: 'Yenidən Göndər', 
              onPress: async () => {
                await user.sendEmailVerification();
                await auth().signOut();
                CustomAlert.show('Uğurlu', 'Təsdiqləmə mexrubu e-poçtunuza yenidən göndərildi.');
              }
            },
            { 
              text: 'Tamam',
              style: 'cancel',
              onPress: async () => await auth().signOut()
            }
          ]
        );
      }
    } catch (error: any) {
      console.error(error);
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.backgroundDark} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Error Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={errorModalVisible}
          onRequestClose={() => setErrorModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              
              {/* Warning Icon */}
              <View style={styles.warningIconContainer}>
                <View style={styles.warningIconGlow} />
                <View style={styles.warningIconInner}>
                  <MaterialIcons name="warning" size={48} color={colors.primary} />
                </View>
              </View>

              {/* Title */}
              <Text style={styles.modalTitle}>
                Login <Text style={styles.modalTitleHighlight}>Failed</Text>
              </Text>

              {/* Message */}
              <Text style={styles.modalMessage}>
                Incorrect email or password. Please try again or reset your password.
              </Text>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.tryAgainButton}
                  onPress={() => setErrorModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.tryAgainText}>TRY AGAIN</Text>
                  <MaterialIcons name="refresh" size={20} color={colors.backgroundDark} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalForgotButton}
                  onPress={() => {
                    setErrorModalVisible(false);
                    router.push('/screens/ForgotPasswordScreen');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalForgotText}>FORGOT PASSWORD?</Text>
                </TouchableOpacity>
              </View>

              {/* Decorative Line */}
              <View style={styles.modalDecoration}>
                <View style={styles.modalDecoLine} />
                <Text style={styles.modalDecoText}>SYSTEM.ERROR_0x401</Text>
                <View style={styles.modalDecoLine} />
              </View>

            </View>
          </View>
        </Modal>

        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>GreenFit</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Welcome</Text>
          <Text style={styles.heroSubtitle}>Continue your workout journey</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          
          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email or Phone</Text>
            <TextInput 
              style={styles.input}
              placeholder="example@fitflow.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput 
                style={[styles.input, { flex: 1, paddingRight: 50 }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setPasswordVisible(!passwordVisible)}
              >
                <MaterialIcons 
                  name={passwordVisible ? "visibility" : "visibility-off"} 
                  size={24} 
                  color={colors.textMuted} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity 
            style={styles.forgotButton}
            onPress={() => router.push('/screens/ForgotPasswordScreen')}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Main Login Button */}
          <TouchableOpacity 
            style={[styles.loginButton, loading && { opacity: 0.7 }]} 
            activeOpacity={0.9} 
            onPress={handleNormalLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>{loading ? 'Logging in...' : 'Login'}</Text>
          </TouchableOpacity>

        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}> OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Logins */}
        <View style={styles.socialContainer}>
          <TouchableOpacity style={styles.socialButton} onPress={onGoogleButtonPress}>
            <GoogleIcon width={24} height={24} />
            <Text style={styles.socialButtonText}>Continue Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialButton}>
            <FontAwesome name="facebook" size={24} color="#1877F2" />
            <Text style={styles.socialButtonText}>Continue Facebook</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.socialButton}>
              <FontAwesome name="apple" size={24} color={colors.textMain} />
              <Text style={styles.socialButtonText}>Continue Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.signUpText}>Sign up</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textMain,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  formContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textMain,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  loginButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: colors.backgroundDark,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter_700Bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  socialContainer: {
    gap: 12,
    marginBottom: 32,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    height: 56,
    borderRadius: 12,
    gap: 12,
  },
  socialButtonText: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  googleIcon: {
    width: 24,
    height: 24,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 16,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  signUpText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1e2114',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 73, 60, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  warningIconContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningIconGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    borderRadius: 40,
  },
  warningIconInner: {
    width: 80,
    height: 80,
    backgroundColor: '#242719',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.3)',
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textMain,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontFamily: 'Inter_700Bold',
    fontStyle: 'italic',
    letterSpacing: -1,
  },
  modalTitleHighlight: {
    color: colors.primary,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 16,
  },
  modalActions: {
    width: '100%',
    gap: 16,
  },
  tryAgainButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tryAgainText: {
    color: colors.backgroundDark,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  modalForgotButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForgotText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  modalDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    opacity: 0.3,
  },
  modalDecoLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.textMuted,
  },
  modalDecoText: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 4,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
    fontFamily: 'Inter_400Regular',
  },
});
