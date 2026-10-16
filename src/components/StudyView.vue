<script setup lang="ts">
import { Volume2, Shuffle, ChevronLeft, ChevronRight, Check, BookOpen } from 'lucide-vue-next';
import type { Word, WordCategory } from '../types';
import { CATEGORY_LABELS } from '../data/words';
import { speakKorean } from '../utils/speech';
import CompletionState from './CompletionState.vue';

const props = defineProps<{
  activeWord: Word | null;
  knownCount: number;
  progressPercent: number;
  queueLength: number;
  cardIndex: number;
  totalCount: number;
  canGoBack: boolean;
  randomMode: boolean;
  revealed: boolean;
  selectedCategory: WordCategory | 'all';
  categoryCounts: { category: WordCategory | 'all'; label: string; count: number }[];
}>();

const emit = defineEmits<{
  (e: 'toggle-reveal'): void;
  (e: 'toggle-random'): void;
  (e: 'go-back'): void;
  (e: 'decision', type: 'known' | 'review'): void;
  (e: 'reset'): void;
  (e: 'open-browser'): void;
  (e: 'select-category', category: WordCategory | 'all'): void;
}>();

const handlePlayAudio = (text: string, event?: Event) => {
  if (event) {
    event.stopPropagation();
  }
  speakKorean(text);
};
</script>

