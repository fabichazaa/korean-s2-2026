import type { Word } from '../types';

const CHO_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const JUNG_LIST = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

const JONG_LIST = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

// Compound batchim decomposition & composition (e.g. ㄺ <-> ㄹ + ㄱ)
const COMPOUND_JONG_SPLIT: Record<string, [string, string]> = {
  'ㄳ': ['ㄱ', 'ㅅ'],
  'ㄵ': ['ㄴ', 'ㅈ'],
  'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'],
  'ㄻ': ['ㄹ', 'ㅁ'],
  'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'],
  'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ'],
};

const COMPOUND_JONG_JOIN: Record<string, string> = {
  'ㄱㅅ': 'ㄳ',
  'ㄴㅈ': 'ㄵ',
  'ㄴㅎ': 'ㄶ',
  'ㄹㄱ': 'ㄺ',
  'ㄹㅁ': 'ㄻ',
  'ㄹㅂ': 'ㄼ',
  'ㄹㅅ': 'ㄽ',
  'ㄹㅌ': 'ㄾ',
  'ㄹㅍ': 'ㄿ',
  'ㄹㅎ': 'ㅀ',
  'ㅂㅅ': 'ㅄ',
};

const COMPOUND_VOWEL_JOIN: Record<string, string> = {
  'ㅗㅏ': 'ㅘ',
  'ㅗㅐ': 'ㅙ',
  'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ',
  'ㅜㅔ': 'ㅞ',
  'ㅜㅣ': 'ㅟ',
  'ㅡㅣ': 'ㅢ',
};

// Smart confusable distractors for Korean learners
const CONFUSABLE_JAMO: Record<string, string[]> = {
  'ㅏ': ['ㅓ', 'ㅑ', 'ㅗ'],
  'ㅓ': ['ㅏ', 'ㅗ', 'ㅕ'],
  'ㅗ': ['ㅜ', 'ㅓ', 'ㅛ'],
  'ㅜ': ['ㅗ', 'ㅡ', 'ㅠ'],
  'ㅡ': ['ㅣ', 'ㅜ', 'ㅗ'],
  'ㅣ': ['ㅡ', 'ㅏ', 'ㅐ'],
  'ㅐ': ['ㅔ', 'ㅏ', 'ㅣ'],
  'ㅔ': ['ㅐ', 'ㅓ', 'ㅖ'],
  'ㅑ': ['ㅕ', 'ㅏ', 'ㅛ'],
  'ㅕ': ['ㅑ', 'ㅓ', 'ㅠ'],
  'ㅛ': ['ㅠ', 'ㅗ', 'ㅑ'],
  'ㅠ': ['ㅛ', 'ㅜ', 'ㅕ'],
  'ㅘ': ['ㅝ', 'ㅗ', 'ㅏ'],
  'ㅝ': ['ㅘ', 'ㅜ', 'ㅓ'],
  'ㅢ': ['ㅚ', 'ㅟ', 'ㅣ'],
  'ㅚ': ['ㅙ', 'ㅟ', 'ㅗ'],
  'ㅟ': ['ㅚ', 'ㅢ', 'ㅜ'],
  'ㄱ': ['ㅋ', 'ㄲ', 'ㄴ'],
  'ㄲ': ['ㄱ', 'ㅋ', 'ㅆ'],
  'ㅋ': ['ㄱ', 'ㅌ', 'ㅊ'],
  'ㄴ': ['ㄷ', 'ㄹ', 'ㅁ'],
  'ㄷ': ['ㅌ', 'ㄸ', 'ㄴ'],
  'ㄸ': ['ㄷ', 'ㅌ', 'ㅃ'],
  'ㅌ': ['ㄷ', 'ㅋ', 'ㅍ'],
  'ㄹ': ['ㄴ', 'ㄷ', 'ㅁ'],
  'ㅁ': ['ㅂ', 'ㅇ', 'ㄴ'],
  'ㅂ': ['ㅍ', 'ㅃ', 'ㅁ'],
  'ㅃ': ['ㅂ', 'ㅍ', 'ㄸ'],
  'ㅍ': ['ㅂ', 'ㅌ', 'ㅎ'],
  'ㅅ': ['ㅆ', 'ㅈ', 'ㅊ'],
  'ㅆ': ['ㅅ', 'ㅉ', 'ㄲ'],
  'ㅇ': ['ㅎ', 'ㅁ', 'ㄴ'],
  'ㅈ': ['ㅊ', 'ㅉ', 'ㅅ'],
  'ㅉ': ['ㅈ', 'ㅊ', 'ㅆ'],
  'ㅊ': ['ㅈ', 'ㅋ', 'ㅅ'],
  'ㅎ': ['ㅇ', 'ㅍ', 'ㅋ'],
};

