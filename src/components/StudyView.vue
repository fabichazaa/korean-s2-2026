<script setup lang="ts">
import { Volume2, Shuffle, ChevronLeft, ChevronRight, Check, BookOpen, Layers } from 'lucide-vue-next';
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
  <section class="study-container mx-auto max-w-[880px] pb-6 pt-5 md:pt-10">
    <!-- Header session info and stats -->
    <div class="nuri-entrance nuri-entrance-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="nuri-mono text-[10px] uppercase font-bold tracking-wider text-[#5848c4]">
          Sesión de estudio · Coreano → Español
        </p>
        <h1 class="main-title mt-2 text-[#1e2338]">
          Una palabra a la vez<span class="text-[#5848c4]">.</span>
        </h1>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-3 sm:pb-1">
        <button
          type="button"
          @click="emit('toggle-random')"
          :aria-pressed="randomMode"
          :class="['random-toggle-btn flex items-center gap-1.5', randomMode ? 'is-active' : '']"
        >
          <Shuffle :size="13" />
          <span>Aleatorio</span>
        </button>

        <div class="text-right">
          <p class="nuri-mono text-[9px] uppercase text-[#6c7393]">dominio</p>
          <p class="nuri-display stat-number leading-none text-[#1e2338]">{{ progressPercent }}%</p>
        </div>

        <div class="stat-divider" />

        <div>
          <p class="nuri-mono text-[9px] uppercase text-[#6c7393]">pendientes</p>
          <p class="nuri-display stat-number leading-none text-[#1e2338]">{{ queueLength }}</p>
        </div>
      </div>
    </div>

    <!-- Category selector horizontal bar -->
    <div class="nuri-entrance mt-6">
      <div class="flex items-center gap-1.5 mb-2.5 text-xs font-semibold text-[#6c7393]">
        <Layers :size="13" />
        <span>Filtrar por categoría:</span>
      </div>
      <div class="category-scroll-list no-scrollbar flex gap-2 overflow-x-auto pb-2 pt-1">
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
    </div>

    <!-- Progress bar & state info -->
    <div class="nuri-entrance nuri-entrance-3 mt-4">
      <div class="mb-2 flex items-center justify-between px-1">
        <p class="text-xs text-[#6c7393]">
          {{ !activeWord ? 'Sesión completa' : 'Toca la tarjeta para descubrir el significado' }}
        </p>
        <p class="nuri-mono text-[10px] text-[#6c7393]">
          {{ knownCount }} de {{ totalCount }} conocidas
        </p>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: `${Math.max(progressPercent, 2)}%` }"
        />
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
      <div class="nuri-card-scene mt-6">
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

            <!-- Front Body: Big Korean Hangul -->
            <div class="my-auto py-6 text-center relative z-10">
              <p class="nuri-mono word-sublabel mb-3">
                {{ activeWord.category === 'verb' ? 'infinitivo' : 'palabra' }}
              </p>
              <p
                class="korean-hero-text"
                :data-testid="`text-card-korean-${activeWord.id}`"
              >
                {{ activeWord.korean }}
              </p>
              <p class="mt-4 text-xs font-medium text-[#6c7393]">¿Qué significa?</p>
            </div>

            <!-- Front Footer -->
            <div class="flex items-center justify-between text-[11px] text-[#6c7393] relative z-10">
              <span class="font-medium">toca para voltear</span>
              <span class="nuri-mono text-[10px]">espacio / enter</span>
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

            <!-- Back Body -->
            <div class="my-auto py-3 relative z-10">
              <p class="nuri-mono text-[9px] uppercase tracking-wider text-[#aaa6d1] mb-2">traducción</p>
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
                class="mt-4 conjugations-container"
              >
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <!-- Presente -->
                  <div
                    v-if="activeWord.verbForms?.present || activeWord.present"
                    class="conjugation-cell"
                  >
                    <div>
                      <span class="nuri-mono cell-label text-[#aaa6d1]">Presente</span>
                      <span class="cell-val text-[#b9b4ff]">
                        {{ activeWord.verbForms?.present || activeWord.present }}
                      </span>
                    </div>
                    <button
                      type="button"
                      @click="handlePlayAudio(activeWord.verbForms?.present || activeWord.present!, $event)"
                      class="cell-audio-btn text-[#aaa6d1] hover:text-white"
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
                    <div>
                      <span class="nuri-mono cell-label text-[#fca5a5]">Negación (안)</span>
                      <span class="cell-val text-[#fca5a5]">
                        {{ activeWord.verbForms.negative }}
                      </span>
                    </div>
                    <button
                      type="button"
                      @click="handlePlayAudio(activeWord.verbForms.negative, $event)"
                      class="cell-audio-btn text-[#fca5a5] hover:text-white"
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
                    <div>
                      <span class="nuri-mono cell-label text-[#9df1e0]">-(으)세요</span>
                      <span class="cell-val text-[#9df1e0]">
                        {{ activeWord.verbForms.honorific }}
                      </span>
                    </div>
                    <button
                      type="button"
                      @click="handlePlayAudio(activeWord.verbForms.honorific, $event)"
                      class="cell-audio-btn text-[#9df1e0] hover:text-white"
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
            <div class="flex items-center justify-between text-[11px] text-[#aaa6d1] relative z-10">
              <span>significado revelado</span>
              <span class="nuri-mono text-[10px]">toca para volver</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="nuri-entrance nuri-entrance-4 mt-6 controls-grid">
        <button
          type="button"
          @click="emit('go-back')"
          :disabled="!canGoBack"
          aria-label="Volver a la tarjeta anterior"
          data-testid="button-previous-card"
          class="nuri-btn-back"
        >
          <ChevronLeft :size="24" />
        </button>

        <button
          type="button"
          @click="emit('decision', 'review')"
          data-testid="button-next-card"
          class="nuri-btn-review"
        >
          <ChevronRight :size="18" />
          <span>Repasar</span>
        </button>

        <button
          type="button"
          @click="emit('decision', 'known')"
          data-testid="button-mark-known"
          class="nuri-btn-known"
        >
          <Check :size="18" :stroke-width="2.6" />
          <span>Lo sé</span>
        </button>
      </div>

      <!-- Keyboard shortcuts legend -->
      <div class="mt-4 flex items-center justify-center gap-3 text-[11px] text-[#6c7393]">
        <span class="inline-flex items-center gap-1.5">
          <kbd class="nuri-key-chip">Espacio</kbd> voltear
        </span>
        <span>·</span>
        <span class="inline-flex items-center gap-1.5">
          <kbd class="nuri-key-chip">1</kbd> repasar
        </span>
        <span>·</span>
        <span class="inline-flex items-center gap-1.5">
          <kbd class="nuri-key-chip">2</kbd> lo sé
        </span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.study-container {
  width: 100%;
}

