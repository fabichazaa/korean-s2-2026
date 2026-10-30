<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  Mic,
  MicOff,
  Flame,
  Eye,
  EyeOff,
  RefreshCw,
  Volume2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-vue-next';
import type { Word, WordCategory } from '../types';
import { WORDS, CATEGORY_ORDER, CATEGORY_TITLES, shuffleWords } from '../data/words';
import {
  speakKorean,
  isSpeechRecognitionSupported,
  checkKoreanPronunciationMatch,
  playGameSound,
} from '../utils/speech';

defineProps<{
  knownIds: string[];
}>();

const emit = defineEmits<{
  (e: 'mark-known', wordId: string): void;
}>();

type FeedbackState = 'idle' | 'listening' | 'success' | 'retry' | 'error';

const BEST_SCORE_KEY = 'nuri-voice-game-best-score-v1';

// State
const selectedCategory = ref<WordCategory | 'all'>('all');
const alwaysShowHangul = ref(false); // Like Duolingo: Spanish only by default, or toggle eye to always show Hangul
const hintRevealed = ref(false);

const deck = ref<Word[]>([]);
const currentIndex = ref(0);
const score = ref(0);
const bestScore = ref(0);
const streak = ref(0);
const wordsCompleted = ref(0);
const lastPointsEarned = ref(0);

// Voice State
const isListening = ref(false);
const feedbackState = ref<FeedbackState>('idle');
const heardText = ref('');
const errorMessage = ref('');
const speechSupported = ref(true);
const isSecureContextFlag = ref(true);
const isIosChrome = ref(false);

let recognition: any = null;
let advanceTimer: number | undefined;

const categoryCounts = computed(() => {
  const counts: { category: WordCategory | 'all'; label: string; count: number }[] = [
    { category: 'all', label: 'Todas', count: WORDS.length },
  ];
  for (const cat of CATEGORY_ORDER) {
    const total = WORDS.filter((w) => w.category === cat).length;
    if (total > 0) {
      const label = CATEGORY_TITLES[cat].split(' (')[0];
      counts.push({ category: cat, label, count: total });
    }
  }
  return counts;
});

const filteredPool = computed(() => {
  if (selectedCategory.value === 'all') return WORDS;
  return WORDS.filter((w) => w.category === selectedCategory.value);
});

const currentWord = computed<Word | null>(() => {
  if (deck.value.length === 0) return null;
  return deck.value[currentIndex.value % deck.value.length] ?? null;
});

const showHangul = computed(() => {
  return (
    alwaysShowHangul.value ||
    hintRevealed.value ||
    feedbackState.value === 'success'
  );
});

// Progress bar fills up every 10 words completed (round progress)
const progressPercent = computed(() => {
  const inRound = wordsCompleted.value % 10;
  if (wordsCompleted.value > 0 && inRound === 0 && feedbackState.value === 'success') {
    return 100;
  }
  return Math.max(8, inRound * 10);
});

const streakMultiplier = computed(() => {
  if (streak.value >= 10) return 3;
  if (streak.value >= 5) return 2;
  if (streak.value >= 3) return 1.5;
  return 1;
});

const buildDeck = () => {
  deck.value = shuffleWords(filteredPool.value);
  currentIndex.value = 0;
  resetCardState();
};

const resetCardState = () => {
  if (advanceTimer) {
    window.clearTimeout(advanceTimer);
    advanceTimer = undefined;
  }
  hintRevealed.value = false;
  heardText.value = '';
  errorMessage.value = '';
  if (feedbackState.value !== 'listening') {
    feedbackState.value = 'idle';
  }
};

const stopRecognition = (useStop = false) => {
  isListening.value = false;
  if (recognition) {
    try {
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      if (useStop) {
        recognition.stop();
      } else {
        recognition.abort();
      }
    } catch {
      // Ignore abort/stop errors
    }
    recognition = null;
  }
  if (feedbackState.value === 'listening') {
    feedbackState.value = 'idle';
  }
};

