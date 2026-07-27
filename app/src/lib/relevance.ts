import { getSousCategorieSearchText } from '../constants/theme';

// Scoring de pertinence des annonces, partagé entre l'accueil (useAnnonces)
// et l'écran Recherche. Retourne 0 si l'annonce n'est pas pertinente : c'est
// un FILTRE strict, pas seulement un tri.
//
// Règles :
// - tous les mots significatifs (3 caractères et plus) de la requête doivent
//   correspondre quelque part (titre, description, catégorie, sous-catégorie,
//   localisation, ou correspondance partielle sur les mots du titre) ;
// - les mots courts (« 2 », « tv ») ne comptent qu'en correspondance de mot
//   entier dans le titre ou la description — sinon « 2 » matcherait le moindre
//   prix ou numéro de téléphone et toutes les annonces resteraient affichées.

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[\s,.-]+/).filter(Boolean);
}

export function scoreAnnonce(query: string, item: any): number {
  const cleanQuery = (query || '').toLowerCase().trim();
  if (!cleanQuery) return 0;
  const queryWords = tokenize(cleanQuery);
  if (queryWords.length === 0) return 0;

  const title = (item.titre || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  const category = (item.categorie || '').toLowerCase();
  const sousCategorie = getSousCategorieSearchText(item.sous_categorie);
  const location = `${item.ville || ''} ${item.quartier || ''}`.toLowerCase();
  const titleTokens = tokenize(title);
  const descTokens = tokenize(desc);

  let score = 0;

  if (title.includes(cleanQuery)) {
    score += 20;
  } else if (desc.includes(cleanQuery)) {
    score += 10;
  }

  const significantCount = queryWords.filter((w) => w.length >= 3).length;
  let matchedSignificant = 0;
  let matchedAny = 0;

  for (const word of queryWords) {
    const isShort = word.length < 3;
    let wordMatched = false;

    if (isShort) {
      if (titleTokens.includes(word)) {
        score += 10;
        wordMatched = true;
      } else if (descTokens.includes(word)) {
        score += 4;
        wordMatched = true;
      }
    } else {
      if (title.includes(word)) {
        score += 8;
        wordMatched = true;
        if (titleTokens.includes(word)) {
          score += 4;
        }
      }
      if (desc.includes(word)) {
        score += 3;
        wordMatched = true;
        if (descTokens.includes(word)) {
          score += 1.5;
        }
      }
      if (category.includes(word)) {
        score += 4;
        wordMatched = true;
      }
      if (sousCategorie && sousCategorie.includes(word)) {
        score += 5;
        wordMatched = true;
      }
      if (location.includes(word)) {
        score += 2;
        wordMatched = true;
      }
      // Correspondance partielle sur les mots du titre (ex : requête
      // « playstation » vs titre « Play station 2 »)
      if (!wordMatched) {
        const partialMatch = titleTokens.some(
          (tw) => tw.length >= 3 && (tw.includes(word) || word.includes(tw))
        );
        if (partialMatch) {
          score += 2.5;
          wordMatched = true;
        }
      }
    }

    if (wordMatched) {
      matchedAny++;
      if (!isShort) matchedSignificant++;
    }
  }

  // Filtre strict : tous les mots significatifs doivent correspondre.
  if (significantCount > 0) {
    if (matchedSignificant < significantCount) return 0;
  } else if (matchedAny === 0) {
    // Requête composée uniquement de mots courts : au moins un doit matcher.
    return 0;
  }

  if (queryWords.length > 1 && matchedAny > 0) {
    score += (matchedAny / queryWords.length) * 10;
  }

  return score;
}

// Scoring des profils utilisateurs pour l'écran Recherche, avec la même règle
// stricte : tous les mots significatifs doivent correspondre au nom ou à la bio.
export function scoreUser(query: string, user: any): number {
  const cleanQuery = (query || '').toLowerCase().trim();
  if (!cleanQuery) return 0;
  const queryWords = tokenize(cleanQuery);
  if (queryWords.length === 0) return 0;

  const prenom = (user.prenom || '').toLowerCase();
  const nom = (user.nom || '').toLowerCase();
  const fullName = `${prenom} ${nom}`;
  const bio = (user.bio || '').toLowerCase();

  let score = 0;

  if (fullName.includes(cleanQuery)) {
    score += 20;
  }

  const significantCount = queryWords.filter((w) => w.length >= 3).length;
  let matchedSignificant = 0;
  let matchedAny = 0;

  for (const word of queryWords) {
    const isShort = word.length < 3;
    let wordMatched = false;

    if (prenom.includes(word) || nom.includes(word)) {
      score += 8;
      wordMatched = true;
      if (prenom === word || nom === word) {
        score += 4;
      }
    }
    if (!isShort && bio.includes(word)) {
      score += 3;
      wordMatched = true;
    }

    if (wordMatched) {
      matchedAny++;
      if (!isShort) matchedSignificant++;
    }
  }

  if (significantCount > 0) {
    if (matchedSignificant < significantCount) return 0;
  } else if (matchedAny === 0) {
    return 0;
  }

  if (queryWords.length > 1 && matchedAny > 0) {
    score += (matchedAny / queryWords.length) * 8;
  }

  return score;
}
