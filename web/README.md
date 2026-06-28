# Site web Flash Market

Site statique : vitrine + pages légales (obligatoires pour Google Play & Apple).

## Pages
- `index.html` — vitrine
- `confidentialite.html` — politique de confidentialité (**URL obligatoire stores**)
- `cgu.html` — conditions générales d'utilisation
- `cgv.html` — conditions générales de vente
- `support.html` — page de support / contact (**URL de support Apple**)
- `style.css` — styles partagés

## Déploiement sur Render
1. [render.com](https://render.com) → **New** → **Static Site**
2. Connecte le repo GitHub `mohamedLamine949/dev_3`
3. Configuration :
   - **Root Directory** : `web`
   - **Build Command** : *(laisser vide)*
   - **Publish Directory** : `.`
4. Deploy → Render donne une URL `*.onrender.com`

## Brancher le domaine `app-flashmarket.com`
1. Sur Render : Static Site → **Settings** → **Custom Domains** → ajoute `app-flashmarket.com` (et `www`)
2. Render affiche un enregistrement à créer. Dans **Hostinger** (hPanel → DNS) :
   - pour le domaine racine : un **A** vers l'IP fournie par Render (ou ALIAS/ANAME si dispo)
   - pour `www` : un **CNAME** vers l'URL `*.onrender.com`
3. HTTPS auto une fois le DNS propagé.

## URLs à renseigner dans les stores
- Google Play → Politique de confidentialité : `https://app-flashmarket.com/confidentialite.html`
- App Store → Privacy Policy URL : idem · Support URL : `https://app-flashmarket.com/support.html`
