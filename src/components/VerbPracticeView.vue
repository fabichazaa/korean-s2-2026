<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  Flame,
  Sparkles,
  Check,
  Volume2,
  SkipForward,
  Table2,
  Zap,
  Search,
  Heart,
} from 'lucide-vue-next';
import type { Word } from '../types';
import { WORDS, shuffleWords } from '../data/words';
import { speakKorean, playGameSound } from '../utils/speech';

export type TenseKey = 'want' | 'present' | 'past' | 'negative' | 'honorific';

interface TenseMeta {
  key: TenseKey;
  shortLabel: string;
  grammarLabel: string;
  promptHint: string;
  colorClass: string;
}

const TENSES: TenseMeta[] = [
  {
    key: 'want',
    shortLabel: 'Querer (-고 싶다)',
    grammarLabel: '❤️ -고 싶다',
    promptHint: 'Deseo · Quiero...',
    colorClass: 'tense-want',
  },
  {
    key: 'present',
    shortLabel: 'Presente (-아요/어요)',
    grammarLabel: '-아요/어요',
    promptHint: 'Presente cortés',
    colorClass: 'tense-present',
  },
  {
    key: 'past',
    shortLabel: 'Pasado (-았/었-)',
    grammarLabel: '-았/었-',
    promptHint: 'Pasado cortés',
    colorClass: 'tense-past',
  },
  {
    key: 'negative',
    shortLabel: 'Negación (안)',
    grammarLabel: '안',
    promptHint: 'Forma negativa',
    colorClass: 'tense-negative',
  },
  {
    key: 'honorific',
    shortLabel: 'Cortés (-(으)세요)',
    grammarLabel: '-(으)세요',
    promptHint: 'Imperativo / Honorífico',
    colorClass: 'tense-honorific',
  },
];

// Exact 21 verbs + 6 adjectives from the class conjugation table (plus class verbs)
const CLASS_TABLE_IDS = [
  'gada',
  'oda',
  'boda',
  'jada',
  'meokda',
  'masida',
  'deutda',
  'sada',
  'ikda',
  'baeuda',
  'gareuchida',
  'joh-ahada',
  'hada',
  'saranghada',
  'malhada',
  'ilhada',
  'gongbuhada',
  'undonghada',
  'jeonhwahada',
  'iyagihada',
  'yeonseuphada',
  'mannada',
  'yorihada',
  'sanchaekhada',
  'gugyeonghada',
  'tada',
  'chupda',
  'deopda',
  'eoryeopda',
  'swipda',
  'gabyeopda',
  'mugeopda',
  'bappeuda',
  'teukbyeolhada',
  'dareuda',
  'itda',
  'eopda',
];

const VERB_WORDS = computed<Word[]>(() => {
  const byId = new Map(WORDS.map((w) => [w.id, w]));
  return CLASS_TABLE_IDS.map((id) => byId.get(id)).filter((w): w is Word => Boolean(w && w.verbForms));
});

const mode = ref<'quiz' | 'table'>('quiz');
const selectedTenseFilter = ref<TenseKey | 'all'>('all');
const tableCategoryFilter = ref<'all' | 'verb' | 'adjective'>('all');
const tableSearch = ref('');

interface QuizChallenge {
  word: Word;
  tense: TenseMeta;
  correctAnswer: string;
  options: string[];
}

const challenges = ref<QuizChallenge[]>([]);
const currentIndex = ref(0);
const selectedOption = ref<string | null>(null);
const wrongOptions = ref<Set<string>>(new Set());
const isResolved = ref(false);

const VERB_SCORE_KEY = 'nuri-verb-practice-score-v1';
const streak = ref(0);
const xp = ref(0);