const FALLBACK_CONSONANTS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ'];
const FALLBACK_VOWELS = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ', 'ㅐ', 'ㅔ'];

export function isVowelJamo(ch: string): boolean {
  return JUNG_LIST.includes(ch);
}

export function isConsonantJamo(ch: string): boolean {
  return CHO_LIST.includes(ch);
}

// Clean Korean target string (take first option before "/" and strip spaces/punctuation)
export function getPrimaryKoreanTarget(word: Word): string {
  return word.korean.split('/')[0].replace(/\s+/g, '').trim();
}

// Decompose a Korean string into a sequence of touch-friendly Jamo tokens
export function decomposeHangulToJamoList(text: string): string[] {
  const clean = text.replace(/\s+/g, '');
  const result: string[] = [];

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const syllableIndex = code - 0xac00;
      const choIdx = Math.floor(syllableIndex / (21 * 28));
      const jungIdx = Math.floor((syllableIndex % (21 * 28)) / 28);
      const jongIdx = syllableIndex % 28;

      result.push(CHO_LIST[choIdx]);
      result.push(JUNG_LIST[jungIdx]);

      if (jongIdx > 0) {
        const jongChar = JONG_LIST[jongIdx];
        if (COMPOUND_JONG_SPLIT[jongChar]) {
          result.push(...COMPOUND_JONG_SPLIT[jongChar]);
        } else {
          result.push(jongChar);
        }
      }
    } else if (CHO_LIST.includes(clean[i]) || JUNG_LIST.includes(clean[i])) {
      result.push(clean[i]);
    }
  }

  return result;
}

// Real-time Korean IME assembler: converts an array of tapped Jamo into composed Hangul blocks
export function composeHangulFromJamoList(rawTokens: string[]): string {
  // Pre-merge adjacent compound vowels if user tapped e.g. ㅗ + ㅏ -> ㅘ
  const tokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const curr = rawTokens[i];
    const next = rawTokens[i + 1];
    if (curr && next && COMPOUND_VOWEL_JOIN[curr + next]) {
      tokens.push(COMPOUND_VOWEL_JOIN[curr + next]);
      i += 1;
    } else {
      tokens.push(curr);
    }
  }

  let output = '';
  let i = 0;

  while (i < tokens.length) {
    const t0 = tokens[i];
    const t1 = tokens[i + 1];

    const choIdx = CHO_LIST.indexOf(t0);
    const jungIdx = t1 ? JUNG_LIST.indexOf(t1) : -1;

    // Start of a syllable: Consonant + Vowel
    if (choIdx !== -1 && jungIdx !== -1) {
      let jongIdx = 0;
      i += 2; // Consumed cho and jung

      // Check if next token is a consonant that can serve as batchim (jong)
      const nextC1 = tokens[i];
      const afterC1 = tokens[i + 1];

      if (nextC1 && JONG_LIST.includes(nextC1)) {
        // If afterC1 is a vowel, nextC1 must be the initial consonant (cho) of the NEXT syllable!
        const nextIsStartOfNewSyllable = afterC1 && isVowelJamo(afterC1);

        if (!nextIsStartOfNewSyllable) {
          jongIdx = JONG_LIST.indexOf(nextC1);
          i += 1;

          // Check for compound batchim (e.g. ㄹ + ㄱ -> ㄺ)
          const nextC2 = tokens[i];
          const afterC2 = tokens[i + 1];
          const compoundJong = nextC2 ? COMPOUND_JONG_JOIN[nextC1 + nextC2] : undefined;

          if (compoundJong && !(afterC2 && isVowelJamo(afterC2))) {
            jongIdx = JONG_LIST.indexOf(compoundJong);
            i += 1;
          }
        }
      }

      const syllableCode = 0xac00 + choIdx * 21 * 28 + jungIdx * 28 + jongIdx;
      output += String.fromCharCode(syllableCode);
    } else {
      // Standalone jamo (e.g. consonant waiting for a vowel)
      output += t0;
      i += 1;
    }
  }

  return output;
}

