import type { Word } from '../types';

export function speakKorean(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    // Clean slash alternatives so TTS reads naturally
    const cleanText = text.split('/')[0].trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.88; // Slower rate for clear language learning pronunciation

    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find((v) => v.lang.toLowerCase().includes('ko'));
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    if (onEnd) {
      let called = false;
      const done = () => {
        if (called) return;
        called = true;
        window.clearTimeout(fallbackTimer);
        onEnd();
      };
      const fallbackTimer = window.setTimeout(done, 1100);
      utterance.onend = done;
      utterance.onerror = done;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis not available or error occurred:', err);
    if (onEnd) onEnd();
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

// Convert Arabic digits that Korean STT often produces (e.g., "1월" -> "일월")
const SINO_DIGIT_MAP: Record<string, string> = {
  '12': '십이',
  '11': '십일',
  '10': '십',
  '1': '일',
  '2': '이',
  '3': '삼',
  '4': '사',
  '5': '오',
  '6': '유', // for 6월 -> 유월 (also handled below)
  '7': '칠',
  '8': '팔',
  '9': '구',
};

function normalizeKorean(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?~"'()\[\]\s\-_/]/g, '')
    .trim();
}

function expandDigitVariants(text: string): string[] {
  const cleaned = normalizeKorean(text);
  const variants = new Set<string>([cleaned]);

  // Special month rules in Korean STT ("6월" -> "유월", "10월" -> "시월")
  const monthNormalized = cleaned
    .replace(/12월/g, '십이월')
    .replace(/11월/g, '십일월')
    .replace(/10월/g, '시월')
    .replace(/6월/g, '유월')
    .replace(/1월/g, '일월')
    .replace(/2월/g, '이월')
    .replace(/3월/g, '삼월')
    .replace(/4월/g, '사월')
    .replace(/5월/g, '오월')
    .replace(/7월/g, '칠월')
    .replace(/8월/g, '팔월')
    .replace(/9월/g, '구월');
  variants.add(monthNormalized);

  // Generic Sino-Korean number replacement
  let genericDigits = cleaned;
  for (const [digit, hangul] of Object.entries(SINO_DIGIT_MAP)) {
    genericDigits = genericDigits.replace(new RegExp(digit, 'g'), hangul);
  }
  variants.add(genericDigits);
  variants.add(cleaned.replace(/6/g, '육'));

  return Array.from(variants);
}

// Decompose Hangul string into individual Jamo characters for phonetic similarity scoring
function decomposeHangulToJamo(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const syllableIndex = code - 0xac00;
      const cho = Math.floor(syllableIndex / (21 * 28));
      const jung = Math.floor((syllableIndex % (21 * 28)) / 28);
      const jong = syllableIndex % 28;
      result += `${cho},${jung},${jong};`;
    } else {
      result += str[i];
    }
  }
  return result;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function getAcceptedTargetsForWord(word: Word): string[] {
  const targets = new Set<string>();

  // For verbs/adjectives both the infinitive (가다) and the polite present (가요)
  // are accepted. Phrases with an object particle (영화를 보다) are also accepted
  // without it (영화 봐요 / 수영해요), as people (and STT) often drop it.
  const addForm = (form?: string) => {
    if (!form) return;
    const clean = normalizeKorean(form);
    if (!clean) return;
    targets.add(clean);
    const tokens = form.trim().split(/\s+/);
    if (tokens.length > 1 && /[을를이가]$/.test(tokens[0])) {
      const withoutParticle = normalizeKorean(
        [tokens[0].replace(/[을를이가]$/, ''), ...tokens.slice(1)].join('')
      );
      if (withoutParticle) targets.add(withoutParticle);
    }
  };

  // Split "/" alternatives (e.g. "아래 / 밑" -> ["아래", "밑"])
  word.korean.split('/').forEach((part) => addForm(part));

  addForm(word.present);
  addForm(word.verbForms?.present);
  addForm(word.verbForms?.honorific);
  if (word.verbForms?.pronunciation) {
    word.verbForms.pronunciation.split('→').forEach((part) => {
      const clean = normalizeKorean(part);
      if (clean) targets.add(clean);
    });
  }

  return Array.from(targets).filter(Boolean);
}

export interface PronunciationMatchResult {
  matched: boolean;
  isClose: boolean;
  bestTranscript: string;
  matchedTarget?: string;
}

export function checkKoreanPronunciationMatch(
  word: Word,
  spokenAlternatives: string[]
): PronunciationMatchResult {
  const targets = getAcceptedTargetsForWord(word);
  let bestSimilarity = 0;
  let bestTranscript = spokenAlternatives[0] ?? '';

  for (const rawSpoken of spokenAlternatives) {
    const spokenVariants = expandDigitVariants(rawSpoken);

    for (const spoken of spokenVariants) {
      if (!spoken) continue;

      for (const target of targets) {
        // 1. Exact match or polite suffix "-요" / "-입니다" variation
        if (
          spoken === target ||
          spoken === `${target}요` ||
          spoken === `${target}입니다` ||
          spoken === `${target}이에요` ||
          spoken === `${target}예요` ||
          (target.length >= 2 && spoken.includes(target))
        ) {
          return {
            matched: true,
            isClose: true,
            bestTranscript: rawSpoken.trim(),
            matchedTarget: target,
          };
        }

        // 2. Jamo-level phonetic similarity for multi-syllable words
        const jamoSpoken = decomposeHangulToJamo(spoken);
        const jamoTarget = decomposeHangulToJamo(target);
        const maxLen = Math.max(jamoSpoken.length, jamoTarget.length);
        if (maxLen > 0) {
          const dist = levenshteinDistance(jamoSpoken, jamoTarget);
          const similarity = 1 - dist / maxLen;
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestTranscript = rawSpoken.trim();
          }

          // High phonetic similarity (e.g. minor batchim assimilation difference)
          if (target.length >= 2 && similarity >= 0.82) {
            return {
              matched: true,
              isClose: true,
              bestTranscript: rawSpoken.trim(),
              matchedTarget: target,
            };
          }
        }
      }
    }
  }

  return {
    matched: false,
    isClose: bestSimilarity >= 0.6,
    bestTranscript: bestTranscript.trim(),
  };
}

let sharedAudioCtx: AudioContext | null = null;

// Synthesized Duolingo-like sound effects using Web Audio API (no external assets needed)
export function playGameSound(type: 'correct' | 'streak' | 'wrong' | 'complete'): void {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;

    if (type === 'correct') {
      // Bright two-note ascending chime (E5 -> B5)
      const notes = [659.25, 987.77];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.095);
        gain.gain.setValueAtTime(0.16, now + idx * 0.095);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.095 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.095);
        osc.stop(now + idx * 0.095 + 0.3);
      });
    } else if (type === 'streak') {
      // Energetic 3-note arpeggio (C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.075);
        gain.gain.setValueAtTime(0.18, now + idx * 0.075);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.075);
        osc.stop(now + idx * 0.075 + 0.27);
      });
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.linearRampToValueAtTime(180, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (type === 'complete') {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.16, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.38);
      });
    }
  } catch {
    // Ignore audio errors if blocked by browser autoplay policy
  }
}