const startRecognition = () => {
  if (!currentWord.value || feedbackState.value === 'success') return;

  if (!isSecureContextFlag.value) {
    feedbackState.value = 'error';
    errorMessage.value = 'Abre la app con https:// para usar el micrófono en el celular.';
    return;
  }

  const SpeechRecognitionCtor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionCtor) {
    speechSupported.value = false;
    feedbackState.value = 'error';
    errorMessage.value = isIosChrome.value
      ? 'En iPhone, abre este link en Safari para usar el micrófono.'
      : 'Usa Safari (iPhone) o Chrome (Android/PC) para hablar.';
    return;
  }

  if (recognition) {
    stopRecognition(false);
  }

  try {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    recognition = new SpeechRecognitionCtor();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = true;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) {
      try {
        recognition.maxAlternatives = 5;
      } catch {
        // Ignore
      }
    }

    isListening.value = true;
    feedbackState.value = 'listening';
    errorMessage.value = '';

    recognition.onstart = () => {
      isListening.value = true;
      feedbackState.value = 'listening';
      errorMessage.value = '';
    };

    recognition.onresult = (event: any) => {
      if (!currentWord.value || feedbackState.value === 'success') return;

      const alternatives: string[] = [];
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) isFinal = true;
        for (let j = 0; j < res.length; j++) {
          if (res[j]?.transcript) {
            alternatives.push(res[j].transcript);
          }
        }
      }

      if (alternatives.length === 0) return;
      heardText.value = alternatives[0].trim();

      const matchResult = checkKoreanPronunciationMatch(currentWord.value, alternatives);

      if (matchResult.matched) {
        handlePronunciationSuccess(matchResult.bestTranscript);
      } else if (isFinal) {
        handlePronunciationRetry(matchResult.bestTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      isListening.value = false;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        feedbackState.value = 'error';
        errorMessage.value = 'Permite el acceso al micrófono en tu navegador.';
      } else if (event.error === 'no-speech') {
        if (feedbackState.value !== 'success') {
          feedbackState.value = 'idle';
        }
      } else if (event.error !== 'aborted') {
        feedbackState.value = 'error';
        errorMessage.value = 'No se escuchó bien, intenta de nuevo.';
      }
    };

    recognition.onend = () => {
      isListening.value = false;
      if (feedbackState.value === 'listening') {
        feedbackState.value = 'idle';
      }
    };

    recognition.start();
  } catch {
    isListening.value = false;
    feedbackState.value = 'error';
    errorMessage.value = 'No se pudo iniciar el micrófono.';
  }
};

const toggleMic = () => {
  if (isListening.value) {
    stopRecognition(true);
  } else {
    startRecognition();
  }
};

const handlePronunciationSuccess = (transcript: string) => {
  stopRecognition(false);
  feedbackState.value = 'success';
  heardText.value = transcript;

  const basePoints = !alwaysShowHangul.value && !hintRevealed.value ? 15 : 10;
  streak.value += 1;

  const earned = Math.round(basePoints * streakMultiplier.value);
  lastPointsEarned.value = earned;
  score.value += earned;
  wordsCompleted.value += 1;

  if (score.value > bestScore.value) {
    bestScore.value = score.value;
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore.value));
    } catch {
      // Ignore
    }
  }

  if (currentWord.value) {
    emit('mark-known', currentWord.value.id);
  }

  if (streak.value > 0 && streak.value % 5 === 0) {
    playGameSound('streak');
  } else {
    playGameSound('correct');
  }

  advanceTimer = window.setTimeout(() => {
    nextCard(true);
  }, 1150);
};

const handlePronunciationRetry = (transcript: string) => {
  stopRecognition(false);
  feedbackState.value = 'retry';
  heardText.value = transcript;
  streak.value = 0;
  playGameSound('wrong');
};

const nextCard = (fromSuccess = false) => {
  stopRecognition(false);
  if (!fromSuccess) {
    streak.value = 0;
  }

  if (currentIndex.value + 1 >= deck.value.length) {
    deck.value = shuffleWords(filteredPool.value);
    currentIndex.value = 0;
  } else {
    currentIndex.value += 1;
  }

  resetCardState();
};

const handleCardTap = () => {
  if (!currentWord.value) return;
  hintRevealed.value = true;
  stopRecognition(false);
  speakKorean(currentWord.value.present || currentWord.value.korean);
};

