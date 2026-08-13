# Flash Market — Vidéo hero « Vitrine » (9:16, ~27 s)

Fichier animé : [`marketing/motion-hero.html`](../motion-hero.html)
Captures réelles de l'app dans un iPhone flottant + **sound effects déjà intégrés** (WebAudio).

> **En une phrase** : tu ouvres le HTML, tu cliques **Lancer** (ça active le son),
> tu screen-record le rectangle vert (9:16). La capture contient DÉJÀ les SFX.
> Il ne te reste qu'à poser **la voix off + la musique** par-dessus dans CapCut.

---

## 1. Minutage (calé exactement sur le code)

| # | Scène | Début → fin | Durée | Ce qu'on voit à l'écran |
|---|---|---|---|---|
| 1 | **Intro marque** | 0,0 → 2,8 s | 2,8 s | Logo qui pop + « Flash Market » + « Le marché du Mali, dans ta poche » |
| 2 | **Accueil** | 2,8 → 7,2 s | 4,4 s | Le fil d'annonces qui défile · tap sur une carte · ❤️ favori · prix qui compte jusqu'à 285 000 FCFA |
| 3 | **Recherche** | 7,2 → 11,4 s | 4,2 s | Les catégories · chips qui cascadent (Voitures, Immobilier, Mode, Services, Tech) · tap sur une catégorie |
| 4 | **Proximité** | 11,4 → 15,2 s | 3,8 s | Radar + 📍 « Près de chez toi » |
| 5 | **Chat** | 15,2 → 19,8 s | 4,6 s | La conversation · bulles qui apparaissent · glow or sur le prix négocié (410 000 FCFA) + ✓✓ verts |
| 6 | **Vendu** | 19,8 → 22,4 s | 2,6 s | Tampon **VENDU** qui claque · « Acheté. Vendu. 🔥 » |
| 7 | **CTA** | 22,4 → 26,6 s | 4,2 s | Gros logo · « Achète. Vends. Près de chez toi. » · App Store + Google Play · app-flashmarket.com · confettis |

