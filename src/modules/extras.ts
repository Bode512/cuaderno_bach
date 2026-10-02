import { storage } from '../storage';
import { SUBJECTS } from '../subjects';

// ===================================================================
// TIPOS
// ===================================================================
interface Note {
  id: string;
  subject: string;
  content: string;
  updated: string;
}

interface Task {
  id: string;
  title: string;
  subject: string;
  done: boolean;
  deadline: string;
  pomodorosDone?: number; // campo opcional nuevo: pomodoros completados en la tarea
}

type Phase = 'work' | 'break' | 'longBreak';
type SoundType = 'campana' | 'beep' | 'digital';

interface PomodoroState {
  isRunning: boolean;
  phase: Phase;
  /** Marca de tiempo (ms) en la que termina la fase. Solo tiene valor si está corriendo. */
  endTime: number | null;
  /** Milisegundos restantes cuando está en pausa / detenido. */
  remainingMs: number;
  pomodoroCount: number;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  soundOn: boolean;
  soundType: SoundType;
  volume: number; // 0-100
  linkedSubject: string;
  linkedTaskId: string | null;
}

interface PomodoroHistoryEntry {
  id: string;
  subject: string;
  taskName: string;
  date: string;
  duration: number; // segundos
  phase: Phase;
}

type SubTab = 'pomodoro' | 'unidades' | 'notas';

// ===================================================================
// UTILIDADES
// ===================================================================
let subTab: SubTab = 'pomodoro';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ===================================================================
// POMODORO: ESTADO
// ===================================================================
const DEFAULT_POMODORO: PomodoroState = {
  isRunning: false,
  phase: 'work',
  endTime: null,
  remainingMs: 25 * 60 * 1000,
  pomodoroCount: 0,
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  soundOn: true,
  soundType: 'campana',
  volume: 60,
  linkedSubject: SUBJECTS[0],
  linkedTaskId: null,
};

const PHASE_LABELS: Record<Phase, string> = {
  work: 'Tiempo de estudio',
  break: 'Descanso corto',
  longBreak: 'Descanso largo',
};

function phaseMs(phase: Phase, s: PomodoroState): number {
  switch (phase) {
    case 'work': return s.workMinutes * 60 * 1000;
    case 'break': return s.breakMinutes * 60 * 1000;
    case 'longBreak': return s.longBreakMinutes * 60 * 1000;
  }
}

function getPomodoroState(): PomodoroState {
  const raw = storage.get<Partial<PomodoroState> & { startTime?: unknown }>('pomodoro', {});
  const s: PomodoroState = { ...DEFAULT_POMODORO, ...raw };
  delete (s as unknown as { startTime?: unknown }).startTime; // formato antiguo

  if (!(SUBJECTS as readonly string[]).includes(s.linkedSubject)) s.linkedSubject = SUBJECTS[0];
  if (typeof raw.remainingMs !== 'number') s.remainingMs = phaseMs(s.phase, s);
  if (s.isRunning && !s.endTime) s.isRunning = false;
  return s;
}

function savePomodoroState(state: PomodoroState) {
  storage.set('pomodoro', state);
}

/** Tiempo restante real. Se calcula siempre con Date.now(), por lo que nunca "salta" ni se desfasa. */
function getRemainingMs(s: PomodoroState): number {
  if (s.isRunning && s.endTime) return Math.max(0, s.endTime - Date.now());
  return s.remainingMs;
}

// ===================================================================
// POMODORO: SONIDO, NOTIFICACIONES, TÍTULO
// ===================================================================
let audioCtx: AudioContext | null = null;

function getAudio(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function playAlarm(type: SoundType, volume: number) {
  const ctx = getAudio();
  const vol = clamp(volume, 0, 100) / 100 * 0.4;
  if (!ctx || vol <= 0) return;

  const patterns: Record<SoundType, { freqs: number[]; wave: OscillatorType; dur: number }> = {
    campana: { freqs: [880, 660, 880], wave: 'sine', dur: 0.7 },
    beep: { freqs: [800, 800, 800], wave: 'sine', dur: 0.25 },
    digital: { freqs: [1000, 1400, 1000, 1400], wave: 'square', dur: 0.18 },
  };
  const p = patterns[type];
  let t = ctx.currentTime;
  p.freqs.forEach(freq => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = p.wave;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
    osc.start(t);
    osc.stop(t + p.dur);
    t += p.dur + 0.12;
  });
}

