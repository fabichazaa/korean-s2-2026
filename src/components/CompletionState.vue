<script setup lang="ts">
import { onMounted } from 'vue';
import { Check, RotateCcw, ChevronRight } from 'lucide-vue-next';
import confetti from 'canvas-confetti';

const props = defineProps<{
  totalWords: number;
}>();

const emit = defineEmits<{
  (e: 'reset'): void;
  (e: 'open-browser'): void;
}>();

onMounted(() => {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#5848c4', '#d9f4ee', '#fef3c7', '#29244f']
    });
  } catch (e) {
    // Canvas confetti fallback silently
  }
});
</script>

<template>
  <div class="nuri-entrance nuri-entrance-3 completion-box mt-7 overflow-hidden rounded-[26px] border border-[#d9ddf1] bg-[#fbfcff] px-7 py-12 text-center shadow-[0_18px_45px_rgba(36,41,77,0.08)] sm:px-12 sm:py-16">
    <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#d9f4ee] text-[#237a69]">
      <Check :size="28" :stroke-width="2.4" />
    </div>

    <p class="nuri-mono mt-7 text-[10px] uppercase tracking-[0.2em] text-[#5848c4]">
      잘했어요 · muy bien
    </p>

    <h2 class="nuri-heading mt-3 text-5xl leading-none text-[#24294d] sm:text-6xl">
      Todo visto.
    </h2>

    <p class="mx-auto mt-5 max-w-[380px] text-sm leading-6 text-[#69708f]">
      Has pasado por las {{ totalWords }} palabras de esta sesión. Déjalas reposar o vuelve a empezar con ojos nuevos.
    </p>

    <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
      <button
        type="button"
        @click="emit('reset')"
        data-testid="button-reset-progress"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-[#29244f] px-5 py-3 text-sm font-semibold text-[#f8f8ff] shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#383266]"
      >
        <RotateCcw :size="16" />
        <span>Repetir sesión</span>
      </button>

      <button
        type="button"
        @click="emit('open-browser')"
        data-testid="button-open-browser-complete"
        class="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d9ddf1] bg-white px-5 py-3 text-sm font-medium text-[#29244f] transition-colors hover:bg-[#eeedff]"
      >
        <span>Ver mis palabras</span>
        <ChevronRight :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.completion-box {
  margin-top: 1.75rem;
}
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.text-center { text-align: center; }
.gap-2 { gap: 0.5rem; }
.gap-3 { gap: 0.75rem; }
.mt-3 { margin-top: 0.75rem; }
.mt-5 { margin-top: 1.25rem; }
.mt-7 { margin-top: 1.75rem; }
.mt-8 { margin-top: 2rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
.px-7 { padding-left: 1.75rem; padding-right: 1.75rem; }
.py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
.py-12 { padding-top: 3rem; padding-bottom: 3rem; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-5xl { font-size: 3rem; line-height: 1; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.rounded-xl { border-radius: 0.75rem; }
.rounded-full { border-radius: 9999px; }
.border { border-width: 1px; border-style: solid; }
.shadow-md { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }
.inline-flex { display: inline-flex; }

@media (min-width: 640px) {
  .sm\:flex-row { flex-direction: row !important; }
  .sm\:px-12 { padding-left: 3rem !important; padding-right: 3rem !important; }
  .sm\:py-16 { padding-top: 4rem !important; padding-bottom: 4rem !important; }
  .sm\:text-6xl { font-size: 3.75rem !important; line-height: 1 !important; }
}
</style>
