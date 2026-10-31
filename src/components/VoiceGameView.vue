<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  Mic,
  MicOff,
  Flame,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Edit3,
  Check,
} from 'lucide-vue-next';
import type { Word, WordCategory } from '../types';
import { WORDS, CATEGORY_ORDER, CATEGORY_TITLES, shuffleWords } from '../data/words';
import {
  isSpeechRecognitionSupported,
  checkKoreanPronunciationMatch,
  playGameSound,
} from '../utils/speech';
import { isSupabaseConfigured, supabase } from '../utils/supabase';

const props = defineProps<{
  knownIds: string[];
  userId?: string | null;
  userEmail?: string | null;
  voiceCorrectCount?: number;
}>();

const emit = defineEmits<{
  (e: 'mark-known', wordId: string, earnedXp: number): void;
  (e: 'update-player-name', newName: string): void;
}>();

type FeedbackState = 'idle' | 'listening' | 'success' | 'retry' | 'error';

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  wordsCorrect: number;
  xp: number;
  bestStreak: number;
  isCurrentUser?: boolean;
}

const BEST_SCORE_KEY = 'nuri-voice-game-best-score-v1';
const PLAYER_STATS_KEY = 'nuri-voice-player-stats-v1';
const PLAYER_NAME_KEY = 'nuri-voice-player-name-v1';
const PLAYER_ID_KEY = 'nuri-voice-player-id-v1';

// Game State
const selectedCategory = ref<WordCategory | 'all'>('all');
const alwaysShowHangul = ref(false);
const hintRevealed = ref(false);

const deck = ref<Word[]>([]);
const currentIndex = ref(0);
const score = ref(0);
const bestScore = ref(0);
const streak = ref(0);
const bestStreak = ref(0);
const wordsCompleted = ref(0);
const totalWordsAllTime = ref(0);
const lastPointsEarned = ref(0);

// Continuous Voice State
const micEnabled = ref(false);
const isListening = ref(false);
const feedbackState = ref<FeedbackState>('idle');
const heardText = ref('');
const errorMessage = ref('');
const speechSupported = ref(true);
const isSecureContextFlag = ref(true);
const isIosChrome = ref(false);

// Leaderboard State
const playerName = ref('');
const editingName = ref(false);
const nameInput = ref('');
const localPlayerId = ref('');
const leaderboard = ref<LeaderboardEntry[]>([]);
const loadingLeaderboard = ref(false);

let recognition: any = null;
let advanceTimer: number | undefined;
let reconnectTimer: number | undefined;
let retryJudgeTimer: number | undefined;

// Snapshot of the recognition transcript at the moment the current card appeared
let latestRawTranscript = '';
let transcriptAtCardStart = '';
let previousWord: Word | null = null;
let cardSwitchedAt = 0;

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

const maxLeaderboardWords = computed(() => {
  if (leaderboard.value.length === 0) return 1;
  return Math.max(1, ...leaderboard.value.map((e) => e.wordsCorrect));
});

const effectivePlayerId = computed(() => props.userId || localPlayerId.value);

const effectivePlayerName = computed(() => {
  if (playerName.value.trim()) return playerName.value.trim();
  if (props.userEmail) return props.userEmail.split('@')[0];
  return 'Estudiante';
});

// Extract what the user has spoken on the CURRENT card (ignoring leftover text from previous cards)
const getSpokenOnCurrentCard = (rawFull: string): string => {
  const clean = rawFull.trim();
  if (!clean) return '';
  if (!transcriptAtCardStart) return clean;
  if (clean === transcriptAtCardStart) return '';

  if (clean.startsWith(transcriptAtCardStart)) {
    return clean.slice(transcriptAtCardStart.length).trim();
  }

  // If the recognizer modified earlier text or started a fresh buffer, take the newest word(s)
  const words = clean.split(/\s+/).filter(Boolean);
  return words.length > 0 ? words[words.length - 1] : clean;
};

