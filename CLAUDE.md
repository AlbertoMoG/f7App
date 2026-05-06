# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Descripción del proyecto

**Fútbol 7 Manager** — SPA en React/TypeScript para gestionar un equipo de fútbol sala amateur (7 jugadores). Funcionalidades: gestión de plantilla, seguimiento de partidos, estadísticas de jugadores, control de asistencia, predicciones de partidos con IA, análisis de rivales, clasificaciones, simulador de alineaciones y tesorería.

---

## Comandos

```bash
# Desarrollo
npm run dev              # Servidor Vite en http://localhost:3000

# Solo en Windows (primera vez — instala bindings nativos)
npm run setup:win

# Comprobación de tipos (no hay test runner; este es el paso de "lint")
npm run lint             # tsc --noEmit

# Build de producción
npm run build

# Firebase
npm run deploy:rules     # Publica las reglas de seguridad de Firestore
npm run test:rules       # Ejecuta los tests de reglas de Firestore con el emulador
```

**No existen tests unitarios** para la lógica de negocio — `npm run lint` es la única validación automatizada.

---

## Configuración del entorno

Crear `.env.local` con estas variables (todas obligatorias salvo las marcadas como opcionales):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_STORAGE_BUCKET=        # opcional
VITE_FIREBASE_MESSAGING_SENDER_ID=   # opcional
VITE_FIREBASE_FIRESTORE_DATABASE_ID= # opcional, para base de datos no predeterminada
GEMINI_API_KEY=                       # opcional, para funciones de IA con Google Gemini
```

Se cargan y validan al arrancar en `src/config/env.ts` — la app lanza un error inmediatamente si falta alguna variable obligatoria.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | React 19 + TypeScript 5.8 |
| Build | Vite 6 |
| Enrutamiento | React Router DOM 7 |
| Estilos | Tailwind CSS 4 + componentes shadcn/ui |
| Backend | Firebase 12 (Auth + Firestore) |
| Gráficas | Recharts 3 |
| Notificaciones | Sonner |
| Animaciones | Motion |
| Fechas | date-fns 4 |
| IA | Google Gemini (`@google/genai`) |
| Exportación PDF/imagen | html2canvas, jspdf, jspdf-autotable |

Tailwind se configura mediante el plugin `@tailwindcss/vite` (no existe `tailwind.config.ts` separado). El alias de ruta `@/` apunta a `src/`.

---

## Arquitectura

### Gestión de estado: Context API + Custom Hooks

Todo el estado global fluye a través de tres contextos React, ensamblados en `App.tsx`:

```
AppDataProvider      → snapshots de Firestore de solo lectura (equipo, jugadores, partidos, etc.)
AppActionsProvider   → funciones CRUD para todas las entidades
NavigationProvider   → estado de UI (activeTab, globalSeasonId, selectedMatchId)
```

**Flujo de datos:**
1. `useFirestoreData(user)` en `App.tsx` abre listeners `onSnapshot` en tiempo real para las 12 colecciones de Firestore
2. El estado se pasa al `AppDataProvider`
3. Los hooks de acciones de dominio (`useMatchActions`, `usePlayerActions`, etc.) escriben en Firestore
4. Los listeners de Firestore propagan los cambios automáticamente a través del contexto
5. Los componentes leen con `useAppData()` y escriben con `useAppActions()`

La ruta principal `"/"` usa **navegación por pestañas** (no por URL) para las vistas principales. `activeTab` en `NavigationContext` controla qué componente se renderiza dentro de `Layout`. Las rutas URL reales solo existen para formularios completos y vistas de detalle.

### Enrutamiento

```
/                           → Shell con Layout; la pestaña activa renderiza uno de:
                              dashboard | ai-analysis | standings | players |
                              matches | simulator | treasury | settings | team
