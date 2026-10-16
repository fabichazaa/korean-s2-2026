<script setup lang="ts">
import { Target, BookOpen, Clock } from 'lucide-vue-next';

export type AppTab = 'study' | 'numbers' | 'vocabulary';

defineProps<{
  activeTab: AppTab;
  knownCount: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: AppTab): void;
}>();
</script>

<template>
  <header class="nuri-topbar nuri-entrance flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-8 md:px-12 lg:px-16 sm:py-3">
    <!-- Brand -->
    <div class="flex items-center gap-2.5 shrink-0">
      <div class="brand-logo flex items-center justify-center">
        누
      </div>
      <div class="hidden sm:block">
        <p class="nuri-brand text-base font-bold leading-none tracking-tight">Nuri</p>
        <p class="nuri-mono mt-1 text-[9px] uppercase text-[#767d9c]">cuaderno de coreano</p>
      </div>
    </div>

    <!-- Main Navigation Bar -->
    <nav class="nav-pill-container flex items-center gap-0.5 p-1 sm:gap-1" aria-label="Navegación principal">
      <button
        type="button"
        @click="emit('update:activeTab', 'study')"
        data-testid="button-nav-study"
        :class="['nav-btn flex items-center gap-1 sm:gap-1.5', activeTab === 'study' ? 'is-active' : '']"
      >
        <Target :size="14" :stroke-width="2.2" />
        <span>Tarjetas</span>
      </button>

      <button
        type="button"
        @click="emit('update:activeTab', 'numbers')"
        data-testid="button-nav-numbers"
        :class="['nav-btn flex items-center gap-1 sm:gap-1.5', activeTab === 'numbers' ? 'is-active' : '']"
      >
        <Clock :size="14" :stroke-width="2.2" />
        <span class="hidden sm:inline">Horas & Números</span>
        <span class="sm:hidden">Horas</span>
      </button>

      <button
        type="button"
        @click="emit('update:activeTab', 'vocabulary')"
        data-testid="button-nav-vocabulary"
        :class="['nav-btn flex items-center gap-1 sm:gap-1.5', activeTab === 'vocabulary' ? 'is-active' : '']"
      >
        <BookOpen :size="14" :stroke-width="2.2" />
        <span>Cuaderno</span>
      </button>
    </nav>

    <!-- Progress indicator -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- Desktop version -->
      <div class="hidden sm:block text-right">
        <p class="nuri-mono text-[9px] uppercase text-[#767d9c]">conocidas</p>
        <p class="mt-0.5 text-xs font-bold text-[#1e2338]">{{ knownCount }}/{{ totalCount }}</p>
      </div>
      <!-- Mobile compact badge -->
      <div
        class="sm:hidden flex items-center gap-1 rounded-full bg-white/90 border border-[#e0e4f2] px-2 py-0.5 shadow-sm"
        title="Palabras conocidas de esta sesión"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-[#1c6d5d]" />
        <span class="nuri-mono text-[11px] font-bold text-[#1e2338]">{{ knownCount }}/{{ totalCount }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.brand-logo {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: var(--primary);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.92rem;
  box-shadow: 0 6px 14px rgba(88, 72, 196, 0.22);
  font-family: var(--font-korean);
}

@media (min-width: 640px) {
  .brand-logo {
    width: 40px;
    height: 40px;
    border-radius: 13px;
    font-size: 1rem;
    box-shadow: 0 8px 18px rgba(88, 72, 196, 0.25);
  }
}

.nav-pill-container {
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 10px rgba(30, 35, 56, 0.04);
}

.nav-btn {
  padding: 0.35rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.73rem;
  font-weight: 600;
  color: var(--muted-foreground);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

@media (min-width: 400px) {
  .nav-btn {
    padding: 0.4rem 0.75rem;
    font-size: 0.76rem;
  }
}

.nav-btn:hover:not(.is-active) {
  background: var(--muted);
  color: var(--foreground);
}

.nav-btn.is-active {
  background: var(--primary);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 4px 14px var(--primary-glow);
}

@media (min-width: 640px) {
  .nav-btn {
    padding: 0.5rem 1.1rem;
    font-size: 0.82rem;
  }
}
</style>