const clearTimers = () => {
  if (advanceTimer) {
    window.clearTimeout(advanceTimer);
    advanceTimer = undefined;
  }
  if (retryJudgeTimer) {
    window.clearTimeout(retryJudgeTimer);
    retryJudgeTimer = undefined;
  }
};

const buildDeck = () => {
  deck.value = shuffleWords(filteredPool.value);
  currentIndex.value = 0;
  previousWord = null;
  resetCardState();
};

const resetCardState = () => {
  clearTimers();
  transcriptAtCardStart = latestRawTranscript;
  cardSwitchedAt = Date.now();
  hintRevealed.value = false;
  heardText.value = '';
  errorMessage.value = '';
  feedbackState.value = isListening.value ? 'listening' : 'idle';
};

const destroyRecognitionInstance = (useStop = false) => {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
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
};

const stopContinuousMic = () => {
  micEnabled.value = false;
  clearTimers();
  destroyRecognitionInstance(true);
  if (feedbackState.value === 'listening') {
    feedbackState.value = 'idle';
  }
};

const startRecognitionSession = () => {
  if (!micEnabled.value) return;

  if (!isSecureContextFlag.value) {
    micEnabled.value = false;
    feedbackState.value = 'error';
    errorMessage.value = 'Abre la app con https:// para usar el micrófono en el celular.';
    return;
  }

  const SpeechRecognitionCtor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionCtor) {
    speechSupported.value = false;
    micEnabled.value = false;
    feedbackState.value = 'error';
    errorMessage.value = isIosChrome.value
      ? 'En iPhone, abre este link en Safari para usar el micrófono.'
      : 'Usa Safari (iPhone) o Chrome (Android/PC) para hablar.';
    return;
  }

  destroyRecognitionInstance(false);

  try {
    recognition = new SpeechRecognitionCtor();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) {
      try {
        recognition.maxAlternatives = 5;
      } catch {
        // Ignore
      }
    }

    latestRawTranscript = '';
    transcriptAtCardStart = '';
    errorMessage.value = '';

    recognition.onstart = () => {
      isListening.value = true;
      if (feedbackState.value !== 'success') {
        feedbackState.value = 'listening';
      }
      errorMessage.value = '';
    };

    recognition.onresult = (event: any) => {
      const segments: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const seg = event.results[i]?.[0]?.transcript;
        if (seg) segments.push(seg.trim());
      }
      latestRawTranscript = segments.join(' ').trim();

      // If celebrating a correct answer, record transcript so it's ignored on the next card
      if (!currentWord.value || feedbackState.value === 'success') {
        transcriptAtCardStart = latestRawTranscript;
        return;
      }

      const newSpeech = getSpokenOnCurrentCard(latestRawTranscript);
      if (!newSpeech) {
        return;
      }

      // Guard: if a late trailing event from the PREVIOUS card arrives right after card switch,
      // absorb it silently so the old word never flashes on the new card!
      if (
        previousWord &&
        Date.now() - cardSwitchedAt < 1800 &&
        checkKoreanPronunciationMatch(previousWord, [newSpeech]).matched &&
        !checkKoreanPronunciationMatch(currentWord.value, [newSpeech]).matched
      ) {
        transcriptAtCardStart = latestRawTranscript;
        return;
      }

      const wordsInSpeech = newSpeech.split(/\s+/).filter(Boolean);
      const lastWord =
        wordsInSpeech.length > 0 ? wordsInSpeech[wordsInSpeech.length - 1] : newSpeech;
      const lastTwoWords =
        wordsInSpeech.length >= 2 ? wordsInSpeech.slice(-2).join(' ') : newSpeech;

      const candidates = new Set<string>([newSpeech, lastWord, lastTwoWords]);
      const lastResult = event.results[event.results.length - 1];
      if (lastResult) {
        for (let j = 0; j < lastResult.length; j++) {
          const alt = lastResult[j]?.transcript?.trim();
          if (alt) {
            candidates.add(alt);
            const altWords = alt.split(/\s+/).filter(Boolean);
            if (altWords.length > 0) {
              candidates.add(altWords[altWords.length - 1]);
            }
          }
        }
      }

      const displayHeard = lastWord || newSpeech;
      heardText.value = displayHeard;
      if (feedbackState.value === 'retry') {
        feedbackState.value = 'listening';
      }

      const matchResult = checkKoreanPronunciationMatch(
        currentWord.value,
        Array.from(candidates)
      );

      if (matchResult.matched) {
        if (retryJudgeTimer) {
          window.clearTimeout(retryJudgeTimer);
          retryJudgeTimer = undefined;
        }
        transcriptAtCardStart = latestRawTranscript;
        handlePronunciationSuccess(displayHeard);
      } else {
        if (retryJudgeTimer) {
          window.clearTimeout(retryJudgeTimer);
        }
        retryJudgeTimer = window.setTimeout(() => {
          if (feedbackState.value !== 'success' && currentWord.value) {
            transcriptAtCardStart = latestRawTranscript;
            handlePronunciationRetry(displayHeard);
          }
        }, 850);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        micEnabled.value = false;
        isListening.value = false;
        feedbackState.value = 'error';
        errorMessage.value = 'Permite el acceso al micrófono en tu navegador.';
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        isListening.value = false;
      }
    };

    recognition.onend = () => {
      isListening.value = false;
      if (micEnabled.value && recognition) {
        try {
          // Reuse the same gesture-blessed recognition instance first (required by iOS Safari)
          latestRawTranscript = '';
          transcriptAtCardStart = '';
          recognition.start();
          reconnectTimer = window.setTimeout(() => {
            if (!isListening.value) {
              micEnabled.value = false;
              if (feedbackState.value === 'listening') {
                feedbackState.value = 'idle';
              }
            }
          }, 500);
        } catch {
          micEnabled.value = false;
          if (feedbackState.value === 'listening') {
            feedbackState.value = 'idle';
          }
        }
      } else {
        micEnabled.value = false;
        if (feedbackState.value === 'listening') {
          feedbackState.value = 'idle';
        }
      }
    };

    recognition.start();
  } catch {
    micEnabled.value = false;
    isListening.value = false;
  }
};

