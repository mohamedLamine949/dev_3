-- =========================================================================
-- MIGRATION : Boutiques PRO v2 — catalogues + commandes structurées
-- À exécuter dans le SQL Editor APRÈS migration_boutiques.sql. Idempotente.
-- =========================================================================
-- Refonte complète de l'expérience PRO (spec 2026-07-12, 2e itération) :
--   - Le PRO ne publie plus de « simples annonces » : il crée des CATALOGUES
--     (ses propres rayons : « Téléphones », « Accessoires »…) et y ajoute des
--     PRODUITS via un formulaire allégé (nom, photos, description, prix,
--     stock). Le produit reste une ligne de `annonces` (l'infra recherche/
--     favoris/vues est réutilisée) rattachée à un catalogue.
--   - « Commander » ne passe plus par le chat : il crée une COMMANDE
--     structurée. Le vendeur a une vraie gestion de commandes (par statut,
--     par catalogue), voit le client, répond ; le client suit ses commandes.
--     La discussion libre reste possible via le chat existant.
--   - Chaque étape notifie automatiquement (pipeline notifications + push).
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. CATALOGUES : les rayons de la boutique
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL CHECK (char_length(nom) BETWEEN 2 AND 40),
  -- Catégorie marketplace associée : les produits du catalogue héritent
  -- de cette catégorie pour rester trouvables dans la recherche classique.
  categorie TEXT NOT NULL DEFAULT 'services',
  ordre INTEGER NOT NULL DEFAULT 0,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT catalogue_nom_unique UNIQUE (user_id, nom)
);

CREATE INDEX IF NOT EXISTS idx_catalogues_user ON public.catalogues(user_id, ordre);

ALTER TABLE public.catalogues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Catalogues publics" ON public.catalogues;
CREATE POLICY "Catalogues publics" ON public.catalogues FOR SELECT USING (true);
DROP POLICY IF EXISTS "Proprietaire gere ses catalogues" ON public.catalogues;
CREATE POLICY "Proprietaire gere ses catalogues" ON public.catalogues
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Rattachement des produits (annonces) à un catalogue
ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS catalogue_id UUID
  REFERENCES public.catalogues(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_annonces_catalogue ON public.annonces(catalogue_id);

-- -------------------------------------------------------------------------
-- 2. COMMANDES : le cœur de l'expérience boutique en ligne
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commandes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendeur_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Le produit peut être supprimé plus tard : on snapshote titre et prix
  produit_id UUID REFERENCES public.annonces(id) ON DELETE SET NULL,
  catalogue_id UUID REFERENCES public.catalogues(id) ON DELETE SET NULL,
  produit_titre TEXT NOT NULL,
  prix INTEGER NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1 CHECK (quantite BETWEEN 1 AND 99),
  note_client TEXT CHECK (note_client IS NULL OR char_length(note_client) <= 500),
  statut TEXT NOT NULL DEFAULT 'nouvelle'
    CHECK (statut IN ('nouvelle', 'confirmee', 'livree', 'refusee', 'annulee')),
  reponse_vendeur TEXT CHECK (reponse_vendeur IS NULL OR char_length(reponse_vendeur) <= 500),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_maj TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commande_pas_soi_meme CHECK (vendeur_id <> client_id)
);

CREATE INDEX IF NOT EXISTS idx_commandes_vendeur ON public.commandes(vendeur_id, statut, date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_commandes_client ON public.commandes(client_id, date_creation DESC);

ALTER TABLE public.commandes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acteurs lisent leurs commandes" ON public.commandes;
CREATE POLICY "Acteurs lisent leurs commandes" ON public.commandes
  FOR SELECT USING (
    auth.uid() = vendeur_id OR auth.uid() = client_id OR public.is_admin()
  );

-- Le client crée une commande sur un produit qui appartient bien au vendeur
DROP POLICY IF EXISTS "Client cree une commande" ON public.commandes;
CREATE POLICY "Client cree une commande" ON public.commandes
  FOR INSERT WITH CHECK (
    auth.uid() = client_id
    AND EXISTS (
      SELECT 1 FROM public.annonces a
      WHERE a.id = produit_id AND a.user_id = vendeur_id
    )
  );

-- Les deux parties peuvent mettre à jour (le vendeur répond/avance le
-- statut, le client peut annuler) ; l'app gouverne les transitions.
DROP POLICY IF EXISTS "Acteurs mettent a jour" ON public.commandes;
CREATE POLICY "Acteurs mettent a jour" ON public.commandes
  FOR UPDATE USING (auth.uid() = vendeur_id OR auth.uid() = client_id);

-- -------------------------------------------------------------------------
-- 3. NOTIFICATIONS AUTOMATIQUES (le trigger push existant fait le reste)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_commande_notification()
RETURNS TRIGGER AS $$
DECLARE
  client_nom TEXT;
  libelle TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(NULLIF(TRIM(prenom || ' ' || COALESCE(nom, '')), ''), 'Un client')
    INTO client_nom FROM public.users WHERE id = NEW.client_id;

    INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
    VALUES (
      NEW.vendeur_id,
      'Nouvelle commande 🛒',
      client_nom || ' commande : ' || NEW.produit_titre
        || ' (' || NEW.quantite || '×' || NEW.prix || ' F). Répondez depuis « Mes commandes ».',
      'commande',
      jsonb_build_object('commandeId', NEW.id)
    );

  ELSIF TG_OP = 'UPDATE' AND NEW.statut IS DISTINCT FROM OLD.statut THEN
    libelle := CASE NEW.statut
      WHEN 'confirmee' THEN 'Commande confirmée ✅'
      WHEN 'livree'    THEN 'Commande livrée 📦'
      WHEN 'refusee'   THEN 'Commande refusée'
      WHEN 'annulee'   THEN 'Commande annulée'
      ELSE 'Commande mise à jour'
    END;

    -- L'annulation vient du client -> on notifie le vendeur ;
    -- tout le reste vient du vendeur -> on notifie le client.
    IF NEW.statut = 'annulee' THEN
      INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
      VALUES (NEW.vendeur_id, libelle,
        'La commande « ' || NEW.produit_titre || ' » a été annulée par le client.',
        'commande', jsonb_build_object('commandeId', NEW.id));
    ELSE
      INSERT INTO public.notifications (user_id, titre, contenu, type, donnees)
      VALUES (NEW.client_id, libelle,
        '« ' || NEW.produit_titre || ' » — '
          || COALESCE(NULLIF(TRIM(NEW.reponse_vendeur), ''), 'suivez votre commande dans l''app.'),
        'commande', jsonb_build_object('commandeId', NEW.id));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_commande_notification ON public.commandes;
CREATE TRIGGER on_commande_notification
  AFTER INSERT OR UPDATE ON public.commandes
  FOR EACH ROW EXECUTE FUNCTION public.handle_commande_notification();

-- Horodatage de la dernière modification
CREATE OR REPLACE FUNCTION public.touch_commande()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_maj := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_commande_touch ON public.commandes;
CREATE TRIGGER on_commande_touch
  BEFORE UPDATE ON public.commandes
  FOR EACH ROW EXECUTE FUNCTION public.touch_commande();

COMMIT;