/matches/new                → Formulario AddMatch (nuevo)
/matches/:matchId/edit      → Formulario AddMatch (edición)
/matches/:matchId/stats     → MatchStats (entrada de estadísticas por jugador)
/players/:playerId          → PlayerProfile (página independiente con sus propias consultas a Firestore)
/seasons/new                → SeasonForm
/seasons/:seasonId/edit     → SeasonForm
```

`PlayerProfile` obtiene sus propios datos directamente de Firestore — **no** usa `AppDataContext`.

### Colecciones de Firestore

Todos los documentos están acotados por `teamId` (o `ownerId` en la colección `team`). Hay **14 colecciones** en total; 12 se suscriben en tiempo real mediante `onSnapshot` en `useFirestoreData.ts`, y 2 (`seasonFees`, `playerPayments`) se consultan bajo demanda en `Treasury.tsx`.

#### Modelo de datos completo

```
team/{teamId}
  ├─ ownerId: string          ← uid del usuario de Firebase Auth (clave de aislamiento)
  ├─ name: string             (1-100 chars)
  └─ shieldUrl?: string       (URL de imagen del escudo)

players/{playerId}
  ├─ teamId: string
  ├─ firstName: string        (1-50 chars)
  ├─ lastName: string         (1-50 chars)
  ├─ alias?: string           (1-50 chars, nombre corto mostrado en la UI)
  ├─ number: number           (1-99)
  ├─ position: string         'Portero' | 'Defensa' | 'Medio' | 'Delantero'
  ├─ birthDate: string        (ISO date)
  ├─ photoUrl?: string
  ├─ isInjured?: boolean      (desnormalizado para acceso rápido)
  └─ isActive?: boolean

playerSeasons/{psId}          ← tabla de unión: controla la plantilla por temporada
  ├─ teamId: string
  ├─ playerId: string
  └─ seasonId: string

seasons/{seasonId}
  ├─ teamId: string
  ├─ name: string             (1-50 chars)
  ├─ division?: string
  └─ startYear: number        (año inicio; temporada va de agosto a julio)

opponents/{opponentId}
  ├─ teamId: string
  ├─ name: string             (1-100 chars)
  ├─ shieldUrl?: string
  └─ seasonIds?: string[]     (deprecated; usar playerSeasons como referencia)

matches/{matchId}
  ├─ teamId: string
  ├─ seasonId: string
  ├─ opponentId: string
  ├─ date: string             (ISO datetime)
  ├─ status: string           'scheduled' | 'completed'
  ├─ type?: string            'league' | 'cup' | 'friendly'
  ├─ scoreTeam?: number       (obligatorio si status='completed')
  ├─ scoreOpponent?: number   (obligatorio si status='completed')
  ├─ round?: string           (jornada, texto libre)
  ├─ isHome?: boolean
  ├─ location?: string
  ├─ fieldId?: string
  └─ savedPrediction?: { team: number, opponent: number }  ← predicción IA guardada

playerStats/{statId}          ← una fila por jugador por partido
  ├─ teamId: string
  ├─ playerId: string
  ├─ matchId: string
  ├─ seasonId: string         (desnormalizado para filtrar por temporada sin join)
  ├─ attendance: string       'attending' | 'notAttending' | 'noResponse' | 'justified' | 'doubtful'
  ├─ wasDoubtful?: boolean
  ├─ goals: number
  ├─ assists: number
  ├─ yellowCards: number
  └─ redCards: number

injuries/{injuryId}
  ├─ teamId: string
  ├─ playerId: string
  ├─ seasonId: string
  ├─ startDate: string        (ISO date)
  ├─ endDate?: string | null  (null = lesión activa)
  └─ cause?: string | null

lineups/{lineupId}
  ├─ teamId: string
  ├─ name: string
  ├─ formation: string        (ej. '2-3-1')
  ├─ slots: LineupSlot[]      (cada slot: { playerId, x, y, pos })
  ├─ matchId?: string         (vinculación opcional a un partido)
  ├─ benchPlayerIds?: string[]
  └─ createdAt: string        (ISO datetime)

fields/{fieldId}
  ├─ teamId: string
  ├─ name: string             (1-100 chars)
  ├─ location?: string        (coordenadas o dirección, max 500 chars)
  └─ mapUrl?: string

standings/{standingId}        ← una fila por rival (o 'my-team') por temporada
  ├─ teamId: string
  ├─ seasonId: string
  ├─ opponentId: string       puede ser 'my-team' para la fila del propio equipo
  ├─ played: number
  ├─ won: number
  ├─ drawn: number
  ├─ lost: number
  ├─ goalsFor: number
  ├─ goalsAgainst: number
  └─ points: number

