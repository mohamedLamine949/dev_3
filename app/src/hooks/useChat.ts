import { useState, useEffect, useCallback } from 'react';
import { supabase, Conversation, Message } from '../lib/supabase';

/**
 * Récupère la liste des conversations de l'utilisateur actif
 */
export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Récupérer toutes les conversations où l'utilisateur est soit acheteur, soit vendeur
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          annonce:annonces(*, images:images_annonce(*))
        `)
        .or(`acheteur_id.eq.${userId},vendeur_id.eq.${userId}`)
        .order('date_dernier_message', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      console.error('Erreur fetchConversations:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConversations();

    if (!userId) return;

    // S'abonner aux changements sur la table conversations
    const channel = supabase
      .channel('public:conversations')
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

  return { conversations, loading, refetch: fetchConversations };
}

/**
 * Gère une conversation spécifique (messages en temps réel)
 */
export function useChat(conversationId: string | undefined, currentUserId: string | undefined) {
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
        .order('date_envoi', { ascending: true }); // ASC pour afficher le plus ancien en haut

      if (error) throw error;
      setMessages(data || []);
      
      // Marquer comme lu
      if (currentUserId && data && data.length > 0) {
        const unreadMsgIds = data.filter(m => !m.lu && m.expediteur_id !== currentUserId).map(m => m.id);
        if (unreadMsgIds.length > 0) {
          await supabase.from('messages').update({ lu: true }).in('id', unreadMsgIds);
        }
      }
    } catch (err) {
      console.error('Erreur fetchMessages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    fetchMessages();

    if (!conversationId) return;

    // Abonnement temps réel aux NOUVEAUX messages
    const channel = supabase
      .channel(`public:messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          // Si le message n'est pas de nous, on le marque lu
          if (currentUserId && payload.new.expediteur_id !== currentUserId) {
             supabase.from('messages').update({ lu: true }).eq('id', payload.new.id).then();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, fetchMessages]);

  const sendMessage = async (contenu: string) => {
    if (!conversationId || !currentUserId || !contenu.trim()) return null;
    
    // 1. Insérer le message
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        expediteur_id: currentUserId,
        contenu: contenu.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur sendMessage:', error);
      return null;
    }

    // 2. Mettre à jour la conversation
    await supabase.from('conversations').update({
      dernier_message: contenu.trim(),
      date_dernier_message: new Date().toISOString()
    }).eq('id', conversationId);

    return newMessage;
  };

  return { messages, loading, sendMessage };
}

/**
 * Trouve ou crée une conversation entre acheteur et vendeur pour une annonce
 */
export async function getOrCreateConversation(acheteurId: string, vendeurId: string, annonceId: string) {
  // 1. Chercher si la conversation existe (UNIQUE index)
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .eq('acheteur_id', acheteurId)
    .eq('vendeur_id', vendeurId)
    .eq('annonce_id', annonceId)
    .single();

  if (existing) return existing;

  // 2. Sinon, on la crée
  const { data: newConv, error: createError } = await supabase
    .from('conversations')
    .insert({
      acheteur_id: acheteurId,
      vendeur_id: vendeurId,
      annonce_id: annonceId,
      dernier_message: "Nouvelle conversation",
    })
    .select()
    .single();

  if (createError) {
    console.error("Erreur création conversation:", createError);
    return null;
  }
  return newConv;
}
