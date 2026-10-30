<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  Mic,
  MicOff,
  Volume2,
  Flame,
  Trophy,
  Eye,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Brain,
  BookOpen,
  Zap,
} from 'lucide-vue-next';
import type { Word, WordCategory } from '../types';
import { WORDS, CATEGORY_ORDER, CATEGORY_TITLES, CATEGORY_LABELS, shuffleWords } from '../data/words';
import {
  speakKorean,
  isSpeechRecognitionSupported,
  checkKoreanPronunciationMatch,
  playGameSound,
} from '../utils/speech';

const props = defineProps<{
  knownIds: string[];
}>();

const emit = defineEmits<{
  (e: 'mark-known', wordId: string): void;
}>();

type GameMode = 'memory' | 'reading';
type FeedbackState = 'idle' | 'listening' | 'success' | 'retry' | 'error';

const BEST_SCORE_KEY = 'nuri-voice-game-best-score-v1';

// Game Settings & State
const gameMode = ref<GameMode>('reading');
const selectedCategory = ref<WordCategory | 'all'>('all');
const autoListen = ref(true);

const deck = ref<Word[]>([]);
const currentIndex = ref(0);
const score = ref(0);
const bestScore = ref(0);
const streak = ref(0);
const maxStreak = ref(0);
const wordsCompleted = ref(0);
const lastPointsEarned = ref(0);

// Card & Voice State
const hintRevealed = ref(false);
const isListening = ref(false);
const feedbackState = ref<FeedbackState>('idle');
const heardText = ref('');
const errorMessage = ref('');
const speechSupported = ref(true);
const isSecureContextFlag = ref(true);
const isIosChrome = ref(false);
const isMobile = ref(false);

let recognition: any = null;
let advanceTimer: number | undefined;
let restartListeningTimer: number | undefined;

// Category counts for top filter bar
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

const showKoreanHangul = computed(() => {
  return (
    gameMode.value === 'reading' ||
    hintRevealed.value ||
    feedbackState.value === 'success'
  );
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
  if (restartListeningTimer) {
    window.clearTimeout(restartListeningTimer);
    restartListeningTimer = undefined;
  }
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
    errorMessage.value =
      'Estás abriendo la app por HTTP (Wi-Fi local sin HTTPS). Los celulares bloquean el micrófono si el link no empieza con https://.';
    return;
  }

  const SpeechRecognitionCtor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionCtor) {
    speechSupported.value = false;
    feedbackState.value = 'error';
    if (isIosChrome.value) {
      errorMessage.value =
        'En iPhone, Apple solo permite reconocimiento de voz dentro de Safari. Abre este link en Safari.';
    } else {
      errorMessage.value =
        'Este navegador no permite reconocimiento de voz. Usa Safari (en iPhone) o Chrome (en Android/PC).';
    }
    return;
  }

  // Only clean up previous session if one exists
  if (recognition) {
    stopRecognition(false);
  }

  try {
    // Only cancel TTS if actively speaking (calling cancel() unconditionally breaks iOS Safari audio session)
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    recognition = new SpeechRecognitionCtor();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = true;

    // iOS WebKit can fail if maxAlternatives > 1
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) {
      try {
        recognition.maxAlternatives = 5;
      } catch {
        // Ignore if read-only
      }
    }

    // Immediate visual feedback on mobile tap
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
        errorMessage.value = !isSecureContextFlag.value
          ? 'El celular bloqueó el micrófono porque la conexión es HTTP (sin HTTPS).'
          : 'Permiso de micrófono o Dictado bloqueado. Permite el micrófono en tu navegador (y activa Dictado en iPhone).';
      } else if (event.error === 'no-speech') {
        if (feedbackState.value !== 'success') {
          feedbackState.value = 'idle';
        }
      } else if (event.error !== 'aborted') {
        feedbackState.value = 'error';
        errorMessage.value = 'No se pudo escuchar con claridad. Toca el micrófono de nuevo.';
      }
    };

    recognition.onend = () => {
      isListening.value = false;
      if (feedbackState.value === 'listening') {
        feedbackState.value = 'idle';
      }
    };

    recognition.start();
  } catch (err) {
    console.warn('Error starting speech recognition:', err);
    isListening.value = false;
    feedbackState.value = 'error';
    errorMessage.value = 'No se pudo iniciar el micrófono. Asegúrate de abrir la app con https://.';
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
  stopRecognition();
  feedbackState.value = 'success';
  heardText.value = transcript;

  // Calculate XP points
  const basePoints = gameMode.value === 'memory' && !hintRevealed.value ? 15 : 10;
  streak.value += 1;
  if (streak.value > maxStreak.value) {
    maxStreak.value = streak.value;
  }

  const earned = Math.round(basePoints * streakMultiplier.value);
  lastPointsEarned.value = earned;
  score.value += earned;
  wordsCompleted.value += 1;

  if (score.value > bestScore.value) {
    bestScore.value = score.value;
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore.value));
    } catch {
      // Ignore storage errors
    }
  }

  if (currentWord.value) {
    emit('mark-known', currentWord.value.id);
  }

  // Play Duolingo-style chime
  if (streak.value > 0 && streak.value % 5 === 0) {
    playGameSound('streak');
  } else {
    playGameSound('correct');
  }

  // Auto-advance to the next word after brief celebration
  advanceTimer = window.setTimeout(() => {
    nextCard(true);
  }, 1450);
};