function buildSmartTraps(word: Word, tenseKey: TenseKey, correctAnswer: string): string[] {
  const forms = word.verbForms;
  if (!forms) return [];

  const pool = new Set<string>();

  // 1. Other conjugation forms of the SAME verb (best distractors!)
  if (forms.want) pool.add(forms.want);
  if (forms.present) pool.add(forms.present);
  if (forms.past) pool.add(forms.past);
  if (forms.negative) pool.add(forms.negative);
  if (forms.honorific) pool.add(forms.honorific);

  const stem = word.korean.endsWith('다') ? word.korean.slice(0, -1) : word.korean;

  // 2. Smart grammatical traps for common mistakes in class
  if (tenseKey === 'negative') {
    // Trap for separable 하다 verbs (e.g. "안 공부해요" instead of "공부 안 해요")
    if (word.korean.endsWith('하다') && word.korean !== '하다' && word.korean !== '좋아하다' && word.korean !== '사랑하다') {
      if (forms.present) pool.add(`안 ${forms.present}`);
    }
    if (forms.past) pool.add(`안 ${forms.past}`);
  }

  if (tenseKey === 'honorific') {
    // Trap for irregular honorifics (자다 -> 주무세요, 먹다/마시다 -> 드세요)
    if (word.id === 'jada') pool.add('자세요');
    if (word.id === 'meokda') pool.add('먹으세요');
    if (word.id === 'masida') pool.add('마시세요');
    if (word.id === 'deutda') pool.add('듣으세요');
  }

  if (tenseKey === 'present' || tenseKey === 'past') {
    // Trap for ㅂ-irregular adjectives or ㄷ-irregular verbs
    if (word.category === 'adjective' && stem.endsWith('ㅂ')) {
      pool.add(`${stem}어요`);
    }
    if (word.id === 'deutda') {
      pool.add('듣어요');
      pool.add('듣었어요');
    }
  }

  if (tenseKey === 'want') {
    pool.add(`${stem}고 싶어`);
    if (forms.present) pool.add(`${forms.present} 싶어요`);
  }

  // Remove the correct answer so we only pick 3 distractors
  pool.delete(correctAnswer);

  const distractors = shuffleWords(Array.from(pool)).slice(0, 3);

  // If fewer than 3 distractors (e.g. adjectives with only 3 forms), add plausible forms
  const fallbackExtras = [
    `${stem}아요`,
    `${stem}어요`,
    `안 ${stem}아요`,
    `${stem}고 싶어요`,
    `${stem}으세요`,
  ];
  for (const extra of fallbackExtras) {
    if (distractors.length >= 3) break;
    if (extra !== correctAnswer && !distractors.includes(extra)) {
      distractors.push(extra);
    }
  }

  return shuffleWords([correctAnswer, ...distractors.slice(0, 3)]);
}

function buildChallengeDeck() {
  const list: QuizChallenge[] = [];
  const activeTenses =
    selectedTenseFilter.value === 'all'
      ? TENSES
      : TENSES.filter((t) => t.key === selectedTenseFilter.value);

  for (const word of VERB_WORDS.value) {
    const forms = word.verbForms;
    if (!forms) continue;

    for (const tense of activeTenses) {
      const targetForm = forms[tense.key];
      if (!targetForm) continue;

      list.push({
        word,
        tense,
        correctAnswer: targetForm,
        options: buildSmartTraps(word, tense.key, targetForm),
      });
    }
  }

  challenges.value = shuffleWords(list);
  currentIndex.value = 0;
  resetCardState();
}

const currentChallenge = computed<QuizChallenge | null>(
  () => challenges.value[currentIndex.value] ?? null
);

const progressPercent = computed(() => {
  if (challenges.value.length === 0) return 0;
  return Math.min(100, Math.round(((currentIndex.value + 1) / challenges.value.length) * 100));
});

function resetCardState() {
  selectedOption.value = null;
  wrongOptions.value = new Set();
  isResolved.value = false;
}

