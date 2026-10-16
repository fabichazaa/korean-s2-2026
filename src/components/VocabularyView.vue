<script setup lang="ts">
import { computed } from 'vue';
import { Target, Search, X } from 'lucide-vue-next';
import type { Word } from '../types';
import { CATEGORY_ORDER } from '../data/words';
import VocabularyTable from './VocabularyTable.vue';

const props = defineProps<{
  words: Word[];
  totalCount: number;
  search: string;
  knownIds: string[];
  reviewCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: 'search', value: string): void;
  (e: 'close'): void;
  (e: 'toggle-known', wordId: string): void;
}>();

const groupedWords = computed(() => {
  return CATEGORY_ORDER.map((category) => ({
    category,
    words: props.words.filter((word) => word.category === category),
  })).filter((group) => group.words.length > 0);
});
</script>

<template>
  <section class="vocab-container mx-auto max-w-[880px] pb-12 pt-5 md:pt-10">
    <!-- Header -->
    <div class="nuri-entrance flex flex-col justify-between gap-4 sm:gap-6 sm:flex-row sm:items-end">
      <div>
        <p class="nuri-mono text-[10px] uppercase font-bold text-[#5848c4]">
          Tu cuaderno · {{ totalCount }} palabras
        </p>
        <h1 class="page-title mt-2 text-[#1e2338]">
          Mis palabras<span class="text-[#5848c4]">.</span>
        </h1>
        <p class="mt-2 max-w-[480px] text-xs sm:text-sm leading-5 sm:leading-6 text-[#6c7393]">
          Una vista organizada para reconocer patrones, repasar lo difícil y consultar todas tus palabras.
        </p>
      </div>

      <button
        type="button"
        @click="emit('close')"
        data-testid="button-back-to-study"
        class="back-study-btn flex items-center justify-center gap-2 w-full sm:w-auto"
      >
        <Target :size="15" />
        <span>Volver a estudiar</span>
      </button>
    </div>

    <!-- Search Input -->
    <div class="nuri-entrance nuri-entrance-2 relative mt-6 sm:mt-8">
      <Search
        class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#767d9c]"
        :size="18"
      />
      <input
        type="search"
        :value="search"
        @input="emit('search', ($event.target as HTMLInputElement).value)"
        placeholder="Busca en coreano o español..."
        aria-label="Buscar palabras"
        data-testid="input-search-vocabulary"
        class="search-input w-full py-3.5 pl-11 pr-11 text-sm text-[#1e2338]"
      />
      <button
        v-if="search"
        type="button"
        @click="emit('search', '')"
        aria-label="Limpiar búsqueda"
        data-testid="button-clear-search"
        class="clear-search-btn absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
      >
        <X :size="15" />
      </button>
    </div>

    <!-- Empty Search State -->
    <div
      v-if="words.length === 0"
      class="nuri-entrance nuri-entrance-3 mt-6 rounded-[22px] border border-[#e0e4f2] bg-white px-6 py-16 text-center"
    >
      <p class="nuri-display text-2xl font-bold text-[#1e2338]">No encontramos esa palabra.</p>
      <p class="mt-2 text-sm text-[#6c7393]">Prueba escribiendo en español o en coreano.</p>
    </div>

    <!-- Tables List -->
    <div v-else class="mt-8 space-y-6">
      <VocabularyTable
        v-for="group in groupedWords"
        :key="group.category"
        :category="group.category"
        :words="group.words"
        :known-ids="knownIds"
        :review-counts="reviewCounts"
        @toggle-known="emit('toggle-known', $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.page-title {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: clamp(2.2rem, 5vw, 3.4rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.back-study-btn {
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.9);
  padding: 0.6rem 1.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--foreground);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  white-space: nowrap;
}
.back-study-btn:hover {
  border-color: rgba(88, 72, 196, 0.4);
  background: #ffffff;
}

.search-input {
  border-radius: 16px;
  border: 1px solid var(--border);
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-glow);
}

.clear-search-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--muted-foreground);
  transition: all 0.15s ease;
}
.clear-search-btn:hover {
  background: #edf0f8;
  color: var(--foreground);
}
</style>
