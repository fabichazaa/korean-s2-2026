<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Clock,
  Sparkles,
  Volume2,
  Calendar,
  HelpCircle,
  Hash,
  RefreshCw,
  ArrowRight,
  ListOrdered,
  CalendarDays,
} from 'lucide-vue-next';
import {
  BASIC_NUMBERS,
  formatKoreanTime,
  DAYS_OF_WEEK,
  GRAMMAR_CAPSULES,
  NATIVE_NUMBERS_FULL,
  MONTH_DAYS,
} from '../data/numbers';
import { speakKorean } from '../utils/speech';

type SubSection = 'clock' | 'native_numbers' | 'month_days' | 'numbers' | 'days' | 'grammar';
const currentTab = ref<SubSection>('clock');

// Clock Trainer State
const hour = ref(3);
const minute = ref(20);
const revealed = ref(false);

const timeData = computed(() => formatKoreanTime(hour.value, minute.value));

const randomizeTime = () => {
  hour.value = Math.floor(Math.random() * 12) + 1;
  const commonMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  minute.value = commonMinutes[Math.floor(Math.random() * commonMinutes.length)];
  revealed.value = false;
};

const setNow = () => {
  const now = new Date();
  let h = now.getHours() % 12;
  if (h === 0) h = 12;
  hour.value = h;
  minute.value = now.getMinutes();
  revealed.value = false;
};

const playAudio = (text: string, e?: Event) => {
  if (e) e.stopPropagation();
  speakKorean(text);
};
</script>

