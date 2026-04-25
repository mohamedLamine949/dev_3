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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { ScrollView } from 'react-native';
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
  const { theme, isDark } = useTheme();
  const currentUserId = session?.user?.id;
  
  const QUICK_REPLIES = [
    "Est-ce toujours disponible ?",
    "Quel est votre dernier prix ?",
    "Où peut-on se voir ?",
    "C'est mon dernier prix.",
    "Merci !",
  ];
  
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
        if (conv) {
          setActiveConversationId(conv.id);
        } else {
          Alert.alert('Erreur', 'Impossible de démarrer la conversation. L\'annonce est peut-être introuvable.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
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
                color={item.lu ? theme.secondary : 'rgba(255,255,255,0.5)'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (resolving || (loading && messages.length === 0)) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {titrAnnonce || 'Conversation'}
          </Text>
          <Text style={styles.headerSubtitle}>{activeConversationId ? 'En ligne' : 'Nouvelle discussion'}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7}>
          <Ionicons name="call-outline" size={22} color={theme.primary} />
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

        {/* Suggestions */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsContainer}
          >
            {QUICK_REPLIES.map((text, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.suggestionChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => {
                  setInputText(text);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.suggestionText, { color: theme.textPrimary }]}>{text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceMuted }]}>
            <TextInput
              style={[styles.textInput, { color: theme.textPrimary }]}
              placeholder="Écrire un message..."
              placeholderTextColor={theme.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: theme.primary }, !inputText.trim() && { backgroundColor: theme.textMuted, shadowOpacity: 0, elevation: 0 }]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={20} color={theme.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surfaceMuted,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
    gap: SPACING.md,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },
  headerSubtitle: {
    fontSize: FONTS.xs,
    color: theme.secondary,
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
    backgroundColor: theme.surface,
    borderBottomLeftRadius: RADIUS.xs,
    ...SHADOWS.sm,
  },
  bubbleMe: {
    backgroundColor: theme.primary,
    borderBottomRightRadius: RADIUS.xs,
  },
  messageText: {
    fontSize: FONTS.md,
    color: theme.textPrimary,
    lineHeight: 21,
  },
  messageTextMe: {
    color: theme.textInverse,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: theme.textMuted,
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.6)',
  },

  // Suggestions
  suggestionsContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  suggestionChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.medium,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : 14,
    gap: SPACING.sm,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    maxHeight: 120,
  },
  textInput: {
    fontSize: FONTS.md,
    padding: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.colored,
  },
});