**Total ≈ 26,6 s.** La vidéo boucle automatiquement (relance sur l'intro).

---

## 2. Storyboard (plan par plan)

- **Plan 1 — Intro.** Fond vert dégradé, orbes qui flottent. Le logo (sac + éclair) surgit
  en `pop`, le nom s'écrit, la tagline apparaît en dessous. Riser sonore qui monte → whoosh
  de transition vers le téléphone.
- **Plan 2 — Accueil.** Le téléphone glisse au centre et flotte doucement (tilt). L'écran
  Accueil scrolle lentement (on voit iPhone 13 Pro, sac en cuir…). Un doigt tape une carte,
  un ❤️ pop, une étiquette dorée compte le prix.
- **Plan 3 — Recherche.** Transition, écran Recherche. Les grosses catégories colorées.
  Autour du téléphone, des chips « 🚗 Voitures / 🏠 Immobilier / 👗 Mode / 🔧 Services / 📱 Tech »
  apparaissent en cascade. Un tap sur une catégorie.
- **Plan 4 — Proximité.** On reste sur Recherche, descendu sur « Près de moi ». Un radar
  pulse depuis le centre, un 📍 tombe. Message : c'est autour de toi.
- **Plan 5 — Chat.** Écran conversation. Les bulles s'enchaînent (pop-pop-pop). Le dernier
  prix (410 000 FCFA) s'entoure d'un halo doré, les ✓✓ passent au vert → ka-ching.
- **Plan 6 — Vendu.** Un tampon **VENDU** vert claque en biais sur l'écran Messages. Punchy.
- **Plan 7 — CTA.** Le téléphone laisse place à l'endcard : logo, phrase, les deux badges
  stores, l'URL, une pluie de confettis. Chime final.

---

## 3. Voix off (français, énergique) — calée sur le minutage

> Ton : jeune, direct, fier, souriant. Débit dynamique (~2,5–3 mots/s).
> Laisse un petit silence sur le « Vendu » pour que le ka-ching respire.

| Temps | Ligne voix off |
|---|---|
| **0,0 – 2,8 s** | « Flash Market : le marché du Mali, **dans ta poche.** » |
| **2,8 – 7,2 s** | « Des milliers d'annonces, **près de chez toi.** » |
| **7,2 – 11,4 s** | « Voitures, immobilier, mode, services… **tout est là.** » |
| **11,4 – 15,2 s** | « Et tout ça, **juste à côté de toi.** » |
| **15,2 – 19,8 s** | « Tu contactes le vendeur, tu **négocies ton prix**, en direct. » |
| **19,8 – 22,4 s** | « Et c'est… **vendu.** 🔥 » |
| **22,4 – 26,6 s** | « Télécharge Flash Market. C'est **gratuit**, et c'est **100 % malien.** 🇲🇱 » |

### Hooks alternatifs pour la 1ʳᵉ seconde (le hook = 80 % de la rétention)
Publie la même vidéo avec 2–3 accroches différentes, garde celle qui retient le mieux
(regarde la rétention à 3 s dans les stats TikTok) :
1. « Au Mali, tout s'achète et tout se vend — et c'est là. »
2. « Cherche, trouve, négocie, achète. Sans bouger de chez toi. »
3. « Le bon coin malien existe. Et il est gratuit. »
4. « iPhone, voiture, canapé… près de chez toi, en 2 minutes. »

> **Option bambara** : garde exactement ce minutage et enregistre la voix toi-même
> (ou ton frère) par-dessus. Une vraie voix malienne convertit souvent mieux que l'IA.

---

## 4. Sound effects — DÉJÀ dans la vidéo (cue sheet de référence)

Les SFX sont générés en direct par le HTML (WebAudio) et se déclenchent pile sur l'animation.
**Tu n'as rien à recaler** — cette table sert juste si tu veux les remplacer/renforcer au montage.

| Temps | Effet | Sur quoi |
|---|---|---|
| 0,0 s | Riser | Montée d'intro |
| ~0,6 s | Chime | Le logo se pose |
| ~2,45 s | Whoosh | Transition vers le téléphone |
| 2,8 s | Whoosh | Entrée Accueil |
| ~3,5 s | Tap | Doigt sur la carte |
| ~3,85 s | Pop | ❤️ favori |
| ~4,7 s | Pop | Étiquette prix |
| 7,2 s | Swipe | Entrée Recherche |
| 7,55–8,1 s | 5 × Pop | Cascade des chips catégories |
| ~8,8 s | Tap | Sur une catégorie |
| 11,4 s | Swipe | Passage proximité |
| ~11,9–12,5 s | Ping (×2) | Radar |
| ~12,3 s | Pop | 📍 pin qui tombe |
| 15,2 s | Whoosh | Entrée Chat |
| 15,7 / 16,15 / 16,6 s | Bubble | Bulles de message |
| ~17,6 s | **Ka-ching** | Prix négocié + ✓✓ verts |
| 19,8 s | Stamp + Success | Tampon **VENDU** |
| 22,4 s | Chime + Confetti | Endcard |

Réglages : `?mute` coupe tous les SFX · `?clean` masque les textes (voir §6).

---

## 5. Voix off — génération (ElevenLabs)

1. Modèle **Multilingual v2** (ou plus récent), voix **française** énergique.
2. Réglages : Stability ~40–45 %, Similarity ~80 %, Style modéré → vivant sans robotique.
3. Colle chaque ligne, génère, exporte en MP3.

## 6. Musique

- **TikTok / Reels** : ajoute un **son tendance DANS l'appli** au moment de publier
  (c'est ce qui booste la portée). Garde la voix off au-dessus, musique à ~15–20 %.
- **YouTube Shorts / Facebook** : mets une musique libre de droits dans le montage.
  Piste originale via **Suno** :
  > « Upbeat afrobeats / amapiano instrumental, punchy log drum, bright marimba, confident
  > energetic vibe, no vocals, 27 seconds, strong intro hit, modern West African advertising
  > feel, 120–124 BPM »

---

## 7. Montage (assemblage CapCut)

1. Ouvre `motion-hero.html` dans le navigateur (Chrome), **plein écran**.
2. Clique **Lancer** (ça active le son) et **screen-record le rectangle vert** en 9:16.
   → Astuce : ouvre en `?clean` si tu préfères mettre les sous-titres au montage
   (`motion-hero.html?clean`).
3. Importe la capture dans CapCut (projet **1080×1920, 30 fps**). Recadre au propre sur le cadre.
4. Ajoute la **voix off** (MP3) et cale chaque ligne sur sa scène (voir §3).
5. Ajoute la **musique** en dessous → baisse-la à ~15 % (« réduire quand la voix parle »).
6. (Option) **Sous-titres auto** CapCut → styliser gros/gras, un mot-clé en vert.
7. Les **SFX sont déjà dans la capture** — laisse-les. Renforce seulement si besoin (§4).
8. Exporte en 1080×1920, 30 fps, haute qualité.

## Checklist publication
- [ ] Hook lisible/audible dès la 1ʳᵉ seconde
- [ ] Voix off nette, musique en dessous, SFX audibles
- [ ] CTA clair à la fin (+ « lien en bio » vers app-flashmarket.com)
- [ ] 3 variantes de hook prêtes à tester