function notify(body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pomodoro', { body });
    }
  } catch { /* noop */ }
}

const baseTitle = document.title;

function updateTitle(s: PomodoroState) {
  if (s.isRunning) {
    const secs = Math.ceil(getRemainingMs(s) / 1000);
    document.title = `${formatTime(secs)} · ${s.phase === 'work' ? 'Estudio' : 'Descanso'}`;
  } else {
    document.title = baseTitle;
  }
}

// ===================================================================
// POMODORO: MOTOR (persiste aunque cambies de pestaña/módulo)
// ===================================================================
interface PomodoroUI {
  el: HTMLElement;
  refresh: () => void;
  rerender: () => void;
}

let pomUI: PomodoroUI | null = null;
let ticker: number | null = null;

function ensureTicker() {
  if (ticker === null) ticker = window.setInterval(tick, 250);
}

function stopTicker() {
  if (ticker !== null) { clearInterval(ticker); ticker = null; }
}

function tick() {
  const s = getPomodoroState();
  if (!s.isRunning || !s.endTime) {
    stopTicker();
    updateTitle(s);
    return;
  }
  if (s.endTime - Date.now() <= 0) {
    finishPhase(s, true);
    return;
  }
  if (pomUI && pomUI.el.isConnected) pomUI.refresh();
  else { pomUI = null; updateTitle(s); }
}

function logWork(s: PomodoroState, elapsedMs: number, completed: boolean) {
  // Las sesiones saltadas de menos de 1 minuto no se registran
  if (!completed && elapsedMs < 60 * 1000) return;

  const tasks = storage.get<Task[]>('tasks', []);
  const task = s.linkedTaskId ? tasks.find(t => t.id === s.linkedTaskId) : null;
  const date = new Date().toISOString().slice(0, 10);

  const sessions = storage.get<{ id: string; subject: string; date: string; hours: number }[]>('study', []);
  sessions.push({
    id: uid(),
    subject: s.linkedSubject,
    date,
    hours: Math.round((elapsedMs / 3600000) * 100) / 100,
  });
  storage.set('study', sessions);

  const history = storage.get<PomodoroHistoryEntry[]>('pomodoroHistory', []);
  history.unshift({
    id: uid(),
    subject: s.linkedSubject,
    taskName: task?.title || '',
    date,
    duration: Math.round(elapsedMs / 1000),
    phase: 'work',
  });
  storage.set('pomodoroHistory', history.slice(0, 50));

  if (completed && task) {
    task.pomodorosDone = (task.pomodorosDone || 0) + 1;
    storage.set('tasks', tasks);
  }
}

/**
 * Termina la fase actual y pasa a la siguiente.
 * completed = true  -> el tiempo llegó a 0 (cuenta el pomodoro, suena la alarma)
 * completed = false -> el usuario pulsó "Saltar" (no cuenta el pomodoro)
 */
function finishPhase(s: PomodoroState, completed: boolean) {
  const total = phaseMs(s.phase, s);
  const elapsedMs = completed ? total : clamp(total - getRemainingMs(s), 0, total);

  let count = s.pomodoroCount;
  if (s.phase === 'work') {
    if (completed) count++;
    logWork(s, elapsedMs, completed);
  }

  let next: Phase;
  if (s.phase === 'work') {
    next = completed && count % s.longBreakInterval === 0 ? 'longBreak' : 'break';
  } else {
    next = 'work';
  }

  const auto = next === 'work' ? s.autoStartPomodoros : s.autoStartBreaks;
  const nextMs = phaseMs(next, s);
  const newState: PomodoroState = {
    ...s,
    phase: next,
    pomodoroCount: count,
    isRunning: auto,
    endTime: auto ? Date.now() + nextMs : null,
    remainingMs: nextMs,
  };
  savePomodoroState(newState);

  if (completed) {
    if (s.soundOn) playAlarm(s.soundType, s.volume);
    notify(s.phase === 'work' ? '¡Tiempo de descanso!' : '¡Hora de estudiar!');
  }

  if (auto) ensureTicker();
  else stopTicker();

  updateTitle(newState);
  if (pomUI && pomUI.el.isConnected) pomUI.rerender();
  else pomUI = null;
}