const toggleMic = () => {
  if (micEnabled.value && isListening.value) {
    stopContinuousMic();
  } else {
    micEnabled.value = true;
    startRecognitionSession();
  }
};

const handlePronunciationSuccess = (transcript: string) => {
  feedbackState.value = 'success';
  heardText.value = transcript;

  const basePoints = !alwaysShowHangul.value && !hintRevealed.value ? 15 : 10;
  streak.value += 1;
  if (streak.value > bestStreak.value) {
    bestStreak.value = streak.value;
  }

  const earned = Math.round(basePoints * streakMultiplier.value);
  lastPointsEarned.value = earned;
  score.value += earned;
  wordsCompleted.value += 1;
  totalWordsAllTime.value += 1;

  if (score.value > bestScore.value) {
    bestScore.value = score.value;
  }

  saveLocalPlayerStats();

  if (currentWord.value) {
    emit('mark-known', currentWord.value.id, earned);
  }

  syncLeaderboardScore();

  if (streak.value > 0 && streak.value % 5 === 0) {
    playGameSound('streak');
  } else {
    playGameSound('correct');
  }

  advanceTimer = window.setTimeout(() => {
    nextCard(true);
  }, 950);
};

const handlePronunciationRetry = (transcript: string) => {
  feedbackState.value = 'retry';
  heardText.value = transcript;
  streak.value = 0;
  playGameSound('wrong');
};

const nextCard = (fromSuccess = false) => {
  if (!fromSuccess) {
    streak.value = 0;
  }

  previousWord = currentWord.value;

  if (currentIndex.value + 1 >= deck.value.length) {
    deck.value = shuffleWords(filteredPool.value);
    currentIndex.value = 0;
  } else {
    currentIndex.value += 1;
  }

  resetCardState();
};

// Pure visual hint toggle: never touches audio or microphone so mic never glitches!
const handleCardTap = () => {
  if (!currentWord.value) return;
  hintRevealed.value = !hintRevealed.value;
};