const handlePronunciationRetry = (transcript: string) => {
  stopRecognition();
  feedbackState.value = 'retry';
  heardText.value = transcript;
  streak.value = 0;
  playGameSound('wrong');
};

const nextCard = (fromSuccess = false) => {
  stopRecognition();
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

  if (fromSuccess && autoListen.value) {
    restartListeningTimer = window.setTimeout(() => {
      startRecognition();
    }, 350);
  }
};

const revealHint = () => {
  hintRevealed.value = true;
  if (currentWord.value) {
    speakKorean(currentWord.value.present || currentWord.value.korean);
  }
};

const listenToCurrentWord = () => {
  if (!currentWord.value) return;
  stopRecognition();
  speakKorean(currentWord.value.present || currentWord.value.korean);
};

const selectCategory = (cat: WordCategory | 'all') => {
  stopRecognition();
  selectedCategory.value = cat;
  buildDeck();
};

const setGameMode = (mode: GameMode) => {
  stopRecognition();
  gameMode.value = mode;
  resetCardState();
};

const resetGameStats = () => {
  stopRecognition();
  score.value = 0;
  streak.value = 0;
  wordsCompleted.value = 0;
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
    listenToCurrentWord();
  } else if (event.key.toLowerCase() === 'h' && gameMode.value === 'memory') {
    event.preventDefault();
    revealHint();
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
  isMobile.value = /Android|iPhone|iPad|iPod/i.test(ua);
  if (isMobile.value) {
    // Mobile browsers require a direct tap gesture to start microphone each card
    autoListen.value = false;
  }
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
  stopRecognition();
  if (advanceTimer) window.clearTimeout(advanceTimer);
  if (restartListeningTimer) window.clearTimeout(restartListeningTimer);
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <section class="voice-game-container mx-auto max-w-[880px] pb-14 pt-3 sm:pt-6">
    <!-- Top Category Filter Chips -->
    <div class="nuri-entrance mb-4">
      <div class="category-scroll-list no-scrollbar">
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
    </div>

    <!-- Score, Streak & Mode Controls HUD -->
    <div class="hud-bar nuri-entrance mb-5">
      <!-- Score & Streak Pills -->
      <div class="hud-stats">
        <!-- XP Score Pill -->
        <div class="stat-pill is-xp" title="Puntos ganados en esta sesión">
          <div class="stat-icon-wrap xp-bg">
            <Trophy :size="15" />
          </div>
          <div>
            <p class="stat-label">Puntos XP</p>
            <p class="stat-value">
              {{ score }}
              <span v-if="bestScore > 0" class="stat-best">· Récord {{ bestScore }}</span>
            </p>
          </div>
        </div>

        <!-- Streak Pill -->
        <div
          :class="['stat-pill is-streak', streak >= 3 ? 'streak-hot' : '']"
          title="Racha de respuestas correctas seguidas"
        >
          <div class="stat-icon-wrap streak-bg">
            <Flame :size="15" />
          </div>
          <div>
            <p class="stat-label">Racha</p>
            <p class="stat-value">
              {{ streak }}🔥
              <span v-if="streakMultiplier > 1" class="multiplier-badge">
                x{{ streakMultiplier }}
              </span>
            </p>
          </div>
        </div>
      </div>

      <!-- Mode Switcher & Hands-Free Toggle -->
      <div class="hud-controls">
        <div class="mode-segmented" role="radiogroup" aria-label="Modo de juego de voz">
          <button
            type="button"
            @click="setGameMode('reading')"
            :class="['mode-btn', gameMode === 'reading' ? 'is-active' : '']"
            title="Muestra el español y el Hangul para practicar lectura y pronunciación"
          >
            <BookOpen :size="14" />
            <span>Lectura + Voz</span>
          </button>
          <button
            type="button"
            @click="setGameMode('memory')"
            :class="['mode-btn', gameMode === 'memory' ? 'is-active' : '']"
            title="Muestra solo español primero (+15 XP base por recordar sin pista)"
          >
            <Brain :size="14" />
            <span>Memoria + Voz</span>
          </button>
        </div>

        <button
          type="button"
          @click="autoListen = !autoListen"
          :class="['auto-listen-btn', autoListen ? 'is-on' : '']"
          title="Escucha automática al pasar a la siguiente tarjeta"
        >
          <Zap :size="13" />
          <span>Auto-mic</span>
        </button>
      </div>
    </div>

    <!-- Browser / HTTPS Compatibility Warning -->
    <div v-if="!isSecureContextFlag" class="browser-warning-card mb-6">
      <AlertCircle :size="20" class="text-amber-600 shrink-0" />
      <div>
        <p class="font-bold text-sm text-amber-900">
          Conexión Wi-Fi sin HTTPS detectada ({{ 'http://' }})
        </p>
        <p class="text-xs text-amber-800 mt-1">
          Por seguridad, <strong>Safari y Chrome en el celular bloquean el micrófono</strong> cuando entras por una IP local <code>http://192.168...</code>. Cuando la app esté subida a internet (con <code>https://</code>) o uses HTTPS local, el micrófono del celular funcionará automáticamente.
        </p>
      </div>
    </div>
    <div v-else-if="!speechSupported" class="browser-warning-card mb-6">
      <AlertCircle :size="20" class="text-amber-600 shrink-0" />
      <div>
        <p class="font-bold text-sm text-amber-900">
          <template v-if="isIosChrome">
            En iPhone, abre la app en Safari para usar el micrófono
          </template>
          <template v-else>
            Tu navegador no soporta reconocimiento de voz nativo
          </template>
        </p>
        <p class="text-xs text-amber-800 mt-1">
          <template v-if="isIosChrome">
            Apple bloquea el reconocimiento de voz dentro de Chrome para iOS. Ábrelo en <strong>Safari</strong> (con <code>https://</code>).
          </template>
          <template v-else>
            Para jugar pronunciando en coreano, abre esta aplicación en <strong>Safari</strong> (iPhone) o <strong>Google Chrome</strong> (Android / PC).
          </template>
        </p>
      </div>
    </div>

    <!-- Main Interactive Game Card -->
    <div
      v-if="currentWord"
      :class="[
        'game-card nuri-entrance',
        feedbackState === 'success' ? 'card-success' : '',
        feedbackState === 'retry' ? 'card-retry' : '',
        isListening ? 'card-listening' : '',
      ]"
    >
      <!-- Card Top Meta Row -->
      <div class="card-meta-row">
        <div class="flex items-center gap-2">
          <span class="cat-tag">{{ CATEGORY_LABELS[currentWord.category] }}</span>
          <span class="card-counter">
            #{{ currentIndex + 1 }} / {{ deck.length }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="listenToCurrentWord"
            class="icon-action-btn"
            title="Escuchar pronunciación nativa (Tecla L)"
          >
            <Volume2 :size="16" />
            <span>Escuchar</span>
          </button>

          <button
            v-if="score > 0 || wordsCompleted > 0"
            type="button"
            @click="resetGameStats"
            class="icon-action-btn is-subtle"
            title="Reiniciar puntaje"
          >
            <RotateCcw :size="14" />
          </button>
        </div>
      </div>

      <!-- Prompt Section: Spanish Word -->
      <div class="prompt-section">
        <h2 class="spanish-prompt">
          {{ currentWord.spanish }}
        </h2>

        <!-- Korean Target Area -->
        <div class="korean-target-area">
          <template v-if="showKoreanHangul">
            <div class="hangul-reveal-box">
              <p class="hangul-main">{{ currentWord.korean }}</p>
              <p
                v-if="currentWord.present && currentWord.present !== currentWord.korean"
                class="hangul-present"
              >
                <strong>{{ currentWord.present }}</strong>
              </p>
              <p v-if="currentWord.note" class="hangul-note">
                {{ currentWord.note }}
              </p>
            </div>
          </template>

          <template v-else>
            <button type="button" @click="revealHint" class="hint-btn">
              <Eye :size="14" />
              <span>Ver pista en Hangul</span>
            </button>
          </template>
        </div>
      </div>

      <!-- Microphone Interactive Trigger -->
      <div class="mic-stage">
        <div class="mic-ring-wrapper">
          <span v-if="isListening" class="pulse-ring ring-1" />
          <span v-if="isListening" class="pulse-ring ring-2" />
          <button
            type="button"
            :disabled="feedbackState === 'success'"
            @click="toggleMic"
            :class="[
              'mic-main-btn',
              isListening ? 'is-listening' : '',
              feedbackState === 'success' ? 'is-success' : '',
            ]"
            aria-label="Activar micrófono para pronunciar"
          >
            <CheckCircle2 v-if="feedbackState === 'success'" :size="34" />
            <Mic v-else-if="isListening" :size="34" />
            <Mic v-else :size="32" />
          </button>
        </div>

        <p v-if="isListening" class="mic-status-label">
          <span class="listening-dot" /> Escuchando...
        </p>
      </div>

      <!-- Live Voice Feedback Banner (Duolingo Style) -->
      <div v-if="heardText || feedbackState !== 'idle'" class="feedback-banner-wrap">
        <!-- SUCCESS STATE -->
        <div v-if="feedbackState === 'success'" class="feedback-banner is-success">
          <div class="flex items-center gap-3">
            <CheckCircle2 :size="24" class="text-emerald-600 shrink-0" />
            <div>
              <p class="feedback-title text-emerald-900">
                ¡Excelente pronunciación!
                <span class="xp-pop">+{{ lastPointsEarned }} XP</span>
              </p>
              <p class="feedback-sub text-emerald-700">
                Escuché: <strong class="font-korean">"{{ heardText }}"</strong>
              </p>
            </div>
          </div>
          <button type="button" @click="nextCard(true)" class="banner-action-btn is-success-btn">
            <span>Siguiente</span>
            <SkipForward :size="14" />
          </button>
        </div>

        <!-- RETRY STATE -->
        <div v-else-if="feedbackState === 'retry'" class="feedback-banner is-retry">
          <div class="flex items-center gap-3">
            <AlertCircle :size="22" class="text-amber-600 shrink-0" />
            <div>
              <p class="feedback-title text-amber-900">
                ¡Casi! Inténtalo de nuevo
              </p>
              <p class="feedback-sub text-amber-800">
                Escuché: <strong class="font-korean">"{{ heardText || '...' }}"</strong>
                · Toca <strong>Escuchar</strong> o vuelve a pulsar el micrófono.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" @click="startRecognition" class="banner-action-btn is-retry-btn">
              <Mic :size="14" />
              <span>Reintentar</span>
            </button>
          </div>
        </div>

        <!-- ERROR STATE -->
        <div v-else-if="feedbackState === 'error'" class="feedback-banner is-error">
          <div class="flex items-center gap-2.5">
            <MicOff :size="20" class="text-rose-600 shrink-0" />
            <p class="text-xs font-semibold text-rose-900">{{ errorMessage }}</p>
          </div>
        </div>

        <!-- INTERIM LISTENING TRANSCRIPT -->
        <div v-else-if="isListening && heardText" class="feedback-banner is-interim">
          <p class="text-xs text-[#5848c4] font-semibold">
            🎤 Detectando: <span class="font-korean text-base font-bold">"{{ heardText }}"</span>
          </p>
        </div>
      </div>

      <!-- Card Footer Actions -->
      <div class="card-footer-row">
        <button
          type="button"
          @click="nextCard(false)"
          class="skip-word-btn"
        >
          <span>Saltar palabra</span>
          <SkipForward :size="15" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.category-scroll-list {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  overflow-x: auto;
  padding: 0.25rem 0.1rem 0.5rem;
}

