<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { Word, WordCategory, SavedProgress, StudyFilter } from './types';
import { WORDS, STORAGE_KEY, shuffleWords, CATEGORY_ORDER, CATEGORY_TITLES } from './data/words';
import Header, { type AppTab } from './components/Header.vue';
import StudyView from './components/StudyView.vue';
import VocabularyView from './components/VocabularyView.vue';
import TimeNumbersView from './components/TimeNumbersView.vue';
import LoadingState from './components/LoadingState.vue';

import { isSupabaseConfigured, supabase } from './utils/supabase';
import AuthModal from './components/AuthModal.vue';

const hydrated = ref(false);
const knownIds = ref<string[]>([]);
const reviewCounts = ref<Record<string, number>>({});
const cursor = ref(0);
const revealed = ref(false);
const activeTab = ref<AppTab>('study');
const selectedCategory = ref<WordCategory | 'all'>('all');
const studyFilter = ref<StudyFilter>('unlearned');
const search = ref('');
const randomMode = ref(false);
const randomOrder = ref<string[]>([]);

// Auth & Cloud Sync
const currentUser = ref<any>(null);
const showAuthModal = ref(false);

let hydrateTimer: number | undefined;

// Load progress from Supabase
const loadSupabaseProgress = async (userId: string) => {
  if (!isSupabaseConfigured) return;
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('known_ids, review_counts')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Could not fetch user progress from Supabase:', error.message);
      return;
    }

    if (data) {
      // Merge remote with local so no offline practice is lost
      const remoteKnown: string[] = Array.isArray(data.known_ids) ? data.known_ids : [];
      const remoteReviews: Record<string, number> = data.review_counts || {};

      const mergedKnown = Array.from(new Set([...remoteKnown, ...knownIds.value]));
      const mergedReviews = { ...remoteReviews };
      for (const [id, count] of Object.entries(reviewCounts.value)) {
        mergedReviews[id] = Math.max(mergedReviews[id] || 0, count);
      }

      knownIds.value = mergedKnown;
      reviewCounts.value = mergedReviews;

      // Save merged state back to Supabase
      await saveSupabaseProgress(userId);
    } else {
      // First time user: create remote row with current local progress
      await supabase.from('user_progress').insert({
        user_id: userId,
        known_ids: knownIds.value,
        review_counts: reviewCounts.value,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Error synchronizing with Supabase:', err);
  }
};

// Save progress to Supabase
const saveSupabaseProgress = async (userId?: string) => {
  const uid = userId || currentUser.value?.id;
  if (!isSupabaseConfigured || !uid) return;

  try {
    await supabase.from('user_progress').upsert({
      user_id: uid,
      known_ids: knownIds.value,
      review_counts: reviewCounts.value,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed saving progress to Supabase:', err);
  }
};

const handleLogout = async () => {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
  currentUser.value = null;
};

// Hydration and localStorage loading
onMounted(async () => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as SavedProgress;
      knownIds.value = Array.isArray(parsed.knownIds) ? parsed.knownIds : [];
      reviewCounts.value = parsed.reviewCounts ?? {};
    }
  } catch (e) {
    console.error('Failed reading saved progress from localStorage', e);
    knownIds.value = [];
    reviewCounts.value = {};
  } finally {
    hydrateTimer = window.setTimeout(() => {
      hydrated.value = true;
    }, 240);
  }

  // Check Supabase session
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      currentUser.value = session?.user ?? null;
      if (currentUser.value) {
        await loadSupabaseProgress(currentUser.value.id);
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        currentUser.value = session?.user ?? null;
        if (session?.user) {
          await loadSupabaseProgress(session.user.id);
        }
      });
    } catch (e) {
      console.error('Failed checking Supabase session', e);
    }
  }

  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  if (hydrateTimer) {
    window.clearTimeout(hydrateTimer);
  }
  window.removeEventListener('keydown', onKeyDown);
});

// Sync to localStorage and Supabase
watch(
  [hydrated, knownIds, reviewCounts],
  () => {
    if (!hydrated.value) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          knownIds: knownIds.value,
          reviewCounts: reviewCounts.value,
        })
      );
    } catch (e) {
      console.error('Failed saving progress to localStorage', e);
    }

    if (currentUser.value) {
      saveSupabaseProgress(currentUser.value.id);
    }
  },
  { deep: true }
);