const selectCategory = (cat: WordCategory | 'all') => {
  selectedCategory.value = cat;
  buildDeck();
};

// Local & Supabase Leaderboard Persistence
const loadLocalPlayerStats = () => {
  try {
    let pid = window.localStorage.getItem(PLAYER_ID_KEY);
    if (!pid) {
      pid = 'p_' + Math.random().toString(36).slice(2, 10);
      window.localStorage.setItem(PLAYER_ID_KEY, pid);
    }
    localPlayerId.value = pid;

    const savedName = window.localStorage.getItem(PLAYER_NAME_KEY);
    if (savedName) {
      playerName.value = savedName;
    }

    const savedBest = window.localStorage.getItem(BEST_SCORE_KEY);
    if (savedBest) {
      bestScore.value = parseInt(savedBest, 10) || 0;
    }

    const rawStats = window.localStorage.getItem(PLAYER_STATS_KEY);
    if (rawStats) {
      const parsed = JSON.parse(rawStats);
      totalWordsAllTime.value = Math.max(
        parsed.wordsCorrect || 0,
        props.voiceCorrectCount || 0
      );
      bestStreak.value = parsed.bestStreak || 0;
      score.value = parsed.xp || 0;
    } else if (props.voiceCorrectCount) {
      totalWordsAllTime.value = props.voiceCorrectCount;
    }
  } catch {
    // Ignore storage errors
  }
};

const saveLocalPlayerStats = () => {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore.value));
    window.localStorage.setItem(
      PLAYER_STATS_KEY,
      JSON.stringify({
        wordsCorrect: totalWordsAllTime.value,
        xp: Math.max(score.value, bestScore.value),
        bestStreak: bestStreak.value,
      })
    );
  } catch {
    // Ignore
  }
};

const savePlayerName = () => {
  const cleaned = nameInput.value.trim().slice(0, 20);
  if (cleaned) {
    playerName.value = cleaned;
    try {
      window.localStorage.setItem(PLAYER_NAME_KEY, cleaned);
    } catch {
      // Ignore
    }
    emit('update-player-name', cleaned);
    syncLeaderboardScore();
  }
  editingName.value = false;
};

const startEditingName = () => {
  nameInput.value = effectivePlayerName.value;
  editingName.value = true;
};

const deduplicateLeaderboard = (entries: LeaderboardEntry[]): LeaderboardEntry[] => {
  const byName = new Map<string, LeaderboardEntry>();
  const myNameLower = effectivePlayerName.value.trim().toLowerCase();

  for (const item of entries) {
    const isMe =
      Boolean(item.isCurrentUser) ||
      item.playerId === effectivePlayerId.value ||
      item.playerId === localPlayerId.value ||
      (Boolean(props.userId) && item.playerId === props.userId) ||
      item.playerName.trim().toLowerCase() === myNameLower;

    const key = isMe ? '__me__' : item.playerName.trim().toLowerCase();
    const existing = byName.get(key);

    if (!existing) {
      byName.set(key, {
        ...item,
        playerId: isMe ? effectivePlayerId.value : item.playerId,
        playerName: isMe ? effectivePlayerName.value : item.playerName,
        isCurrentUser: isMe,
      });
    } else {
      byName.set(key, {
        playerId: isMe ? effectivePlayerId.value : existing.playerId,
        playerName: isMe ? effectivePlayerName.value : existing.playerName,
        wordsCorrect: Math.max(existing.wordsCorrect, item.wordsCorrect),
        xp: Math.max(existing.xp, item.xp),
        bestStreak: Math.max(existing.bestStreak, item.bestStreak),
        isCurrentUser: Boolean(existing.isCurrentUser || isMe),
      });
    }
  }

  return Array.from(byName.values())
    .sort((a, b) => b.wordsCorrect - a.wordsCorrect || b.xp - a.xp)
    .slice(0, 10);
};