.nuri-cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  transition: all 0.18s ease;
}

.nuri-cat-chip:hover:not(.is-active) {
  border-color: rgba(88, 72, 196, 0.35);
  color: var(--foreground);
}

.nuri-cat-chip.is-active {
  background: var(--primary);
  color: #ffffff;
  border-color: var(--primary);
  box-shadow: 0 3px 10px rgba(88, 72, 196, 0.22);
}

.nuri-cat-badge {
  font-size: 0.68rem;
  padding: 0.05rem 0.4rem;
  border-radius: 9999px;
  background: rgba(30, 35, 56, 0.07);
  font-weight: 700;
}

.nuri-cat-chip.is-active .nuri-cat-badge {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

.hud-bar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 0.85rem 1rem;
  box-shadow: 0 4px 16px rgba(30, 35, 56, 0.04);
}

@media (min-width: 680px) {
  .hud-bar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.hud-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.85rem 0.4rem 0.5rem;
  border-radius: 14px;
  background: #f8f9fc;
  border: 1px solid #e5e9f5;
}

.stat-pill.streak-hot {
  background: #fff7ed;
  border-color: #fed7aa;
}

.stat-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.xp-bg {
  background: rgba(88, 72, 196, 0.12);
  color: var(--primary);
}

.streak-bg {
  background: rgba(249, 115, 22, 0.14);
  color: #ea580c;
}