leagueFixtures/{fixtureId}    ← resultados de liga entre rivales (sin participación del equipo)
  ├─ teamId: string
  ├─ seasonId: string
  ├─ homeOpponentId: string
  ├─ awayOpponentId: string   (≠ homeOpponentId, validado en reglas)
  ├─ date: string
  ├─ status: string           'scheduled' | 'completed'
  ├─ scoreHome?: number
  ├─ scoreAway?: number
  └─ round?: string

── Solo bajo demanda (Treasury.tsx usa getDocs, no onSnapshot) ──────────────

seasonFees/{seasonId}         ← el docId ES el seasonId (un doc por temporada)
  ├─ teamId: string
  ├─ seasonId: string
  ├─ ficha: number            (coste ficha federativa)
  ├─ inscripcion: number      (coste inscripción)
  ├─ seguro: number           (coste seguro)
  ├─ arbitroPerMatch: number  (coste árbitro por partido)
  ├─ expectedMatches: number  (partidos previstos)
  ├─ installments: number     (número de plazos de pago, ≥1)
  └─ previousBalance: number  (saldo arrastrado de temporada anterior)

playerPayments/{paymentId}    ← un doc por pago registrado
  ├─ teamId: string
  ├─ playerId: string
  ├─ seasonId: string
  └─ amountPaid: number