<template>
  <section class="mx-auto max-w-[880px] pb-16 pt-5 md:pt-10">
    <!-- Header -->
    <div class="nuri-entrance mb-8">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p class="nuri-mono text-[10px] uppercase font-bold tracking-wider text-[#5848c4]">
            Módulo especial · Números, Horas y Gramática
          </p>
          <h1 class="page-title mt-2 text-[#1e2338]">
            Horas y Números<span class="text-[#5848c4]">.</span>
          </h1>
          <p class="mt-3 max-w-[560px] text-xs leading-5 text-[#6c7393] sm:text-sm">
            Aprende a diferenciar el sistema <strong class="text-[#1e2338]">Coreano Nativo</strong> (para horas y conteo) del <strong class="text-[#1e2338]">Sino-Coreano</strong> (para minutos, pisos, fechas y dinero).
          </p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="mt-6 flex overflow-x-auto no-scrollbar gap-2 border-b border-[#e0e4f2] pb-3 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        <button
          type="button"
          @click="currentTab = 'clock'"
          :class="['sub-tab-btn flex items-center gap-2 shrink-0', currentTab === 'clock' ? 'is-active' : '']"
        >
          <Clock :size="15" />
          <span>¿Qué hora es? (Reloj)</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'native_numbers'"
          :class="['sub-tab-btn flex items-center gap-2 shrink-0', currentTab === 'native_numbers' ? 'is-active' : '']"
        >
          <ListOrdered :size="15" />
          <span>Números Nativos (1~100)</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'month_days'"
          :class="['sub-tab-btn flex items-center gap-2 shrink-0', currentTab === 'month_days' ? 'is-active' : '']"
        >
          <CalendarDays :size="15" />
          <span>Días del Mes (1~31일)</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'numbers'"
          :class="['sub-tab-btn flex items-center gap-2 shrink-0', currentTab === 'numbers' ? 'is-active' : '']"
        >
          <Hash :size="15" />
          <span>Sino vs Nativo (1-12)</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'days'"
          :class="['sub-tab-btn flex items-center gap-2 shrink-0', currentTab === 'days' ? 'is-active' : '']"
        >
          <Calendar :size="15" />
          <span>Días de la semana</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'grammar'"
          :class="['sub-tab-btn flex items-center gap-2 shrink-0', currentTab === 'grammar' ? 'is-active' : '']"
        >
          <HelpCircle :size="15" />
          <span>Preguntas clave</span>
        </button>
      </div>
    </div>

    <!-- TAB 1: RELOJ INTERACTIVO -->
    <div v-if="currentTab === 'clock'" class="nuri-entrance">
      <div class="clock-card-box p-4 sm:p-8 md:p-10">
        <!-- Badge Rule Reminder -->
        <div class="mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e0e4f2] pb-4 sm:pb-5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="golden-rule-badge flex items-center gap-1 shrink-0">
              <Sparkles :size="12" /> Regla de oro
            </span>
            <span class="text-xs font-medium text-[#6c7393]">
              <strong class="text-[#5848c4]">Hora (시)</strong> en Nativo + <strong class="text-[#2b8a78]">Minuto (분)</strong> en Sino
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="setNow"
              class="quick-action-btn"
            >
              Hora actual
            </button>
            <button
              type="button"
              @click="randomizeTime"
              class="quick-action-btn is-primary flex items-center gap-1.5"
            >
              <RefreshCw :size="12" /> Aleatoria
            </button>
          </div>
        </div>

        <!-- Clock Display Card -->
        <div class="flex flex-col items-center justify-center py-4 sm:py-6 text-center">
          <p class="nuri-mono text-[11px] uppercase tracking-wider text-[#6c7393]">¿Cómo se dice en coreano?</p>
          
          <!-- Big Digital Clock -->
          <div class="my-4 sm:my-5 digital-clock-display flex items-baseline">
            <span class="nuri-mono clock-digits">
              {{ String(hour).padStart(2, '0') }}:{{ String(minute).padStart(2, '0') }}
            </span>
          </div>

          <!-- Reveal or Revealed Box -->
          <div v-if="!revealed" class="mt-4">
            <button
              type="button"
              @click="revealed = true"
              class="reveal-time-btn flex items-center gap-2"
            >
              <span>Mostrar en Coreano</span>
              <ArrowRight :size="16" />
            </button>
            <p class="mt-3 text-xs text-[#6c7393]">Intenta decirlo en voz alta antes de revelar</p>
          </div>

          <div v-else class="revealed-box w-full max-w-[620px] p-4 sm:p-6 md:p-8">
            <div class="flex items-center justify-between">
              <span class="nuri-mono answer-tag">
                Respuesta
              </span>
              <button
                type="button"
                @click="playAudio(timeData.koreanText)"
                title="Escuchar hora en coreano"
                class="nuri-audio-btn is-card-back"
              >
                <Volume2 :size="18" />
              </button>
            </div>

            <div class="my-5 sm:my-6">
              <p class="nuri-display time-korean-text">
                {{ timeData.koreanText }}
              </p>
              <p class="mt-2.5 sm:mt-3 text-sm text-[#aaa6d1]">
                {{ timeData.spanishText }}
              </p>
            </div>

            <!-- Breakdown -->
            <div class="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3 border-t border-[#b9b4ff]/20 pt-4 sm:pt-5 text-left text-xs">
              <div class="breakdown-card">
                <p class="nuri-mono text-[9px] uppercase tracking-wider text-[#aaa6d1]">Hora (Coreano Nativo)</p>
                <p class="mt-1 text-base font-bold text-[#b9b4ff]">{{ timeData.hourPart }}</p>
              </div>
              <div class="breakdown-card">
                <p class="nuri-mono text-[9px] uppercase tracking-wider text-[#aaa6d1]">Minutos (Sino-Coreano)</p>
                <p class="mt-1 text-base font-bold text-[#9df1e0]">{{ timeData.minutePart }}</p>
              </div>
            </div>

            <div class="mt-5 sm:mt-6 flex justify-center gap-3">
              <button
                type="button"
                @click="randomizeTime"
                class="another-time-btn flex items-center gap-2"
              >
                <RefreshCw :size="13" /> Probar con otra hora
              </button>
            </div>
          </div>
        </div>

        <!-- Quick Time Stepper Controls -->
        <div class="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 border-t border-[#e0e4f2] pt-5 sm:pt-6 text-xs text-[#6c7393]">
          <span class="font-medium">Ajustar manualmente:</span>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              @click="hour = hour === 1 ? 12 : hour - 1; revealed = false"
              class="stepper-btn"
            >
              -1h
            </button>
            <span class="nuri-mono font-bold text-[#1e2338] px-1">{{ hour }}h</span>
            <button
              type="button"
              @click="hour = hour === 12 ? 1 : hour + 1; revealed = false"
              class="stepper-btn"
            >
              +1h
            </button>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              @click="minute = (minute - 5 + 60) % 60; revealed = false"
              class="stepper-btn"
            >
              -5m
            </button>
            <span class="nuri-mono font-bold text-[#1e2338] px-1">{{ minute }}m</span>
            <button
              type="button"
              @click="minute = (minute + 5) % 60; revealed = false"
              class="stepper-btn"
            >
              +5m
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: NÚMEROS NATIVOS COMPLETOS (1-100) -->
    <div v-else-if="currentTab === 'native_numbers'" class="nuri-entrance">
      <!-- Explication banner -->
      <div class="mb-6 rounded-2xl border border-[#d9ddf1] bg-white p-5 shadow-sm">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="native-badge">Coreano Nativo (고유어 수사)</span>
          <span class="text-xs font-semibold text-[#5848c4]">Conteo de objetos, personas, horas y edad</span>
        </div>
        <p class="mt-3 text-xs leading-relaxed text-[#6c7393]">
          Se usan comúnmente para contar <strong class="text-[#1e2338]">objetos</strong> (개), <strong class="text-[#1e2338]">personas</strong> (명), <strong class="text-[#1e2338]">horas</strong> (시) y <strong class="text-[#1e2338]">edad</strong> (살).
        </p>

        <!-- Rule Box -->
        <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-[#92400e]">
          <p class="font-bold flex items-center gap-1.5">
            <Sparkles :size="14" /> Regla de Abreviación con Contadores:
          </p>
          <p class="mt-1 leading-5">
            Cuando van seguidos de un sustantivo contador, los números <strong>1, 2, 3, 4 y 20</strong> cambian a su forma abreviada:
          </p>
          <div class="mt-2.5 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2 font-mono font-medium text-xs">
            <div class="rounded-lg bg-white/90 p-2 border border-amber-200/60 text-center">
              <span class="block text-[10px] text-gray-500">1: 하나 →</span>
              <strong class="text-[#5848c4] text-sm">한</strong>
            </div>
            <div class="rounded-lg bg-white/90 p-2 border border-amber-200/60 text-center">
              <span class="block text-[10px] text-gray-500">2: 둘 →</span>
              <strong class="text-[#5848c4] text-sm">두</strong>
            </div>
            <div class="rounded-lg bg-white/90 p-2 border border-amber-200/60 text-center">
              <span class="block text-[10px] text-gray-500">3: 셋 →</span>
              <strong class="text-[#5848c4] text-sm">세</strong>
            </div>
            <div class="rounded-lg bg-white/90 p-2 border border-amber-200/60 text-center">
              <span class="block text-[10px] text-gray-500">4: 넷 →</span>
              <strong class="text-[#5848c4] text-sm">네</strong>
            </div>
            <div class="rounded-lg bg-white/90 p-2 border border-amber-200/60 text-center col-span-2 xs:col-span-1">
              <span class="block text-[10px] text-gray-500">20: 스물 →</span>
              <strong class="text-[#5848c4] text-sm">스무</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Numbers Grid -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <div
          v-for="item in NATIVE_NUMBERS_FULL"
          :key="item.value"
          class="rounded-2xl border border-[#d9ddf1] bg-white p-4 shadow-sm hover:border-[#5848c4]/40 transition-all flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="nuri-mono text-xs font-extrabold text-[#767d9c] bg-[#edf0f8] px-2 py-0.5 rounded-full">
                {{ item.value }}
              </span>
              <button
                type="button"
                @click="playAudio(item.audioText)"
                title="Escuchar número"
                class="nuri-audio-btn nuri-audio-btn-sm"
              >
                <Volume2 :size="15" />
              </button>
            </div>

            <div class="mt-3">
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black text-[#1e2338] font-korean">{{ item.hangul }}</span>
                <span v-if="item.shortForm" class="text-xs font-bold text-[#5848c4] bg-[#eeedff] px-1.5 py-0.5 rounded">
                  forma corta: {{ item.shortForm }}
                </span>
              </div>
              <p class="text-xs text-[#767d9c] font-mono mt-0.5">{{ item.pronunciation }}</p>
              <p class="text-sm font-semibold text-[#1e2338] mt-1">{{ item.spanish }}</p>
            </div>
          </div>

          <div v-if="item.tip" class="mt-3 pt-2.5 border-t border-[#f0f2f8] text-[11px] text-[#5848c4] font-medium">
            💡 {{ item.tip }}
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: DÍAS DEL MES (일) 1~31 -->
    <div v-else-if="currentTab === 'month_days'" class="nuri-entrance">
      <!-- Explication banner -->
      <div class="mb-6 rounded-2xl border border-[#d9ddf1] bg-white p-5 shadow-sm">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="sino-badge">Sino-Coreano + 일 (Día)</span>
          <span class="text-xs font-semibold text-[#145e50]">Fechas y Días del Mes (1일 ~ 31일)</span>
        </div>
        <p class="mt-3 text-xs leading-relaxed text-[#6c7393]">
          Para expresar los días del mes se utiliza el número en <strong class="text-[#1e2338]">Sino-Coreano</strong> seguido del contador <strong class="text-[#1e2338]">일 (il)</strong>.
        </p>

        <!-- Assimilation alerts -->
        <div class="mt-4 rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-xs text-sky-950">
          <p class="font-bold flex items-center gap-1.5 text-sky-900">
            <Sparkles :size="14" /> Reglas de Asimilación Fonética:
          </p>
          <ul class="mt-2 space-y-1 leading-5 text-[11px]">
            <li>• <strong>16일 (십육일):</strong> La consonante final 'ㅂ' y la '유' se asimilan y se pronuncia <strong class="text-[#5848c4]">[심뉴길] (shim-nyu-gil)</strong>.</li>
            <li>• <strong>26일 (이십육일):</strong> Se pronuncia de la misma forma asimilada <strong class="text-[#5848c4]">[이심뉴길] (i-shim-nyu-gil)</strong>.</li>
            <li>• En general, la consonante final se une a la vocal de '일': por ejemplo, <strong>1일 (일일 → [이릴])</strong>, <strong>3일 (삼일 → [사밀])</strong>.</li>
          </ul>
        </div>
      </div>

      <!-- Days Grid (31 days) -->
      <div class="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
        <div
          v-for="item in MONTH_DAYS"
          :key="item.day"
          @click="playAudio(item.hangul)"
          class="group cursor-pointer rounded-xl border border-[#d9ddf1] bg-white p-3 shadow-sm hover:border-[#5848c4] hover:shadow-md transition-all flex flex-col justify-between"
          :title="`Toca para escuchar ${item.hangul}`"
        >
          <div class="flex items-center justify-between">
            <span class="nuri-mono text-[11px] font-black text-[#5848c4] bg-[#eeedff] px-2 py-0.5 rounded-full">
              {{ item.day }}일
            </span>
            <button
              type="button"
              @click.stop="playAudio(item.hangul)"
              title="Escuchar pronunciación"
              class="nuri-audio-btn nuri-audio-btn-sm opacity-70 group-hover:opacity-100"
            >
              <Volume2 :size="13" />
            </button>
          </div>

          <div class="mt-2 text-center">
            <p class="text-lg font-black text-[#1e2338] font-korean">{{ item.hangul }}</p>
            <p class="text-[11px] font-mono text-[#767d9c] mt-0.5">{{ item.pronunciation }}</p>
          </div>

          <div v-if="item.note" class="mt-2 text-[9px] font-bold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 text-center">
            {{ item.note }}
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: TABLA SINO VS NATIVO -->
    <div v-else-if="currentTab === 'numbers'" class="nuri-entrance">
      <div class="mb-6 grid gap-4 sm:grid-cols-2">
        <!-- Card Sino Uses -->
        <div class="info-card p-5">
          <span class="sino-badge">
            Sino-Coreano (한자어 수)
          </span>
          <h3 class="mt-2 text-lg font-bold text-[#1e2338]">일, 이, 삼, 사...</h3>
          <p class="mt-2 text-xs text-[#6c7393]">
            Se usa para unidades exactas, abstractas e importadas:
          </p>
          <ul class="mt-3 space-y-1.5 text-xs text-[#1e2338]">
            <li>• <strong>Minutos</strong> (분): 20분 = 이십 분</li>
            <li>• <strong>Fechas</strong> (년/월/일): 10월 8일 = 시월 팔일</li>
            <li>• <strong>Pisos de edificios</strong> (층): 3층 = 삼 층</li>
            <li>• <strong>Páginas</strong> (쪽): 15쪽 = 십오 쪽</li>
            <li>• <strong>Dinero / Won</strong> (원): 1,000원 = 천 원</li>
            <li>• <strong>Teléfonos</strong> y números de serie (호, 번)</li>
          </ul>
        </div>

        <!-- Card Native Uses -->
        <div class="info-card p-5">
          <span class="native-badge">
            Coreano Nativo (고유어 수)
          </span>
          <h3 class="mt-2 text-lg font-bold text-[#1e2338]">하나, 둘, 셋, 넷...</h3>
          <p class="mt-2 text-xs text-[#6c7393]">
            Se usa para cantidades físicas, vivas y la hora:
          </p>
          <ul class="mt-3 space-y-1.5 text-xs text-[#1e2338]">
            <li>• <strong>Horas</strong> (시): 한 시, 두 시, 세 시...</li>
            <li>• <strong>Edad</strong> (살): 스무 살 (20 años)</li>
            <li>• <strong>Personas</strong> (명): 세 명 (3 personas)</li>
            <li>• <strong>Objetos</strong> (개): 두 개 (2 unidades)</li>
            <li>• <strong>Animales</strong> (마리): 한 마리 (1 perro/gato)</li>
            <li>⚠️ <em>Cambian a 한, 두, 세, 네 antes de un contador</em></li>
          </ul>
        </div>
      </div>

      <!-- Comparative Table 1-12 -->
      <div class="table-container">
        <div class="table-header-row px-2.5 py-2.5 sm:px-6 sm:py-3">
          <span>N°</span>
          <span>Sino-Coreano</span>
          <span>Coreano Nativo (Horas)</span>
        </div>

        <div class="divide-y divide-[#e0e4f2]/70">
          <div
            v-for="item in BASIC_NUMBERS"
            :key="item.value"
            class="table-data-row px-2.5 py-2.5 sm:px-6 sm:py-3"
          >
            <span class="nuri-mono text-sm font-bold text-[#6c7393]">{{ item.value }}</span>

            <!-- Sino Column -->
            <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <button
                type="button"
                @click="playAudio(item.sino)"
                class="nuri-audio-btn nuri-audio-btn-sm shrink-0"
                title="Escuchar"
              >
                <Volume2 :size="13" />
              </button>
              <div class="min-w-0">
                <p class="text-base font-bold text-[#1e2338] leading-tight">{{ item.sino }}</p>
                <p class="nuri-mono text-[10px] text-[#6c7393]">{{ item.sinoPron }}</p>
              </div>
            </div>

            <!-- Native Column -->
            <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <button
                type="button"
                @click="playAudio(item.nativeShort ? `${item.nativeShort} 시` : item.native)"
                class="nuri-audio-btn nuri-audio-btn-sm shrink-0"
                title="Escuchar"
              >
                <Volume2 :size="13" />
              </button>
              <div class="min-w-0">
                <p class="text-base font-bold text-[#5848c4] leading-tight">
                  {{ item.native }}
                  <span v-if="item.nativeShort && item.nativeShort !== item.native" class="text-xs text-[#1e2338] font-normal block sm:inline">
                    (→ {{ item.nativeShort }})
                  </span>
                </p>
                <p class="nuri-mono text-[10px] text-[#6c7393]">{{ item.nativePron }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: DÍAS DE LA SEMANA -->
    <div v-if="currentTab === 'days'" class="nuri-entrance">
      <div class="info-card mb-6 p-5">
        <p class="text-xs text-[#6c7393]">
          En coreano, los días terminan en <strong class="text-[#1e2338]">요일 (yoil)</strong> y cada uno proviene de los elementos de la naturaleza (Hanja):
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="day in DAYS_OF_WEEK"
          :key="day.korean"
          class="day-card p-4"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="nuri-display text-xl font-bold text-[#1e2338]">{{ day.korean }}</span>
              <span class="nuri-mono day-badge">
                {{ day.spanish }}
              </span>
            </div>
            <p class="mt-1 text-xs text-[#6c7393]">
              Elemento: <span class="font-medium text-[#1e2338]">{{ day.hanjaMeaning }}</span>
            </p>
          </div>

          <button
            type="button"
            @click="playAudio(day.korean)"
            class="nuri-audio-btn"
            title="Escuchar pronunciación"
          >
            <Volume2 :size="16" />
          </button>
        </div>
      </div>

      <!-- Time markers extra -->
      <div class="info-card mt-8 p-5">
        <h4 class="nuri-mono text-[10px] font-bold uppercase tracking-wider text-[#5848c4]">
          Marcadores temporales esenciales
        </h4>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="timeWord in [
              { ko: '오늘', es: 'Hoy' },
              { ko: '어제', es: 'Ayer' },
              { ko: '내일', es: 'Mañana' },
              { ko: '지금', es: 'Ahora' },
            ]"
            :key="timeWord.ko"
            class="time-word-box p-3"
          >
            <div>
              <p class="font-bold text-[#1e2338]">{{ timeWord.ko }}</p>
              <p class="text-xs text-[#6c7393]">{{ timeWord.es }}</p>
            </div>
            <button
              type="button"
              @click="playAudio(timeWord.ko)"
              class="nuri-audio-btn nuri-audio-btn-sm"
            >
              <Volume2 :size="13" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: GRAMÁTICA Y PREGUNTAS -->
    <div v-if="currentTab === 'grammar'" class="nuri-entrance">
      <div class="space-y-4">
        <div
          v-for="card in GRAMMAR_CAPSULES"
          :key="card.questionWord"
          class="grammar-card mb-4 p-5"
        >
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e4f2]/70 pb-3">
            <div class="flex items-center gap-3">
              <span class="nuri-display text-2xl font-bold text-[#5848c4]">
                {{ card.questionWord }}
              </span>
              <span class="grammar-meaning-badge">
                {{ card.meaning }}
              </span>
            </div>

            <button
              type="button"
              @click="playAudio(card.audioText)"
              class="grammar-audio-btn flex items-center gap-1.5"
            >
              <Volume2 :size="14" />
              <span>Escuchar ejemplo</span>
            </button>
          </div>

          <p class="mt-3 text-xs text-[#6c7393]">
            📌 <strong class="text-[#1e2338]">Uso y Partícula:</strong> {{ card.particleNote }}
          </p>

          <div class="mt-3 example-box p-3 text-sm">
            <p class="font-bold text-[#1e2338]">{{ card.exampleKorean }}</p>
            <p class="mt-1 text-xs text-[#6c7393]">{{ card.exampleSpanish }}</p>
          </div>
        </div>
      </div>
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

.sub-tab-btn {
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.85);
  color: var(--muted-foreground);
  transition: all 0.2s ease;
}
.sub-tab-btn:hover {
  background: #ffffff;
  color: var(--foreground);
}
.sub-tab-btn.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
  box-shadow: 0 6px 16px var(--primary-glow);
}