const fetchLeaderboard = async () => {
  loadingLeaderboard.value = true;
  const rawEntries: LeaderboardEntry[] = [];
  const duplicateIdsToClean: string[] = [];

  const myId = effectivePlayerId.value;
  const myNameLower = effectivePlayerName.value.trim().toLowerCase();

  rawEntries.push({
    playerId: myId,
    playerName: effectivePlayerName.value,
    wordsCorrect: totalWordsAllTime.value,
    xp: Math.max(score.value, bestScore.value),
    bestStreak: bestStreak.value,
    isCurrentUser: true,
  });

  if (isSupabaseConfigured) {
    try {
      const { data: lbData, error: lbError } = await supabase
        .from('voice_leaderboard')
        .select('player_id, player_name, words_correct, xp, best_streak')
        .order('words_correct', { ascending: false })
        .limit(25);

      if (!lbError && Array.isArray(lbData)) {
        for (const row of lbData) {
          const rowNameLower = (row.player_name || '').trim().toLowerCase();
          const isMe =
            row.player_id === myId ||
            row.player_id === localPlayerId.value ||
            (Boolean(props.userId) && row.player_id === props.userId) ||
            (rowNameLower && rowNameLower === myNameLower);

          if (isMe) {
            if (row.words_correct > totalWordsAllTime.value) {
              totalWordsAllTime.value = row.words_correct;
            }
            if (row.xp > bestScore.value) {
              bestScore.value = row.xp;
            }
            if (row.best_streak > bestStreak.value) {
              bestStreak.value = row.best_streak;
            }
            if (row.player_id !== myId) {
              duplicateIdsToClean.push(row.player_id);
            }
          }

          rawEntries.push({
            playerId: row.player_id,
            playerName: row.player_name || 'Estudiante',
            wordsCorrect: row.words_correct || 0,
            xp: row.xp || 0,
            bestStreak: row.best_streak || 0,
            isCurrentUser: isMe,
          });
        }

        // Remove any leftover guest/duplicate rows for the current user from Supabase
        if (duplicateIdsToClean.length > 0) {
          supabase
            .from('voice_leaderboard')
            .delete()
            .in('player_id', duplicateIdsToClean)
            .then(() => {});
        }
      } else {
        const { data: progData } = await supabase
          .from('user_progress')
          .select('*')
          .limit(20);

        if (Array.isArray(progData)) {
          for (const row of progData as any[]) {
            const isMe = row.user_id === props.userId;
            const rc = (row.review_counts || {}) as Record<string, any>;
            const voiceCount =
              typeof rc.__voice_correct__ === 'number'
                ? rc.__voice_correct__
                : Array.isArray(row.known_ids)
                ? row.known_ids.length
                : 0;
            const displayName =
              row.user_name ||
              (typeof rc.__player_name__ === 'string' ? rc.__player_name__ : '') ||
              (isMe ? effectivePlayerName.value : `Usuario ${String(row.user_id).slice(0, 4)}`);

            if (voiceCount > 0 || isMe) {
              rawEntries.push({
                playerId: isMe ? myId : row.user_id,
                playerName: displayName,
                wordsCorrect: isMe
                  ? Math.max(voiceCount, totalWordsAllTime.value)
                  : voiceCount,
                xp: rc.__voice_xp__ || voiceCount * 10,
                bestStreak: isMe ? bestStreak.value : 0,
                isCurrentUser: isMe,
              });
            }
          }
        }
      }
    } catch {
      // Ignore network/table errors
    }
  }

  leaderboard.value = deduplicateLeaderboard(rawEntries);
  loadingLeaderboard.value = false;
};