```

#### Índices compuestos (`firestore.indexes.json`)

| Colección | Campos indexados |
|-----------|-----------------|
| `playerStats` | `teamId` + `matchId` |
| `playerStats` | `teamId` + `playerId` + `matchId` |
| `playerStats` | `teamId` + `seasonId` |
| `playerSeasons` | `teamId` + `playerId` |
| `playerSeasons` | `teamId` + `seasonId` |
| `opponents` | `teamId` + `seasonIds` (ARRAY_CONTAINS) |
| `matches` | `teamId` + `seasonId` |
| `lineups` | `teamId` + `matchId` |

#### Reglas de seguridad (`firestore.rules`)

El acceso está completamente restringido al propietario del equipo. La cadena de verificación es:

```
request.auth.uid  →  team/{teamId}.ownerId  →  resource.data.teamId
```

Funciones clave:
- `isTeamOwnerById(teamId)` — verifica que el uid del usuario es el `ownerId` del equipo
- `canReadByTeamId()` / `canWriteByTeamId()` — usadas en casi todas las colecciones
- Excepción: `seasonFees` usa el `seasonId` como docId y tiene una regla especial que valida `request.resource.data.seasonId == seasonFeesId`

Todos los writes tienen validadores de dominio (`isValidPlayer`, `isValidMatch`, etc.) que comprueban campos requeridos, longitudes de string y rangos numéricos antes de permitir la escritura.

---

## Lógica de negocio clave (`src/lib/`)

### Sistema de baremo de jugadores (`ratingSystem.ts`)

Calcula una puntuación 0–100 por jugador. Fórmula:

```
notaFinal = (notaCompromiso × 0.55) + (notaDesempeno × 0.45) + bonoRegularidad − penalizacionRegularidad
```

**Compromiso (55%):** Base 100 → se reduce por el ratio de asistencia efectiva, penalizaciones por no contestar (−10/partido) y por no asistencia (−1,5/partido). Las lesiones cuentan como el 80% de la asistencia; las ausencias justificadas, el 90%.

**Desempeño (45%):** Puntos por partido asistido (Victoria +100, Empate +45, Derrota +25; Gol +80, Asistencia +40, Amarilla −20, Roja −80; tramos defensivos: portería a cero +70, 1 gol encajado +35, 2 goles +12). Se aplican multiplicadores por posición (goles del portero ×1.5, asistencias del medio ×1.2, etc.). Se escala con `factorFiabilidad = 0.6 + 0.4 × (partidosAsistidos / partidosTotales)` para evitar inflación con pocos partidos.

**Regularidad:** +8 pts por cada 5 partidos consecutivos asistidos; −8 pts por cada racha de 3 ausencias consecutivas.

### Evaluador de convocatoria (`squadEvaluator.ts`)

Otorga una nota S/A/B/C/D a la convocatoria de un partido concreto. Factores: baremo medio, equilibrio posicional (presencia de portero, número de defensas y delanteros), franjas de edad, sinergias letales, ausencia de jugadores clave y forma en liga del rival.

### Calculador de sinergias (`synergyCalculator.ts`)

Precalcula la tasa de victorias de cada par de jugadores que han coincidido en partidos. Los pares con ≥70% de victorias se marcan como «sinergias letales». Complejidad O(M×P²) — se llama una sola vez mediante `useMemo([matches, stats])`.

### Motor de predicciones (`src/features/ai-analysis/hooks/usePredictions.ts`)

Pipeline de predicción por partido:
1. **Línea base:** media de GF/GC solo en partidos de liga (retrocede a todos los tipos si no hay suficientes)
2. **Blend H2H:** peso dinámico `min(0.6, n×0.15)` — hasta el 60% de influencia H2H con 4 o más enfrentamientos previos
3. **Modificadores multiplicativos:** calidad de convocatoria, forma táctica, sinergias, jugadores clave, diferencial de clasificación, edad, inercia, forma del rival
4. **Calibración:** aprende el sesgo de los últimos 5 partidos completados con `BIAS_LEARNING_RATE = 0.4`
5. **Distribución de Poisson:** convierte GF/GC predichos en probabilidades victoria/empate/derrota
6. **Convocatoria recomendada:** selecciona los 10 mejores jugadores elegibles con restricción: ≥1 portero + ≥2 defensas antes de rellenar libremente

Las constantes de ajuste están en `src/lib/predictionConstants.ts`.

### Puntuación de amenaza del rival (`src/lib/rivalThreatScore.ts`)

Calcula una puntuación de amenaza (0–100) para cada rival usando tendencia de forma, racha, posición en tabla y PPG. Expone structs numéricos (`formData`, `streakData`, `tableData`, `ppgData`) directamente — no se necesita parseo de cadenas.

---

## Módulo de Análisis IA (`src/features/ai-analysis/`)

Cuatro pestañas, cada una respaldada por su propio hook:

| Pestaña | Hook | Propósito |
|---------|------|-----------|
| Inteligencia Predictiva | `usePredictions.ts` | Predicción del resultado del próximo partido |
| Estudio de Convocatorias | `useSquadAnalysis.ts` | Calidad histórica de la convocatoria por partido |
| Análisis de Rivales | `useRivalThreatAnalysis.ts` | Ranking de amenaza de los rivales |
| IA vs Fútbol | (inline en `AIVsFootballTab.tsx`) | Seguimiento de la precisión de predicciones |

`useSquadAnalysis` memoiza `buildSynergyMap` por separado (deps: `[matches, stats]`) para que no se recalcule cuando cambian las valoraciones de los jugadores.

---

## Convenciones de UI

- Los primitivos de **shadcn/ui** están en `src/components/ui/`. Para añadir nuevos: `npx shadcn add <componente>`.
- La utilidad `cn()` de `src/lib/utils.ts` combina clases de Tailwind (`clsx` + `tailwind-merge`).
- Los colores por grado de valoración de jugadores están en `GRADE_COLORS` dentro de `src/lib/predictionConstants.ts`.
- Notificaciones: usar siempre `toast.success()` / `toast.error()` de `sonner` — nunca `alert()`.
- Las imágenes de Firebase Storage llevan `referrerPolicy="no-referrer"` en la etiqueta `<img>`.

---

## Añadir una nueva funcionalidad

**Nueva pestaña en el shell principal:**
1. Añadir la clave de pestaña a la unión de tipos en `NavigationContext`
2. Renderizar el componente condicionalmente en `App.tsx` bajo la ruta `"/"`
3. Añadir el elemento de navegación en `Layout.tsx`

**Nueva colección de Firestore:**
1. Añadir el tipo a `src/types.ts`
2. Añadir un listener en `useFirestoreData.ts`
3. Exponer a través de `AppDataContext`
4. Crear un hook de acciones de dominio (p. ej. `useXxxActions.ts`) y conectarlo a `AppActionsContext`
5. Actualizar `firestore.rules` y `firestore.indexes.json`