function selectOption(option: string) {
  if (isResolved.value || !currentChallenge.value) return;

  if (option === currentChallenge.value.correctAnswer) {
    selectedOption.value = option;
    isResolved.value = true;
    streak.value += 1;
    xp.value += 10 + Math.min(streak.value * 2, 10);
    saveScore();

    if (streak.value > 0 && streak.value % 5 === 0) {
      playGameSound('streak');
    } else {
      playGameSound('correct');
    }

    speakKorean(option.split('/')[0].trim());
  } else {
    const nextWrong = new Set(wrongOptions.value);
    nextWrong.add(option);
    wrongOptions.value = nextWrong;
    streak.value = 0;
    saveScore();
    playGameSound('wrong');
  }
}

function nextChallenge() {
  if (currentIndex.value < challenges.value.length - 1) {
    currentIndex.value += 1;
    resetCardState();
  } else {
    playGameSound('complete');
    buildChallengeDeck();
  }
}

function selectTenseFilter(filter: TenseKey | 'all') {
  selectedTenseFilter.value = filter;
  buildChallengeDeck();
}

const filteredTableWords = computed(() => {
  const q = tableSearch.value.trim().toLowerCase();
  return VERB_WORDS.value.filter((w) => {
    if (tableCategoryFilter.value !== 'all' && w.category !== tableCategoryFilter.value) {
      return false;
    }
    if (!q) return true;
    return (
      w.korean.toLowerCase().includes(q) ||
      w.spanish.toLowerCase().includes(q) ||
      (w.verbForms?.present?.toLowerCase().includes(q) ?? false) ||
      (w.verbForms?.past?.toLowerCase().includes(q) ?? false) ||
      (w.verbForms?.want?.toLowerCase().includes(q) ?? false)
    );
  });
});

function saveScore() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      VERB_SCORE_KEY,
      JSON.stringify({ streak: streak.value, xp: xp.value })
    );
  } catch {
    // ignore storage errors
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(VERB_SCORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        streak.value = parsed.streak ?? 0;
        xp.value = parsed.xp ?? 0;
      }
    } catch {
      // ignore
    }
  }
  buildChallengeDeck();
});

watch(VERB_WORDS, () => {
  if (challenges.value.length === 0) buildChallengeDeck();
});
</script>