.stat-label {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #767d9c;
  line-height: 1.1;
}

.stat-value {
  font-size: 0.95rem;
  font-weight: 800;
  color: #1e2338;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.stat-best {
  font-size: 0.72rem;
  font-weight: 600;
  color: #767d9c;
}

.multiplier-badge {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 0.08rem 0.4rem;
  border-radius: 9999px;
  background: #ea580c;
  color: #ffffff;
}

.hud-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.mode-segmented {
  display: inline-flex;
  background: #f1f3f9;
  padding: 0.22rem;
  border-radius: 12px;
  border: 1px solid #e2e6f3;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.75rem;
  border-radius: 9px;
  font-size: 0.76rem;
  font-weight: 600;
  color: #6c7393;
  transition: all 0.18s ease;
}

.mode-btn.is-active {
  background: #ffffff;
  color: var(--primary);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(30, 35, 56, 0.08);
}

.auto-listen-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.42rem 0.7rem;
  border-radius: 11px;
  font-size: 0.74rem;
  font-weight: 600;
  border: 1px solid var(--border);
  background: #ffffff;
  color: #767d9c;
  transition: all 0.18s ease;
}

.auto-listen-btn.is-on {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.4);
  color: #047857;
}

.browser-warning-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.2rem;
  border-radius: 16px;
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.game-card {
  background: #ffffff;
  border: 2px solid #e4e8f5;
  border-radius: 28px;
  padding: 1.4rem 1.25rem;
  box-shadow: 0 12px 34px rgba(30, 35, 56, 0.06);
  transition: all 0.25s ease;
}

