import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Conversation, Message } from '../lib/supabase';

/**
 * Hook pour récupérer les conversations d'un utilisateur
 */
export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          annonce:annonces(id, titre, prix, images:images_annonce(image_url)),
          acheteur:users!acheteur_id(id, prenom, nom, avatar_url),
          vendeur:users!vendeur_id(id, prenom, nom, avatar_url)
        `)
        .or(`acheteur_id.eq.${userId},vendeur_id.eq.${userId}`)
        .order('date_dernier_message', { ascending: false });

      if (error) throw error;
      setConversations((data as Conversation[]) || []);
    } catch (err) {
      console.error('Erreur fetchConversations:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Écouter les nouvelles conversations en temps réel
  useEffect(() => {
    if (!userId) return;

    fetchConversations();

    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `acheteur_id=eq.${userId}`,
        },
        () => fetchConversations()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `vendeur_id=eq.${userId}`,
        },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchConversations]);

  return { conversations, loading, unreadCount, refetch: fetchConversations };
}

/**
 * Hook pour les messages d'une conversation en temps réel
 */
export function useMessages(conversationId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('date_envoi', { ascending: true });

      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (err) {
      console.error('Erreur fetchMessages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Écouter les nouveaux messages en temps réel
  useEffect(() => {
    if (!conversationId) return;

    fetchMessages();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages]);

  return { messages, loading, refetch: fetchMessages };
}

/**
 * Envoyer un message dans une conversation
 */
export async function sendMessage(
  conversationId: string,
  expediteurId: string,
  contenu: string
): Promise<{ error: string | null }> {
  try {
    // 1. Insérer le message
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        expediteur_id: expediteurId,
        contenu,
      });

    if (msgError) throw msgError;

    // 2. Mettre à jour la conversation
    await supabase
      .from('conversations')
      .update({
        dernier_message: contenu,
        date_dernier_message: new Date().toISOString(),
      })
      .eq('id', conversationId);

    return { error: null };
  } catch (err: any) {
    return { error: err.message || 'Erreur lors de l\'envoi' };
  }
}

/**
 * Créer ou retrouver une conversation existante
 */
export async function getOrCreateConversation(
  acheteurId: string,
  vendeurId: string,
  annonceId: string
): Promise<{ conversationId: string | null; error: string | null }> {
  try {
    // Vérifier si une conversation existe déjà
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('acheteur_id', acheteurId)
      .eq('vendeur_id', vendeurId)
      .eq('annonce_id', annonceId)
      .single();

    if (existing) {
      return { conversationId: existing.id, error: null };
    }

    // Créer une nouvelle conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        acheteur_id: acheteurId,
        vendeur_id: vendeurId,
        annonce_id: annonceId,
      })
      .select('id')
      .single();

    if (error) throw error;

    return { conversationId: newConv?.id || null, error: null };
  } catch (err: any) {
    return { conversationId: null, error: err.message };
  }
}

/**
 * Marquer les messages comme lus
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
) {
  await supabase
    .from('messages')
    .update({ lu: true })
    .eq('conversation_id', conversationId)
    .neq('expediteur_id', userId)
    .eq('lu', false);
}
