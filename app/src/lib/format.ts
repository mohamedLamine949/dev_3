/**
 * Formatage des montants et des nombres — source unique.
 *
 * Avant, `formatPrix` était recopié dans six écrans avec trois comportements
 * différents : certains abrégeaient au-dessus du million, d'autres non, et les
 * suffixes oscillaient entre « F » et « FCFA ». Le même prix ne s'écrivait pas
 * pareil sur la carte et sur la fiche.
 *
 * Règles retenues (dossier directeur §15.2) :
 *  - séparateur de milliers systématique : 150 000 FCFA ;
 *  - suffixe « FCFA » en toutes lettres partout où la place le permet ;
 *  - abréviation réservée aux cartes de liste, où la largeur est contrainte.
 *
 * Le groupement est fait à la main plutôt que par `toLocaleString` : selon le
 * moteur JS embarqué, `fr-FR` insère une espace fine insécable qui se rend mal
 * dans certaines polices, et l'API Intl n'est pas garantie sur tous les
 * appareils Android bas de gamme visés.
 */

/** 150000 → « 150 000 ». Gère les décimales et les valeurs négatives. */
export function groupThousands(value: number, decimals = 0): string {
  if (!isFinite(value)) return '0';
  const negatif = value < 0;
  const abs = Math.abs(value);
  const fixed = decimals > 0 ? abs.toFixed(decimals) : Math.round(abs).toString();
  const [entier, dec] = fixed.split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (negatif ? '-' : '') + groupe + (dec ? ',' + dec : '');
}

/** Montant complet : « 150 000 FCFA ». À utiliser partout où la place le permet. */
export function formatPrix(prix: number | string | null | undefined): string {
  const n = typeof prix === 'number' ? prix : Number(prix);
  if (!isFinite(n)) return '— FCFA';
  return groupThousands(n) + ' FCFA';
}

/**
 * Montant abrégé pour les cartes de liste, où la largeur est contrainte :
 * « 1,5 M FCFA » au-dessus du million, montant complet en dessous.
 */
export function formatPrixCompact(prix: number | string | null | undefined): string {
  const n = typeof prix === 'number' ? prix : Number(prix);
  if (!isFinite(n)) return '— FCFA';
  if (Math.abs(n) >= 1000000) {
    const millions = n / 1000000;
    const decimales = Math.abs(n) % 1000000 === 0 ? 0 : 1;
    return groupThousands(millions, decimales) + ' M FCFA';
  }
  return groupThousands(n) + ' FCFA';
}

/** Nombre simple avec séparateur de milliers, sans devise : « 1 240 vues ». */
export function formatNombre(valeur: number | string | null | undefined): string {
  const n = typeof valeur === 'number' ? valeur : Number(valeur);
  if (!isFinite(n)) return '0';
  return groupThousands(n);
}