<template>
  <section class="verb-practice-wrapper">
    <!-- Mode Switcher: Desafío vs Tabla Completa -->
    <div class="mode-header nuri-entrance nuri-entrance-1">
      <div class="mode-switcher" role="tablist" aria-label="Modo de práctica de verbos">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'quiz'"
          :class="['mode-btn', mode === 'quiz' ? 'is-active' : '']"
          @click="mode = 'quiz'"
        >
          <Zap :size="15" />
          <span>Desafío de Tiempos</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'table'"
          :class="['mode-btn', mode === 'table' ? 'is-active' : '']"
          @click="mode = 'table'"
        >
          <Table2 :size="15" />
          <span>Tabla de Clase ({{ VERB_WORDS.length }})</span>
        </button>
      </div>
    </div>

    <!-- ==========================================
         MODE 1: INTERACTIVE CONJUGATION CHALLENGE
         ========================================== -->
    <div v-if="mode === 'quiz'" class="quiz-container">
      <!-- Tense Filter Chips -->
      <div class="category-strip nuri-entrance nuri-entrance-1" role="tablist" aria-label="Filtrar por tiempo verbal">
        <button
          type="button"
          :class="['cat-chip', selectedTenseFilter === 'all' ? 'is-active' : '']"
          @click="selectTenseFilter('all')"
        >
          <span>Todos los tiempos</span>
        </button>
        <button
          v-for="t in TENSES"
          :key="t.key"
          type="button"
          :class="['cat-chip', selectedTenseFilter === t.key ? 'is-active' : '']"
          @click="selectTenseFilter(t.key)"
        >
          <span>{{ t.grammarLabel }}</span>
        </button>
      </div>

      <!-- Progress & Streak Top Bar -->
      <div class="voice-topbar nuri-entrance nuri-entrance-1">
        <button
          v-if="currentChallenge"
          type="button"
          class="hint-icon-btn"
          title="Escuchar infinitivo"
          @click="speakKorean(currentChallenge.word.korean)"
        >
          <Volume2 :size="16" />
        </button>

        <div class="progress-track" aria-label="Progreso">
          <div class="progress-fill" :style="{ width: `${progressPercent}%` }">
            <div class="progress-shine" />
          </div>
        </div>

        <div class="stats-cluster">
          <div :class="['stat-pill', streak > 0 ? 'is-streak' : '']" title="Racha de conjugaciones">
            <Flame :size="14" class="stat-icon" />
            <span>{{ streak }}</span>
          </div>
          <div class="stat-pill is-xp" title="Puntos de experiencia">
            <Sparkles :size="13" class="stat-icon" />
            <span>{{ xp }} XP</span>
          </div>
        </div>
      </div>

      <!-- Stacked Card Arena -->
      <div v-if="currentChallenge" class="deck-arena nuri-entrance nuri-entrance-2">
        <div class="stack-layer layer-2" aria-hidden="true" />
        <div class="stack-layer layer-1" aria-hidden="true" />

        <div
          :key="`${currentChallenge.word.id}-${currentChallenge.tense.key}-${currentIndex}`"
          :class="['verb-card', isResolved ? 'state-success' : '']"
        >
          <!-- Top Row: Target Tense Pill + Category -->
          <div class="card-top-row">
            <span :class="['tense-badge', currentChallenge.tense.colorClass]">
              {{ currentChallenge.tense.grammarLabel }} · {{ currentChallenge.tense.promptHint }}
            </span>

            <span class="verb-type-tag">
              {{ currentChallenge.word.category === 'adjective' ? 'Adjetivo (형용사)' : 'Verbo (동사)' }}
            </span>
          </div>

          <!-- Center Prompt: Base Infinitive + Spanish Meaning -->
          <div class="prompt-zone">
            <div class="infinitive-row">
              <h2 class="korean-infinitive">{{ currentChallenge.word.korean }}</h2>
              <button
                type="button"
                class="mini-audio-btn"
                title="Escuchar verbo base"
                @click="speakKorean(currentChallenge.word.korean)"
              >
                <Volume2 :size="16" />
              </button>
            </div>
            <p class="spanish-meaning">{{ currentChallenge.word.spanish }}</p>
            <p v-if="currentChallenge.word.note" class="verb-note">
              💡 {{ currentChallenge.word.note }}
            </p>
          </div>

          <!-- Options Grid (4 choices from the same verb) -->
          <div class="options-grid">
            <button
              v-for="option in currentChallenge.options"
              :key="option"
              type="button"
              :disabled="isResolved || wrongOptions.has(option)"
              :class="[
                'option-btn',
                isResolved && option === currentChallenge.correctAnswer ? 'is-correct' : '',
                wrongOptions.has(option) ? 'is-wrong' : '',
              ]"
              @click="selectOption(option)"
            >
              <span class="option-hangul">{{ option }}</span>
              <Check
                v-if="isResolved && option === currentChallenge.correctAnswer"
                :size="18"
                :stroke-width="3"
                class="option-check"
              />
            </button>
          </div>

          <!-- Full Conjugation Summary Row on Success -->
          <transition name="pop-badge">
            <div v-if="isResolved && currentChallenge.word.verbForms" class="resolved-summary">
              <div class="summary-chips">
                <button
                  v-if="currentChallenge.word.verbForms.want"
                  type="button"
                  class="summary-chip"
                  @click="speakKorean(currentChallenge.word.verbForms.want)"
                >
                  <span class="chip-k">-고 싶다</span>
                  <strong>{{ currentChallenge.word.verbForms.want }}</strong>
                </button>
                <button
                  v-if="currentChallenge.word.verbForms.present"
                  type="button"
                  class="summary-chip"
                  @click="speakKorean(currentChallenge.word.verbForms.present)"
                >
                  <span class="chip-k">Presente</span>
                  <strong>{{ currentChallenge.word.verbForms.present }}</strong>
                </button>
                <button
                  v-if="currentChallenge.word.verbForms.past"
                  type="button"
                  class="summary-chip"
                  @click="speakKorean(currentChallenge.word.verbForms.past)"
                >
                  <span class="chip-k">Pasado</span>
                  <strong>{{ currentChallenge.word.verbForms.past }}</strong>
                </button>
                <button
                  v-if="currentChallenge.word.verbForms.negative"
                  type="button"
                  class="summary-chip"
                  @click="speakKorean(currentChallenge.word.verbForms.negative)"
                >
                  <span class="chip-k">안</span>
                  <strong>{{ currentChallenge.word.verbForms.negative }}</strong>
                </button>
                <button
                  v-if="currentChallenge.word.verbForms.honorific"
                  type="button"
                  class="summary-chip"
                  @click="speakKorean(currentChallenge.word.verbForms.honorific)"
                >
                  <span class="chip-k">-(으)세요</span>
                  <strong>{{ currentChallenge.word.verbForms.honorific }}</strong>
                </button>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Bottom Next / Skip Action Bar -->
      <div class="action-bar nuri-entrance nuri-entrance-3">
        <button
          v-if="!isResolved"
          type="button"
          class="secondary-btn"
          @click="nextChallenge"
        >
          <SkipForward :size="16" />
          <span>Saltar</span>
        </button>
        <button
          v-else
          type="button"
          class="primary-next-btn"
          @click="nextChallenge"
        >
          <span>Siguiente verbo</span>
          <SkipForward :size="16" />
        </button>
      </div>
    </div>

    <!-- ==========================================
         MODE 2: FULL INTERACTIVE CLASS TABLE
         ========================================== -->
    <div v-else class="table-container nuri-entrance nuri-entrance-2">
      <!-- Table Controls: Search + Filter -->
      <div class="table-controls">
        <div class="search-box">
          <Search :size="15" class="search-icon" />
          <input
            v-model="tableSearch"
            type="search"
            placeholder="Buscar verbo en coreano o español (ej. 먹다, comer, 갔어요)..."
            class="search-input"
          />
        </div>

        <div class="filter-pills">
          <button
            type="button"
            :class="['cat-chip', tableCategoryFilter === 'all' ? 'is-active' : '']"
            @click="tableCategoryFilter = 'all'"
          >
            Todos ({{ VERB_WORDS.length }})
          </button>
          <button
            type="button"
            :class="['cat-chip', tableCategoryFilter === 'verb' ? 'is-active' : '']"
            @click="tableCategoryFilter = 'verb'"
          >
            Verbos (동사)
          </button>
          <button
            type="button"
            :class="['cat-chip', tableCategoryFilter === 'adjective' ? 'is-active' : '']"
            @click="tableCategoryFilter = 'adjective'"
          >
            Adjetivos (형용사)
          </button>
        </div>
      </div>

      <p class="table-helper">
        🔊 Tocá cualquier conjugación de la tabla para escuchar cómo se pronuncia.
      </p>

      <!-- Responsive Conjugation Table -->
      <div class="table-scroll-card">
        <table class="conj-table">
          <thead>
            <tr>
              <th>Infinitivo</th>
              <th>
                <span class="th-heart"><Heart :size="12" class="fill-rose-500 text-rose-500" /> -고 싶다</span>
                <small>Querer</small>
              </th>
              <th>
                <span>-아요/어요</span>
                <small>Presente</small>
              </th>
              <th>
                <span>-았/었-</span>
                <small>Pasado</small>
              </th>
              <th>
                <span>안</span>
                <small>Negación</small>
              </th>
              <th>
                <span>-(으)세요</span>
                <small>Cortés</small>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="w in filteredTableWords" :key="w.id">
              <!-- Infinitive + Spanish -->
              <td class="td-infinitive">
                <button
                  type="button"
                  class="cell-speak-btn is-base"
                  @click="speakKorean(w.korean)"
                >
                  <span class="base-kr">{{ w.korean }}</span>
                  <Volume2 :size="13" class="speak-ico" />
                </button>
                <span class="base-es">{{ w.spanish }}</span>
                <span v-if="w.verbForms?.pronunciation" class="base-pron">
                  [{{ w.verbForms.pronunciation }}]
                </span>
              </td>

              <!-- -고 싶다 -->
              <td>
                <button
                  v-if="w.verbForms?.want"
                  type="button"
                  class="cell-speak-btn is-want"
                  @click="speakKorean(w.verbForms.want)"
                >
                  <span>{{ w.verbForms.want }}</span>
                  <Volume2 :size="12" class="speak-ico" />
                </button>
                <span v-else class="cell-empty">—</span>
              </td>

              <!-- -아요/어요 -->
              <td>
                <button
                  v-if="w.verbForms?.present"
                  type="button"
                  class="cell-speak-btn is-present"
                  @click="speakKorean(w.verbForms.present)"
                >
                  <span>{{ w.verbForms.present }}</span>
                  <Volume2 :size="12" class="speak-ico" />
                </button>
                <span v-else class="cell-empty">—</span>
              </td>

              <!-- -았/었- -->
              <td>
                <button
                  v-if="w.verbForms?.past"
                  type="button"
                  class="cell-speak-btn is-past"
                  @click="speakKorean(w.verbForms.past)"
                >
                  <span>{{ w.verbForms.past }}</span>
                  <Volume2 :size="12" class="speak-ico" />
                </button>
                <span v-else class="cell-empty">—</span>
              </td>

              <!-- 안 -->
              <td>
                <button
                  v-if="w.verbForms?.negative"
                  type="button"
                  class="cell-speak-btn is-neg"
                  @click="speakKorean(w.verbForms.negative)"
                >
                  <span>{{ w.verbForms.negative }}</span>
                  <Volume2 :size="12" class="speak-ico" />
                </button>
                <span v-else class="cell-empty">—</span>
              </td>

              <!-- -(으)세요 -->
              <td>
                <button
                  v-if="w.verbForms?.honorific"
                  type="button"
                  class="cell-speak-btn is-hon"
                  @click="speakKorean(w.verbForms.honorific.split('/')[0].trim())"
                >
                  <span>{{ w.verbForms.honorific }}</span>
                  <Volume2 :size="12" class="speak-ico" />
                </button>
                <span v-else class="cell-empty">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.verb-practice-wrapper {
  width: 100%;
  margin: 0 auto;
  padding: 0.25rem 0.75rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.mode-header {
  display: flex;
  justify-content: center;
  max-width: 540px;
  width: 100%;
  margin: 0 auto;
}

.mode-switcher {
  display: flex;
  width: 100%;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 9999px;
  padding: 0.25rem;
  box-shadow: 0 2px 8px rgba(30, 35, 56, 0.04);
}

.mode-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.48rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted-foreground);
  transition: all 0.18s ease;
}