<template>
  <section class="study-container mx-auto max-w-[880px] pb-6 pt-2 sm:pt-6">
    <!-- Streamlined, Breathable Top Toolbar -->
    <div class="study-toolbar nuri-entrance">
      <!-- Category chips and Shuffle toggle row -->
      <div class="toolbar-chips-row">
        <div class="category-scroll-list no-scrollbar">
          <button
            v-for="cat in categoryCounts"
            :key="cat.category"
            type="button"
            @click="emit('select-category', cat.category)"
            :class="['nuri-cat-chip', selectedCategory === cat.category ? 'is-active' : '']"
          >
            <span>{{ cat.label }}</span>
            <span class="nuri-cat-badge">{{ cat.count }}</span>
          </button>
        </div>

        <button
          type="button"
          @click="emit('toggle-random')"
          :aria-pressed="randomMode"
          :class="['random-toggle-btn shrink-0', randomMode ? 'is-active' : '']"
          title="Modo aleatorio"
        >
          <Shuffle :size="13" />
          <span>Aleatorio</span>
        </button>
      </div>

      <!-- Single, Modern Progress Indicator -->
      <div class="study-progress-section">
        <div class="progress-meta">
          <span class="progress-title">
            <span class="dot-indicator" />
            <span>Aprendidas: <strong class="text-[#1e2338]">{{ knownCount }}</strong> de {{ totalCount }}</span>
          </span>
          <span class="progress-percentage nuri-mono font-bold">{{ progressPercent }}%</span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :style="{ width: `${Math.max(progressPercent, 2)}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Completion view or Active Flashcard -->
    <CompletionState
      v-if="!activeWord"
      :total-words="totalCount"
      @reset="emit('reset')"
      @open-browser="emit('open-browser')"
    />

    <template v-else>
      <!-- FLASHCARD 3D SCENE -->
      <div class="nuri-card-scene mt-3 sm:mt-5">
        <div
          role="button"
          tabindex="0"
          @click="emit('toggle-reveal')"
          @keydown.enter.prevent="emit('toggle-reveal')"
          @keydown.space.prevent="emit('toggle-reveal')"
          :aria-expanded="revealed"
          :aria-label="revealed ? 'Ocultar significado' : 'Mostrar significado'"
          data-testid="button-flashcard"
          :class="['nuri-card cursor-pointer', revealed ? 'is-revealed' : '']"
        >
          <!-- Front Face -->
          <div class="nuri-card-face nuri-card-front">
            <!-- Decorative accent circles -->
            <div class="card-glow-circle circle-tr" />
            <div class="card-glow-circle circle-bl" />

            <!-- Front Header -->
            <div class="flex items-center justify-between relative z-10">
              <span class="category-badge">
                {{ CATEGORY_LABELS[activeWord.category] }}
              </span>

              <div class="flex items-center gap-3">
                <button
                  type="button"
                  @click="handlePlayAudio(activeWord.korean, $event)"
                  title="Escuchar pronunciación"
                  aria-label="Escuchar pronunciación en coreano"
                  class="nuri-audio-btn"
                >
                  <Volume2 :size="17" />
                </button>

                <span class="nuri-mono card-counter">
                  {{ String(cardIndex).padStart(2, '0') }} / {{ String(totalCount).padStart(2, '0') }}
                </span>
              </div>
            </div>

            <!-- Front Body: Big Korean Hangul (Clean, no PALABRA / ¿Qué significa?) -->
            <div class="my-auto py-8 text-center relative z-10">
              <p
                class="korean-hero-text"
                :data-testid="`text-card-korean-${activeWord.id}`"
              >
                {{ activeWord.korean }}
              </p>
            </div>

            <!-- Front Footer -->
            <div class="flex items-center justify-center text-[12px] font-medium text-[#7b819f] relative z-10">
              <span>toca para voltear</span>
            </div>
          </div>

          <!-- Back Face -->
          <div class="nuri-card-face nuri-card-back">
            <div class="card-glow-circle-dark" />
            <div class="nuri-ruled absolute inset-x-8 bottom-8 top-8 opacity-10" />

            <!-- Back Header -->
            <div class="flex items-center justify-between relative z-10">
              <span class="meaning-badge">
                significado
              </span>

              <div class="flex items-center gap-3">
                <button
                  type="button"
                  @click="handlePlayAudio(activeWord.verbForms?.present || activeWord.korean, $event)"
                  title="Escuchar pronunciación"
                  aria-label="Escuchar pronunciación en coreano"
                  class="nuri-audio-btn is-card-back"
                >
                  <Volume2 :size="17" />
                </button>

                <span class="flex items-center gap-1.5 text-xs text-[#c2c2dd]">
                  <BookOpen :size="14" />
                  <span>español</span>
                </span>
              </div>
            </div>

            <!-- Back Body: Clean Translation -->
            <div class="my-auto py-4 relative z-10">
              <p
                class="spanish-hero-text"
                :data-testid="`text-card-spanish-${activeWord.id}`"
              >
                {{ activeWord.spanish }}
              </p>

              <!-- Cultural / Context Note -->
              <div v-if="activeWord.note" class="mt-3">
                <span class="note-pill">
                  💡 {{ activeWord.note }}
                </span>
              </div>

              <!-- Verb / Adjective Conjugations -->
              <div
                v-if="activeWord.verbForms || activeWord.present"
                class="mt-3 sm:mt-4 conjugations-container"
              >
                <div class="grid grid-cols-1 gap-1.5 xs:grid-cols-3 sm:grid-cols-3 sm:gap-2">
                  <!-- Presente -->
                  <div
                    v-if="activeWord.verbForms?.present || activeWord.present"
                    class="conjugation-cell"
                  >
                    <div class="min-w-0 pr-1">
                      <span class="nuri-mono cell-label text-[#aaa6d1]">Presente</span>
                      <span class="cell-val text-[#b9b4ff] truncate block">
                        {{ activeWord.verbForms?.present || activeWord.present }}
                      </span>
                    </div>
                    <button
                      type="button"
                      @click="handlePlayAudio(activeWord.verbForms?.present || activeWord.present!, $event)"
                      class="cell-audio-btn text-[#aaa6d1] hover:text-white shrink-0"
                      title="Escuchar"
                    >
                      <Volume2 :size="14" />
                    </button>
                  </div>

                  <!-- Negación con 안 -->
                  <div
                    v-if="activeWord.verbForms?.negative"
                    class="conjugation-cell"
                  >
                    <div class="min-w-0 pr-1">
                      <span class="nuri-mono cell-label text-[#fca5a5]">Negación (안)</span>
                      <span class="cell-val text-[#fca5a5] truncate block">
                        {{ activeWord.verbForms.negative }}
                      </span>
                    </div>
                    <button
                      type="button"
                      @click="handlePlayAudio(activeWord.verbForms.negative, $event)"
                      class="cell-audio-btn text-[#fca5a5] hover:text-white shrink-0"
                      title="Escuchar"
                    >
                      <Volume2 :size="14" />
                    </button>
                  </div>

                  <!-- Honorífico -(으)세요 -->
                  <div
                    v-if="activeWord.verbForms?.honorific"
                    class="conjugation-cell"
                  >
                    <div class="min-w-0 pr-1">
                      <span class="nuri-mono cell-label text-[#9df1e0]">-(으)세요</span>
                      <span class="cell-val text-[#9df1e0] truncate block">
                        {{ activeWord.verbForms.honorific }}
                      </span>
                    </div>
                    <button
                      type="button"
                      @click="handlePlayAudio(activeWord.verbForms.honorific, $event)"
                      class="cell-audio-btn text-[#9df1e0] hover:text-white shrink-0"
                      title="Escuchar"
                    >
                      <Volume2 :size="14" />
                    </button>
                  </div>
                </div>

                <!-- Pronunciación fonética -->
                <div
                  v-if="activeWord.verbForms?.pronunciation"
                  class="mt-2.5 flex items-center gap-2 border-t border-[#b9b4ff]/15 pt-2 text-xs"
                >
                  <span class="nuri-mono text-[10px] text-[#aaa6d1]">🗣️ Pronunciación:</span>
                  <span class="font-bold text-[#fef3c7]">{{ activeWord.verbForms.pronunciation }}</span>
                </div>
              </div>
            </div>

            <!-- Back Footer -->
            <div class="flex items-center justify-center text-[12px] text-[#aaa6d1] relative z-10">
              <span class="nuri-mono text-[11px]">toca para volver</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="nuri-entrance nuri-entrance-4 mt-5 sm:mt-6 controls-grid">
        <button
          type="button"
          @click="emit('go-back')"
          :disabled="!canGoBack"
          title="Tarjeta anterior"
          aria-label="Volver a la tarjeta anterior"
          data-testid="button-previous-card"
          class="nuri-btn-back"
        >
          <ChevronLeft :size="24" />
        </button>

        <button
          type="button"
          @click="emit('decision', 'known')"
          title="Marcar como conocida"
          aria-label="Marcar como conocida"
          data-testid="button-mark-known"
          class="nuri-btn-known"
        >
          <Check :size="18" :stroke-width="2.6" />
          <span>Lo sé</span>
        </button>

        <button
          type="button"
          @click="emit('decision', 'review')"
          title="Siguiente tarjeta"
          aria-label="Siguiente tarjeta"
          data-testid="button-next-card"
          class="nuri-btn-next"
        >
          <ChevronRight :size="24" />
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.study-container {
  width: 100%;
}