const selectCategory = (cat: WordCategory | 'all') => {
  stopRecognition(false);
  selectedCategory.value = cat;
  buildDeck();
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    toggleMic();
  } else if (event.key.toLowerCase() === 'l') {
    event.preventDefault();
    handleCardTap();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    nextCard(false);
  }
};

watch(selectedCategory, () => {
  buildDeck();
});

onMounted(() => {
  isSecureContextFlag.value = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : true;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  isIosChrome.value = /CriOS/i.test(ua);
  speechSupported.value = isSpeechRecognitionSupported();
  try {
    const savedBest = window.localStorage.getItem(BEST_SCORE_KEY);
    if (savedBest) {
      bestScore.value = parseInt(savedBest, 10) || 0;
    }
  } catch {
    // Ignore
  }
  buildDeck();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  stopRecognition(false);
  if (advanceTimer) window.clearTimeout(advanceTimer);
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <section class="duo-voice-screen mx-auto max-w-[540px] pt-2 pb-16">
    <!-- Category Filter Chips -->
    <div class="category-scroll-list no-scrollbar mb-3">
      <button
        v-for="cat in categoryCounts"
        :key="cat.category"
        type="button"
        @click="selectCategory(cat.category)"
        :class="['nuri-cat-chip', selectedCategory === cat.category ? 'is-active' : '']"
      >
        <span>{{ cat.label }}</span>
        <span class="nuri-cat-badge">{{ cat.count }}</span>
      </button>
    </div>

    <!-- Duolingo-Style Top Progress & Streak Bar -->
    <div class="duo-top-bar">
      <!-- Toggle Hangul visibility button (left icon like Duolingo's gear) -->
      <button
        type="button"
        @click="alwaysShowHangul = !alwaysShowHangul"
        :class="['duo-icon-toggle', alwaysShowHangul ? 'is-active' : '']"
        :title="alwaysShowHangul ? 'Ocultar Hangul por defecto' : 'Mostrar siempre Hangul'"
      >
        <Eye v-if="alwaysShowHangul" :size="18" />
        <EyeOff v-else :size="18" />
      </button>

      <!-- Progress Track -->
      <div class="duo-progress-track">
        <div
          class="duo-progress-fill"
          :style="{ width: `${progressPercent}%` }"
        >
          <div class="duo-progress-shine" />
        </div>
      </div>

      <!-- Streak & XP Counter (Right side like Duolingo timer) -->
      <div class="duo-streak-badge" :class="{ 'is-hot': streak > 0 }">
        <Flame :size="18" class="streak-icon" />
        <span>{{ streak }}</span>
        <span v-if="score > 0" class="xp-mini">· {{ score }} XP</span>
      </div>
    </div>

    <!-- Stacked Card Deck (Duolingo 3D Stack) -->
    <div v-if="currentWord" class="duo-deck-stage">
      <div class="duo-card-stack">
        <!-- Background stacked cards peeking at the top -->
        <div class="stack-layer layer-3" />
        <div class="stack-layer layer-2" />
        <div class="stack-layer layer-1" />

        <!-- Front Active Card (Tap card to hear / reveal Hangul hint) -->
        <button
          type="button"
          @click="handleCardTap"
          :class="[
            'duo-front-card',
            isListening ? 'is-listening' : '',
            feedbackState === 'success' ? 'is-success' : '',
            feedbackState === 'retry' ? 'is-retry' : '',
          ]"
          title="Toca la tarjeta para escuchar y ver en coreano"
        >
          <!-- Subtle speaker hint in top-right corner of card -->
          <span class="card-audio-corner">
            <Volume2 :size="16" />
          </span>

          <!-- Main Spanish Word Centered -->
          <span class="duo-card-word">
            {{ currentWord.spanish }}
          </span>

          <!-- Korean Hangul (shown if toggled, tapped, or answered) -->
          <span v-if="showHangul" class="duo-card-hangul">
            {{ currentWord.korean }}
            <small
              v-if="currentWord.present && currentWord.present !== currentWord.korean"
              class="duo-card-present"
            >
              ({{ currentWord.present }})
            </small>
          </span>

          <!-- Live feedback pill inside bottom of card -->
          <span v-if="feedbackState === 'success'" class="card-feedback-pill is-ok">
            <CheckCircle2 :size="15" />
            <span>{{ heardText }} · +{{ lastPointsEarned }} XP</span>
          </span>
          <span v-else-if="feedbackState === 'retry'" class="card-feedback-pill is-warn">
            <AlertCircle :size="15" />
            <span>"{{ heardText || '...' }}" · Intenta de nuevo</span>
          </span>
          <span v-else-if="feedbackState === 'error'" class="card-feedback-pill is-err">
            <MicOff :size="14" />
            <span>{{ errorMessage }}</span>
          </span>
          <span v-else-if="isListening && heardText" class="card-feedback-pill is-listening">
            <span>{{ heardText }}</span>
          </span>
        </button>
      </div>

      <!-- Duolingo Action Row: Wide Mic Button + Square Skip Button -->
      <div class="duo-actions-row">
        <!-- Wide 3D Microphone Button -->
        <button
          type="button"
          :disabled="feedbackState === 'success'"
          @click="toggleMic"
          :class="[
            'duo-mic-btn',
            isListening ? 'is-listening' : '',
            feedbackState === 'success' ? 'is-success' : '',
          ]"
          aria-label="Hablar por micrófono"
        >
          <CheckCircle2 v-if="feedbackState === 'success'" :size="28" :stroke-width="2.5" />
          <Mic v-else :size="28" :stroke-width="2.4" />
        </button>

        <!-- Square 3D Skip / Next Card Button -->
        <button
          type="button"
          @click="nextCard(false)"
          class="duo-skip-btn"
          aria-label="Cambiar palabra"
          title="Siguiente palabra"
        >
          <RefreshCw :size="24" :stroke-width="2.4" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.category-scroll-list {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0.15rem 0.1rem 0.35rem;
}

.nuri-cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  transition: all 0.18s ease;
}