.mode-btn.is-active {
  background: var(--primary);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(88, 72, 196, 0.28);
}

.quiz-container {
  max-width: 540px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* Filter chips */
.category-strip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
  scrollbar-width: none;
}
.category-strip::-webkit-scrollbar {
  display: none;
}

.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.32rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.85);
  color: var(--muted-foreground);
  transition: all 0.16s ease;
}

.cat-chip.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(88, 72, 196, 0.22);
}

/* Top bar */
.voice-topbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.hint-icon-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 0.6rem;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.progress-track {
  flex: 1;
  height: 0.65rem;
  border-radius: 9999px;
  background: #e5e8f4;
  overflow: hidden;
  padding: 2px;
}

.progress-fill {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(90deg, #5848c4 0%, #7c6df0 100%);
  transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
}

.progress-shine {
  position: absolute;
  top: 1px;
  left: 6px;
  right: 6px;
  height: 3px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.32);
}

.stats-cluster {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  padding: 0.22rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 800;
  background: #ffffff;
  border: 1px solid var(--border);
  color: var(--muted-foreground);
}

.stat-pill.is-streak {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #ea580c;
}

.stat-pill.is-xp {
  background: #f2f0ff;
  border-color: #dcd7fe;
  color: var(--primary);
}

/* Stacked Card */
.deck-arena {
  position: relative;
  padding-top: 8px;
}

