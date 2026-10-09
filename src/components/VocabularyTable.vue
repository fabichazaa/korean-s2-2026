<script setup lang="ts">
import { computed } from 'vue';
import { Check, Volume2 } from 'lucide-vue-next';
import type { Word, WordCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_TITLES } from '../data/words';
import { speakKorean } from '../utils/speech';

const props = defineProps<{
  category: WordCategory;
  words: Word[];
  knownIds: string[];
  reviewCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: 'toggle-known', wordId: string): void;
}>();

const hasPresentColumn = computed(() => props.category === 'verb' || props.category === 'adjective');

const playAudio = (text: string, e: Event) => {
  e.stopPropagation();
  speakKorean(text);
};
</script>

<template>
  <section :data-testid="`vocabulary-section-${category}`" class="mb-8">
    <div class="mb-3 flex items-center justify-between px-1">
      <div class="flex items-baseline gap-3">
        <h2 class="category-heading text-xl font-bold text-[#1e2338]">{{ CATEGORY_TITLES[category] }}</h2>
        <span class="nuri-mono text-[11px] font-bold text-[#6c7393]">{{ words.length }}</span>
      </div>
      <span class="category-chip-label">
        {{ CATEGORY_LABELS[category] }}
      </span>
    </div>

    <div class="table-card overflow-hidden">
      <!-- Table Header -->
      <div
        :class="[
          'table-header-grid px-4 py-3 sm:px-6',
          hasPresentColumn ? 'has-present' : 'no-present'
        ]"
      >
        <span>Palabra</span>
        <span>Español</span>
        <span v-if="hasPresentColumn">Presente</span>
        <span class="text-right">Estado</span>
      </div>

      <!-- Table Body -->
      <div class="divide-y divide-[#e0e4f2]/70">
        <div
          v-for="word in words"
          :key="word.id"
          :data-testid="`row-vocabulary-${word.id}`"
          :class="[
            'table-row-grid items-center px-4 py-3.5 sm:px-6',
            hasPresentColumn ? 'has-present' : 'no-present'
          ]"
        >
          <!-- Korean Word with Audio Button -->
          <div class="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              @click="playAudio(word.korean, $event)"
              :title="`Escuchar ${word.korean}`"
              aria-label="Escuchar pronunciación"
              class="nuri-audio-btn nuri-audio-btn-sm shrink-0"
            >
              <Volume2 :size="14" />
            </button>
            <div class="min-w-0">
              <p
                class="nuri-display truncate text-[20px] font-bold leading-tight text-[#1e2338]"
                :data-testid="`text-word-korean-${word.id}`"
              >
                {{ word.korean }}
              </p>
            </div>
          </div>

          <!-- Spanish translation & note -->
          <div class="min-w-0 pr-2">
            <p
              class="truncate text-sm text-[#1e2338] font-medium"
              :data-testid="`text-word-spanish-${word.id}`"
            >
              {{ word.spanish }}
            </p>
            <p v-if="word.note" class="truncate text-[11px] text-[#6c7393] mt-0.5">
              {{ word.note }}
            </p>
          </div>

          <!-- Present simple if verb or adjective -->
          <div v-if="hasPresentColumn" class="flex items-center gap-2 min-w-0">
            <button
              v-if="word.present"
              type="button"
              @click="playAudio(word.present, $event)"
              :title="`Escuchar ${word.present}`"
              aria-label="Escuchar conjugación"
              class="nuri-audio-btn nuri-audio-btn-sm shrink-0"
            >
              <Volume2 :size="13" />
            </button>
            <p class="truncate text-sm text-[#5848c4] font-semibold">
              {{ word.present }}
            </p>
          </div>

          <!-- Status badge with toggle click -->
          <div class="flex min-w-[70px] flex-col items-end gap-1">
            <button
              type="button"
              @click="emit('toggle-known', word.id)"
              :title="knownIds.includes(word.id) ? 'Clic para desmarcar como conocido' : 'Clic para marcar como conocido'"
              class="cursor-pointer transition-transform hover:scale-105"
            >
              <span
                v-if="knownIds.includes(word.id)"
                class="status-known inline-flex items-center gap-1"
              >
                <Check :size="12" :stroke-width="2.6" /> lista
              </span>

              <span
                v-else-if="(reviewCounts[word.id] ?? 0) > 0"
                class="status-review"
              >
                {{ reviewCounts[word.id] }}
                {{ reviewCounts[word.id] === 1 ? 'repaso' : 'repasos' }}
              </span>

              <span
                v-else
                class="status-pending"
              >
                pendiente
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.category-heading {
  font-family: var(--font-sans);
  letter-spacing: -0.02em;
}

.category-chip-label {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6c7393;
}

.table-card {
  border-radius: 20px;
  border: 1px solid var(--border);
  background: #ffffff;
  box-shadow: var(--shadow-sm);
}

.table-header-grid {
  display: grid;
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: #edf0f8;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6c7393;
}

.table-row-grid {
  display: grid;
  align-items: center;
  transition: background 0.15s ease;
}
.table-row-grid:hover {
  background: #f7f8fc;
}

.has-present {
  grid-template-columns: 1.2fr 1fr 1fr 80px;
}

.no-present {
  grid-template-columns: 1.2fr 1.6fr 80px;
}

@media (max-width: 640px) {
  .has-present {
    grid-template-columns: 1fr 1fr 0.9fr 70px;
    gap: 0.5rem;
  }
  .no-present {
    grid-template-columns: 1.1fr 1.4fr 70px;
    gap: 0.5rem;
  }
}

.status-known {
  border-radius: 9999px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  padding: 0.2rem 0.65rem;
  font-size: 0.6875rem;
  font-weight: 700;
}

.status-review {
  border-radius: 9999px;
  background: #fef3c7;
  color: #92400e;
  padding: 0.2rem 0.65rem;
  font-size: 0.6875rem;
  font-weight: 700;
}

.status-pending {
  border-radius: 9999px;
  background: #edf0f8;
  color: #6c7393;
  padding: 0.2rem 0.65rem;
  font-size: 0.6875rem;
  font-weight: 600;
}
</style>