// Si había un temporizador corriendo al cargar la app, reanudar el motor
if (getPomodoroState().isRunning) ensureTicker();

// ===================================================================
// CICLO DE VIDA DEL MÓDULO
// ===================================================================
let pendingNoteFlush: (() => void) | null = null;

function flushNotes() {
  if (pendingNoteFlush) pendingNoteFlush();
}

window.addEventListener('beforeunload', flushNotes);

export function cleanupExtras() {
  // El temporizador sigue corriendo en segundo plano (como Pomofocus);
  // solo desconectamos la interfaz.
  pomUI = null;
  flushNotes();
  updateTitle(getPomodoroState());
}

export function renderExtras(el: HTMLElement) {
  flushNotes();
  pomUI = null;

  el.innerHTML = `
    <h1>Extras</h1>
    <div class="module-tabs">
      <button class="module-tab ${subTab === 'pomodoro' ? 'active' : ''}" data-stab="pomodoro">Pomodoro</button>
      <button class="module-tab ${subTab === 'unidades' ? 'active' : ''}" data-stab="unidades">Unidades</button>
      <button class="module-tab ${subTab === 'notas' ? 'active' : ''}" data-stab="notas">Bloc de notas</button>
    </div>
    <div id="extras-content"></div>
  `;

  el.querySelectorAll('.module-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      subTab = (btn as HTMLElement).dataset.stab as SubTab;
      renderExtras(el);
    });
  });

  const content = el.querySelector('#extras-content')! as HTMLElement;
  switch (subTab) {
    case 'pomodoro': renderPomodoro(content); break;
    case 'unidades': renderUnitConverter(content); break;
    case 'notas': renderNotes(content); break;
  }
}

