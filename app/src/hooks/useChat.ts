import { useState, useEffect, useCallback } from 'react';
import { supabase, Message } from '../lib/supabase';

/**
 * Compte les messages non lus pour l'utilisateur (pour le badge de la tab)
 */
export function useUnreadCount(userId: string | undefined) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) { setCount(0); return; }

    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`acheteur_id.eq.${userId},vendeur_id.eq.${userId}`);

    if (!convs || convs.length === 0) { setCount(0); return; }

    const convIds = convs.map((c) => c.id);
    const { count: unread } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .eq('lu', false)
      .neq('expediteur_id', userId);

    setCount(unread || 0);
  }, [userId]);

  useEffect(() => {
    fetchCount();
    if (!userId) return;

    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`unread_count_${userId}_${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchCount)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchCount]);

  return count;
}

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
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          annonce:annonces(*, images:images_annonce(*)),
          acheteur:users!conversations_acheteur_id_fkey(id, prenom, nom, avatar_url),
          vendeur:users!conversations_vendeur_id_fkey(id, prenom, nom, avatar_url)
        `)
        .or(`acheteur_id.eq.${userId},vendeur_id.eq.${userId}`)
        .order('date_dernier_message', { ascending: false });

      if (error) throw error;

      // Enrichir chaque conversation avec le nombre de messages non lus
      const convData = data || [];
      if (convData.length > 0) {
        const convIds = convData.map((c) => c.id);
        const { data: unreadMsgs } = await supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .eq('lu', false)
          .neq('expediteur_id', userId);

        const unreadMap: Record<string, number> = {};
        (unreadMsgs || []).forEach((m) => {
          unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
        });

        setConversations(convData.map((c) => ({ ...c, unread_count: unreadMap[c.id] || 0 })));
      } else {
        setConversations([]);
      }
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
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public_conversations_${suffix}`)
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
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public_messages_${conversationId}_${suffix}`)
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

    // 3. (Géré côté serveur par trigger SQL) : L'insertion du message déclenche automatiquement la notification in-app et push via Expo.

    return newMessage;
  };

  return { messages, loading, sendMessage };
}

/**
 * Trouve ou crée une conversation entre acheteur et vendeur pour une annonce
 */
export async function getOrCreateConversation(acheteurId: string, vendeurId: string, annonceId: string) {
  if (!acheteurId || !vendeurId || !annonceId) {
    console.error("getOrCreateConversation: paramètres manquants", { acheteurId, vendeurId, annonceId });
    return null;
  }

  // 1. Vérifier que l'annonce existe encore en base
  const { data: annonceCheck, error: annonceError } = await supabase
    .from('annonces')
    .select('id')
    .eq('id', annonceId)
    .maybeSingle();

  if (annonceError || !annonceCheck) {
    console.error("getOrCreateConversation: annonce introuvable", annonceId, annonceError);
    return null;
  }

  // 2. Chercher si la conversation existe déjà
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('acheteur_id', acheteurId)
    .eq('vendeur_id', vendeurId)
    .eq('annonce_id', annonceId)
    .maybeSingle();

  if (existing) return existing;

  // 3. Sinon, on la crée
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