.stack-layer {
  position: absolute;
  left: 0;
  right: 0;
  margin: 0 auto;
  border-radius: 1.5rem;
  background: #ffffff;
  border: 1.5px solid var(--border);
  pointer-events: none;
}

.stack-layer.layer-2 {
  top: 0;
  width: 88%;
  height: 100%;
  opacity: 0.45;
  transform: translateY(-4px);
}

.stack-layer.layer-1 {
  top: 4px;
  width: 94%;
  height: 100%;
  opacity: 0.75;
  transform: translateY(-2px);
}

.verb-card {
  position: relative;
  z-index: 2;
  background: #ffffff;
  border-radius: 1.5rem;
  border: 2px solid var(--border);
  box-shadow:
    0 5px 0 #dfe3f2,
    0 12px 28px -8px rgba(30, 35, 56, 0.08);
  padding: 1rem 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  transition: all 0.2s ease;
}

.verb-card.state-success {
  border-color: #22c55e;
  box-shadow:
    0 5px 0 #16a34a,
    0 12px 28px -8px rgba(34, 197, 94, 0.2);
}

.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tense-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 800;
}

.tense-want {
  background: #fdf2f8;
  color: #db2777;
  border: 1px solid #fbcfe8;
}
.tense-present {
  background: #f2f0ff;
  color: #5848c4;
  border: 1px solid #dcd7fe;
}
.tense-past {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}
.tense-negative {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.tense-honorific {
  background: #f0fdfa;
  color: #0d9488;
  border: 1px solid #99f6e4;
}

.verb-type-tag {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--muted-foreground);
}

