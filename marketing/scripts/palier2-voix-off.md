# Palier 2 — Doper le mockup (voix off + musique + sous-titres)

Objectif : transformer la vidéo screen-record du mockup (`marketing/promo.html`) en
vraie pub rythmée. On garde l'image, on ajoute **voix off FR + musique + sous-titres
animés + hook**.

Minutage du mockup (à respecter pour caler la voix) :
| Scène | Début → fin | Durée |
|---|---|---|
| Intro marque | 0,0 → 2,6 s | 2,6 s |
| Accueil | 2,6 → 6,0 s | 3,4 s |
| Recherche | 6,0 → 9,4 s | 3,4 s |
| Chat | 9,4 → 12,8 s | 3,4 s |
| CTA | 12,8 → 16,6 s | 3,8 s |

---

## 1. Script voix off (français, énergique)

> Ton : jeune, direct, fier. Débit dynamique. ~2,5–3 mots/seconde.

- **[0,0–2,6 s — HOOK]** « Tu as un truc à vendre au Mali ? Deux minutes, c'est réglé. »
- **[2,6–6,0 s — Accueil]** « Flash Market : tout s'achète, tout se vend, près de chez toi. »
- **[6,0–9,4 s — Recherche]** « Téléphones, voitures, mode, immobilier… tout est là. »
- **[9,4–12,8 s — Chat]** « Tu contactes le vendeur directement, et tu négocies ton prix. »
- **[12,8–16,6 s — CTA]** « Télécharge Flash Market. C'est gratuit, et c'est 100 % malien. »

### Hooks alternatifs à tester (le hook = 80 % de la rétention)
1. « Arrête de chercher un acheteur — l'appli s'en occupe. »
2. « Au Mali, on ne vend plus comme avant. Regarde. »
3. « iPhone, voiture, canapé… vendu en 2 jours, sans bouger de chez toi. »
4. « Le bon coin malien existe, et il est gratuit. »

> Publie la même vidéo avec 2–3 hooks différents sur quelques jours : garde celui
> qui retient le mieux (regarde la rétention à 3 s dans les stats TikTok).

---

## 2. Voix off — ElevenLabs

1. Modèle **Multilingual v2** (ou plus récent), voix **française** énergique.
2. Réglages : Stability ~40–45 %, Similarity ~80 %, Style modéré → ton vivant sans robotique.
3. Colle chaque ligne, génère, exporte en MP3.
4. Alternative gratuite/locale : enregistre la voix toi-même (ou ton frère) au téléphone
   dans un endroit calme — une vraie voix malienne peut mieux convertir qu'une IA.
5. Option **bambara** : impossible en IA de qualité → si tu veux du bambara, enregistre-le
   toi par-dessus, en gardant ce timing.

---

## 3. Musique

La musique porte l'énergie. Stratégie selon la plateforme :

- **TikTok** : ajoute un **son tendance DANS l'appli TikTok** au moment de publier
  (onglet Sons → « tendances »). C'est ce qui booste la portée. Garde la voix off au-dessus,
  musique à ~15–20 % du volume.
- **Instagram Reels** : pareil, utilise un **audio tendance Instagram** à la publication.
- **YouTube Shorts / Facebook** : là le son tendance ne joue pas pareil → intègre une
  musique libre de droits directement dans le montage.

### Piste originale via Suno (libre de droits, pour YT/FB)
Prompt Suno :
> « Upbeat afrobeats / amapiano instrumental, punchy log drum, bright marimba, confident
> energetic vibe, no vocals, 17 seconds, strong intro hit, modern West African advertising
> feel, 120–124 BPM »

---

## 4. Sous-titres (style TikTok, incrustés)

Gros, gras, blancs à contour noir, un mot-clé en vert (#22c55e), qui apparaissent au rythme
de la voix. Le mockup a déjà des textes à l'écran → soit tu les gardes comme accent visuel,
soit tu utilises la **version sans textes** du mockup (voir plus bas) pour ne pas doubler.

Texte à afficher par scène :
- Hook : **VENDRE AU MALI ? 2 MINUTES.**
- Accueil : **TOUT S'ACHÈTE, TOUT SE VEND**
- Recherche : **TÉLÉPHONES · VOITURES · MODE · IMMOBILIER**
- Chat : **NÉGOCIE EN DIRECT AVEC LE VENDEUR**
- CTA : **TÉLÉCHARGE — C'EST GRATUIT 🇲🇱**

Astuce CapCut : les **sous-titres automatiques** transcrivent ta voix off → tu récupères le
texte synchronisé en 1 clic, tu n'as plus qu'à le styliser.

---

## 5. Montage CapCut (assemblage)

1. Enregistre **une passe propre** du mockup (~17 s), plein cadre 9:16.
2. Importe la vidéo dans CapCut (projet 1080×1920, 30 fps).
3. Ajoute la **voix off** (MP3 ElevenLabs) et cale chaque ligne sur sa scène (voir minutage).
4. Ajoute la **musique** en dessous → baisse-la à ~15 % (fonction « réduire quand la voix parle »).
5. **Sous-titres auto** → styliser (gros, gras, animation « pop »), un mot vert par phrase.
6. Ajoute un **texte de hook** énorme dès la 1ʳᵉ seconde (renforce l'accroche).
7. Cale les **changements de scène sur les temps forts** de la musique (beat-sync).
8. Exporte en 1080×1920, 30 fps, haute qualité.

---

## Checklist de publication
- [ ] Hook lisible dès la 1ʳᵉ seconde (texte + voix)
- [ ] Voix off nette, musique en dessous
- [ ] Sous-titres synchronisés
- [ ] CTA clair à la fin (+ « lien en bio » vers app-flashmarket.com)
- [ ] 3 variantes de hook prêtes à tester
