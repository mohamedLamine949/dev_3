import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Vente {
  id: string;
  produit_titre: string;
  prix: number;
  quantite: number;
  date_creation: string;
  acheteur: { prenom: string | null; nom: string | null } | null;
}

// Historique des ventes réelles d'une boutique PRO : commandes livrées,
// remplace l'ancienne vue basée sur les frais de publication payés.
export function useHistoriqueVentes(vendeurId: string | undefined) {
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!vendeurId) return;
    setLoading(true);
    const { data } = await supabase
      .from('commandes')
      .select('id, produit_titre, prix, quantite, date_creation, acheteur:client_id(prenom, nom)')
      .eq('vendeur_id', vendeurId)
      .eq('statut', 'livree')
      .order('date_creation', { ascending: false });
    setVentes((data as any) || []);
    setLoading(false);
  }, [vendeurId]);

  useEffect(() => { refetch(); }, [refetch]);

  const total = ventes.reduce((s, v) => s + v.prix * v.quantite, 0);

  return { ventes, total, loading, refetch };
}