.clock-card-box {
  border-radius: 26px;
  border: 1px solid #d9ddf1;
  background: #ffffff;
  box-shadow: var(--shadow-lg);
}

.golden-rule-badge {
  border-radius: 9999px;
  background: var(--primary-light);
  color: var(--primary);
  padding: 0.25rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 700;
}

.quick-action-btn {
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: #ffffff;
  padding: 0.35rem 0.85rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--muted-foreground);
  transition: all 0.2s ease;
}
.quick-action-btn:hover {
  border-color: rgba(88, 72, 196, 0.4);
  color: var(--foreground);
}
.quick-action-btn.is-primary {
  border-color: rgba(88, 72, 196, 0.3);
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 700;
}
.quick-action-btn.is-primary:hover {
  background: var(--primary);
  color: #ffffff;
}

.digital-clock-display {
  border-radius: 20px;
  border: 1px solid var(--border);
  background: #ffffff;
  padding: 0.875rem 1.5rem;
  box-shadow: var(--shadow-sm);
}

@media (min-width: 640px) {
  .digital-clock-display {
    border-radius: 24px;
    padding: 1.25rem 2.25rem;
  }
}

.clock-digits {
  font-size: clamp(2.6rem, 8vw, 5.5rem);
  font-weight: 800;
  line-height: 1;
  color: #1e2338;
}

