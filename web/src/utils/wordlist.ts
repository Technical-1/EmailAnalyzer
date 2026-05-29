/**
 * Dependency-free passphrase wordlist.
 *
 * Generated deterministically at module load from short consonant/vowel
 * syllable fragments to produce >= 1296 unique, pronounceable, lowercase
 * words. This gives >= ~10.3 bits of entropy per word without bundling a
 * large external file or adding a dependency.
 *
 * The list is frozen and stable across runs (no randomness here).
 */

const ONSETS = [
  'b', 'br', 'c', 'cl', 'cr', 'd', 'dr', 'f', 'fl', 'fr', 'g', 'gl', 'gr',
  'h', 'j', 'k', 'l', 'm', 'n', 'p', 'pl', 'pr', 'r', 's', 'sk', 'sl', 'sn',
  'sp', 'st', 'sw', 't', 'tr', 'v', 'w', 'z',
];

const NUCLEI = ['a', 'e', 'i', 'o', 'u'];

const CODAS = ['b', 'ck', 'd', 'ft', 'g', 'ld', 'll', 'm', 'n', 'nd', 'ng', 'nt', 'p', 'r', 'sh', 'sk', 'st', 't', 'x', 'z'];

function buildWordlist(): string[] {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const onset of ONSETS) {
    for (const nucleus of NUCLEI) {
      for (const coda of CODAS) {
        const word = onset + nucleus + coda;
        if (!seen.has(word)) {
          seen.add(word);
          words.push(word);
        }
      }
    }
  }
  return words;
}

// 35 onsets * 5 nuclei * 20 codas = 3500 candidate words (all unique here).
export const WORDLIST: readonly string[] = Object.freeze(buildWordlist());