.nuri-cat-chip.is-active {
  background: var(--primary);
  color: #ffffff;
  border-color: var(--primary);
}

.nuri-cat-badge {
  font-size: 0.65rem;
  padding: 0.04rem 0.36rem;
  border-radius: 9999px;
  background: rgba(30, 35, 56, 0.07);
  font-weight: 700;
}

.nuri-cat-chip.is-active .nuri-cat-badge {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

/* Top Progress & Streak Bar */
.duo-top-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0.2rem;
  margin-bottom: 1.5rem;
}

.duo-icon-toggle {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-foreground);
  background: #ffffff;
  border: 1px solid var(--border);
  transition: all 0.18s ease;
  flex-shrink: 0;
}

.duo-icon-toggle:hover {
  border-color: rgba(88, 72, 196, 0.35);
  color: var(--primary);
}

.duo-icon-toggle.is-active {
  color: var(--primary);
  background: var(--primary-light);
  border-color: rgba(88, 72, 196, 0.35);
}

.duo-progress-track {
  flex: 1;
  height: 12px;
  background: #e4e8f5;
  border-radius: 9999px;
  overflow: hidden;
  position: relative;
}

.duo-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #5848c4 0%, #7c6df0 100%);
  border-radius: 9999px;
  transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.duo-progress-shine {
  position: absolute;
  top: 2px;
  left: 8px;
  right: 8px;
  height: 3px;
  background: rgba(255, 255, 255, 0.28);
  border-radius: 9999px;
}

.duo-streak-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--muted-foreground);
  background: #ffffff;
  border: 1px solid var(--border);
  padding: 0.28rem 0.65rem;
  border-radius: 9999px;
  flex-shrink: 0;
}

.duo-streak-badge.is-hot {
  color: #ea580c;
  background: #fff7ed;
  border-color: #fed7aa;
}

.streak-icon {
  fill: currentColor;
}

.xp-mini {
  font-size: 0.76rem;
  color: var(--primary);
  font-weight: 800;
  margin-left: 0.1rem;
}

/* Stacked Deck Stage */
.duo-deck-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0.5rem;
}

.duo-card-stack {
  position: relative;
  width: 100%;
  max-width: 340px;
  padding-top: 22px;
  margin-bottom: 1.35rem;
}

.stack-layer {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: #ffffff;
  border: 1.5px solid var(--border);
  border-radius: 26px;
  height: 100%;
  pointer-events: none;
}

