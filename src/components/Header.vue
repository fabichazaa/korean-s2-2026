<script setup lang="ts">
import { Target, BookOpen, Clock, User, LogOut } from 'lucide-vue-next';

export type AppTab = 'study' | 'numbers' | 'vocabulary';

defineProps<{
  activeTab: AppTab;
  knownCount: number;
  totalCount: number;
  userEmail?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: AppTab): void;
  (e: 'open-auth'): void;
  (e: 'logout'): void;
}>();
</script>

<template>
  <header class="nuri-topbar nuri-entrance">
    <div class="header-container">
      <!-- Brand & Mobile Auth Row -->
      <div class="brand-row">
        <div class="brand-left">
          <div class="brand-logo">누</div>
          <div class="brand-info">
            <p class="brand-title">Nuri</p>
            <p class="brand-sub">cuaderno de coreano</p>
          </div>
        </div>

        <!-- Mobile Auth Button -->
        <div class="mobile-auth-wrapper">
          <button
            v-if="!userEmail"
            type="button"
            @click="emit('open-auth')"
            class="header-auth-btn"
          >
            <User :size="13" />
            <span>Cuenta</span>
          </button>
          <div v-else class="logged-user-pill">
            <span class="user-name-short" :title="userEmail">
              {{ userEmail.split('@')[0] }}
            </span>
            <button
              type="button"
              @click="emit('logout')"
              title="Cerrar sesión"
              class="logout-icon-btn"
            >
              <LogOut :size="13" />
            </button>
          </div>
        </div>
      </div>

      <!-- Main Navigation Tabs -->
      <nav class="nav-pill-container" aria-label="Navegación principal">
        <button
          type="button"
          @click="emit('update:activeTab', 'study')"
          data-testid="button-nav-study"
          :class="['nav-btn', activeTab === 'study' ? 'is-active' : '']"
        >
          <Target :size="15" :stroke-width="2.2" />
          <span>Tarjetas</span>
        </button>

        <button
          type="button"
          @click="emit('update:activeTab', 'numbers')"
          data-testid="button-nav-numbers"
          :class="['nav-btn', activeTab === 'numbers' ? 'is-active' : '']"
        >
          <Clock :size="15" :stroke-width="2.2" />
          <span class="tab-label-desktop">Horas & Números</span>
          <span class="tab-label-mobile">Números</span>
        </button>

        <button
          type="button"
          @click="emit('update:activeTab', 'vocabulary')"
          data-testid="button-nav-vocabulary"
          :class="['nav-btn', activeTab === 'vocabulary' ? 'is-active' : '']"
        >
          <BookOpen :size="15" :stroke-width="2.2" />
          <span>Cuaderno</span>
        </button>
      </nav>

      <!-- Desktop Counter & Auth Section -->
      <div class="desktop-side-actions">
        <!-- Subtle progress counter on desktop -->
        <div class="desktop-counter">
          <p class="counter-label">conocidas</p>
          <p class="counter-val">{{ knownCount }}/{{ totalCount }}</p>
        </div>

        <div class="stat-divider-vert" />

        <!-- Desktop Auth button -->
        <button
          v-if="!userEmail"
          type="button"
          @click="emit('open-auth')"
          class="header-auth-btn is-desktop"
        >
          <User :size="14" />
          <span>Iniciar sesión</span>
        </button>
        <div v-else class="logged-user-desktop">
          <div class="text-right">
            <p class="counter-label">cuenta</p>
            <p class="user-email-text" :title="userEmail">
              {{ userEmail.split('@')[0] }}
            </p>
          </div>
          <button
            type="button"
            @click="emit('logout')"
            title="Cerrar sesión"
            class="logout-icon-btn"
          >
            <LogOut :size="14" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.nuri-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: rgba(247, 248, 252, 0.92);
  border-bottom: 1px solid rgba(224, 228, 242, 0.8);
  padding: 0.5rem 0.75rem;
}

@media (min-width: 640px) {
  .nuri-topbar {
    padding: 0.75rem 2rem;
  }
}

.header-container {
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .header-container {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
}

.brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

@media (min-width: 640px) {
  .brand-row {
    width: auto;
  }
}

.brand-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--primary);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(88, 72, 196, 0.25);
  font-family: var(--font-korean);
}

@media (min-width: 640px) {
  .brand-logo {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    font-size: 1rem;
  }
}

.brand-info {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-weight: 800;
  font-size: 1rem;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--foreground);
}

.brand-sub {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #767d9c;
  margin-top: 0.15rem;
}

@media (max-width: 639px) {
  .brand-sub {
    display: none;
  }
}

.mobile-auth-wrapper {
  display: flex;
  align-items: center;
}

@media (min-width: 640px) {
  .mobile-auth-wrapper {
    display: none;
  }
}

.header-auth-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--foreground);
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.header-auth-btn:hover {
  border-color: rgba(88, 72, 196, 0.4);
  background: var(--primary-light);
  color: var(--primary);
}

.header-auth-btn.is-desktop {
  padding: 0.45rem 0.85rem;
}

.logged-user-pill {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 9999px;
  padding: 0.2rem 0.45rem 0.2rem 0.65rem;
}

.user-name-short {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--primary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 50%;
  color: #767d9c;
  transition: all 0.2s ease;
}
.logout-icon-btn:hover {
  background: #fef2f2;
  color: #ef4444;
}

.nav-pill-container {
  display: flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 10px rgba(30, 35, 56, 0.04);
  padding: 0.25rem;
  width: 100%;
}

@media (min-width: 640px) {
  .nav-pill-container {
    width: auto;
    padding: 0.3rem;
  }
}

.nav-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.45rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted-foreground);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

@media (min-width: 640px) {
  .nav-btn {
    flex: initial;
    padding: 0.45rem 1.1rem;
    font-size: 0.825rem;
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

.tab-label-desktop {
  display: none;
}
.tab-label-mobile {
  display: inline;
}

@media (min-width: 640px) {
  .tab-label-desktop {
    display: inline;
  }
  .tab-label-mobile {
    display: none;
  }
}

.desktop-side-actions {
  display: none;
  align-items: center;
  gap: 0.85rem;
}

@media (min-width: 640px) {
  .desktop-side-actions {
    display: flex;
  }
}

.desktop-counter {
  text-align: right;
  flex-shrink: 0;
}

.stat-divider-vert {
  width: 1px;
  height: 24px;
  background: var(--border);
}

.logged-user-desktop {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.user-email-text {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--foreground);
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.counter-label {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  text-transform: uppercase;
  color: #767d9c;
}

.counter-val {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e2338;
  margin-top: 0.1rem;
}
</style>