// ===================================================================
// POMODORO: INTERFAZ
// ===================================================================
const RING_RADIUS = 90;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function renderPomodoro(el: HTMLElement) {
  const phaseColor = (p: Phase) => (p === 'work' ? 'var(--accent)' : p === 'longBreak' ? '#00b894' : '#00cec9');

  const dotsHtml = (s: PomodoroState) => {
    const n = clamp(s.longBreakInterval, 1, 12);
    const done = s.phase === 'longBreak' ? n : s.pomodoroCount % n;
    return Array.from({ length: n }, (_, k) => {
      const i = k + 1;
      const cls = `${i <= done ? 'pomodoro-dot-done' : ''} ${i === done + 1 && s.phase === 'work' ? 'pomodoro-dot-active' : ''}`;
      return `<div class="pomodoro-dot ${cls}"></div>`;
    }).join('');
  };

  const numRow = (id: string, label: string, val: number, min: number, max: number) => `
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <label style="font-size:13px;">${label}</label>
      <input class="input" id="${id}" type="number" min="${min}" max="${max}" value="${val}" style="width:70px;text-align:center;">
    </div>`;

  const checkRow = (id: string, label: string, checked: boolean) => `
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <label style="font-size:13px;" for="${id}">${label}</label>
      <input id="${id}" type="checkbox" ${checked ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent);">
    </div>`;

  // ---------- Actualización ligera (cada tick): no reconstruye el DOM ----------
  const refresh = () => {
    const s = getPomodoroState();
    const rem = getRemainingMs(s);
    const total = phaseMs(s.phase, s);
    const progress = total > 0 ? clamp(((total - rem) / total) * 100, 0, 100) : 0;

    const display = el.querySelector('.pomodoro-display');
    if (display) display.textContent = formatTime(Math.ceil(rem / 1000));

    const ring = el.querySelector('#pom-ring');
    if (ring) ring.setAttribute('stroke-dashoffset', String(RING_LENGTH * (1 - progress / 100)));

    const dots = el.querySelector('#pom-dots');
    if (dots) dots.innerHTML = dotsHtml(s);

    updateTitle(s);
  };

  // ---------- Construcción completa ----------
  const render = () => {
    const s = getPomodoroState();
    const tasks = storage.get<Task[]>('tasks', []);
    const pendingTasks = tasks.filter(t => !t.done);
    const isWork = s.phase === 'work';
    const total = phaseMs(s.phase, s);
    const hasProgress = s.remainingMs < total;
    const toggleLabel = s.isRunning ? 'Pausar' : hasProgress ? 'Reanudar' : 'Iniciar';

    el.innerHTML = `
      <div class="glass-card" style="text-align:center;">
        <h3>Pomodoro</h3>
        <div class="module-tabs" style="justify-content:center;margin:8px 0 12px;">
          ${(['work', 'break', 'longBreak'] as Phase[]).map(p =>
            `<button class="module-tab ${p === s.phase ? 'active' : ''}" data-phase="${p}">${p === 'work' ? 'Estudio' : p === 'break' ? 'Descanso corto' : 'Descanso largo'}</button>`
          ).join('')}
        </div>
        <p class="help-text">${PHASE_LABELS[s.phase]} · Pomodoro #${s.pomodoroCount + (isWork ? 1 : 0)}</p>
        <div id="pom-dots" class="pomodoro-phase-indicator" style="display:flex;gap:6px;justify-content:center;margin-bottom:16px;"></div>
        <div style="position:relative;width:200px;height:200px;margin:0 auto 16px;">
          <svg style="transform:rotate(-90deg);width:200px;height:200px;" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="${RING_RADIUS}" fill="none" stroke="var(--border-subtle)" stroke-width="8"/>
            <circle id="pom-ring" cx="100" cy="100" r="${RING_RADIUS}" fill="none" stroke="${phaseColor(s.phase)}" stroke-width="8"
              stroke-dasharray="${RING_LENGTH}" stroke-dashoffset="${RING_LENGTH}"
              stroke-linecap="round" style="transition:stroke-dashoffset 0.25s linear;"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
            <div class="pomodoro-display" style="margin:0;font-size:3rem;">00:00</div>
          </div>
        </div>
        <div style="font-size:13px;color:var(--ink-muted);margin-bottom:16px;">Completados: ${s.pomodoroCount}</div>
        <div class="pomodoro-controls">
          <button class="btn btn-primary" id="pom-toggle">${toggleLabel}</button>
          <button class="btn btn-secondary" id="pom-reset">Reiniciar</button>
          <button class="btn btn-secondary" id="pom-skip">Saltar</button>
        </div>
      </div>
      <div class="glass-card">
        <h3>Vincular a</h3>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
          <div>
            <label class="input-label">Asignatura</label>
            <select class="input" id="pom-subject">
              ${SUBJECTS.map(sub => `<option value="${esc(sub)}" ${sub === s.linkedSubject ? 'selected' : ''}>${esc(sub)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="input-label">Tarea (opcional)</label>
            <select class="input" id="pom-task">
              <option value="">Sin tarea vinculada</option>
              ${pendingTasks.map(t => `<option value="${esc(t.id)}" ${t.id === s.linkedTaskId ? 'selected' : ''}>${esc(t.title)} (${esc(t.subject)})${t.pomodorosDone ? ` · 🍅 ${t.pomodorosDone}` : ''}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="glass-card">
        <h3>Configuración</h3>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
          ${numRow('pom-work', 'Estudio (min)', s.workMinutes, 1, 120)}
          ${numRow('pom-break', 'Descanso corto (min)', s.breakMinutes, 1, 60)}
          ${numRow('pom-long', 'Descanso largo (min)', s.longBreakMinutes, 1, 120)}
          ${numRow('pom-interval', 'Descanso largo cada (pomodoros)', s.longBreakInterval, 1, 12)}
          ${checkRow('pom-auto-breaks', 'Iniciar descansos automáticamente', s.autoStartBreaks)}
          ${checkRow('pom-auto-pomos', 'Iniciar pomodoros automáticamente', s.autoStartPomodoros)}
          ${checkRow('pom-sound-on', 'Sonido al terminar', s.soundOn)}
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label style="font-size:13px;">Sonido</label>
            <select class="input" id="pom-sound-type" style="width:120px;">
              <option value="campana" ${s.soundType === 'campana' ? 'selected' : ''}>Campana</option>
              <option value="beep" ${s.soundType === 'beep' ? 'selected' : ''}>Beep</option>
              <option value="digital" ${s.soundType === 'digital' ? 'selected' : ''}>Digital</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <label style="font-size:13px;">Volumen</label>
            <input id="pom-volume" type="range" min="0" max="100" value="${s.volume}" style="flex:1;max-width:160px;accent-color:var(--accent);">
          </div>
          <button class="btn btn-secondary" id="pom-reset-count">Reiniciar contador</button>
        </div>
      </div>
      <div class="glass-card">
        <h3>Historial reciente</h3>
        ${renderPomodoroHistory()}
      </div>
    `;

    attachEvents();
    refresh();
  };

  // ---------- Eventos ----------
  function attachEvents() {
    // Cambiar de fase manualmente (pestañas)
    el.querySelectorAll('[data-phase]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = getPomodoroState();
        const target = (btn as HTMLElement).dataset.phase as Phase;
        if (target === s.phase) return;
        const hasProgress = getRemainingMs(s) < phaseMs(s.phase, s);
        if ((s.isRunning || hasProgress) && !confirm('Se perderá el progreso de la fase actual. ¿Continuar?')) return;
        stopTicker();
        savePomodoroState({ ...s, phase: target, isRunning: false, endTime: null, remainingMs: phaseMs(target, s) });
        render();
      });
    });

    // Iniciar / Pausar / Reanudar
    el.querySelector('#pom-toggle')?.addEventListener('click', () => {
      getAudio(); // desbloquea el audio con un gesto del usuario
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      const s = getPomodoroState();
      if (s.isRunning) {
        savePomodoroState({ ...s, isRunning: false, endTime: null, remainingMs: getRemainingMs(s) });
        stopTicker();
      } else {
        const remaining = s.remainingMs > 0 ? s.remainingMs : phaseMs(s.phase, s);
        savePomodoroState({ ...s, isRunning: true, endTime: Date.now() + remaining, remainingMs: remaining });
        ensureTicker();
      }
      render();
    });

    // Reiniciar la fase actual
    el.querySelector('#pom-reset')?.addEventListener('click', () => {
      const s = getPomodoroState();
      stopTicker();
      savePomodoroState({ ...s, isRunning: false, endTime: null, remainingMs: phaseMs(s.phase, s) });
      render();
    });

    // Saltar a la siguiente fase
    el.querySelector('#pom-skip')?.addEventListener('click', () => {
      const s = getPomodoroState();
      if (s.isRunning && !confirm('¿Saltar a la siguiente fase? Este pomodoro no se contará como completado.')) return;
      finishPhase(s, false);
    });

    // Reiniciar contador de pomodoros
    el.querySelector('#pom-reset-count')?.addEventListener('click', () => {
      if (!confirm('¿Poner el contador de pomodoros a 0?')) return;
      const s = getPomodoroState();
      savePomodoroState({ ...s, pomodoroCount: 0 });
      render();
    });

    // Vincular asignatura / tarea
    el.querySelector('#pom-subject')?.addEventListener('change', e => {
      const s = getPomodoroState();
      s.linkedSubject = (e.target as HTMLSelectElement).value;
      savePomodoroState(s);
    });

    el.querySelector('#pom-task')?.addEventListener('change', e => {
      const s = getPomodoroState();
      const id = (e.target as HTMLSelectElement).value || null;
      s.linkedTaskId = id;
      if (id) {
        const task = storage.get<Task[]>('tasks', []).find(t => t.id === id);
        if (task && (SUBJECTS as readonly string[]).includes(task.subject)) {
          s.linkedSubject = task.subject;
          const subSel = el.querySelector('#pom-subject') as HTMLSelectElement | null;
          if (subSel) subSel.value = task.subject;
        }
      }
      savePomodoroState(s);
    });

    // Configuración numérica
    type NumKey = 'workMinutes' | 'breakMinutes' | 'longBreakMinutes' | 'longBreakInterval';
    const bindNum = (id: string, key: NumKey, min: number, max: number) => {
      el.querySelector(`#${id}`)?.addEventListener('change', e => {
        const input = e.target as HTMLInputElement;
        const s = getPomodoroState();
        let v = parseInt(input.value);
        if (isNaN(v)) v = s[key];
        v = clamp(v, min, max);
        input.value = String(v);

        // Si el temporizador está parado y sin empezar, el cambio se aplica al instante
        const untouched = !s.isRunning && s.remainingMs === phaseMs(s.phase, s);
        s[key] = v;
        if (untouched) s.remainingMs = phaseMs(s.phase, s);
        savePomodoroState(s);
        refresh();
      });
    };
    bindNum('pom-work', 'workMinutes', 1, 120);
    bindNum('pom-break', 'breakMinutes', 1, 60);
    bindNum('pom-long', 'longBreakMinutes', 1, 120);
    bindNum('pom-interval', 'longBreakInterval', 1, 12);

    // Opciones de arranque automático y sonido
    const bindCheck = (id: string, key: 'autoStartBreaks' | 'autoStartPomodoros' | 'soundOn') => {
      el.querySelector(`#${id}`)?.addEventListener('change', e => {
        const s = getPomodoroState();
        s[key] = (e.target as HTMLInputElement).checked;
        savePomodoroState(s);
      });
    };
    bindCheck('pom-auto-breaks', 'autoStartBreaks');
    bindCheck('pom-auto-pomos', 'autoStartPomodoros');
    bindCheck('pom-sound-on', 'soundOn');

    el.querySelector('#pom-sound-type')?.addEventListener('change', e => {
      const s = getPomodoroState();
      s.soundType = (e.target as HTMLSelectElement).value as SoundType;
      savePomodoroState(s);
      playAlarm(s.soundType, s.volume); // vista previa
    });

    el.querySelector('#pom-volume')?.addEventListener('change', e => {
      const s = getPomodoroState();
      s.volume = parseInt((e.target as HTMLInputElement).value) || 0;
      savePomodoroState(s);
      playAlarm(s.soundType, s.volume); // vista previa
    });
  }

  pomUI = { el, refresh, rerender: render };
  render();
  if (getPomodoroState().isRunning) ensureTicker();
}

