/**
 * Permet aux scripts Node de `require()` directement les modules TypeScript
 * de `src/` — sans dépendance nouvelle ni étape de build.
 *
 * Pourquoi : la logique de catégorisation doit vivre dans l'application
 * (elle sert à la publication) ET être exécutable en ligne de commande pour
 * analyser les annonces déjà en ligne. Dupliquer le vocabulaire dans un
 * script serait la garantie que les deux divergent au premier ajout de mot.
 *
 * `typescript` est déjà une dépendance du projet ; on transpile en mémoire,
 * rien n'est écrit sur le disque.
 */
const fs = require('fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