// Generate a shuffled pad of 10-12 Jamo buttons (consonants first, then vowels) for a given word
export function generateJamoPadForWord(word: Word): {
  consonants: string[];
  vowels: string[];
  requiredJamoCount: number;
} {
  const primary = getPrimaryKoreanTarget(word);
  const requiredTokens = decomposeHangulToJamoList(primary);

  // Also include Jamo from present form if available so the user can write either form!
  const presentTokens = word.present
    ? decomposeHangulToJamoList(word.present.replace(/\s+/g, ''))
    : [];

  const uniqueConsonants = new Set<string>();
  const uniqueVowels = new Set<string>();

  for (const t of [...requiredTokens, ...presentTokens]) {
    if (isVowelJamo(t)) {
      uniqueVowels.add(t);
    } else if (isConsonantJamo(t)) {
      uniqueConsonants.add(t);
    }
  }

  // Add smart confusable distractors so the pad has ~6 consonants and ~4-6 vowels (10-12 total)
  const targetConsonantCount = Math.max(6, uniqueConsonants.size + 1);
  const targetVowelCount = Math.max(4, uniqueVowels.size + 1);

  const seedJamo = [...uniqueConsonants, ...uniqueVowels];
  for (const jamo of seedJamo) {
    const candidates = CONFUSABLE_JAMO[jamo] || [];
    for (const cand of candidates) {
      if (isConsonantJamo(cand) && uniqueConsonants.size < targetConsonantCount) {
        uniqueConsonants.add(cand);
      } else if (isVowelJamo(cand) && uniqueVowels.size < targetVowelCount) {
        uniqueVowels.add(cand);
      }
    }
  }

  for (const c of FALLBACK_CONSONANTS) {
    if (uniqueConsonants.size >= targetConsonantCount) break;
    uniqueConsonants.add(c);
  }
  for (const v of FALLBACK_VOWELS) {
    if (uniqueVowels.size >= targetVowelCount) break;
    uniqueVowels.add(v);
  }

  // Sort in standard Korean dictionary order so the pad feels predictable and easy to scan!
  const sortedConsonants = Array.from(uniqueConsonants).sort(
    (a, b) => CHO_LIST.indexOf(a) - CHO_LIST.indexOf(b)
  );
  const sortedVowels = Array.from(uniqueVowels).sort(
    (a, b) => JUNG_LIST.indexOf(a) - JUNG_LIST.indexOf(b)
  );

  return {
    consonants: sortedConsonants,
    vowels: sortedVowels,
    requiredJamoCount: requiredTokens.length,
  };
}

export function checkWrittenKoreanMatch(word: Word, composedInput: string): boolean {
  const cleanInput = composedInput.replace(/\s+/g, '').trim();
  if (!cleanInput) return false;

  const validTargets = new Set<string>();
  word.korean.split('/').forEach((part) => {
    const cleaned = part.replace(/\s+/g, '').trim();
    if (cleaned) validTargets.add(cleaned);
  });

  if (word.present) {
    validTargets.add(word.present.replace(/\s+/g, '').trim());
  }
  if (word.verbForms?.present) {
    validTargets.add(word.verbForms.present.replace(/\s+/g, '').trim());
  }

  return validTargets.has(cleanInput);
}

