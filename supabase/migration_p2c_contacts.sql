-- =========================================================================
-- PHASE 2 — Mises en relation qualifiées (statistiques de contacts)
-- Dossier directeur §3.4, §5.4, §8.2, §17.1. Idempotente.
-- Prérequis : migration_p1_entitlements.sql (listing_kind).
-- =========================================================================
-- Le §3.4 pose la métrique centrale du produit : le nombre hebdomadaire de
-- MISES EN RELATION QUALIFIÉES — « premier message envoyé, commande créée,
-- demande de devis, clic WhatsApp ou appel révélé après consultation d'une
-- annonce ». C'est elle qui représente la valeur, pas les installations ni
-- les vues.
--
-- Aujourd'hui rien de tout cela n'est mesuré. Conséquences directes :
--   - le vendeur PRO n'a aucune preuve de ce que son abonnement lui rapporte,
--     et avec 0 commande en base il ne voit que des zéros (§8.2) ;
--   - le palier Vendeur promet des « statistiques » qui n'existent pas (§5.4) ;
--   - on ne peut pas savoir si l'application marche.
--
-- ── Intégrité : pourquoi une RPC et pas un INSERT direct ──────────────────
-- Un compteur malhonnête est pire que pas de compteur : il ferait payer un
-- abonnement sur des chiffres faux. La RPC ci-dessous garantit que :
--   - le vendeur est DÉDUIT de l'annonce, jamais fourni par le client, donc
--     personne ne peut gonfler les statistiques d'un tiers ni les siennes ;
--   - un vendeur qui touche sa propre annonce n'est pas compté ;
--   - un même utilisateur qui reclique n'est compté qu'une fois par tranche
--     de 6 heures.
--
-- ── Vie privée (§17.2) ────────────────────────────────────────────────────
-- On enregistre le TYPE de contact et rien d'autre. Aucun contenu de message,
-- aucun numéro, aucune donnée de localisation.
-- =========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.contact_events (
  id          BIGSERIAL PRIMARY KEY,
  annonce_id  UUID REFERENCES public.annonces(id) ON DELETE CASCADE,
  vendeur_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL
              CHECK (type IN ('message', 'whatsapp', 'appel', 'commande', 'devis')),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_events_vendeur
  ON public.contact_events(vendeur_id, date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_contact_events_annonce
  ON public.contact_events(annonce_id, type);

ALTER TABLE public.contact_events ENABLE ROW LEVEL SECURITY;

-- Le vendeur voit SES contacts. Personne d'autre, et personne n'écrit
-- directement : tout passe par la RPC.
DROP POLICY IF EXISTS "Le vendeur lit ses contacts" ON public.contact_events;
CREATE POLICY "Le vendeur lit ses contacts" ON public.contact_events
  FOR SELECT USING (auth.uid() = vendeur_id);

-- -------------------------------------------------------------------------
-- Enregistrement d'une mise en relation
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enregistrer_contact(
  p_annonce_id UUID,
  p_type       TEXT
)
RETURNS void AS $$
DECLARE
  v_vendeur UUID;
  v_client  UUID := auth.uid();
BEGIN
  IF p_type NOT IN ('message', 'whatsapp', 'appel', 'commande', 'devis') THEN
    RETURN; -- type inconnu : on ignore en silence plutot que de casser l'app
  END IF;

  -- Le vendeur vient de l'annonce, jamais du client.
  SELECT user_id INTO v_vendeur FROM public.annonces WHERE id = p_annonce_id;
  IF v_vendeur IS NULL THEN
    RETURN;
  END IF;

  -- Un vendeur qui consulte sa propre annonce ne se compte pas lui-meme.
  IF v_client IS NOT NULL AND v_client = v_vendeur THEN
    RETURN;
  END IF;

  -- Anti-doublon : un meme utilisateur identifie qui reclique dans les 6
  -- heures ne compte qu'une fois. Un visiteur anonyme ne peut pas etre
  -- dedoublonne de facon fiable : c'est une limite assumee, signalee dans
  -- l'interface.
  IF v_client IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contact_events
    WHERE annonce_id = p_annonce_id
      AND client_id = v_client
      AND type = p_type
      AND date_creation > NOW() - INTERVAL '6 hours'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.contact_events (annonce_id, vendeur_id, client_id, type)
  VALUES (p_annonce_id, v_vendeur, v_client, p_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Un visiteur non connecte peut cliquer « Appeler » ou « WhatsApp » : ces
-- contacts-la comptent autant que les autres, la fonction doit donc etre
-- appelable par anon.
GRANT EXECUTE ON FUNCTION public.enregistrer_contact(UUID, TEXT) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- Contact au niveau BOUTIQUE (et non d'une publication précise)
-- -------------------------------------------------------------------------
-- Les boutons « Appeler » et « WhatsApp » de la vitrine ne portent sur aucune
-- annonce en particulier : ce sont pourtant les mises en relation les plus
-- directes, et les omettre viderait la mesure de son sens.
--
-- Ici le vendeur ne peut pas être déduit d'une annonce, il est donc fourni.
-- Le risque résiduel est qu'un tiers gonfle les chiffres d'un vendeur — du
-- bruit, sans bénéfice pour personne. Le risque qui compte, un vendeur qui
-- gonfle SES PROPRES chiffres, reste bloqué : on refuse l'auto-contact, et
-- l'anti-doublon de 6 heures s'applique.
CREATE OR REPLACE FUNCTION public.enregistrer_contact_boutique(
  p_vendeur_id UUID,
  p_type       TEXT
)
RETURNS void AS $$
DECLARE
  v_client UUID := auth.uid();
BEGIN
  IF p_type NOT IN ('message', 'whatsapp', 'appel', 'commande', 'devis') THEN
    RETURN;
  END IF;

  -- La cible doit exister.
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_vendeur_id) THEN
    RETURN;
  END IF;

  IF v_client IS NOT NULL AND v_client = p_vendeur_id THEN
    RETURN;
  END IF;

  IF v_client IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contact_events
    WHERE vendeur_id = p_vendeur_id
      AND annonce_id IS NULL
      AND client_id = v_client
      AND type = p_type
      AND date_creation > NOW() - INTERVAL '6 hours'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.contact_events (annonce_id, vendeur_id, client_id, type)
  VALUES (NULL, p_vendeur_id, v_client, p_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.enregistrer_contact_boutique(UUID, TEXT) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- Agrégats prêts à afficher
-- -------------------------------------------------------------------------
-- Par vendeur, sur 30 jours. La RLS de la table s'applique : chacun ne voit
-- que ses propres chiffres.
CREATE OR REPLACE VIEW public.v_contacts_vendeur_30j
WITH (security_invoker = true) AS
SELECT
  vendeur_id,
  COUNT(*)                                                   AS total,
  COUNT(*) FILTER (WHERE type = 'message')                   AS messages,
  COUNT(*) FILTER (WHERE type = 'whatsapp')                  AS whatsapp,
  COUNT(*) FILTER (WHERE type = 'appel')                     AS appels,
  COUNT(*) FILTER (WHERE type IN ('commande', 'devis'))      AS demandes,
  COUNT(DISTINCT client_id) FILTER (WHERE client_id IS NOT NULL) AS personnes_identifiees
FROM public.contact_events
WHERE date_creation > NOW() - INTERVAL '30 days'
GROUP BY vendeur_id;

-- Par publication, sur 30 jours : « quels produits attirent des contacts »
-- (§4.2, besoin du commercant).
CREATE OR REPLACE VIEW public.v_contacts_annonce_30j
WITH (security_invoker = true) AS
SELECT
  annonce_id,
  vendeur_id,
  COUNT(*) AS contacts
FROM public.contact_events
WHERE date_creation > NOW() - INTERVAL '30 days'
  AND annonce_id IS NOT NULL
GROUP BY annonce_id, vendeur_id;

GRANT SELECT ON public.v_contacts_vendeur_30j  TO authenticated;
GRANT SELECT ON public.v_contacts_annonce_30j  TO authenticated;

-- Piege verifie en production le 2026-08-20 : une vue s'execute avec les
-- droits de son proprietaire et contourne la RLS. `security_invoker = true`
-- ci-dessus la fait respecter la RLS de `contact_events` — sans quoi chaque
-- vendeur verrait les contacts de tous les autres.
REVOKE ALL ON public.v_contacts_vendeur_30j FROM anon;
REVOKE ALL ON public.v_contacts_annonce_30j FROM anon;

COMMIT;

-- =========================================================================
-- Vérification
-- =========================================================================
SELECT proname FROM pg_proc WHERE proname LIKE 'enregistrer_contact%';

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('contact_events', 'v_contacts_vendeur_30j', 'v_contacts_annonce_30j')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

SELECT type, COUNT(*) FROM public.contact_events GROUP BY type;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- DROP VIEW IF EXISTS public.v_contacts_annonce_30j;
-- DROP VIEW IF EXISTS public.v_contacts_vendeur_30j;
-- DROP FUNCTION IF EXISTS public.enregistrer_contact(UUID, TEXT);
-- DROP TABLE IF EXISTS public.contact_events;
