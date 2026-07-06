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
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, Message } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useChat, getOrCreateConversation, useConversationPresence } from '../hooks/useChat';

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
    gap: SPACING.md,
  },
  headerInfo: {
    flex: 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surfaceMuted,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarInitial: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: theme.primary,
  },
  headerTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: theme.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: FONTS.medium,
  },
  headerSubtitleOnline: {
    color: theme.primary,
  },
  messagesList: {
    padding: SPACING.lg,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    justifyContent: 'flex-start',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
  },
  bubbleMe: {
    backgroundColor: theme.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: theme.surfaceMuted,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: FONTS.md,
    lineHeight: 20,
    color: theme.textPrimary,
  },
  messageTextMe: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
    color: theme.textMuted,
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputArea: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    paddingBottom: Platform.OS === 'ios' ? 30 : SPACING.lg,
  },
  quickReplies: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  quickReplyChip: {
    backgroundColor: theme.surfaceMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  quickReplyText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: FONTS.medium,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: theme.surfaceMuted,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? 10 : 5,
    borderWidth: 1,
    borderColor: theme.borderLight,
  },
  textInput: {
    fontSize: FONTS.md,
    color: theme.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  sendButtonDisabled: {
    backgroundColor: theme.textMuted,
    opacity: 0.5,
  },
});

export default function ChatConversationScreen({ route, navigation }: any) {
  const { conversationId: initialConvId, vendeurId, annonceId, interlocuteur } = route.params || {};
  const titreAnnonce = route.params?.titreAnnonce || route.params?.titrAnnonce;
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
  const [otherUser, setOtherUser] = useState<any>(interlocuteur || null);
  
  const { messages, loading, sendMessage } = useChat(activeConversationId, currentUserId);
  const otherOnline = useConversationPresence(activeConversationId, currentUserId);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  useEffect(() => {
    async function initConv() {
      if (!initialConvId && vendeurId && annonceId && currentUserId) {
        if (currentUserId === vendeurId) {
          setResolving(false);
          return;
        }
        const conv = await getOrCreateConversation(currentUserId, vendeurId, annonceId);
        if (conv) {
          setActiveConversationId(conv.id);
        } else {
          Alert.alert('Erreur', 'Impossible de démarrer la conversation.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      }
      setResolving(false);
    }
    initConv();
  }, [initialConvId, vendeurId, annonceId, currentUserId]);

  // Récupère le profil de l'interlocuteur s'il n'a pas été passé en paramètre
  // (ex : ouverture depuis une notification qui ne connaît que l'id de conversation)
  useEffect(() => {
    if (otherUser || !currentUserId) return;
    let cancelled = false;

    async function fetchOtherUser() {
      let otherId: string | undefined = vendeurId;
      if (!otherId && activeConversationId) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('acheteur_id, vendeur_id')
          .eq('id', activeConversationId)
          .maybeSingle();
        if (conv) {
          otherId = conv.acheteur_id === currentUserId ? conv.vendeur_id : conv.acheteur_id;
        }
      }
      if (!otherId || otherId === currentUserId) return;

      const { data } = await supabase
        .from('users')
        .select('id, prenom, nom, avatar_url')
        .eq('id', otherId)
        .maybeSingle();
      if (data && !cancelled) setOtherUser(data);
    }

    fetchOtherUser();
    return () => { cancelled = true; };
  }, [otherUser, activeConversationId, vendeurId, currentUserId]);

  const otherUserName = [otherUser?.prenom, otherUser?.nom].filter(Boolean).join(' ').trim();

  const handleSend = async (text?: string) => {
    const finalMsg = text || inputText;
    if (!finalMsg.trim() || !activeConversationId) return;

    if (!text) setInputText('');
    await sendMessage(finalMsg);
    
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
                color={item.lu ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (resolving || (loading && messages.length === 0)) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    // 'padding' sur les deux plateformes : contrairement à 'height', il ne
    // compense que le chevauchement réellement mesuré avec le clavier, donc il
    // fonctionne avec l'edge-to-edge Android que la fenêtre soit redimensionnée
    // ou non ('height' laissait le clavier cacher la saisie).
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerContent}
          activeOpacity={otherUser?.id ? 0.7 : 1}
          disabled={!otherUser?.id}
          onPress={() => {
            if (otherUser?.id) {
              navigation.navigate('VendeurProfile', { vendeurId: otherUser.id });
            }
          }}
        >
          {otherUser?.avatar_url ? (
            <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              {otherUserName ? (
                <Text style={styles.headerAvatarInitial}>{otherUserName[0].toUpperCase()}</Text>
              ) : (
                <Ionicons name="person" size={20} color={theme.textMuted} />
              )}
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {otherUserName || titreAnnonce || 'Conversation'}
            </Text>
            <Text
              style={[styles.headerSubtitle, otherOnline && styles.headerSubtitleOnline]}
              numberOfLines={1}
            >
              {otherOnline ? 'En ligne' : !activeConversationId ? 'Nouveau' : titreAnnonce || ''}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickReplies}>
          {QUICK_REPLIES.map((reply, idx) => (
            <TouchableOpacity key={idx} style={styles.quickReplyChip} onPress={() => handleSend(reply)}>
              <Text style={styles.quickReplyText}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Écrire un message..."
              placeholderTextColor={theme.textMuted}
              multiline
              value={inputText}
              onChangeText={setInputText}
            />
          </View>
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]} 
            onPress={() => handleSend()}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
