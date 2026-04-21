import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { Message } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useChat, getOrCreateConversation } from '../hooks/useChat';

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  route: any;
  navigation: any;
}

export default function ChatConversationScreen({ route, navigation }: Props) {
  const { conversationId: initialConvId, titrAnnonce, vendeurId, annonceId } = route.params || {};
  const { session } = useAuth();
  const currentUserId = session?.user?.id;
  
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(initialConvId);
  const [resolving, setResolving] = useState(!initialConvId);
  
  const { messages, loading, sendMessage } = useChat(activeConversationId, currentUserId);
  
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Initialize conversation if needed
  useEffect(() => {
    async function initConv() {
      if (!initialConvId && vendeurId && annonceId && currentUserId) {
        if (currentUserId === vendeurId) {
          // Si l'utilisateur clique sur sa propre annonce pour la contacter
          setResolving(false);
          return;
        }
        const conv = await getOrCreateConversation(currentUserId, vendeurId, annonceId);
        if (conv) setActiveConversationId(conv.id);
      }
      setResolving(false);
    }
    
    initConv();
  }, [initialConvId, vendeurId, annonceId, currentUserId]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeConversationId) return;

    const textToSend = inputText;
    setInputText(''); // Optimistic clear
    
    await sendMessage(textToSend);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.expediteur_id === currentUserId;

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.contenu}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
              {formatTime(item.date_envoi)}
            </Text>
            {isMe && (
              <Ionicons
                name={item.lu ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.lu ? COLORS.secondary : 'rgba(255,255,255,0.5)'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (resolving || loading && messages.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {titrAnnonce || 'Conversation'}
          </Text>
          <Text style={styles.headerSubtitle}>{activeConversationId ? 'En ligne' : 'Nouvelle discussion'}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7}>
          <Ionicons name="call-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Écrire un message..."
              placeholderTextColor={COLORS.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={20} color={COLORS.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceMuted,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FONTS.xs,
    color: COLORS.secondary,
    marginTop: 1,
  },

  // Messages
  messagesList: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
    justifyContent: 'flex-start',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: RADIUS.xs,
    ...SHADOWS.sm,
  },
  bubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: RADIUS.xs,
  },
  messageText: {
    fontSize: FONTS.md,
    color: COLORS.textPrimary,
    lineHeight: 21,
  },
  messageTextMe: {
    color: COLORS.textInverse,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.6)',
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: 34,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    maxHeight: 120,
  },
  textInput: {
    fontSize: FONTS.md,
    color: COLORS.textPrimary,
    padding: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.colored,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
});
