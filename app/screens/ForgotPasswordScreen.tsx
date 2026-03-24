import { colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import auth from '@react-native-firebase/auth';
import React, { useState } from 'react';
import { openInbox } from 'react-native-email-link';
import { CustomAlert } from '@/utils/CustomAlert';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [invalidEmailModalVisible, setInvalidEmailModalVisible] = useState(false);

  const handleOpenEmailApp = async () => {
    try {
      await openInbox();
    } catch {
      const mailtoUrl = 'mailto:';
      try {
        const supported = await Linking.canOpenURL(mailtoUrl);
        if (supported) {
          await Linking.openURL(mailtoUrl);
          return;
        }
      } catch {
      }
      CustomAlert.show(
        'E-poçt Tətbiqi Açılmadı',
        'Cihazınızda e-poçt tətbiqi tapılmadı. Lütfən poçt qutunuzu özünüz açaraq gələn mailləri yoxlayın.'
      );
    }
  };

  const handleSendResetLink = async () => {
    if (!email) {
      CustomAlert.show('Xəta', 'Zəhmət olmasa e-poçt ünvanınızı daxil edin.');
      return;
    }
    setLoading(true);
    try {
      await auth().sendPasswordResetEmail(email);
      setSuccessModalVisible(true);
    } catch (error: any) {
      console.error(error);
      let errorMessage = 'Link göndərilərkən xəta baş verdi. Yenidən cəhd edin.';
      if (error.code === 'auth/invalid-email') {
        setInvalidEmailModalVisible(true);
        return;
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Bu e-poçt ünvanına aid istifadəçi tapılmadı.';
      }
      CustomAlert.show('Uğursuz Əməliyyat', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.backgroundDark} />

      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalKineticLayer}>
            <View style={styles.modalKineticBlobA} />
            <View style={styles.modalKineticBlobB} />
          </View>

          <View style={styles.modalHeader}>
            <Text style={styles.modalBrand}>GREENFIT</Text>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.modalIconOuterGlow} />
            <View style={styles.modalIconCard}>
              <MaterialIcons name="mark-email-read" size={56} color={colors.primary} />
            </View>

            <View style={styles.modalTextBlock}>
              <Text style={styles.modalTitle}>
                LINK <Text style={styles.modalTitleHighlight}>SENT!</Text>
              </Text>
              <Text style={styles.modalDescription}>
                We have sent a password reset link to your email address. Please follow the instructions to get back to your workout.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                activeOpacity={0.9}
                onPress={handleOpenEmailApp}
              >
                <Text style={styles.modalPrimaryButtonText}>OPEN EMAIL APP</Text>
                <MaterialIcons name="open-in-new" size={18} color={colors.backgroundDark} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryButton}
                activeOpacity={0.8}
                onPress={() => {
                  setSuccessModalVisible(false);
                  router.back();
                }}
              >
                <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={styles.modalSecondaryButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={invalidEmailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInvalidEmailModalVisible(false)}
      >
        <View style={styles.errorModalBackdrop}>
          <View style={styles.errorModalHeader}>
            <View style={styles.errorModalHeaderLeft}>
              <TouchableOpacity
                onPress={() => setInvalidEmailModalVisible(false)}
                accessibilityLabel="Close"
                style={styles.errorModalCloseButton}
              >
                <MaterialIcons name="close" size={22} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.errorModalHeaderTitle}>AUTHENTICATION</Text>
            </View>
          </View>

          <View style={styles.errorModalCard}>
            <View style={styles.errorModalStack}>
              <View style={styles.errorModalIconGlow} />
              <View style={styles.errorModalIconCircle}>
                <MaterialIcons name="error" size={40} color={colors.primary} />
              </View>

              <View style={styles.errorModalTextStack}>
                <Text style={styles.errorModalTitle}>INVALID EMAIL FORMAT</Text>
                <Text style={styles.errorModalDescription}>
                  Please enter a valid email address (e.g.,{' '}
                  <Text style={styles.errorModalExample}>name@example.com</Text>) to continue.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setInvalidEmailModalVisible(false)}
                style={styles.errorModalPrimaryButton}
              >
                <LinearGradient
                  colors={["#f3ffca", colors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.errorModalPrimaryGradient}
                >
                  <Text style={styles.errorModalPrimaryText}>GOT IT</Text>
                  <MaterialIcons name="arrow-forward" size={20} color={colors.backgroundDark} />
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.errorModalTopRightAccent} />
              <View style={styles.errorModalBottomAccent} />
            </View>
          </View>
        </View>
      </Modal>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header / Back Button */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.backButton}
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back" size={28} color={colors.textMain} />
            </TouchableOpacity>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>
                Forgot {'\n'}
                <Text style={styles.titleHighlight}>Password</Text>
              </Text>
              <Text style={styles.description}>
                Enter your email address to receive a password reset link
              </Text>
            </View>

            {/* Image/Visual Element */}
            <View style={styles.imageContainer}>
              <View style={styles.imageOverlay} />
              <Image 
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-w6WSr7rGlb5LdVKUEr6lyY1AhW1sF8_NyzkAjoO9BKGEVnZFM_npA5Y_Mc7F39Ke7Hn15o9A8aSuqEZw23L_R011Vs3rs5tvT4VN_EznGyg421e8xgOcsdLrK1GjFbH5cndUvCDvzge-vYx2ponKOFeKhiSPO51nQtQOOnK_3LGUkLLQw061bn5xABneE7IXCnnW92k8ZVBWEHm2EKrs5XjUNMLf6ZxdtXe6iYs9sfyeAkP4Fo1YG2hQjYpEU1H1gzLE43RvszE' }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="mail" size={24} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input}
                    placeholder="yourname@email.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity 
                style={[styles.submitButton, loading && { opacity: 0.7 }]}
                activeOpacity={0.9}
                onPress={handleSendResetLink}
                disabled={loading || successModalVisible || invalidEmailModalVisible}
              >
                <Text style={styles.submitButtonText}>{loading ? 'Sending...' : 'Send Reset Link'}</Text>
                {!loading && <MaterialIcons name="send" size={20} color={colors.backgroundDark} />}
              </TouchableOpacity>
            </View>

            {/* Footer Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Remember your password? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* Decorative Elements (simulated with absolute views if needed, but keeping clean for now as per RN best practices) */}
          
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  modalKineticLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  modalKineticBlobA: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 520,
    left: -240,
    top: -180,
    backgroundColor: 'rgba(204, 255, 0, 0.10)',
    opacity: 0.35,
  },
  modalKineticBlobB: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 520,
    right: -240,
    bottom: -220,
    backgroundColor: 'rgba(204, 255, 0, 0.08)',
    opacity: 0.25,
  },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBrand: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    fontStyle: 'italic',
    fontFamily: 'Inter_800ExtraBold',
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  modalIconOuterGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(204, 255, 0, 0.16)',
    top: -6,
    opacity: 0.6,
  },
  modalIconCard: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#0f1207',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTextBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  modalTitle: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
    textTransform: 'uppercase',
    color: colors.textMain,
    fontFamily: 'Inter_800ExtraBold',
  },
  modalTitleHighlight: {
    color: colors.primary,
    fontStyle: 'italic',
  },
  modalDescription: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
  },
  modalActions: {
    width: '100%',
    gap: 14,
  },
  modalPrimaryButton: {
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  modalPrimaryButtonText: {
    color: colors.backgroundDark,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Inter_800ExtraBold',
  },
  modalSecondaryButton: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalSecondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontFamily: 'Inter_800ExtraBold',
  },
  errorModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 15, 6, 0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  errorModalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  errorModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  errorModalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.primary,
    textTransform: 'uppercase',
    fontFamily: 'Inter_800ExtraBold',
  },
  errorModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: colors.primary,
    shadowOpacity: 0.20,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: 'hidden',
  },
  errorModalStack: {
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorModalIconGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(204, 255, 0, 0.18)',
    top: -30,
    opacity: 0.6,
  },
  errorModalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  errorModalTextStack: {
    alignItems: 'center',
    marginBottom: 22,
  },
  errorModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    textTransform: 'uppercase',
    color: colors.textMain,
    fontFamily: 'Inter_800ExtraBold',
    textAlign: 'center',
  },
  errorModalDescription: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    fontFamily: 'Inter_400Regular',
  },
  errorModalExample: {
    color: colors.textMain,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  errorModalPrimaryButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  errorModalPrimaryGradient: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  errorModalPrimaryText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: 'Inter_800ExtraBold',
  },
  errorModalTopRightAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 72,
    height: 72,
    backgroundColor: 'rgba(204, 255, 0, 0.06)',
    borderBottomLeftRadius: 72,
  },
  errorModalBottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 120,
    height: 4,
    backgroundColor: colors.primary,
    opacity: 0.25,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    paddingVertical: 16,
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 8,
    marginLeft: -8, // Align icon with content
  },
  mainContent: {
    flex: 1,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  titleSection: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colors.textMain,
    lineHeight: 48,
    fontFamily: 'Inter_700Bold',
  },
  titleHighlight: {
    color: colors.primary,
  },
  description: {
    fontSize: 18,
    color: colors.textMuted, // Using muted for description as per theme usage, or closer to slate-400
    marginTop: 16,
    lineHeight: 28,
    fontFamily: 'Inter_400Regular',
  },
  imageContainer: {
    width: '100%',
    height: 192, // 48 * 4
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 24,
    position: 'relative',
    backgroundColor: '#1e293b', // Placeholder bg
  },
  image: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(204, 255, 0, 0.1)', // primary/20
    zIndex: 1,
  },
  formSection: {
    gap: 24,
    paddingVertical: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMain,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Inter_600SemiBold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // slate-800/50 approx
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    // In RN we handle focus styling via state if needed, simplified here
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color: colors.textMain,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  submitButtonText: {
    color: colors.backgroundDark,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter_700Bold',
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  loginLink: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
    fontFamily: 'Inter_700Bold',
  },
});
