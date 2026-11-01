<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  Flame,
  Eye,
  EyeOff,
  Delete,
  RefreshCw,
  CheckCircle2,
  RotateCcw,
} from 'lucide-vue-next';
import type { Word, WordCategory } from '../types';
import { WORDS, CATEGORY_ORDER, CATEGORY_TITLES, shuffleWords } from '../data/words';
import {
  composeHangulFromJamoList,
  generateJamoPadForWord,
  checkWrittenKoreanMatch,
  getPrimaryKoreanTarget,
} from '../utils/hangul';
import { playGameSound } from '../utils/speech';

defineProps<{
  knownIds: string[];
}>();

const emit = defineEmits<{
  (e: 'mark-known', wordId: string, earnedXp: number): void;
}>();

type WriteState = 'typing' | 'success';

const WRITE_SCORE_KEY = 'nuri-write-game-score-v1';

// State
const selectedCategory = ref<WordCategory | 'all'>('all');
const alwaysShowHint = ref(false);
const hintRevealed = ref(false);

const deck = ref<Word[]>([]);
const currentIndex = ref(0);
const score = ref(0);
const streak = ref(0);
const wordsCompleted = ref(0);
const lastPointsEarned = ref(0);

// Typing State
const jamoTokens = ref<string[]>([]);
const writeState = ref<WriteState>('typing');

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

const currentPad = computed(() => {
  if (!currentWord.value) {
    return { consonants: [], vowels: [], requiredJamoCount: 0 };
  }
  return generateJamoPadForWord(currentWord.value);
});

const composedText = computed(() => {
  return composeHangulFromJamoList(jamoTokens.value);
});

const targetSyllableCount = computed(() => {
  if (!currentWord.value) return 0;
  return getPrimaryKoreanTarget(currentWord.value).length;
});

const showHint = computed(() => {
  return alwaysShowHint.value || hintRevealed.value;
});