const syncLeaderboardScore = async () => {
  const myId = effectivePlayerId.value;
  const myEntry: LeaderboardEntry = {
    playerId: myId,
    playerName: effectivePlayerName.value,
    wordsCorrect: totalWordsAllTime.value,
    xp: Math.max(score.value, bestScore.value),
    bestStreak: bestStreak.value,
    isCurrentUser: true,
  };

  leaderboard.value = deduplicateLeaderboard([...leaderboard.value, myEntry]);

  if (!isSupabaseConfigured) return;

  try {
    await supabase.from('voice_leaderboard').upsert(
      {
        player_id: myId,
        player_name: effectivePlayerName.value,
        words_correct: totalWordsAllTime.value,
        xp: Math.max(score.value, bestScore.value),
        best_streak: bestStreak.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id' }
    );
  } catch {
    // Fallback handled
  }
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    toggleMic();
  } else if (event.key.toLowerCase() === 'h') {
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

watch(
  () => [props.userId, props.userEmail],
  () => {
    fetchLeaderboard();
  }
);

watch(
  () => props.voiceCorrectCount,
  (newVal) => {
    if (typeof newVal === 'number' && newVal > totalWordsAllTime.value) {
      totalWordsAllTime.value = newVal;
      syncLeaderboardScore();
    }
  }
);

onMounted(() => {
  isSecureContextFlag.value = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : true;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  isIosChrome.value = /CriOS/i.test(ua);
  speechSupported.value = isSpeechRecognitionSupported();

  loadLocalPlayerStats();
  buildDeck();
  fetchLeaderboard();

  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  stopContinuousMic();
  clearTimers();
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

    <!-- Top Progress & Streak Bar -->
    <div class="duo-top-bar">
      <!-- Toggle Hangul visibility button -->
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

      <!-- Streak & XP Counter -->
      <div class="duo-streak-badge" :class="{ 'is-hot': streak > 0 }">
        <Flame :size="18" class="streak-icon" />
        <span>{{ streak }}</span>
        <span v-if="score > 0" class="xp-mini">· {{ score }} XP</span>
      </div>
    </div>

    <!-- Stacked Card Deck -->
    <div v-if="currentWord" class="duo-deck-stage">
      <div class="duo-card-stack">
        <!-- Background stacked cards peeking at the top -->
        <div class="stack-layer layer-3" />
        <div class="stack-layer layer-2" />
        <div class="stack-layer layer-1" />

        <!-- Front Active Card (Tap card to reveal/hide Hangul hint without touching audio) -->
        <button
          type="button"
          @click="handleCardTap"
          :class="[
            'duo-front-card',
            isListening ? 'is-listening' : '',
            feedbackState === 'success' ? 'is-success' : '',
            feedbackState === 'retry' ? 'is-retry' : '',
          ]"
          title="Toca la tarjeta para ver u ocultar la pista en coreano"
        >
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

      <!-- Bottom Tactile Action Row: Continuous Mic Toggle + Skip Button -->
      <div class="duo-actions-row">
        <!-- Wide Continuous Microphone Toggle Button -->
        <button
          type="button"
          @click="toggleMic"
          :class="[
            'duo-mic-btn',
            isListening ? 'is-listening' : '',
            feedbackState === 'success' ? 'is-success' : '',
          ]"
          :aria-label="isListening ? 'Desactivar micrófono continuo' : 'Activar micrófono continuo'"
        >
          <CheckCircle2 v-if="feedbackState === 'success'" :size="26" :stroke-width="2.5" />
          <Mic v-else :size="26" :stroke-width="2.4" />
          <span class="mic-btn-label">
            {{ isListening ? 'Escuchando continuo' : 'Activar micrófono' }}
          </span>
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

    <!-- Bottom Ranking / Chart of Most Words Done Correctly -->
    <div class="leaderboard-card mt-10">
      <div class="leaderboard-header">
        <div class="flex items-center gap-2">
          <div class="lb-icon-badge">
            <Trophy :size="16" />
          </div>
          <div>
            <h3 class="lb-title">Ranking de Palabras Acertadas</h3>
            <p class="lb-subtitle">Palabras pronunciadas correctamente por usuario</p>
          </div>
        </div>

        <!-- Edit Nickname Pill -->
        <div class="lb-name-editor">
          <template v-if="editingName">
            <input
              v-model="nameInput"
              type="text"
              maxlength="20"
              placeholder="Tu nombre..."
              class="lb-name-input"
              @keydown.enter="savePlayerName"
            />
            <button type="button" @click="savePlayerName" class="lb-name-save-btn" title="Guardar">
              <Check :size="14" />
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              @click="startEditingName"
              class="lb-name-pill"
              title="Cambiar tu nombre en el ranking"
            >
              <span>{{ effectivePlayerName }}</span>
              <Edit3 :size="12" />
            </button>
          </template>
        </div>
      </div>

      <!-- Bar Chart & Player Rows -->
      <div class="lb-list">
        <div
          v-for="(entry, idx) in leaderboard"
          :key="entry.playerId"
          :class="['lb-row', entry.isCurrentUser ? 'is-me' : '']"
        >
          <div class="lb-row-top">
            <div class="flex items-center gap-2 min-w-0">
              <span :class="['lb-rank', idx < 3 ? `rank-${idx + 1}` : '']">
                {{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1 }}
              </span>
              <span class="lb-player-name truncate">
                {{ entry.playerName }}
              </span>
              <span v-if="entry.isCurrentUser" class="lb-you-tag">Tú</span>
            </div>

            <div class="lb-stats-right">
              <span class="lb-words-count">{{ entry.wordsCorrect }} palabras</span>
              <span v-if="entry.bestStreak > 0" class="lb-streak-mini">
                {{ entry.bestStreak }}🔥
              </span>
            </div>
          </div>

          <!-- Horizontal Bar Chart Track -->
          <div class="lb-bar-track">
            <div
              class="lb-bar-fill"
              :class="{ 'is-me-fill': entry.isCurrentUser }"
              :style="{
                width: `${Math.max(6, Math.round((entry.wordsCorrect / maxLeaderboardWords) * 100))}%`,
              }"
            />
          </div>
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
  gap: 0.55rem;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: 0 8px 20px var(--primary-glow);
  transition: transform 0.1s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.mic-btn-label {
  font-size: 0.85rem;
  font-weight: 700;
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
  animation: gentlePulse 1.5s infinite ease-in-out;
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
    transform: scale(1.02);
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

/* Leaderboard & Chart Card */
.leaderboard-card {
  background: #ffffff;
  border: 1.5px solid var(--border);
  border-radius: 22px;
  padding: 1.15rem 1.15rem;
  box-shadow: var(--shadow-sm);
}

.leaderboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.lb-icon-badge {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--primary-light);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lb-title {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--foreground);
  line-height: 1.15;
}

.lb-subtitle {
  font-size: 0.7rem;
  color: var(--muted-foreground);
  margin-top: 0.1rem;
}

.lb-name-editor {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.lb-name-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 700;
  background: var(--muted);
  color: var(--foreground);
  border: 1px solid var(--border);
  transition: all 0.15s ease;
}

.lb-name-pill:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.lb-name-input {
  width: 115px;
  padding: 0.25rem 0.55rem;
  border-radius: 8px;
  border: 1px solid var(--primary);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--foreground);
}

.lb-name-save-btn {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lb-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.lb-row {
  padding: 0.6rem 0.75rem;
  border-radius: 14px;
  background: #f8f9fd;
  border: 1px solid #edf0f8;
}

.lb-row.is-me {
  background: #f4f3ff;
  border-color: rgba(88, 72, 196, 0.28);
}

.lb-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.lb-rank {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--muted-foreground);
  min-width: 22px;
  text-align: center;
}

.lb-player-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--foreground);
}

.lb-you-tag {
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.08rem 0.4rem;
  border-radius: 9999px;
  background: var(--primary);
  color: #ffffff;
}

.lb-stats-right {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.lb-words-count {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--primary);
}

.lb-streak-mini {
  font-size: 0.72rem;
  font-weight: 700;
  color: #ea580c;
}

.lb-bar-track {
  width: 100%;
  height: 7px;
  background: #e4e8f5;
  border-radius: 9999px;
  overflow: hidden;
}

.lb-bar-fill {
  height: 100%;
  background: #94a3b8;
  border-radius: 9999px;
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.lb-bar-fill.is-me-fill {
  background: linear-gradient(90deg, #5848c4 0%, #7c6df0 100%);
}
</style>