.prompt-zone {
  text-align: center;
  padding: 0.25rem 0;
}

.infinitive-row {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.korean-infinitive {
  font-size: clamp(1.9rem, 6vw, 2.35rem);
  font-weight: 800;
  color: var(--foreground);
  letter-spacing: -0.02em;
}

.mini-audio-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  background: #f2f0ff;
  color: var(--primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.spanish-meaning {
  font-size: 1.05rem;
  font-weight: 700;
  color: #4b5166;
  margin-top: 0.1rem;
}

.verb-note {
  font-size: 0.73rem;
  color: var(--muted-foreground);
  margin-top: 0.25rem;
}

/* 4 Choice Buttons */
.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.55rem;
}

.option-btn {
  position: relative;
  min-height: 3.25rem;
  padding: 0.6rem 0.75rem;
  border-radius: 1rem;
  background: #ffffff;
  border: 1.5px solid #d4d9ec;
  box-shadow: 0 3px 0 #d4d9ec;
  font-size: 1.12rem;
  font-weight: 800;
  color: var(--foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: all 0.12s ease;
}

.option-btn:hover:not(:disabled) {
  border-color: var(--primary);
  background: #f6f5ff;
  transform: translateY(-1px);
}

.option-btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 1px 0 #d4d9ec;
}

.option-btn.is-correct {
  background: #dcfce7;
  border-color: #16a34a;
  box-shadow: 0 3px 0 #16a34a;
  color: #15803d;
}

.option-btn.is-wrong {
  background: #fef2f2;
  border-color: #fca5a5;
  box-shadow: none;
  color: #dc2626;
  opacity: 0.55;
  text-decoration: line-through;
}

.resolved-summary {
  border-top: 1px dashed var(--border);
  padding-top: 0.65rem;
}

.summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: center;
}

.summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.55rem;
  border-radius: 0.6rem;
  background: #f8f9fc;
  border: 1px solid var(--border);
  font-size: 0.74rem;
  color: var(--foreground);
}

.chip-k {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--muted-foreground);
}

/* Action bar */
.action-bar {
  display: flex;
  justify-content: center;
}

.secondary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.65rem 1.25rem;
  border-radius: 1rem;
  background: #ffffff;
  border: 1.5px solid var(--border);
  box-shadow: 0 3px 0 #dfe3f2;
  color: var(--muted-foreground);
  font-size: 0.82rem;
  font-weight: 700;
}

.primary-next-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.8rem 1.4rem;
  border-radius: 1rem;
  background: var(--primary);
  color: #ffffff;
  box-shadow: 0 4px 0 #3f3296;
  font-size: 0.9rem;
  font-weight: 800;
}

/* ==========================================
   TABLE VIEW STYLES
   ========================================== */
.table-container {
  max-width: 1080px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.table-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.search-box {
  position: relative;
  flex: 1 1 260px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-foreground);
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.2rem;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: #ffffff;
  font-size: 0.82rem;
  outline: none;
}

.search-input:focus {
  border-color: var(--primary);
}

.filter-pills {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.table-helper {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  font-weight: 600;
}

.table-scroll-card {
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  overflow-x: auto;
  box-shadow: 0 8px 24px -10px rgba(30, 35, 56, 0.07);
}

.conj-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 680px;
  text-align: left;
}

.conj-table th {
  background: #f8f9fc;
  padding: 0.7rem 0.75rem;
  font-size: 0.76rem;
  font-weight: 800;
  color: var(--foreground);
  border-bottom: 1px solid var(--border);
}

.conj-table th small {
  display: block;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--muted-foreground);
}

.th-heart {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.conj-table td {
  padding: 0.55rem 0.7rem;
  border-bottom: 1px solid #eef0f7;
  vertical-align: middle;
}

.conj-table tr:last-child td {
  border-bottom: none;
}

.td-infinitive {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
}

.base-kr {
  font-size: 0.98rem;
  font-weight: 800;
  color: var(--foreground);
}

.base-es {
  font-size: 0.72rem;
  color: var(--muted-foreground);
  font-weight: 600;
}

.base-pron {
  font-size: 0.65rem;
  color: #b45309;
  font-weight: 700;
}

.cell-speak-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.55rem;
  border-radius: 0.55rem;
  font-size: 0.88rem;
  font-weight: 700;
  transition: all 0.14s ease;
}

.cell-speak-btn:hover {
  transform: translateY(-1px);
}

.cell-speak-btn.is-base {
  padding: 0.1rem 0.3rem;
  margin-left: -0.3rem;
}

.cell-speak-btn.is-want {
  background: #fdf2f8;
  color: #be185d;
}
.cell-speak-btn.is-present {
  background: #f2f0ff;
  color: #4c3db5;
}
.cell-speak-btn.is-past {
  background: #fffbeb;
  color: #b45309;
}
.cell-speak-btn.is-neg {
  background: #fef2f2;
  color: #b91c1c;
}
.cell-speak-btn.is-hon {
  background: #f0fdfa;
  color: #0f766e;
}

.speak-ico {
  opacity: 0.55;
}

.cell-empty {
  color: #cbd5e1;
  font-weight: 700;
  padding-left: 0.5rem;
}

.pop-badge-enter-active,
.pop-badge-leave-active {
  transition: all 0.2s ease;
}
.pop-badge-enter-from,
.pop-badge-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>