const progressPercent = computed(() => {
  const inRound = wordsCompleted.value % 10;
  if (wordsCompleted.value > 0 && inRound === 0 && writeState.value === 'success') {
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

const clearAdvanceTimer = () => {
  if (advanceTimer) {
    window.clearTimeout(advanceTimer);
    advanceTimer = undefined;
  }
};

const resetCardState = () => {
  clearAdvanceTimer();
  jamoTokens.value = [];
  hintRevealed.value = false;
  writeState.value = 'typing';
};

const buildDeck = () => {
  deck.value = shuffleWords(filteredPool.value);
  currentIndex.value = 0;
  resetCardState();
};

const tapJamo = (jamo: string) => {
  if (!currentWord.value || writeState.value === 'success') return;
  if (jamoTokens.value.length >= 24) return;

  jamoTokens.value = [...jamoTokens.value, jamo];

  // Auto-validate immediately as the user assembles the word
  if (checkWrittenKoreanMatch(currentWord.value, composedText.value)) {
    handleWriteSuccess();
  }
};

const backspaceJamo = () => {
  if (writeState.value === 'success' || jamoTokens.value.length === 0) return;
  jamoTokens.value = jamoTokens.value.slice(0, -1);
};

const clearAllJamo = () => {
  if (writeState.value === 'success') return;
  jamoTokens.value = [];
};

const handleWriteSuccess = () => {
  writeState.value = 'success';

  const basePoints = !alwaysShowHint.value && !hintRevealed.value ? 15 : 10;
  streak.value += 1;

  const earned = Math.round(basePoints * streakMultiplier.value);
  lastPointsEarned.value = earned;
  score.value += earned;
  wordsCompleted.value += 1;

  try {
    window.localStorage.setItem(WRITE_SCORE_KEY, String(score.value));
  } catch {
    // Ignore storage errors
  }

  if (currentWord.value) {
    emit('mark-known', currentWord.value.id, earned);
  }

  if (streak.value > 0 && streak.value % 5 === 0) {
    playGameSound('streak');
  } else {
    playGameSound('correct');
  }

  advanceTimer = window.setTimeout(() => {
    nextCard(true);
  }, 950);
};

const nextCard = (fromSuccess = false) => {
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

const toggleCardHint = () => {
  if (!currentWord.value) return;
  hintRevealed.value = !hintRevealed.value;
};

const selectCategory = (cat: WordCategory | 'all') => {
  selectedCategory.value = cat;
  buildDeck();
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  if (event.key === 'Backspace') {
    event.preventDefault();
    backspaceJamo();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    nextCard(false);
  }
};

watch(selectedCategory, () => {
  buildDeck();
});

onMounted(() => {
  try {
    const saved = window.localStorage.getItem(WRITE_SCORE_KEY);
    if (saved) {
      score.value = parseInt(saved, 10) || 0;
    }
  } catch {
    // Ignore
  }
  buildDeck();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  clearAdvanceTimer();
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <section class="write-game-screen mx-auto max-w-[540px] pt-2 pb-16">
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

    <!-- Top Progress & Streak Bar -->
    <div class="duo-top-bar">
      <!-- Toggle Hangul hint visibility button -->
      <button
        type="button"
        @click="alwaysShowHint = !alwaysShowHint"
        :class="['duo-icon-toggle', alwaysShowHint ? 'is-active' : '']"
        :title="alwaysShowHint ? 'Ocultar guía en Hangul' : 'Mostrar siempre guía en Hangul'"
      >
        <Eye v-if="alwaysShowHint" :size="18" />
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

      <!-- Streak & XP Counter -->
      <div class="duo-streak-badge" :class="{ 'is-hot': streak > 0 }">
        <Flame :size="18" class="streak-icon" />
        <span>{{ streak }}</span>
        <span v-if="score > 0" class="xp-mini">· {{ score }} XP</span>
      </div>
    </div>

    <!-- Stacked Card + Smart Jamo Pad -->
    <div v-if="currentWord" class="duo-deck-stage">
      <div class="duo-card-stack">
        <div class="stack-layer layer-3" />
        <div class="stack-layer layer-2" />
        <div class="stack-layer layer-1" />

        <!-- Front Active Card (Tap card to toggle Hangul hint) -->
        <div
          @click="toggleCardHint"
          :class="[
            'duo-front-card',
            jamoTokens.length > 0 && writeState !== 'success' ? 'is-active-typing' : '',
            writeState === 'success' ? 'is-success' : '',
          ]"
          title="Toca la tarjeta si necesitas ver una pista"
        >
          <!-- Spanish Word Prompt -->
          <span class="duo-card-word">
            {{ currentWord.spanish }}
          </span>

          <!-- Subtle Ghost Hint (if user tapped the card or enabled Eye toggle) -->
          <span v-if="showHint && writeState !== 'success'" class="hint-ghost-hangul">
            {{ currentWord.korean }}
            <small
              v-if="currentWord.present && currentWord.present !== currentWord.korean"
              class="hint-ghost-present"
            >
              ({{ currentWord.present }})
            </small>
          </span>

          <!-- Live Composed Hangul Display Box -->
          <div
            :class="[
              'composed-input-box',
              writeState === 'success' ? 'is-box-success' : '',
              composedText ? 'has-text' : '',
            ]"
            @click.stop
          >
            <span v-if="composedText" class="composed-hangul-text">
              {{ composedText }}
            </span>
            <span v-else class="composed-placeholder">
              <span
                v-for="idx in targetSyllableCount"
                :key="idx"
                class="syllable-slot-dot"
              />
            </span>
          </div>

          <!-- Success Pill -->
          <span v-if="writeState === 'success'" class="card-feedback-pill is-ok">
            <CheckCircle2 :size="15" />
            <span>¡Correcto! +{{ lastPointsEarned }} XP</span>
          </span>
        </div>
      </div>

      <!-- Smart On-Screen Korean Jamo Pad -->
      <div class="jamo-pad-container">
        <!-- Row 1: Consonants (자음) -->
        <div class="jamo-section">
          <p class="jamo-section-label">Consonantes</p>
          <div class="jamo-grid">
            <button
              v-for="c in currentPad.consonants"
              :key="`c-${c}`"
              type="button"
              :disabled="writeState === 'success'"
              @click="tapJamo(c)"
              class="jamo-key is-consonant"
            >
              {{ c }}
            </button>
          </div>
        </div>

        <!-- Row 2: Vowels (모음) -->
        <div class="jamo-section">
          <p class="jamo-section-label">Vocales</p>
          <div class="jamo-grid">
            <button
              v-for="v in currentPad.vowels"
              :key="`v-${v}`"
              type="button"
              :disabled="writeState === 'success'"
              @click="tapJamo(v)"
              class="jamo-key is-vowel"
            >
              {{ v }}
            </button>
          </div>
        </div>

        <!-- Bottom Action Bar: Clear, Backspace, Skip -->
        <div class="write-actions-row">
          <button
            type="button"
            :disabled="jamoTokens.length === 0 || writeState === 'success'"
            @click="clearAllJamo"
            class="write-ctrl-btn is-secondary"
            title="Borrar todo"
          >
            <RotateCcw :size="18" />
            <span>Limpiar</span>
          </button>

          <button
            type="button"
            :disabled="jamoTokens.length === 0 || writeState === 'success'"
            @click="backspaceJamo"
            class="write-ctrl-btn is-backspace"
            title="Borrar última letra"
          >
            <Delete :size="20" />
            <span>Borrar letra</span>
          </button>

          <button
            type="button"
            @click="nextCard(false)"
            class="write-ctrl-btn is-skip"
            title="Siguiente palabra"
          >
            <RefreshCw :size="19" />
          </button>
        </div>
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
  margin-bottom: 1.15rem;
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

/* Stacked Card Stage */
.duo-deck-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0.25rem;
}

.duo-card-stack {
  position: relative;
  width: 100%;
  max-width: 380px;
  padding-top: 18px;
  margin-bottom: 1rem;
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
  width: 78%;
  height: 50px;
  opacity: 0.55;
  background: #f3f5fc;
}

.stack-layer.layer-2 {
  top: 6px;
  width: 86%;
  height: 50px;
  opacity: 0.78;
  background: #f8f9fe;
}

.stack-layer.layer-1 {
  top: 12px;
  width: 93%;
  height: 50px;
}

.duo-front-card {
  position: relative;
  z-index: 2;
  width: 100%;
  min-height: 205px;
  background: var(--card);
  border: 1.5px solid var(--border);
  border-bottom: 4px solid #cfd6ec;
  border-radius: 26px;
  padding: 1.4rem 1.25rem 1.5rem;
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

.duo-front-card.is-active-typing {
  border-color: var(--primary);
  border-bottom-color: var(--primary-hover);
}

.duo-front-card.is-success {
  border-color: #10b981;
  border-bottom-color: #059669;
  background: #f4fbf8;
}

.duo-card-word {
  font-size: clamp(1.35rem, 4.5vw, 1.85rem);
  font-weight: 800;
  color: var(--foreground);
  letter-spacing: -0.02em;
  line-height: 1.2;
  word-break: break-word;
}

.hint-ghost-hangul {
  font-family: var(--font-korean);
  font-size: 1.05rem;
  font-weight: 700;
  color: #9ba3c2;
  letter-spacing: 0.05em;
}

.hint-ghost-present {
  font-size: 0.8rem;
  margin-left: 0.25rem;
}

/* Live Hangul Input Slot inside the Card */
.composed-input-box {
  margin-top: 0.2rem;
  min-width: 170px;
  min-height: 60px;
  padding: 0.5rem 1.25rem;
  border-radius: 18px;
  background: #f7f8fc;
  border: 2px dashed #cbd2e9;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
}

.composed-input-box.has-text {
  background: var(--primary-light);
  border: 2px solid rgba(88, 72, 196, 0.35);
}

.composed-input-box.is-box-success {
  background: #d9f4ee;
  border: 2px solid #10b981;
}

.composed-hangul-text {
  font-family: var(--font-korean);
  font-size: clamp(1.85rem, 5.5vw, 2.35rem);
  font-weight: 800;
  color: var(--primary);
  line-height: 1.15;
  letter-spacing: 0.03em;
}

.composed-input-box.is-box-success .composed-hangul-text {
  color: #065f46;
}

.composed-placeholder {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}

.syllable-slot-dot {
  width: 26px;
  height: 4px;
  border-radius: 9999px;
  background: #cbd2e9;
}

.card-feedback-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.3rem 0.75rem;
  border-radius: 12px;
  font-size: 0.76rem;
  font-weight: 700;
}

.card-feedback-pill.is-ok {
  background: var(--secondary);
  color: var(--secondary-foreground);
}

/* Smart On-Screen Jamo Pad */
.jamo-pad-container {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.jamo-section {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 0.65rem 0.75rem 0.75rem;
}

.jamo-section-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted-foreground);
  font-weight: 700;
  margin-bottom: 0.45rem;
  padding-left: 0.2rem;
}

.jamo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 0.45rem;
}

.jamo-key {
  height: 50px;
  border-radius: 14px;
  font-family: var(--font-korean);
  font-size: 1.35rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  color: var(--foreground);
  border: 1.5px solid var(--border);
  border-bottom: 3.5px solid #cfd6ec;
  box-shadow: 0 2px 6px rgba(30, 35, 56, 0.04);
  transition: transform 0.08s ease, background 0.15s ease, border-color 0.15s ease;
  user-select: none;
}

.jamo-key.is-vowel {
  background: #faf9ff;
  color: var(--primary);
  border-color: #dcd8f8;
  border-bottom-color: #c2baf2;
}

.jamo-key:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--primary-light);
}

.jamo-key:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-width: 1.5px;
}

.write-actions-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.15rem;
}

.write-ctrl-btn {
  height: 50px;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: transform 0.08s ease, background 0.15s ease, opacity 0.15s ease;
}

.write-ctrl-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.write-ctrl-btn:active:not(:disabled) {
  transform: translateY(2px);
}

.write-ctrl-btn.is-secondary {
  padding: 0 0.9rem;
  background: #ffffff;
  color: var(--muted-foreground);
  border: 1.5px solid var(--border);
  border-bottom: 3.5px solid #cfd6ec;
}

.write-ctrl-btn.is-backspace {
  flex: 1;
  background: var(--primary);
  color: #ffffff;
  border-bottom: 3.5px solid #3f3199;
  box-shadow: 0 6px 16px var(--primary-glow);
}

.write-ctrl-btn.is-skip {
  width: 54px;
  background: #ffffff;
  color: var(--primary);
  border: 1.5px solid var(--border);
  border-bottom: 3.5px solid #cfd6ec;
  flex-shrink: 0;
}
</style>