.study-toolbar {
  margin-bottom: 0.25rem;
}

.toolbar-chips-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.category-scroll-list {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  padding: 0.25rem 0;
  flex: 1;
  min-width: 0;
}

.study-progress-section {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.45rem 0.85rem;
  margin-top: 0.4rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.progress-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.dot-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
  display: inline-block;
}

.progress-percentage {
  color: var(--primary);
  font-size: 0.8125rem;
}

.random-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.9);
  color: var(--muted-foreground);
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.random-toggle-btn:hover {
  background: #ffffff;
  color: var(--foreground);
  border-color: rgba(88, 72, 196, 0.4);
}
.random-toggle-btn.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
  box-shadow: 0 4px 12px var(--primary-glow);
}

.progress-track {
  height: 6px;
  background: #edf0f8;
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 9999px;
  background: var(--primary);
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Card Elements */
.card-glow-circle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.circle-tr {
  width: 180px;
  height: 180px;
  top: -40px;
  right: -40px;
  border: 16px solid rgba(222, 219, 255, 0.45);
}
.circle-bl {
  width: 160px;
  height: 160px;
  bottom: -40px;
  left: -40px;
  background: rgba(217, 244, 238, 0.55);
}

.card-glow-circle-dark {
  position: absolute;
  width: 180px;
  height: 180px;
  top: -40px;
  right: -40px;
  border-radius: 50%;
  border: 16px solid rgba(143, 134, 255, 0.18);
  pointer-events: none;
}

.category-badge {
  display: inline-flex;
  border-radius: 9999px;
  background: var(--primary-light);
  color: var(--primary);
  padding: 0.35rem 0.85rem;
  font-size: 0.6875rem;
  font-family: var(--font-mono);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.card-counter {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #7b819f;
}

.word-sublabel {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: #7b819f;
}

.korean-hero-text {
  font-family: var(--font-korean);
  font-weight: 700;
  font-size: clamp(3.2rem, 11vw, 5rem);
  line-height: 1.15;
  color: #1e2338;
  word-break: keep-all;
  letter-spacing: -0.025em;
}

.meaning-badge {
  display: inline-flex;
  border-radius: 9999px;
  background: #383164;
  color: #b9b4ff;
  padding: 0.35rem 0.85rem;
  font-size: 0.6875rem;
  font-family: var(--font-mono);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.spanish-hero-text {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: clamp(1.6rem, 5vw, 3rem);
  line-height: 1.1;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.note-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 10px;
  border: 1px solid rgba(185, 180, 255, 0.22);
  background: rgba(59, 53, 108, 0.6);
  padding: 0.35rem 0.7rem;
  font-size: 0.75rem;
  color: #dedbff;
}

.conjugations-container {
  border-radius: 16px;
  border: 1px solid rgba(185, 180, 255, 0.2);
  background: rgba(45, 39, 84, 0.75);
  padding: 0.625rem;
}

@media (min-width: 640px) {
  .conjugations-container {
    padding: 0.875rem;
  }
}

.conjugation-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 12px;
  background: #241f48;
  padding: 0.4rem 0.6rem;
}

@media (min-width: 640px) {
  .conjugation-cell {
    padding: 0.5rem 0.75rem;
  }
}

.cell-label {
  display: block;
  font-size: 0.5625rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cell-val {
  font-size: 0.875rem;
  font-weight: 700;
}

@media (min-width: 640px) {
  .cell-val {
    font-size: 0.9375rem;
  }
}

.cell-audio-btn {
  display: inline-flex;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.cell-audio-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.controls-grid {
  display: grid;
  grid-template-columns: 52px 1fr 52px;
  gap: 0.625rem;
  max-width: 680px;
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 640px) {
  .controls-grid {
    grid-template-columns: 64px 1fr 64px;
    gap: 1rem;
  }
}
</style>