function renderPomodoroHistory(): string {
  const history = storage.get<PomodoroHistoryEntry[]>('pomodoroHistory', []);
  if (history.length === 0) return '<p style="font-size:13px;">No hay sesiones completadas aún.</p>';
  return '<div style="display:flex;flex-direction:column;gap:6px;">' +
    history.slice(0, 10).map(h => {
      const mins = Math.max(1, Math.round(h.duration / 60));
      const date = new Date(h.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      return `<div class="task-item" style="padding:8px 12px;">
        <div class="task-info">
          <div class="task-title" style="font-size:13px;">${esc(h.subject)}${h.taskName ? ` · ${esc(h.taskName)}` : ''}</div>
          <div class="task-meta">${date} · ${mins}min estudio</div>
        </div>
      </div>`;
    }).join('') + '</div>';
}

// ===================================================================
// CONVERSOR DE UNIDADES
// ===================================================================
interface UnitCategory {
  name: string;
  units: { name: string; factor: number }[];
}

const UNIT_CATEGORIES: UnitCategory[] = [
  {
    name: 'Longitud',
    units: [
      { name: 'Metros', factor: 1 },
      { name: 'Kilómetros', factor: 1000 },
      { name: 'Centímetros', factor: 0.01 },
      { name: 'Milímetros', factor: 0.001 },
      { name: 'Millas', factor: 1609.344 },
      { name: 'Yardas', factor: 0.9144 },
      { name: 'Pies', factor: 0.3048 },
      { name: 'Pulgadas', factor: 0.0254 },
    ],
  },
  {
    name: 'Masa',
    units: [
      { name: 'Kilogramos', factor: 1 },
      { name: 'Gramos', factor: 0.001 },
      { name: 'Miligramos', factor: 0.000001 },
      { name: 'Libras', factor: 0.45359237 },
      { name: 'Onzas', factor: 0.028349523125 },
      { name: 'Toneladas', factor: 1000 },
    ],
  },
  {
    name: 'Volumen',
    units: [
      { name: 'Litros', factor: 1 },
      { name: 'Mililitros', factor: 0.001 },
      { name: 'Metros³', factor: 1000 },
      { name: 'Centímetros³', factor: 0.001 },
      { name: 'Galones (US)', factor: 3.785411784 },
    ],
  },
  {
    name: 'Temperatura',
    units: [
      { name: 'Celsius', factor: 0 },
      { name: 'Fahrenheit', factor: 0 },
      { name: 'Kelvin', factor: 0 },
    ],
  },
  {
    name: 'Velocidad',
    units: [
      { name: 'm/s', factor: 1 },
      { name: 'km/h', factor: 1 / 3.6 },
      { name: 'mph', factor: 0.44704 },
      { name: 'Nudos', factor: 0.514444 },
    ],
  },
  {
    name: 'Energía',
    units: [
      { name: 'Julios', factor: 1 },
      { name: 'Kilojulios', factor: 1000 },
      { name: 'Calorías', factor: 4.184 },
      { name: 'Kilocalorías', factor: 4184 },
      { name: 'Electronvoltios', factor: 1.602176634e-19 },
    ],
  },
  {
    name: 'Presión',
    units: [
      { name: 'Pascales', factor: 1 },
      { name: 'Kilopascales', factor: 1000 },
      { name: 'Bar', factor: 100000 },
      { name: 'Atmósferas', factor: 101325 },
      { name: 'mmHg', factor: 133.322387415 },
      { name: 'PSI', factor: 6894.757293168 },
    ],
  },
  {
    name: 'Tiempo',
    units: [
      { name: 'Segundos', factor: 1 },
      { name: 'Minutos', factor: 60 },
      { name: 'Horas', factor: 3600 },
      { name: 'Días', factor: 86400 },
      { name: 'Semanas', factor: 604800 },
    ],
  },
];

function formatNumber(n: number): string {
  if (!isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12 || abs < 1e-4) return n.toExponential(4);
  return n.toLocaleString('es-ES', { maximumSignificantDigits: 8 });
}

function renderUnitConverter(el: HTMLElement) {
  let selectedCategory = 0;
  let valueStr = '1';
  let fromIdx = 0;
  let toIdx = 1;

  const render = () => {
    const cat = UNIT_CATEGORIES[selectedCategory];

    el.innerHTML = `
      <div class="glass-card">
        <h3>Conversor de unidades</h3>
        <div class="module-tabs" style="margin-top:8px;">
          ${UNIT_CATEGORIES.map((c, i) => `<button class="module-tab ${i === selectedCategory ? 'active' : ''}" data-cat="${i}">${c.name}</button>`).join('')}
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Valor</label>
            <input class="input" id="unit-value" type="number" step="any" placeholder="0" value="${esc(valueStr)}">
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <select class="input" id="unit-from" style="flex:1;">
              ${cat.units.map((u, i) => `<option value="${i}" ${i === fromIdx ? 'selected' : ''}>${u.name}</option>`).join('')}
            </select>
            <span style="font-size:20px;color:var(--accent);">→</span>
            <select class="input" id="unit-to" style="flex:1;">
              ${cat.units.map((u, i) => `<option value="${i}" ${i === toIdx ? 'selected' : ''}>${u.name}</option>`).join('')}
            </select>
          </div>
          <div style="padding:16px;background:var(--accent-soft);border-radius:var(--radius-sm);text-align:center;">
            <div id="unit-result" style="font-family:var(--font-display);font-size:1.8rem;font-weight:700;color:var(--accent);">—</div>
          </div>
        </div>
      </div>`;

    const convert = () => {
      const valueInput = el.querySelector('#unit-value') as HTMLInputElement;
      const resultEl = el.querySelector('#unit-result') as HTMLElement;
      valueStr = valueInput.value;
      fromIdx = parseInt((el.querySelector('#unit-from') as HTMLSelectElement).value);
      toIdx = parseInt((el.querySelector('#unit-to') as HTMLSelectElement).value);

      const value = parseFloat(valueStr);
      if (isNaN(value)) { resultEl.textContent = '—'; return; }

      if (cat.name === 'Temperatura') {
        let celsius: number;
        if (fromIdx === 0) celsius = value;
        else if (fromIdx === 1) celsius = (value - 32) * 5 / 9;
        else celsius = value - 273.15;

        let result: number;
        if (toIdx === 0) result = celsius;
        else if (toIdx === 1) result = celsius * 9 / 5 + 32;
        else result = celsius + 273.15;

        resultEl.textContent = formatNumber(result);
      } else {
        const base = value * cat.units[fromIdx].factor;
        resultEl.textContent = formatNumber(base / cat.units[toIdx].factor);
      }
    };

    el.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCategory = parseInt((btn as HTMLElement).dataset.cat!);
        fromIdx = 0;
        toIdx = 1;
        render();
      });
    });

    el.querySelector('#unit-value')?.addEventListener('input', convert);
    el.querySelector('#unit-from')?.addEventListener('change', convert);
    el.querySelector('#unit-to')?.addEventListener('change', convert);

    convert();
  };

  render();
}

