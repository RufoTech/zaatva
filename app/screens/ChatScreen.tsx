import { Feather, MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { CustomAlert } from '@/utils/CustomAlert';
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const BG_DARK = "#0d0f06";
const PRIMARY = "#ccff00";
const SURFACE_CONTAINER = "#181b0f";
const SURFACE_CONTAINER_HIGH = "#1e2114";
const TEXT_WHITE = "#fdfdec";
const TEXT_MUTED = "#abac9c";

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export default function ChatScreen() {
  const router = useRouter();
  const { friendId, friendName, friendPhoto } = useLocalSearchParams();
  const user = auth().currentUser;

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Sharing states
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isPickerModalVisible, setIsPickerModalVisible] = useState(false);
  const [shareType, setShareType] = useState<'workout' | 'program'>('workout');
  const [userItems, setUserItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});

  // Generate a unique chatId based on both UIDs
  const getChatId = () => {
    if (!user || !friendId) return '';
    return user.uid > String(friendId)
      ? `${user.uid}_${friendId}`
      : `${friendId}_${user.uid}`;
  };

  const chatId = getChatId();

  useEffect(() => {
    if (!chatId) return;

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const unsubscribe = firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .where('createdAt', '>=', firestore.Timestamp.fromDate(yesterday))
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        if (!snapshot) return;
        
        const loadedMessages = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Mark as read if the current user is not the sender and it's not read yet
          if (data.senderId !== user?.uid && data.status !== 'read') {
            doc.ref.update({ status: 'read' });
          }

          return {
            id: doc.id,
            ...data
          };
        });
        setMessages(loadedMessages);
      });

    return () => unsubscribe();
  }, [chatId]);

  const sendPushNotification = async (text: string) => {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      await fetch(`${API_URL}/api/notifications/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receiverId: friendId,
          senderName: user.displayName || user.email || 'A Friend',
          text: text
        })
      });
    } catch (e) {
      console.error("Error sending push notification:", e);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !chatId) return;

    const messageData = {
      text: inputText.trim(),
      senderId: user.uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
      status: 'sent', // 'sent', 'delivered', 'read'
    };

    setInputText('');
    
    try {
      await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .add(messageData);

      // Optionally update latest message in the chat document
      await firestore().collection('chats').doc(chatId).set({
        lastMessage: messageData.text,
        lastMessageTime: messageData.createdAt,
        participants: [user.uid, friendId]
      }, { merge: true });

      // Trigger push notification to the receiver securely via backend
      sendPushNotification(messageData.text);

    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const openItemPicker = async (type: 'workout' | 'program') => {
    setShareType(type);
    setIsShareModalVisible(false);
    setIsPickerModalVisible(true);
    setLoadingItems(true);

    try {
      if (!user) return;
      const collectionName = type === 'program' ? 'user_programs' : 'customUserWorkouts';
      const snapshot = await firestore()
        .collection(collectionName)
        .where('userId', '==', user.uid)
        .get();

      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setUserItems(items);
    } catch (error) {
      console.error("Error fetching items to share:", error);
    } finally {
      setLoadingItems(false);
    }
  };

  const shareItem = async (item: any) => {
    setIsPickerModalVisible(false);
    if (!user || !chatId) return;

    const messageData = {
      text: `Shared a ${shareType === 'program' ? 'Monthly Program' : 'Workout'}: ${item.name || item.title || 'Item'}`,
      senderId: user.uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
      status: 'sent',
      type: 'shared_item',
      sharedItem: {
        id: item.id,
        type: shareType,
        name: item.name || item.title || 'Untitled',
        coverImage: item.coverImage || item.image || null,
      }
    };

    try {
      await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .add(messageData);

      await firestore().collection('chats').doc(chatId).set({
        lastMessage: "Shared an item",
        lastMessageTime: firestore.FieldValue.serverTimestamp(),
        participants: [user.uid, friendId]
      }, { merge: true });

      // Trigger push notification to the receiver securely via backend
      sendPushNotification(messageData.text);

    } catch (error) {
      console.error("Error sharing item:", error);
    }
  };

  const handleSaveSharedItem = async (messageId: string, sharedItem: any) => {
    if (!user || !chatId) return;

    try {
      if (sharedItem.type === 'program') {
        const progDoc = await firestore().collection('user_programs').doc(sharedItem.id).get();
        if (!progDoc.exists) {
          CustomAlert.show("Error", "This program no longer exists.");
          return;
        }

        const newProgRef = firestore().collection('user_programs').doc();
        await newProgRef.set({
          ...progDoc.data(),
          userId: user.uid,
          createdAt: firestore.FieldValue.serverTimestamp()
        });

        const weeksDoc = await firestore().collection('user_program_weeks').doc(sharedItem.id).get();
        if (weeksDoc.exists) {
          await firestore().collection('user_program_weeks').doc(newProgRef.id).set({
            ...weeksDoc.data(),
            userId: user.uid
          });
        }

        CustomAlert.show("Success", "Program saved to your library!");
      } else {
        const workoutDoc = await firestore().collection('customUserWorkouts').doc(sharedItem.id).get();
        if (!workoutDoc.exists) {
          CustomAlert.show("Error", "This workout no longer exists.");
          return;
        }

        await firestore().collection('customUserWorkouts').add({
          ...workoutDoc.data(),
          userId: user.uid,
          createdAt: firestore.FieldValue.serverTimestamp()
        });

        CustomAlert.show("Success", "Workout saved to your library!");
      }

      // Update the specific message in Firestore to mark it as saved by this user
      await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .doc(messageId)
        .update({
          [`savedBy_${user.uid}`]: true
        });

    } catch (error) {
      console.error("Error saving shared item:", error);
      CustomAlert.show("Error", "Could not save the item.");
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === user?.uid;
    const isSavedByMe = item[`savedBy_${user?.uid}`] === true;

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperFriend]}>
        {!isMe && (
          <Image source={{ uri: String(friendPhoto) }} style={styles.messageAvatar} />
        )}
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleFriend]}>
          
          {/* Shared Item Card */}
          {item.type === 'shared_item' && item.sharedItem && (
            <View style={styles.sharedItemCard}>
              {item.sharedItem.coverImage ? (
                <Image source={{ uri: item.sharedItem.coverImage }} style={styles.sharedItemImage} />
              ) : (
                <View style={[styles.sharedItemImage, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <MaterialIcons name="fitness-center" size={24} color={TEXT_MUTED} />
                </View>
              )}
              <View style={styles.sharedItemInfo}>
                <Text style={styles.sharedItemType}>
                  {item.sharedItem.type === 'program' ? 'MONTHLY PROGRAM' : 'WORKOUT'}
                </Text>
                <Text style={styles.sharedItemTitle} numberOfLines={2}>
                  {item.sharedItem.name}
                </Text>
                
                {!isMe && (
                  <TouchableOpacity 
                    style={[styles.saveSharedButton, isSavedByMe && { backgroundColor: '#4a5e00' }]}
                    onPress={() => !isSavedByMe && handleSaveSharedItem(item.id, item.sharedItem)}
                    disabled={isSavedByMe}
                  >
                    <Feather 
                      name={isSavedByMe ? "check" : "download"} 
                      size={14} 
                      color={isSavedByMe ? PRIMARY : "#1f230f"} 
                    />
                    <Text style={[styles.saveSharedButtonText, isSavedByMe && { color: PRIMARY }]}>
                      {isSavedByMe ? "Saved" : "Save to Library"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={styles.messageContentRow}>
            <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextFriend, item.type === 'shared_item' && { fontStyle: 'italic', marginTop: 8 }]}>
              {item.text}
            </Text>
            {isMe && (
              <View style={styles.statusIconContainer}>
                <MaterialIcons 
                  name="done-all" 
                  size={16} 
                  color={item.status === 'read' ? '#3b82f6' : 'rgba(13, 15, 6, 0.4)'} 
                />
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        
        <View style={styles.headerUserInfo}>
          <Image source={{ uri: String(friendPhoto) }} style={styles.headerAvatar} />
          <Text style={styles.headerName}>{friendName}</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          inverted={true} // Newest messages at bottom
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() => (
            <View style={{ padding: 16, alignItems: 'center', marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              <MaterialIcons name="timer" size={16} color={TEXT_MUTED} style={{ marginBottom: 4 }} />
              <Text style={{ color: TEXT_MUTED, fontSize: 12, textAlign: 'center' }}>
                Mesajlar 24 saatdan sonra avtomatik silinir.
              </Text>
            </View>
          )}
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={() => setIsShareModalVisible(true)}
          >
            <MaterialIcons name="add" size={24} color={PRIMARY} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={TEXT_MUTED}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]} 
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <MaterialIcons name="send" size={20} color={BG_DARK} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Share Options Modal */}
      <Modal
        visible={isShareModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsShareModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsShareModalVisible(false)}>
          <View style={styles.shareMenuContainer}>
            <Text style={styles.shareMenuTitle}>Share with {friendName}</Text>
            
            <TouchableOpacity style={styles.shareOptionButton} onPress={() => openItemPicker('workout')}>
              <View style={styles.shareOptionIcon}>
                <MaterialIcons name="fitness-center" size={24} color={PRIMARY} />
              </View>
              <View>
                <Text style={styles.shareOptionTitle}>Workout Program</Text>
                <Text style={styles.shareOptionSubtitle}>Share a single custom workout</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOptionButton} onPress={() => openItemPicker('program')}>
              <View style={styles.shareOptionIcon}>
                <MaterialIcons name="event-note" size={24} color={PRIMARY} />
              </View>
              <View>
                <Text style={styles.shareOptionTitle}>Monthly Workout</Text>
                <Text style={styles.shareOptionSubtitle}>Share a full weekly/monthly program</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Item Picker Modal */}
      <Modal
        visible={isPickerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPickerModalVisible(false)}
      >
        <View style={styles.pickerModalContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>
              Select {shareType === 'program' ? 'Monthly Program' : 'Workout'}
            </Text>
            <TouchableOpacity onPress={() => setIsPickerModalVisible(false)}>
              <MaterialIcons name="close" size={24} color={TEXT_WHITE} />
            </TouchableOpacity>
          </View>

          {loadingItems ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: TEXT_MUTED }}>Loading your items...</Text>
            </View>
          ) : userItems.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: TEXT_MUTED }}>You don't have any {shareType}s to share.</Text>
            </View>
          ) : (
            <FlatList
              data={userItems}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.pickerItem}
                  onPress={() => shareItem(item)}
                >
                  {item.coverImage || item.image ? (
                    <Image source={{ uri: item.coverImage || item.image }} style={styles.pickerItemImage} />
                  ) : (
                    <View style={[styles.pickerItemImage, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                      <MaterialIcons name="image" size={24} color={TEXT_MUTED} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemTitle}>{item.name || item.title || 'Untitled'}</Text>
                    <Text style={styles.pickerItemSubtitle}>
                      {shareType === 'program' ? `${item.workoutCount || 0} workouts` : `${item.duration || 0} mins`}
                    </Text>
                  </View>
                  <MaterialIcons name="send" size={20} color={PRIMARY} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: SURFACE_CONTAINER_HIGH,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerName: {
    color: TEXT_WHITE,
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    gap: 16,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    maxWidth: '80%',
  },
  messageWrapperMe: {
    alignSelf: 'flex-end',
  },
  messageWrapperFriend: {
    alignSelf: 'flex-start',
    gap: 8,
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  messageBubbleMe: {
    backgroundColor: PRIMARY,
    borderBottomRightRadius: 4,
  },
  messageBubbleFriend: {
    backgroundColor: SURFACE_CONTAINER,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextMe: {
    color: BG_DARK,
    fontWeight: '500',
  },
  messageTextFriend: {
    color: TEXT_WHITE,
  },
  messageContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  statusIconContainer: {
    marginLeft: 6,
    marginBottom: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: SURFACE_CONTAINER_HIGH,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: SURFACE_CONTAINER,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    color: TEXT_WHITE,
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedItemCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sharedItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  sharedItemInfo: {
    flex: 1,
  },
  sharedItemType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: PRIMARY,
    letterSpacing: 1,
    marginBottom: 4,
  },
  sharedItemTitle: {
    color: TEXT_WHITE,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  saveSharedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  saveSharedButtonText: {
    color: '#1f230f',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  shareMenuContainer: {
    backgroundColor: SURFACE_CONTAINER_HIGH,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  shareMenuTitle: {
    color: TEXT_WHITE,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  shareOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 16,
  },
  shareOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(204,255,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareOptionTitle: {
    color: TEXT_WHITE,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  shareOptionSubtitle: {
    color: TEXT_MUTED,
    fontSize: 13,
  },
  pickerModalContainer: {
    flex: 1,
    backgroundColor: BG_DARK,
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pickerTitle: {
    color: TEXT_WHITE,
    fontSize: 18,
    fontWeight: 'bold',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_CONTAINER,
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  pickerItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  pickerItemTitle: {
    color: TEXT_WHITE,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  pickerItemSubtitle: {
    color: TEXT_MUTED,
    fontSize: 13,
  },
});