@media (min-width: 640px) {
  .game-card {
    padding: 2rem 2.25rem;
  }
}

.game-card.card-listening {
  border-color: #5848c4;
  box-shadow: 0 14px 40px rgba(88, 72, 196, 0.14);
}

.game-card.card-success {
  border-color: #10b981;
  background: linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%);
  box-shadow: 0 14px 40px rgba(16, 185, 129, 0.16);
}

.game-card.card-retry {
  border-color: #f59e0b;
}

.card-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.cat-tag {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  font-weight: 700;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  background: var(--primary-light);
  color: var(--primary);
}

.card-counter {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: #878ea8;
  font-weight: 600;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.8rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 600;
  background: #f5f6fb;
  color: #1e2338;
  border: 1px solid #e2e6f3;
  transition: all 0.18s ease;
}

.icon-action-btn:hover {
  background: var(--primary-light);
  color: var(--primary);
  border-color: rgba(88, 72, 196, 0.35);
}

.icon-action-btn.is-subtle {
  padding: 0.4rem 0.55rem;
  color: #767d9c;
}

.prompt-section {
  text-align: center;
  padding: 0.5rem 0 1.5rem;
}

.prompt-instruction {
  font-size: 0.8rem;
  font-weight: 600;
  color: #6c7393;
  margin-bottom: 0.4rem;
}