.reveal-time-btn {
  border-radius: 16px;
  background: var(--primary);
  color: #ffffff;
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  box-shadow: 0 10px 24px var(--primary-glow);
  transition: transform 0.2s ease;
}
@media (min-width: 640px) {
  .reveal-time-btn {
    padding: 0.875rem 2rem;
    font-size: 0.9375rem;
  }
}
.reveal-time-btn:hover {
  transform: scale(1.02);
}

.revealed-box {
  border-radius: 22px;
  border: 1px solid #35305e;
  background: var(--card-back-bg);
  color: #ffffff;
  box-shadow: var(--shadow-card-dark);
}
@media (min-width: 640px) {
  .revealed-box {
    border-radius: 24px;
  }
}

.answer-tag {
  border-radius: 9999px;
  background: #383164;
  color: #b9b4ff;
  padding: 0.25rem 0.75rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
}

.time-korean-text {
  font-size: clamp(1.8rem, 5.5vw, 4rem);
  line-height: 1.1;
  color: #f8f8ff;
  word-break: keep-all;
}

.breakdown-card {
  border-radius: 14px;
  background: #241f48;
  padding: 0.75rem 1rem;
}

.another-time-btn {
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  padding: 0.5rem 1.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease;
}
.another-time-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.stepper-btn {
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #ffffff;
  padding: 0.25rem 0.65rem;
  font-weight: 700;
  transition: all 0.15s ease;
}
.stepper-btn:hover {
  background: #edf0f8;
}

