import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, DeviceEventEmitter } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { AlertButton } from '@/utils/CustomAlert';

export default function CustomAlertModal() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<AlertButton[]>([]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('SHOW_CUSTOM_ALERT', (params) => {
      setTitle(params.title);
      setMessage(params.message || '');
      setButtons(params.buttons || []);
      setVisible(true);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
  };

  const getIcon = () => {
    const t = title.toLowerCase();
    if (t.includes('error') || t.includes('fail') || t.includes('hata')) return 'error-outline';
    if (t.includes('success') || t.includes('başarılı')) return 'check-circle-outline';
    if (t.includes('info') || t.includes('bilgi')) return 'info-outline';
    return 'warning';
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          <View style={styles.warningIconContainer}>
            <View style={styles.warningIconGlow} />
            <View style={styles.warningIconInner}>
              <MaterialIcons name={getIcon()} size={48} color={colors?.primary || '#ccff00'} />
            </View>
          </View>

          <Text style={styles.modalTitle}>
            {title}
          </Text>

          {!!message && (
            <Text style={styles.modalMessage}>
              {message}
            </Text>
          )}

          <View style={styles.modalActions}>
            {buttons && buttons.length > 0 ? (
              buttons.map((btn, index) => (
                <TouchableOpacity 
                   key={index}
                   style={[styles.actionButton, btn.style === 'cancel' && styles.cancelButton, btn.style === 'destructive' && styles.destructiveButton ]}
                   onPress={() => {
                     handleClose();
                     if (btn.onPress) {
                         // Need a small delay to allow modal to close before executing callback
                         setTimeout(() => btn.onPress!(), 100);
                     }
                   }}
                   activeOpacity={0.8}
                >
                  <Text style={[styles.actionText, btn.style === 'cancel' && styles.cancelText, btn.style === 'destructive' && styles.destructiveText]}>{btn.text}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.actionText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 24,
    fontWeight: '900',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  modalActions: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#ccff00',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#1f230f',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelText: {
    color: '#f1f5f9',
  },
  destructiveButton: {
    backgroundColor: '#ef4444',
  },
  destructiveText: {
    color: '#ffffff',
  }
});
