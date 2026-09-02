-- =========================================================================
-- JOURNAL DES PAIEMENTS RÉELS — FLASH MARKET
-- À exécuter dans le SQL Editor Supabase (projet prod kmydbkaytrxtcequngnn).
-- Idempotente : ré-exécutable sans risque.
-- Prérequis : migration_p1_entitlements.sql (table plans),
--             migration_boost_annonce.sql (colonnes boost_*),
--             migration_admin_rls.sql (fonction is_admin).
-- =========================================================================
-- POURQUOI CETTE MIGRATION
--
-- Aucune table n'enregistrait un encaissement. Les conséquences étaient
-- graves et invisibles :
--
--   1. `annonces.est_payee` ne veut plus dire « payée ». L'application
--      l'écrit à TRUE pour toute publication, y compris gratuite
--      (`montant_depot = 0`, transaction `FREE_QUOTA`). La console admin
--      multipliait chaque annonce par un barème de catégorie et affichait un
--      chiffre d'affaires qui n'a jamais existé.
--   2. Un achat d'accès (Pro 5 000 / Service 2 500 / Vendeur 2 000, paiement
--      UNIQUE à vie depuis le 2026-08-31) ne laissait aucune trace : seuls
--      `users.type_compte`, `date_abonnement` et `plan_achete` étaient
--      écrits. Montant et référence de transaction perdus — impossible de
--      distinguer un compte Pro payé d'un compte Pro accordé à la main.
--   3. Un boost n'existait que dans les colonnes `boost_*` de l'annonce,
--      écrasées au boost suivant.
--
-- On installe donc `public.paiements` : la SOURCE UNIQUE de ce qui a été
-- réellement encaissé. La console admin ne lit plus que cette table. Un
-- chiffre qui n'y figure pas n'est pas affiché — plus aucun montant déduit.
--
-- NB : il n'y a plus d'abonnement. Tout est du paiement unique. Rien
-- n'expire, rien ne se renouvelle — cette migration n'écrit donc pas dans
-- `subscriptions` (table conservée pour l'historique uniquement).
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. La table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.paiements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- boost   : mise en avant d'une annonce (250 F / 48 h)
  -- acces   : achat unique d'une offre à vie (pro / service / vendeur)
  -- annonce : publication payée à l'unité (montant_depot)
  type           TEXT NOT NULL CHECK (type IN ('boost', 'acces', 'annonce')),
  montant_fcfa   INTEGER NOT NULL CHECK (montant_fcfa > 0),
  statut         TEXT NOT NULL DEFAULT 'reussi'
                 CHECK (statut IN ('reussi', 'rembourse')),
  annonce_id     UUID REFERENCES public.annonces(id) ON DELETE SET NULL,
  plan_code      TEXT REFERENCES public.plans(code),
  transaction_id TEXT,                       -- référence PaiementPro (CC-...)
  source         TEXT NOT NULL DEFAULT 'paiementpro',
  date_paiement  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note           TEXT,
  date_creation  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.paiements IS
  'Encaissements reellement constates. Source unique de la page Finances de la '
  'console admin. Ne JAMAIS y deduire un montant a partir d''un bareme, d''un '
  'statut ou d''un type de compte : une ligne = de l''argent recu.';

COMMENT ON COLUMN public.paiements.montant_fcfa IS
  'Montant reellement paye, jamais un tarif theorique.';

CREATE INDEX IF NOT EXISTS idx_paiements_date ON public.paiements(date_paiement DESC);
CREATE INDEX IF NOT EXISTS idx_paiements_user ON public.paiements(user_id);
CREATE INDEX IF NOT EXISTS idx_paiements_type ON public.paiements(type, date_paiement DESC);

-- Anti-doublon. Leçon du correctif « push en triple » (9b90e21) : ce qui peut
-- être enregistré deux fois le sera. On rend le double comptage impossible EN
-- BASE plutôt que de compter sur l'appelant.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_paiement_transaction
  ON public.paiements(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_paiement_boost
  ON public.paiements(annonce_id, date_paiement) WHERE type = 'boost';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_paiement_depot
  ON public.paiements(annonce_id) WHERE type = 'annonce';

-- =========================================================================
-- 2. Traçabilité du boost : la référence de la transaction
-- =========================================================================
-- Sans elle, un boost payé ne peut pas être rapproché du relevé PaiementPro.
ALTER TABLE public.annonces ADD COLUMN IF NOT EXISTS boost_transaction_id TEXT;

COMMENT ON COLUMN public.annonces.boost_transaction_id IS
  'Reference PaiementPro du boost. NULL pour un boost offert (payments_enabled '
  '= false) : dans ce cas boost_prix vaut 0 et aucun paiement n''est journalise.';

-- =========================================================================
-- 3. Capture automatique en base
-- =========================================================================
-- Le boost et le dépôt payé sont écrits directement sur l'annonce. Des
-- triggers les captent : aucune version de l'application — y compris une
-- version publiée depuis un autre poste — ne peut « oublier » d'enregistrer
-- l'encaissement. La condition `boost_prix > 0` est ce qui distingue un
-- boost payé d'un boost offert.
CREATE OR REPLACE FUNCTION public.enregistrer_paiement_boost()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.boost_paye_le IS NOT NULL
     AND COALESCE(NEW.boost_prix, 0) > 0
     -- Le prix est décidé par le téléphone : un appareil resté sur un ancien
     -- bundle JS écrit 250 même sur un boost offert. Quand les paiements sont
     -- désactivés, aucun boost n'est un encaissement. Défaut TRUE si la config
     -- est illisible, pour ne jamais perdre un vrai paiement.
     AND COALESCE((SELECT payments_enabled FROM public.app_config WHERE id = 1), TRUE)
     AND (TG_OP = 'INSERT'
          OR OLD.boost_paye_le IS DISTINCT FROM NEW.boost_paye_le)
  THEN
    INSERT INTO public.paiements
      (user_id, type, montant_fcfa, annonce_id, transaction_id,
       date_paiement, source, note)
    VALUES
      (NEW.user_id, 'boost', NEW.boost_prix, NEW.id,
       NULLIF(NEW.boost_transaction_id, ''), NEW.boost_paye_le,
       'paiementpro', 'Boost de mise en avant (48 h)')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Publication payée à l'unité. Les publications dans le quota écrivent 0 :
-- elles ne créent donc aucune ligne.
CREATE OR REPLACE FUNCTION public.enregistrer_paiement_depot()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(NEW.montant_depot, 0) > 0 THEN
    INSERT INTO public.paiements
      (user_id, type, montant_fcfa, annonce_id, transaction_id,
       date_paiement, source, note)
    VALUES
      (NEW.user_id, 'annonce', NEW.montant_depot, NEW.id,
       NULLIF(NEW.id_transaction_paiement, ''),
       COALESCE(NEW.date_creation, NOW()), 'paiementpro',
       'Publication payee a l''unite')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_paiement_depot ON public.annonces;
CREATE TRIGGER trg_paiement_depot
  AFTER INSERT ON public.annonces
  FOR EACH ROW EXECUTE FUNCTION public.enregistrer_paiement_depot();

DROP TRIGGER IF EXISTS trg_paiement_boost ON public.annonces;
CREATE TRIGGER trg_paiement_boost
  AFTER INSERT OR UPDATE OF boost_paye_le ON public.annonces
  FOR EACH ROW EXECUTE FUNCTION public.enregistrer_paiement_boost();

-- =========================================================================
-- 4. Enregistrement d'un achat d'accès (appelé par l'application)
-- =========================================================================
-- Un achat d'accès ne laisse aucune écriture exploitable en base (il ne
-- modifie que la ligne `users`), d'où cette RPC. Le client ne choisit PAS le
-- montant : il est lu dans `plans`. Sans cela, n'importe quel appelant
-- pourrait déclarer avoir payé 500 000 F.
CREATE OR REPLACE FUNCTION public.enregistrer_paiement_acces(
  p_plan_code      TEXT,
  p_transaction_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user UUID := auth.uid();
  v_prix INTEGER;
  v_nom  TEXT;
  v_id   UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT prix_fcfa, nom INTO v_prix, v_nom
  FROM public.plans WHERE code = p_plan_code AND actif;

  IF v_prix IS NULL OR v_prix <= 0 THEN
    RAISE EXCEPTION 'Offre inconnue ou gratuite : %', p_plan_code;
  END IF;

  INSERT INTO public.paiements
    (user_id, type, montant_fcfa, plan_code, transaction_id, source, note)
  VALUES
    (v_user, 'acces', v_prix, p_plan_code, NULLIF(p_transaction_id, ''),
     'paiementpro', 'Achat unique — acces a vie : ' || COALESCE(v_nom, p_plan_code))
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  -- Volontairement AUCUNE écriture dans `subscriptions` : il n'y a plus
  -- d'abonnement ni d'échéance (migration_paiement_unique.sql). Y écrire une
  -- validité de 30 jours ferait réapparaître une date d'expiration là où le
  -- produit promet un accès à vie.
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.enregistrer_paiement_acces(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_paiement_acces(TEXT, TEXT) TO authenticated;

-- =========================================================================
-- 5. Qui a le droit de lire (§ migration_admin_rls.sql)
-- =========================================================================
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chacun lit ses paiements" ON public.paiements;
CREATE POLICY "chacun lit ses paiements" ON public.paiements
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "les admins lisent tous les paiements" ON public.paiements;
CREATE POLICY "les admins lisent tous les paiements" ON public.paiements
  FOR SELECT USING (public.is_admin());

-- Aucune policy d'INSERT/UPDATE/DELETE : seuls les triggers, la fonction
-- SECURITY DEFINER ci-dessus et le rôle service écrivent ici. Un utilisateur
-- ne peut pas s'inventer un paiement.

-- =========================================================================
-- 6. Correction des deux boosts de test du 2026-08-31
-- =========================================================================
-- `BoostAnnonceScreen` active le boost SANS paiement quand
-- `app_config.payments_enabled` est faux — mais il écrivait quand même
-- `boost_prix = 250`. Deux boosts posés en test avant le passage en LIVE
-- (2026-08-31 22:37) portent donc un prix que personne n'a payé :
--
--   20:12 — « Iphone 17 Pro »              (test)
--   21:24 — « Xbox series S + Manette »    (test)
--   23:23 — « Maillot version authentique » (PAYÉ — après le passage en LIVE)
--
-- On remet leur prix à 0 : c'est la vérité (ces boosts étaient offerts), et
-- la reprise ci-dessous les exclut alors d'elle-même, sans liste noire.
-- La cause est corrigée côté application : `activerBoost` écrit désormais
-- `boost_prix = 0` quand les paiements sont désactivés.
UPDATE public.annonces
SET boost_prix = 0
WHERE boost_paye_le IS NOT NULL
  AND COALESCE(boost_prix, 0) > 0
  AND boost_paye_le < TIMESTAMPTZ '2026-08-31 22:37:00+00';

-- La période LIVE s'est arrêtée le 2026-09-01 à 12:07 UTC (retour en
-- FREE_LAUNCH, offre de lancement gratuite). Le boost de « Stanley » du
-- 2026-09-01 15:25 était donc offert lui aussi, alors qu'il portait 250 F :
-- voir supabase/correction_boost_offert_2026_09_01.sql, qui le remet à 0 et
-- supprime la ligne d'encaissement fictive créée par la reprise ci-dessous.
-- Fenêtre réellement facturée à ce jour : 2026-08-31 22:37 → 2026-09-01 12:07.

-- =========================================================================
-- 7. Reprise de l'existant — les seuls encaissements réels à ce jour
-- =========================================================================
-- On ne reprend QUE ce qui porte une trace d'encaissement : un boost au prix
-- non nul, ou une publication au dépôt non nul. Les annonces publiées
-- gratuitement ne créent aucune ligne : elles n'ont jamais rapporté un franc,
-- quel que soit leur `est_payee`.
INSERT INTO public.paiements
  (user_id, type, montant_fcfa, annonce_id, transaction_id, date_paiement, source, note)
SELECT a.user_id, 'boost', a.boost_prix, a.id,
       NULLIF(a.boost_transaction_id, ''), a.boost_paye_le, 'paiementpro',
       'Reprise : boost paye enregistre sur l''annonce'
FROM public.annonces a
WHERE a.boost_paye_le IS NOT NULL
  AND COALESCE(a.boost_prix, 0) > 0
ON CONFLICT DO NOTHING;

INSERT INTO public.paiements
  (user_id, type, montant_fcfa, annonce_id, transaction_id, date_paiement, source, note)
SELECT a.user_id, 'annonce', a.montant_depot, a.id,
       NULLIF(a.id_transaction_paiement, ''), a.date_creation, 'paiementpro',
       'Reprise : publication payee a l''unite'
FROM public.annonces a
WHERE COALESCE(a.montant_depot, 0) > 0
ON CONFLICT DO NOTHING;

-- Les achats d'accès déjà encaissés ne peuvent PAS être repris
-- automatiquement : `users.type_compte` ne dit pas si le compte a payé ou a
-- été accordé (14 comptes « professionnel » existent, dont la plupart datent
-- de la phase gratuite). Les rapprocher à la main, un par un, avec le relevé
-- PaiementPro — voir docs/EXPLOITATION.md §6 bis.

COMMIT;

-- =========================================================================
-- 8. Vérification — à lire après exécution
-- =========================================================================
SELECT type, COUNT(*) AS nb, SUM(montant_fcfa) AS total_fcfa
FROM public.paiements WHERE statut = 'reussi'
GROUP BY type ORDER BY 3 DESC;

-- Attendu au 2026-09-01 : UNE ligne, boost 250 F, « Maillot version authentique ».
SELECT p.date_paiement, p.type, p.montant_fcfa,
       u.prenom || ' ' || u.nom AS payeur, a.titre, p.transaction_id
FROM public.paiements p
LEFT JOIN public.users u ON u.id = p.user_id
LEFT JOIN public.annonces a ON a.id = p.annonce_id
ORDER BY p.date_paiement DESC;

-- =========================================================================
-- 9. SI UN PAIEMENT REPRIS N'EST PAS RÉEL
-- =========================================================================
--   DELETE FROM public.paiements
--   WHERE type = 'boost' AND annonce_id = '<id_annonce>';
--
-- Le trigger ne la recréera pas : il ne se déclenche qu'à un NOUVEAU boost.
-- =========================================================================

-- =========================================================================
-- ROLLBACK (annulation complète de cette migration)
-- =========================================================================
-- DROP TRIGGER IF EXISTS trg_paiement_boost ON public.annonces;
-- DROP TRIGGER IF EXISTS trg_paiement_depot ON public.annonces;
-- DROP FUNCTION IF EXISTS public.enregistrer_paiement_boost();
-- DROP FUNCTION IF EXISTS public.enregistrer_paiement_depot();
-- DROP FUNCTION IF EXISTS public.enregistrer_paiement_acces(TEXT, TEXT);
-- DROP TABLE IF EXISTS public.paiements;
-- ALTER TABLE public.annonces DROP COLUMN IF EXISTS boost_transaction_id;
-- Le prix des deux boosts de test (§6) reste à 0 : c'est une correction de
-- donnée, pas une structure — la rétablir à 250 serait réintroduire l'erreur.