.info-card {
  border-radius: 18px;
  border: 1px solid #d9ddf1;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
}

.sino-badge {
  display: inline-flex;
  border-radius: 9999px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  padding: 0.25rem 0.7rem;
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: var(--font-mono);
  text-transform: uppercase;
}

.native-badge {
  display: inline-flex;
  border-radius: 9999px;
  background: var(--primary-light);
  color: var(--primary);
  padding: 0.25rem 0.7rem;
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: var(--font-mono);
  text-transform: uppercase;
}

.table-container {
  border-radius: 20px;
  border: 1px solid var(--border);
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
@media (min-width: 640px) {
  .table-container {
    border-radius: 22px;
  }
}

.table-header-row {
  display: grid;
  grid-template-columns: 34px 1fr 1fr;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border);
  background: #edf0f8;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted-foreground);
}
@media (min-width: 640px) {
  .table-header-row {
    grid-template-columns: 50px 1fr 1fr;
    gap: 0;
    font-size: 0.6875rem;
  }
}

.table-data-row {
  display: grid;
  grid-template-columns: 34px 1fr 1fr;
  gap: 0.25rem;
  align-items: center;
  transition: background 0.15s ease;
}
@media (min-width: 640px) {
  .table-data-row {
    grid-template-columns: 50px 1fr 1fr;
    gap: 0;
  }
}
.table-data-row:hover {
  background: #f7f8fc;
}

.day-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}
.day-card:hover {
  border-color: rgba(88, 72, 196, 0.4);
}

.day-badge {
  border-radius: 6px;
  background: var(--primary-light);
  color: var(--primary);
  padding: 0.15rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
}

.time-word-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: #ffffff;
}

.grammar-card {
  border-radius: 18px;
  border: 1px solid var(--border);
  background: #ffffff;
  box-shadow: var(--shadow-sm);
}

.grammar-meaning-badge {
  border-radius: 9999px;
  background: var(--primary-light);
  color: var(--primary);
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.grammar-audio-btn {
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: #f8f9fc;
  padding: 0.35rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--primary);
}
.grammar-audio-btn:hover {
  background: var(--primary-light);
}

.example-box {
  border-radius: 12px;
  background: #f8f9fc;
}
</style>