// Category counts for chip filter
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

// Category Filtered Words for Study Queue
const categoryWords = computed(() => {
  if (selectedCategory.value === 'all') return WORDS;
  return WORDS.filter((word) => word.category === selectedCategory.value);
});

const orderedQueue = computed(() => {
  if (studyFilter.value === 'unlearned') {
    return categoryWords.value.filter((word) => !knownIds.value.includes(word.id));
  }
  if (studyFilter.value === 'learned') {
    return categoryWords.value.filter((word) => knownIds.value.includes(word.id));
  }
  return categoryWords.value;
});

const queue = computed(() => {
  if (!randomMode.value) return orderedQueue.value;

  const availableIds = new Set(orderedQueue.value.map((word) => word.id));
  const savedRandomWords = randomOrder.value
    .filter((id) => availableIds.has(id))
    .map((id) => orderedQueue.value.find((word) => word.id === id))
    .filter((word): word is Word => Boolean(word));
  const missingWords = orderedQueue.value.filter((word) => !randomOrder.value.includes(word.id));

  return [...savedRandomWords, ...missingWords];
});

const activeWord = computed(() => {
  if (queue.value.length === 0) return null;
  return queue.value[Math.min(cursor.value, queue.value.length - 1)];
});

const cardIndex = computed(() => {
  if (!activeWord.value) return 0;
  return queue.value.findIndex((word) => word.id === activeWord.value?.id) + 1;
});

const knownCount = computed(() => {
  return categoryWords.value.filter((w) => knownIds.value.includes(w.id)).length;
});

const unlearnedCount = computed(() => {
  return Math.max(0, categoryWords.value.length - knownCount.value);
});

const overallKnownCount = computed(() => knownIds.value.length);

const progressPercent = computed(() => {
  if (categoryWords.value.length === 0) return 100;
  return Math.round((knownCount.value / categoryWords.value.length) * 100);
});

const filteredWords = computed(() => {
  const normalized = search.value.trim().toLowerCase();
  if (!normalized) return WORDS;
  return WORDS.filter((word) =>
    [
      word.korean,
      word.spanish,
      word.present ?? '',
      word.note ?? '',
      word.verbForms?.negative ?? '',
      word.verbForms?.honorific ?? '',
    ].some((value) => value.toLowerCase().includes(normalized))
  );
});

// Actions
const handleDecision = (decision: 'known' | 'review') => {
  if (!activeWord.value) return;
  const currentWord = activeWord.value;

  if (decision === 'known') {
    if (!knownIds.value.includes(currentWord.id)) {
      knownIds.value = [...knownIds.value, currentWord.id];
    }
    if (studyFilter.value === 'unlearned') {
      cursor.value = Math.min(cursor.value, Math.max(0, queue.value.length - 2));
    } else {
      if (queue.value.length > 1) {
        cursor.value = (cursor.value + 1) % queue.value.length;
      }
    }
  } else {
    reviewCounts.value = {
      ...reviewCounts.value,
      [currentWord.id]: (reviewCounts.value[currentWord.id] ?? 0) + 1,
    };
    if (queue.value.length > 1) {
      cursor.value = (cursor.value + 1) % queue.value.length;
    }
  }
  revealed.value = false;
};

const toggleKnownInTable = (wordId: string) => {
  if (knownIds.value.includes(wordId)) {
    knownIds.value = knownIds.value.filter((id) => id !== wordId);
  } else {
    knownIds.value = [...knownIds.value, wordId];
  }
};

const toggleKnownWord = (wordId: string) => {
  toggleKnownInTable(wordId);
  if (studyFilter.value !== 'all') {
    cursor.value = Math.min(cursor.value, Math.max(0, queue.value.length - 2));
  }
};

const resetProgress = () => {
  knownIds.value = [];
  reviewCounts.value = {};
  cursor.value = 0;
  revealed.value = false;
  randomMode.value = false;
  randomOrder.value = [];
};

const handleCategoryChange = (category: WordCategory | 'all') => {
  selectedCategory.value = category;
  cursor.value = 0;
  revealed.value = false;
  if (randomMode.value) {
    randomOrder.value = shuffleWords(orderedQueue.value).map((w) => w.id);
  }
};