.main-title {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: clamp(2.2rem, 5vw, 3.4rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.stat-number {
  font-size: 1.75rem;
  font-family: var(--font-sans);
  font-weight: 700;
}

.stat-divider {
  width: 1px;
  height: 2.25rem;
  background: var(--border);
}

.random-toggle-btn {
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.85);
  color: var(--muted-foreground);
  padding: 0.45rem 0.9rem;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease;
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
  box-shadow: 0 6px 16px var(--primary-glow);
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
  font-weight: 800;
  font-size: clamp(3.2rem, 9.5vw, 5.8rem);
  line-height: 1;
  color: #1e2338;
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
  font-size: clamp(2rem, 5.5vw, 3.4rem);
  line-height: 1.05;
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
  padding: 0.4rem 0.75rem;
  font-size: 0.78rem;
  color: #dedbff;
}

.conjugations-container {
  border-radius: 16px;
  border: 1px solid rgba(185, 180, 255, 0.2);
  background: rgba(45, 39, 84, 0.75);
  padding: 0.875rem;
}

.conjugation-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 12px;
  background: #241f48;
  padding: 0.5rem 0.75rem;
}

.cell-label {
  display: block;
  font-size: 0.5625rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cell-val {
  font-size: 0.9375rem;
  font-weight: 700;
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
  grid-template-columns: 64px 1fr 1fr;
  gap: 0.75rem;
  max-width: 680px;
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 640px) {
  .controls-grid {
    gap: 1rem;
  }
}
</style>