.stack-layer.layer-3 {
  top: 0;
  width: 76%;
  height: 60px;
  opacity: 0.55;
  background: #f3f5fc;
}

.stack-layer.layer-2 {
  top: 7px;
  width: 84%;
  height: 60px;
  opacity: 0.78;
  background: #f8f9fe;
}

.stack-layer.layer-1 {
  top: 14px;
  width: 92%;
  height: 60px;
}

.duo-front-card {
  position: relative;
  z-index: 2;
  width: 100%;
  min-height: 245px;
  background: var(--card);
  border: 1.5px solid var(--border);
  border-bottom: 4px solid #cfd6ec;
  border-radius: 26px;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.65rem;
  box-shadow: var(--shadow-md);
  transition: all 0.2s ease;
  cursor: pointer;
}

@media (min-width: 640px) {
  .duo-card-stack {
    max-width: 380px;
  }
  .duo-front-card {
    min-height: 275px;
  }
}

.duo-front-card.is-listening {
  border-color: var(--primary);
  border-bottom-color: var(--primary-hover);
  box-shadow: 0 12px 32px var(--primary-glow);
}

.duo-front-card.is-success {
  border-color: #10b981;
  border-bottom-color: #059669;
  background: #f4fbf8;
}

.duo-front-card.is-retry {
  border-color: #f59e0b;
  border-bottom-color: #d97706;
}

.card-audio-corner {
  position: absolute;
  top: 16px;
  right: 18px;
  color: #b4bcd4;
  transition: color 0.18s ease;
}

.duo-front-card:hover .card-audio-corner {
  color: var(--primary);
}

.duo-card-word {
  font-size: clamp(1.6rem, 5vw, 2.15rem);
  font-weight: 800;
  color: var(--foreground);
  letter-spacing: -0.02em;
  line-height: 1.25;
  word-break: break-word;
}

.duo-card-hangul {
  font-family: var(--font-korean);
  font-size: clamp(1.5rem, 4.5vw, 1.95rem);
  font-weight: 800;
  color: var(--primary);
  line-height: 1.2;
}

.duo-card-present {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted-foreground);
  margin-top: 0.2rem;
}

.card-feedback-pill {
  position: absolute;
  bottom: 14px;
  left: 14px;
  right: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 12px;
  font-size: 0.76rem;
  font-weight: 700;
  font-family: var(--font-korean);
}

.card-feedback-pill.is-ok {
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.card-feedback-pill.is-warn {
  background: var(--accent);
  color: var(--accent-foreground);
}

.card-feedback-pill.is-err {
  background: #fee2e2;
  color: #b91c1c;
}

.card-feedback-pill.is-listening {
  background: var(--primary-light);
  color: var(--primary);
}

/* Bottom Tactile Buttons Row (Nuri Palette) */
.duo-actions-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  max-width: 340px;
}

@media (min-width: 640px) {
  .duo-actions-row {
    max-width: 380px;
  }
}

.duo-mic-btn {
  flex: 1;
  height: 62px;
  border-radius: 18px;
  background: var(--primary);
  border-bottom: 4px solid #3f3199;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px var(--primary-glow);
  transition: transform 0.1s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.duo-mic-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.duo-mic-btn:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-width: 2px;
}

.duo-mic-btn.is-listening {
  background: #e11d48;
  border-bottom-color: #9f1239;
  box-shadow: 0 8px 22px rgba(225, 29, 72, 0.3);
  animation: gentlePulse 1.3s infinite ease-in-out;
}

.duo-mic-btn.is-success {
  background: #10b981;
  border-bottom-color: #047857;
  box-shadow: 0 8px 22px rgba(16, 185, 129, 0.28);
}

@keyframes gentlePulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}

.duo-skip-btn {
  width: 70px;
  height: 62px;
  border-radius: 18px;
  background: #ffffff;
  border: 1.5px solid var(--border);
  border-bottom: 4px solid #cfd6ec;
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  transition: transform 0.1s ease, background 0.15s ease, border-color 0.15s ease;
}

.duo-skip-btn:hover {
  background: var(--primary-light);
  border-color: rgba(88, 72, 196, 0.35);
  border-bottom-color: rgba(88, 72, 196, 0.45);
}

.duo-skip-btn:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
}
</style>