const handleStudyFilterChange = (filter: StudyFilter) => {
  studyFilter.value = filter;
  cursor.value = 0;
  revealed.value = false;
  if (randomMode.value) {
    randomOrder.value = shuffleWords(orderedQueue.value).map((w) => w.id);
  }
};

const toggleRandomMode = () => {
  const nextRandomMode = !randomMode.value;
  if (nextRandomMode) {
    randomOrder.value = shuffleWords(queue.value).map((word) => word.id);
  }
  randomMode.value = nextRandomMode;
  cursor.value = 0;
  revealed.value = false;
};

const goBack = () => {
  if (cursor.value === 0) return;
  cursor.value = Math.max(0, cursor.value - 1);
  revealed.value = false;
};

// Keyboard navigation
const onKeyDown = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  if (activeTab.value !== 'study') {
    if (event.key === 'Escape') {
      activeTab.value = 'study';
    }
    return;
  }

  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    revealed.value = !revealed.value;
  }
  if (event.key === '1' || event.key === 'ArrowLeft') {
    event.preventDefault();
    handleDecision('review');
  }
  if (event.key === '2' || event.key === 'ArrowRight') {
    event.preventDefault();
    handleDecision('known');
  }
};
</script>

<template>
  <LoadingState v-if="!hydrated" />

  <div v-else class="nuri-page nuri-grain min-h-[100dvh]">
    <div class="mx-auto min-h-[100dvh] w-full max-w-[1440px]">
      <!-- Header -->
      <Header
        :active-tab="activeTab"
        :known-count="overallKnownCount"
        :total-count="WORDS.length"
        :user-email="currentUser?.email"
        @update:active-tab="activeTab = $event"
        @open-auth="showAuthModal = true"
        @logout="handleLogout"
      />

      <!-- Main Content Area -->
      <main class="w-full min-w-0 px-3 pb-10 sm:px-8 md:px-12 lg:px-16 sm:pb-12">
        <!-- Study Mode View (Flashcards) -->
        <StudyView
          v-if="activeTab === 'study'"
          :active-word="activeWord"
          :known-count="knownCount"
          :unlearned-count="unlearnedCount"
          :category-total-count="categoryWords.length"
          :progress-percent="progressPercent"
          :queue-length="queue.length"
          :card-index="cardIndex"
          :total-count="queue.length"
          :can-go-back="cursor > 0"
          :random-mode="randomMode"
          :revealed="revealed"
          :selected-category="selectedCategory"
          :category-counts="categoryCounts"
          :study-filter="studyFilter"
          :is-word-known="activeWord ? knownIds.includes(activeWord.id) : false"
          @toggle-reveal="revealed = !revealed"
          @toggle-random="toggleRandomMode"
          @go-back="goBack"
          @decision="handleDecision"
          @reset="resetProgress"
          @open-browser="activeTab = 'vocabulary'"
          @select-category="handleCategoryChange"
          @update:study-filter="handleStudyFilterChange"
          @toggle-word-known="toggleKnownWord"
        />

        <!-- Time & Numbers Interactive Trainer -->
        <TimeNumbersView
          v-else-if="activeTab === 'numbers'"
        />

        <!-- Notebook / Vocabulary View -->
        <VocabularyView
          v-else-if="activeTab === 'vocabulary'"
          :words="filteredWords"
          :total-count="WORDS.length"
          :search="search"
          :known-ids="knownIds"
          :review-counts="reviewCounts"
          @search="search = $event"
          @close="activeTab = 'study'"
          @toggle-known="toggleKnownInTable"
        />
      </main>
    </div>

    <!-- Auth Modal -->
    <AuthModal
      v-if="showAuthModal"
      @close="showAuthModal = false"
      @authenticated="showAuthModal = false"
    />
  </div>
</template>

<style scoped>
.min-h-\[100dvh\] {
  min-height: 100vh;
  min-height: 100dvh;
}
.max-w-\[1440px\] {
  max-width: 1440px;
}
.mx-auto {
  margin-left: auto;
  margin-right: auto;
}
.w-full {
  width: 100%;
}
.min-w-0 {
  min-width: 0;
}
.pb-12 {
  padding-bottom: 3rem;
}
</style>
