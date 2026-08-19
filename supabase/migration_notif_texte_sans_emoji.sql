-- =========================================================================
-- MIGRATION : Notifications de commande — texte sans emoji
-- Idempotente. Remplace juste le contenu de la fonction, le trigger existant
-- (on_commande_notification, défini dans migration_boutiques_v2.sql) la
-- référence déjà par son nom, pas besoin de le recréer.
-- =========================================================================

BEGIN;

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
      'Nouvelle commande',
      client_nom || ' commande : ' || NEW.produit_titre
        || ' (' || NEW.quantite || '×' || NEW.prix || ' F). Répondez depuis « Mes commandes ».',
      'commande',
      jsonb_build_object('commandeId', NEW.id)
    );

  ELSIF TG_OP = 'UPDATE' AND NEW.statut IS DISTINCT FROM OLD.statut THEN
    libelle := CASE NEW.statut
      WHEN 'confirmee' THEN 'Commande confirmée'
      WHEN 'livree'    THEN 'Commande livrée'
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

COMMIT;
