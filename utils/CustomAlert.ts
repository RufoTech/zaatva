import { DeviceEventEmitter } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export const CustomAlert = {
  show: (title: string, message?: string, buttons?: AlertButton[]) => {
    DeviceEventEmitter.emit('SHOW_CUSTOM_ALERT', { title, message, buttons });
  }
};