.spanish-prompt {
  font-size: clamp(1.65rem, 4vw, 2.35rem);
  font-weight: 800;
  color: #1e2338;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.korean-target-area {
  margin-top: 1.25rem;
  min-height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hangul-reveal-box {
  background: #f8f9fd;
  border: 1px solid #e5e9f5;
  border-radius: 20px;
  padding: 1rem 1.5rem;
  width: 100%;
  max-width: 480px;
}

.hangul-main {
  font-family: var(--font-korean);
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: 800;
  color: var(--primary);
  line-height: 1.2;
}

.hangul-present {
  margin-top: 0.35rem;
  font-size: 0.88rem;
  color: #49506b;
  font-family: var(--font-korean);
}

.hangul-note {
  margin-top: 0.3rem;
  font-size: 0.76rem;
  color: #767d9c;
}

.memory-hidden-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  background: #f8f9fd;
  border: 1px dashed #cbd2e9;
  border-radius: 18px;
  padding: 1rem 1.4rem;
  max-width: 460px;
}

.memory-hint-text {
  font-size: 0.8rem;
  color: #6c7393;
}

.hint-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.42rem 0.9rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 700;
  background: #ffffff;
  color: var(--primary);
  border: 1px solid rgba(88, 72, 196, 0.3);
  transition: all 0.18s ease;
}

.hint-btn:hover {
  background: var(--primary-light);
}

.mic-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0.75rem 0 1.25rem;
}

.mic-ring-wrapper {
  position: relative;
  width: 92px;
  height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mic-main-btn {
  position: relative;
  z-index: 2;
  width: 78px;
  height: 78px;
  border-radius: 50%;
  background: var(--primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 25px rgba(88, 72, 196, 0.35);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.mic-main-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 12px 30px rgba(88, 72, 196, 0.45);
}

.mic-main-btn.is-listening {
  background: #ef4444;
  box-shadow: 0 10px 28px rgba(239, 68, 68, 0.45);
}

.mic-main-btn.is-success {
  background: #10b981;
  box-shadow: 0 10px 28px rgba(16, 185, 129, 0.45);
}

.pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.25);
  animation: micPulse 1.6s infinite ease-out;
}

.pulse-ring.ring-2 {
  animation-delay: 0.6s;
}

@keyframes micPulse {
  0% {
    transform: scale(0.85);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.55);
    opacity: 0;
  }
}

.mic-status-label {
  margin-top: 0.75rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #6c7393;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.listening-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  display: inline-block;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

.kbd-key {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  background: #f1f3f9;
  border: 1px solid #d5d9ec;
  color: #1e2338;
}

.feedback-banner-wrap {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
}

.feedback-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1.2rem;
  border-radius: 18px;
  flex-wrap: wrap;
}

.feedback-banner.is-success {
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
}

.feedback-banner.is-retry {
  background: #fffbeb;
  border: 1px solid #fcd34d;
}

.feedback-banner.is-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.feedback-banner.is-interim {
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  justify-content: center;
}

.feedback-title {
  font-size: 0.9rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.feedback-sub {
  font-size: 0.8rem;
  margin-top: 0.1rem;
}

.xp-pop {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.5rem;
  border-radius: 9999px;
  background: #10b981;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 800;
}

.banner-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.95rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 700;
  transition: all 0.18s ease;
}

.is-success-btn {
  background: #059669;
  color: #ffffff;
}

.is-success-btn:hover {
  background: #047857;
}

.is-retry-btn {
  background: #d97706;
  color: #ffffff;
}

.is-retry-btn:hover {
  background: #b45309;
}

.card-footer-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 0.25rem;
}

.footer-tip {
  font-size: 0.72rem;
  color: #878ea8;
}

.footer-tip kbd {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 0.08rem 0.32rem;
  background: #f5f6fb;
  border: 1px solid #e0e4f2;
  border-radius: 4px;
}

.skip-word-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #6c7393;
  padding: 0.4rem 0.8rem;
  border-radius: 9999px;
  transition: all 0.18s ease;
}

.skip-word-btn:hover {
  background: #f1f3f9;
  color: #1e2338;
}

.font-korean {
  font-family: var(--font-korean);
}
</style>

