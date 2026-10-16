<script setup lang="ts">
import { ref } from 'vue';
import { supabase } from '../utils/supabase';
import { X, Mail, Lock, Sparkles, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'authenticated'): void;
}>();

const mode = ref<'login' | 'signup'>('login');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const loading = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const handleSubmit = async () => {
  errorMsg.value = '';
  successMsg.value = '';

  if (mode.value === 'signup') {
    if (password.value !== confirmPassword.value) {
      errorMsg.value = 'Las contraseñas no coinciden. Por favor verifícalas.';
      return;
    }
    if (password.value.length < 6) {
      errorMsg.value = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
  }

  loading.value = true;

  try {
    if (mode.value === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.value.trim(),
        password: password.value,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      if (data.session) {
        successMsg.value = '¡Cuenta creada con éxito! Sincronizando progreso...';
        setTimeout(() => {
          emit('authenticated');
          emit('close');
        }, 1000);
      } else {
        successMsg.value = '¡Te enviamos un correo de confirmación! Revisa tu bandeja de entrada (y spam) para activar tu cuenta.';
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value,
      });

      if (error) throw error;

      successMsg.value = '¡Bienvenido de vuelta! Sincronizando progreso...';
      setTimeout(() => {
        emit('authenticated');
        emit('close');
      }, 700);
    }
  } catch (err: any) {
    errorMsg.value = err.message || 'Ocurrió un error. Verifica tus datos.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card nuri-entrance">
      <!-- Close Button -->
      <button type="button" @click="emit('close')" class="modal-close-btn" aria-label="Cerrar">
        <X :size="18" />
      </button>

      <!-- Modal Header -->
      <div class="text-center pt-2 pb-1">
        <div class="brand-badge-circle mx-auto mb-3">
          <Sparkles :size="20" />
        </div>
        <h2 class="text-xl font-bold text-[#1e2338]">
          {{ mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta' }}
        </h2>
        <p class="text-xs text-[#767d9c] mt-1.5 max-w-[280px] mx-auto">
          Guarda tus palabras aprendidas y accede desde tu celular o computadora.
        </p>
      </div>

      <!-- Mode Toggle Tabs -->
      <div class="auth-tabs-toggle mt-4 mb-4">
        <button
          type="button"
          @click="mode = 'login'; errorMsg = ''; successMsg = ''; confirmPassword = ''"
          :class="['auth-tab-btn', mode === 'login' ? 'is-active' : '']"
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          @click="mode = 'signup'; errorMsg = ''; successMsg = ''"
          :class="['auth-tab-btn', mode === 'signup' ? 'is-active' : '']"
        >
          Registrarse
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-3">
        <!-- Error Alert -->
        <div v-if="errorMsg" class="alert-box is-error flex items-start gap-2">
          <AlertCircle :size="16" class="shrink-0 mt-0.5 text-red-600" />
          <span class="text-xs text-red-700 leading-snug">{{ errorMsg }}</span>
        </div>

        <!-- Success Alert -->
        <div v-if="successMsg" class="alert-box is-success flex items-start gap-2">
          <CheckCircle2 :size="16" class="shrink-0 mt-0.5 text-emerald-600" />
          <span class="text-xs text-emerald-700 leading-snug">{{ successMsg }}</span>
        </div>

        <!-- Email Field -->
        <div class="input-group">
          <label class="input-label">Correo electrónico</label>
          <div class="input-wrapper">
            <Mail :size="16" class="input-icon" />
            <input
              v-model="email"
              type="email"
              required
              placeholder="tu-email@gmail.com"
              class="auth-input"
            />
          </div>
        </div>

        <!-- Password Field -->
        <div class="input-group">
          <label class="input-label">Contraseña</label>
          <div class="input-wrapper">
            <Lock :size="16" class="input-icon" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              minlength="6"
              placeholder="Mínimo 6 caracteres"
              class="auth-input has-toggle"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="password-toggle-btn"
              tabindex="-1"
              :title="showPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
            >
              <EyeOff v-if="showPassword" :size="16" />
              <Eye v-else :size="16" />
            </button>
          </div>
        </div>

        <!-- Confirm Password Field (Only for Signup) -->
        <div v-if="mode === 'signup'" class="input-group">
          <label class="input-label">Confirmar contraseña</label>
          <div class="input-wrapper">
            <Lock :size="16" class="input-icon" />
            <input
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              required
              minlength="6"
              placeholder="Repite tu contraseña"
              class="auth-input has-toggle"
            />
            <button
              type="button"
              @click="showConfirmPassword = !showConfirmPassword"
              class="password-toggle-btn"
              tabindex="-1"
              :title="showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
            >
              <EyeOff v-if="showConfirmPassword" :size="16" />
              <Eye v-else :size="16" />
            </button>
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="loading"
          class="auth-submit-btn w-full mt-4"
        >
          <Loader2 v-if="loading" :size="16" class="animate-spin" />
          <span>{{ loading ? 'Procesando...' : mode === 'login' ? 'Entrar a mi cuenta' : 'Crear mi cuenta' }}</span>
        </button>
      </form>

      <!-- Footer Info -->
      <div class="mt-4 pt-3 border-t border-[#f0f2f8] text-center">
        <p class="text-[11px] text-[#767d9c]">
          🔒 Tu progreso se almacena de forma privada y segura.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(18, 15, 38, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 400px;
  background: #ffffff;
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(18, 15, 38, 0.25);
  border: 1px solid #e0e4f2;
}

.modal-close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #767d9c;
  background: #f7f8fc;
  transition: all 0.2s ease;
}
.modal-close-btn:hover {
  background: #edf0f8;
  color: #1e2338;
}

.brand-badge-circle {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--primary-light);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-tabs-toggle {
  display: flex;
  background: #edf0f8;
  border-radius: 12px;
  padding: 0.25rem;
  gap: 0.25rem;
}

.auth-tab-btn {
  flex: 1;
  padding: 0.45rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 9px;
  color: #6c7393;
  transition: all 0.2s ease;
}
.auth-tab-btn.is-active {
  background: #ffffff;
  color: var(--foreground);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.input-group {
  margin-bottom: 0.75rem;
}

.input-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #4b526d;
  margin-bottom: 0.35rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.85rem;
  color: #767d9c;
  pointer-events: none;
}

.auth-input {
  width: 100%;
  padding: 0.65rem 0.85rem 0.65rem 2.4rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: #ffffff;
  font-size: 0.875rem;
  color: var(--foreground);
  transition: all 0.2s ease;
}
.auth-input.has-toggle {
  padding-right: 2.5rem;
}
.auth-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-glow);
}

.password-toggle-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #767d9c;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 6px;
  transition: color 0.2s ease;
}
.password-toggle-btn:hover {
  color: var(--foreground);
}

.alert-box {
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  font-size: 0.75rem;
}
.alert-box.is-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
}
.alert-box.is-success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.auth-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 14px;
  background: var(--primary);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.875rem;
  box-shadow: 0 4px 14px var(--primary-glow);
  transition: all 0.2s ease;
}
.auth-submit-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
}
.auth-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
