# 🚀 Cómo correr la app localmente (Guía Rápida)

### 1. Abrir la terminal en la carpeta del proyecto
Si ya estás dentro del editor (VS Code / Antigravity), abre la terminal integrada con:
- **Atajo:** `` Ctrl + Ñ `` o `` Ctrl + ` ``

*(Si abres PowerShell o CMD desde afuera, entra a la carpeta con:)*
```powershell
cd "C:\Users\Fabs\OneDrive\Escritorio\korean-s2-2026"
```

---

### 2. Instalar dependencias *(solo si es la primera vez o agregaste paquetes)*
```powershell
npm install
```

---

### 3. Encender la app en modo desarrollo (¡El comando de todos los días!)
```powershell
npm run dev
```

---

### 4. Abrir en el navegador
Una vez que corras `npm run dev`, verás un link en la terminal. Ábrelo en **Chrome** o **Edge** (recomendado para que funcione el micrófono del **Juego de Voz**):
- 👉 **http://localhost:5173** *(puedes hacer `Ctrl + Clic` sobre el link en la terminal)*

---

### 📱 Cómo abrir la app desde tu celular (en el mismo Wi-Fi)

1. En lugar de `npm run dev`, corre este comando para exponer la app en tu red Wi-Fi:
   ```powershell
   npm run dev -- --host
   ```
2. En la terminal aparecerán dos direcciones:
   - `Local:   http://localhost:5173/`
   - `Network: http://192.168.X.X:5173/` *(tu IP local)*
3. En tu celular (conectado al **mismo Wi-Fi**), abre el navegador y escribe esa dirección **`http://192.168.X.X:5173`**.

> **💡 Nota importante sobre el Micrófono en el celular:**
> Por seguridad, los navegadores de celular bloquean el micrófono en direcciones `http://192.168...` (solo permiten micrófono en `localhost` o con `https://`). Las tarjetas, audio y números funcionarán perfecto por Wi-Fi, pero si quieres usar el **Juego de Voz con micrófono desde el celular**, necesitas abrirla con `https://` (por ejemplo subiéndola a Vercel/Netlify o usando un túnel seguro).

---

### 🛑 ¿Cómo apagar el servidor?
En la misma terminal donde está corriendo, presiona:
- **`Ctrl + C`** (y luego `S` o `Enter` si te pregunta confirmar).

---

### 📦 Otros comandos útiles (opcionales)
| Comando | ¿Para qué sirve? |
| :--- | :--- |
| `npm run dev` | Inicia la app localmente para usarla o editarla en vivo. |
| `npm run build` | Verifica errores y empaqueta la app lista para subir a internet (`dist/`). |
| `npm run preview` | Prueba localmente la versión final compilada con `build`. |

---

### 🏆 SQL Completo en Supabase (Reset & Creación desde Cero)
Si quieres reiniciar la base de datos de cero (incluyendo la columna `user_name` y la tabla `voice_leaderboard`), pega esto en el **SQL Editor** de Supabase y dale a **Run**:

```sql
-- 1. Borrar tablas anteriores y usuarios de prueba para empezar de cero
drop table if exists public.voice_leaderboard cascade;
drop table if exists public.user_progress cascade;
delete from auth.users;

-- 2. Crear tabla user_progress (con columna user_name incluida)
create table public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_name text not null default 'Estudiante',
  known_ids jsonb not null default '[]'::jsonb,
  review_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

create policy "Public read user_progress for leaderboard"
  on public.user_progress for select using (true);

create policy "Users can insert own progress"
  on public.user_progress for insert with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.user_progress for update using (auth.uid() = user_id);

-- 3. Crear tabla voice_leaderboard para el ranking del Juego de Voz
create table public.voice_leaderboard (
  player_id text primary key,
  player_name text not null default 'Estudiante',
  words_correct int not null default 0,
  xp int not null default 0,
  best_streak int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.voice_leaderboard enable row level security;

create policy "Public read leaderboard"
  on public.voice_leaderboard for select using (true);

create policy "Public insert leaderboard"
  on public.voice_leaderboard for insert with check (true);

create policy "Public update leaderboard"
  on public.voice_leaderboard for update using (true);
```