// ===================================================================
// BLOC DE NOTAS
// ===================================================================
function saveNote(subject: string, content: string): string {
  const notes = storage.get<Note[]>('notes', []); // siempre datos frescos
  const now = new Date().toLocaleString('es-ES');
  const idx = notes.findIndex(n => n.subject === subject);
  if (idx >= 0) {
    notes[idx].content = content;
    notes[idx].updated = now;
  } else {
    notes.push({ id: uid(), subject, content, updated: now });
  }
  storage.set('notes', notes);
  return now;
}

function renderNotes(el: HTMLElement) {
  const noteSubjects = ['General', ...SUBJECTS];
  let activeSubject = 'General';

  const render = () => {
    const notes = storage.get<Note[]>('notes', []);
    const note = notes.find(n => n.subject === activeSubject);

    el.innerHTML = `
      <div class="glass-card">
        <h3>Bloc de notas</h3>
        <div class="notes-subject-scroll" style="margin-top:8px;">
          <button class="scroll-arrow" id="notes-scroll-left">&#9664;</button>
          <div class="notes-subject-list" id="notes-subject-list">
            ${noteSubjects.map(s => `<button class="module-tab ${s === activeSubject ? 'active' : ''}" data-notefilter="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>
          <button class="scroll-arrow" id="notes-scroll-right">&#9654;</button>
        </div>
      </div>
      <div class="glass-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:600;font-size:14px;">${esc(activeSubject)}</span>
          <span id="note-updated" style="font-size:11px;color:var(--ink-muted);">${note ? esc(note.updated) : ''}</span>
        </div>
        <textarea class="notes-textarea" id="notes-area" placeholder="Escribe tus notas aquí...">${esc(note?.content || '')}</textarea>
      </div>`;

    el.querySelectorAll('[data-notefilter]').forEach(btn => {
      btn.addEventListener('click', () => {
        flushNotes(); // guarda lo pendiente antes de cambiar de asignatura
        activeSubject = (btn as HTMLElement).dataset.notefilter!;
        render();
      });
    });

    const scrollList = el.querySelector('#notes-subject-list') as HTMLElement;
    el.querySelector('#notes-scroll-left')?.addEventListener('click', () => {
      scrollList.scrollBy({ left: -160, behavior: 'smooth' });
    });
    el.querySelector('#notes-scroll-right')?.addEventListener('click', () => {
      scrollList.scrollBy({ left: 160, behavior: 'smooth' });
    });

    const textarea = el.querySelector('#notes-area') as HTMLTextAreaElement;
    const subject = activeSubject;
    let saveTimeout: number | null = null;

    const flush = () => {
      if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
      const updated = saveNote(subject, textarea.value);
      const label = el.querySelector('#note-updated');
      if (label) label.textContent = updated;
      if (pendingNoteFlush === flush) pendingNoteFlush = null;
    };

    textarea.addEventListener('input', () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      pendingNoteFlush = flush;
      saveTimeout = window.setTimeout(flush, 500);
    });
    textarea.addEventListener('blur', () => { if (pendingNoteFlush === flush) flush(); });
  };

  render();
}
