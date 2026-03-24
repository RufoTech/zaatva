import GoogleIcon from '@/components/GoogleIcon';
import { colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { CustomAlert } from '@/utils/CustomAlert';
import {
  Alert,
  Dimensions,
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

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

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
      
      // Save user details to Firestore 'user_about'
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

        // Also save to 'users' collection to keep consistency across the app
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
      CustomAlert.show('Giriş Uğursuz', 'Google ilə daxil olarkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.');
    }
  }

  const handleRegister = async () => {
    let isValid = true;
    setNameError('');
    setEmailError('');
    setPasswordError('');

    if (fullName.trim().length < 3) {
      setNameError('Minimum 3 harfli olmalı');
      isValid = false;
    }
    if (!email.trim() || !validateEmail(email)) {
      setEmailError('Düzgün e-posta giriniz');
      isValid = false;
    }
    if (password.length < 6) {
      setPasswordError('Minimum 6 harfli olmalı');
      isValid = false;
    }

    if (!isValid) return;

    if (password !== confirmPassword) {
      CustomAlert.show('Diqqət', 'Daxil etdiyiniz şifrələr uyğun gəlmir.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Optional: Update user profile with full name
      await user.updateProfile({ displayName: fullName });

      // Save user details to Firestore 'user_about'
      await firestore().collection('user_about').doc(user.uid).set({
        fullname: fullName,
        mail: email,
        photoURL: '', // Boş qalacaq çünki e-mail ilə qeydiyyatdan keçir, sonradan əlavə edə bilər
        provider: 'email',
        createdAt: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      // Send email verification
      await user.sendEmailVerification();
      
      CustomAlert.show(
        'Qeydiyyat Uğurlu!', 
        'Hesabınız yaradıldı. Zəhmət olmasa e-poçtunuzu yoxlayaraq hesabınızı təsdiqləyin.',
        [
          { text: 'Tamam', onPress: () => router.replace('/screens/LoginScreen') }
        ]
      );
    } catch (error: any) {
      console.error(error);
      CustomAlert.show('Xəta Başı Verdi', 'Bu e-poçt ünvanı ilə artıq qeydiyyatdan keçilib və ya fərqli bir xəta var. Zəhmət olmasa bir daha yoxlayın.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.backgroundDark} />
      
      {/* Decorative background elements */}
      <View style={styles.decorativeCircleTop} />
      <View style={styles.decorativeCircleBottom} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color={colors.textMain} />
            </TouchableOpacity>
          </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start your fitness journey</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Full Name</Text>
                {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
              </View>
              <TextInput 
                style={[styles.input, nameError ? styles.inputError : null]}
                placeholder="Cavid Əliyev / John Doe"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (nameError) setNameError('');
                }}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Email</Text>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              </View>
              <TextInput 
                style={[styles.input, emailError ? styles.inputError : null]}
                placeholder="example@fitflow.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError('');
                }}
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              </View>
              <View style={styles.passwordContainer}>
                <TextInput 
                  style={[styles.input, passwordError ? styles.inputError : null, { flex: 1, paddingRight: 50 }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError('');
                  }}
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

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput 
                  style={[styles.input, { flex: 1, paddingRight: 50 }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!confirmPasswordVisible}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon} 
                  onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                >
                  <MaterialIcons 
                    name={confirmPasswordVisible ? "visibility" : "visibility-off"} 
                    size={24} 
                    color={colors.textMuted} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Register Button */}
            <TouchableOpacity 
              style={[styles.registerButton, loading && { opacity: 0.7 }]} 
              activeOpacity={0.9} 
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>{loading ? 'Signing Up...' : 'Sign Up'}</Text>
            </TouchableOpacity>

          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login */}
          <View style={styles.socialContainer}>
            <TouchableOpacity style={styles.socialButton} onPress={onGoogleButtonPress}>
              <GoogleIcon width={24} height={24} />
              <Text style={styles.socialButtonText}>Continue Google</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Link */}
          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>Log in</Text>
              </TouchableOpacity>
            </View>
            
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  decorativeCircleTop: {
    position: 'absolute',
    top: -96,
    right: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    zIndex: 0,
  },
  decorativeCircleBottom: {
    position: 'absolute',
    bottom: -96,
    left: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(204, 255, 0, 0.05)',
    zIndex: 0,
  },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
    zIndex: 1,
  },
  header: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: colors.textMain,
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  formContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textMain,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
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
  inputError: {
    borderColor: '#ff4444',
    backgroundColor: 'rgba(255, 68, 68, 0.05)',
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
  registerButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonText: {
    color: colors.backgroundDark,
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  socialContainer: {
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
    fontFamily: 'Inter_500Medium',
  },
  googleIcon: {
    width: 24,
    height: 24,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingBottom: 16,
    gap: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  footerSubText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  loginLink: {
    color: colors.primary,
    fontWeight: 'bold',
    fontFamily: 'Inter_700Bold',
  },
});
