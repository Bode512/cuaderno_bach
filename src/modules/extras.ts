import { storage } from '../storage';
import { SUBJECTS } from '../subjects';

interface Note {
  id: string;
  subject: string;
  content: string;
  updated: string;
}

interface PomodoroState {
  isRunning: boolean;
  phase: 'work' | 'break' | 'longBreak';
  startTime: number | null;
  pomodoroCount: number;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  linkedSubject: string;
  linkedTaskId: string | null;
}

interface PomodoroHistoryEntry {
  id: string;
  subject: string;
  taskName: string;
  date: string;
  duration: number;
  phase: 'work' | 'break' | 'longBreak';
}

type SubTab = 'pomodoro' | 'unidades' | 'notas';

let subTab: SubTab = 'pomodoro';

let pomodoroRaf: number | null = null;

const DEFAULT_POMODORO: PomodoroState = {
  isRunning: false,
  phase: 'work',
  startTime: null,
  pomodoroCount: 0,
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  linkedSubject: SUBJECTS[0],
  linkedTaskId: null,
};

function getPomodoroState(): PomodoroState {
  return storage.get<PomodoroState>('pomodoro', DEFAULT_POMODORO);
}

function savePomodoroState(state: PomodoroState) {
  storage.set('pomodoro', state);
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* noop */ }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function phaseDuration(phase: 'work' | 'break' | 'longBreak', state: PomodoroState): number {
  switch (phase) {
    case 'work': return state.workMinutes * 60;
    case 'break': return state.breakMinutes * 60;
    case 'longBreak': return state.longBreakMinutes * 60;
  }
}

function computeRemaining(state: PomodoroState): number {
  if (!state.isRunning || !state.startTime) return phaseDuration(state.phase, state);
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  return Math.max(0, phaseDuration(state.phase, state) - elapsed);
}

export function cleanupExtras() {
  if (pomodoroRaf) { cancelAnimationFrame(pomodoroRaf); pomodoroRaf = null; }
}

export function renderExtras(el: HTMLElement) {
  el.innerHTML = `
    <h1>Extras</h1>
    <div class="module-tabs">
      <button class="module-tab ${subTab==='pomodoro'?'active':''}" data-stab="pomodoro">Pomodoro</button>
      <button class="module-tab ${subTab==='unidades'?'active':''}" data-stab="unidades">Unidades</button>
      <button class="module-tab ${subTab==='notas'?'active':''}" data-stab="notas">Bloc de notas</button>
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

// ===== POMODORO =====
function renderPomodoro(el: HTMLElement) {
  const state = getPomodoroState();
  const tasks = storage.get<{id:string;title:string;subject:string;done:boolean;deadline:string}[]>('tasks', []);
  const pendingTasks = tasks.filter(t => !t.done);

  if (pomodoroRaf) { cancelAnimationFrame(pomodoroRaf); pomodoroRaf = null; }

  function render() {
    const current = getPomodoroState();
    const remaining = computeRemaining(current);
    const total = phaseDuration(current.phase, current);
    const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
    const isWork = current.phase === 'work';
    const isLongBreak = current.phase === 'longBreak';
    const phaseLabel = isWork ? 'Tiempo de estudio' : isLongBreak ? 'Descanso largo' : 'Descanso corto';
    const phaseColor = isWork ? 'var(--accent)' : isLongBreak ? '#00b894' : '#00cec9';

    el.innerHTML = `
      <div class="glass-card" style="text-align:center;">
        <h3>Pomodoro</h3>
        <p class="help-text">${phaseLabel} · Pomodoro #${(current.pomodoroCount || 0) + (isWork ? 1 : 0)}</p>
        <div class="pomodoro-phase-indicator" style="display:flex;gap:6px;justify-content:center;margin-bottom:16px;">
          ${[1,2,3,4].map(i => `<div class="pomodoro-dot ${i <= (current.pomodoroCount % 4) ? 'pomodoro-dot-done' : ''} ${i === (current.pomodoroCount % 4) + 1 && isWork ? 'pomodoro-dot-active' : ''}"></div>`).join('')}
        </div>
        <div style="position:relative;width:200px;height:200px;margin:0 auto 16px;">
          <svg style="transform:rotate(-90deg);width:200px;height:200px;" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="var(--border-subtle)" stroke-width="8"/>
            <circle cx="100" cy="100" r="90" fill="none" stroke="${phaseColor}" stroke-width="8"
              stroke-dasharray="${2 * Math.PI * 90}"
              stroke-dashoffset="${2 * Math.PI * 90 * (1 - progress / 100)}"
              stroke-linecap="round" style="transition:stroke-dashoffset 0.5s linear;"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
            <div class="pomodoro-display" style="margin:0;font-size:3rem;">${formatTime(remaining)}</div>
          </div>
        </div>
        <div style="font-size:13px;color:var(--ink-muted);margin-bottom:16px;">Completados: ${current.pomodoroCount}</div>
        <div class="pomodoro-controls">
          <button class="btn btn-primary" id="pom-toggle">${current.isRunning ? 'Pausar' : 'Iniciar'}</button>
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
              ${SUBJECTS.map(s => `<option value="${s}" ${s === current.linkedSubject ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="input-label">Tarea (opcional)</label>
            <select class="input" id="pom-task">
              <option value="">Sin tarea vinculada</option>
              ${pendingTasks.map(t => `<option value="${t.id}" ${t.id === current.linkedTaskId ? 'selected' : ''}>${t.title} (${t.subject})</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="glass-card">
        <h3>Configuración</h3>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label style="font-size:13px;">Estudio (min)</label>
            <input class="input" id="pom-work" type="number" min="1" max="60" value="${current.workMinutes}" style="width:70px;text-align:center;">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label style="font-size:13px;">Descanso corto (min)</label>
            <input class="input" id="pom-break" type="number" min="1" max="30" value="${current.breakMinutes}" style="width:70px;text-align:center;">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label style="font-size:13px;">Descanso largo (min)</label>
            <input class="input" id="pom-long" type="number" min="1" max="60" value="${current.longBreakMinutes}" style="width:70px;text-align:center;">
          </div>
        </div>
      </div>
      <div class="glass-card">
        <h3>Historial reciente</h3>
        ${renderPomodoroHistory()}
      </div>
    `;

    // Update display every second
    if (current.isRunning) {
      const tick = () => {
        const s = getPomodoroState();
        if (!s.isRunning) return;
        const rem = computeRemaining(s);
        const display = el.querySelector('.pomodoro-display');
        if (display) display.textContent = formatTime(rem);
        const circle = el.querySelector('circle:last-child') as SVGCircleElement;
        if (circle) {
          const tot = phaseDuration(s.phase, s);
          const prog = tot > 0 ? ((tot - rem) / tot) * 100 : 0;
          circle.setAttribute('stroke-dashoffset', String(2 * Math.PI * 90 * (1 - prog / 100)));
        }
        if (rem <= 0) {
          handlePhaseEnd(s);
          return;
        }
        pomodoroRaf = requestAnimationFrame(tick);
      };
      pomodoroRaf = requestAnimationFrame(tick);
    }

    attachPomodoroEvents(el, pendingTasks);
  }

  function handlePhaseEnd(s: PomodoroState) {
    playBeep();
    const wasWork = s.phase === 'work';
    const nextPomodoroCount = wasWork ? s.pomodoroCount + 1 : s.pomodoroCount;

    if (wasWork) {
      logStudySession(s);
    }

    let nextPhase: PomodoroState['phase'];
    if (wasWork) {
      nextPhase = nextPomodoroCount % 4 === 0 ? 'longBreak' : 'break';
    } else {
      nextPhase = 'work';
    }

    const newState: PomodoroState = {
      ...s,
      isRunning: false,
      phase: nextPhase,
      startTime: null,
      pomodoroCount: nextPomodoroCount,
    };
    savePomodoroState(newState);

    if (Notification.permission === 'granted') {
      new Notification('Pomodoro', {
        body: wasWork ? '¡Tiempo de descanso!' : '¡Hora de estudiar!',
      });
    }

    render();
  }

  function logStudySession(s: PomodoroState) {
    const sessions = storage.get<{id:string;subject:string;date:string;hours:number}[]>('study', []);
    const duration = phaseDuration('work', s);
    const task = s.linkedTaskId ? tasks.find(t => t.id === s.linkedTaskId) : null;
    sessions.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      subject: s.linkedSubject,
      date: new Date().toISOString().slice(0, 10),
      hours: Math.round((duration / 3600) * 10) / 10,
    });
    storage.set('study', sessions);

    const history = storage.get<PomodoroHistoryEntry[]>('pomodoroHistory', []);
    history.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      subject: s.linkedSubject,
      taskName: task?.title || '',
      date: new Date().toISOString().slice(0, 10),
      duration: duration,
      phase: 'work',
    });
    storage.set('pomodoroHistory', history.slice(0, 50));
  }

  function attachPomodoroEvents(el: HTMLElement, pendingTasks: {id:string;title:string;subject:string}[]) {
    el.querySelector('#pom-toggle')?.addEventListener('click', () => {
      const s = getPomodoroState();
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
      if (s.isRunning) {
        const elapsed = s.startTime ? Math.floor((Date.now() - s.startTime) / 1000) : 0;
        savePomodoroState({ ...s, isRunning: false, startTime: null });
        render();
      } else {
        const dur = phaseDuration(s.phase, s);
        const remaining = computeRemaining(s);
        savePomodoroState({
          ...s,
          isRunning: true,
          startTime: Date.now() - ((dur - remaining) * 1000),
        });
        render();
      }
    });

    el.querySelector('#pom-reset')?.addEventListener('click', () => {
      const s = getPomodoroState();
      savePomodoroState({ ...s, isRunning: false, phase: 'work', startTime: null });
      render();
    });

    el.querySelector('#pom-skip')?.addEventListener('click', () => {
      const s = getPomodoroState();
      handlePhaseEnd({ ...s, isRunning: false });
    });

    el.querySelector('#pom-subject')?.addEventListener('change', (e) => {
      const s = getPomodoroState();
      s.linkedSubject = (e.target as HTMLSelectElement).value;
      savePomodoroState(s);
    });

    el.querySelector('#pom-task')?.addEventListener('change', (e) => {
      const s = getPomodoroState();
      s.linkedTaskId = (e.target as HTMLSelectElement).value || null;
      savePomodoroState(s);
    });

    ['pom-work', 'pom-break', 'pom-long'].forEach(id => {
      el.querySelector(`#${id}`)?.addEventListener('change', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value) || 25;
        const s = getPomodoroState();
        if (id === 'pom-work') s.workMinutes = val;
        else if (id === 'pom-break') s.breakMinutes = val;
        else s.longBreakMinutes = val;
        savePomodoroState(s);
      });
    });
  }

  render();
}

function renderPomodoroHistory(): string {
  const history = storage.get<PomodoroHistoryEntry[]>('pomodoroHistory', []);
  if (history.length === 0) return '<p style="font-size:13px;">No hay sesiones completadas aún.</p>';
  return '<div style="display:flex;flex-direction:column;gap:6px;">' +
    history.slice(0, 10).map(h => {
      const mins = Math.round(h.duration / 60);
      const date = new Date(h.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      return `<div class="task-item" style="padding:8px 12px;">
        <div class="task-info">
          <div class="task-title" style="font-size:13px;">${h.subject}${h.taskName ? ` · ${h.taskName}` : ''}</div>
          <div class="task-meta">${date} · ${mins}min estudio</div>
        </div>
      </div>`;
    }).join('') + '</div>';
}

// ===== CONVERSOR DE UNIDADES =====
function renderUnitConverter(el: HTMLElement) {
  const categories = [
    {
      name: 'Longitud',
      units: [
        { name: 'Metros', factor: 1 },
        { name: 'Kilómetros', factor: 1000 },
        { name: 'Centímetros', factor: 0.01 },
        { name: 'Milímetros', factor: 0.001 },
        { name: 'Millas', factor: 1609.344 },
        { name: 'Pies', factor: 0.3048 },
      ]
    },
    {
      name: 'Masa',
      units: [
        { name: 'Kilogramos', factor: 1 },
        { name: 'Gramos', factor: 0.001 },
        { name: 'Miligramos', factor: 0.000001 },
        { name: 'Libras', factor: 0.453592 },
        { name: 'Toneladas', factor: 1000 },
      ]
    },
    {
      name: 'Volumen',
      units: [
        { name: 'Litros', factor: 1 },
        { name: 'Mililitros', factor: 0.001 },
        { name: 'Metros³', factor: 1000 },
        { name: 'Centímetros³', factor: 0.001 },
      ]
    },
    {
      name: 'Temperatura',
      units: [
        { name: 'Celsius', factor: 0 },
        { name: 'Fahrenheit', factor: 0 },
        { name: 'Kelvin', factor: 0 },
      ]
    },
    {
      name: 'Velocidad',
      units: [
        { name: 'm/s', factor: 1 },
        { name: 'km/h', factor: 0.277778 },
        { name: 'mph', factor: 0.44704 },
        { name: 'Nudos', factor: 0.514444 },
      ]
    },
    {
      name: 'Energía',
      units: [
        { name: 'Julios', factor: 1 },
        { name: 'Kilojulios', factor: 1000 },
        { name: 'Calorías', factor: 4.184 },
        { name: 'Kilocalorías', factor: 4184 },
        { name: 'Electronvoltios', factor: 1.602e-19 },
      ]
    },
  ];

  let selectedCategory = 0;

  const render = () => {
    const cat = categories[selectedCategory];

    el.innerHTML = `
      <div class="glass-card">
        <h3>Conversor de unidades</h3>
        <div class="module-tabs" style="margin-top:8px;">
          ${categories.map((c, i) => `<button class="module-tab ${i === selectedCategory ? 'active' : ''}" data-cat="${i}">${c.name}</button>`).join('')}
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Valor</label>
            <input class="input" id="unit-value" type="number" step="any" placeholder="0" value="1">
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <select class="input" id="unit-from" style="flex:1;">
              ${cat.units.map((u, i) => `<option value="${i}">${u.name}</option>`).join('')}
            </select>
            <span style="font-size:20px;color:var(--accent);">→</span>
            <select class="input" id="unit-to" style="flex:1;">
              ${cat.units.map((u, i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>${u.name}</option>`).join('')}
            </select>
          </div>
          <div style="padding:16px;background:var(--accent-soft);border-radius:var(--radius-sm);text-align:center;">
            <div id="unit-result" style="font-family:var(--font-display);font-size:1.8rem;font-weight:700;color:var(--accent);">—</div>
          </div>
        </div>
      </div>`;

    const convert = () => {
      const value = parseFloat((el.querySelector('#unit-value') as HTMLInputElement)?.value || '0') || 0;
      const fromIdx = parseInt((el.querySelector('#unit-from') as HTMLSelectElement)?.value || '0');
      const toIdx = parseInt((el.querySelector('#unit-to') as HTMLSelectElement)?.value || '1');
      const resultEl = el.querySelector('#unit-result') as HTMLElement;

      if (cat.name === 'Temperatura') {
        let celsius: number;
        if (fromIdx === 0) celsius = value;
        else if (fromIdx === 1) celsius = (value - 32) * 5/9;
        else celsius = value - 273.15;

        let result: number;
        if (toIdx === 0) result = celsius;
        else if (toIdx === 1) result = celsius * 9/5 + 32;
        else result = celsius + 273.15;

        resultEl.textContent = result.toFixed(4);
      } else {
        const baseValue = value * cat.units[fromIdx].factor;
        const result = baseValue / cat.units[toIdx].factor;
        resultEl.textContent = result.toPrecision(6);
      }
    };

    el.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCategory = parseInt((btn as HTMLElement).dataset.cat!);
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

// ===== BLOC DE NOTAS =====
function renderNotes(el: HTMLElement) {
  const notes = storage.get<Note[]>('notes', []);
  const noteSubjects = ['General', ...SUBJECTS];
  let activeSubject = 'General';

  const render = () => {
    const note = notes.find(n => n.subject === activeSubject);

    el.innerHTML = `
      <div class="glass-card">
        <h3>Bloc de notas</h3>
        <div class="notes-subject-scroll" style="margin-top:8px;">
          <button class="scroll-arrow" id="notes-scroll-left">&#9664;</button>
          <div class="notes-subject-list" id="notes-subject-list">
            ${noteSubjects.map(s => `<button class="module-tab ${s === activeSubject ? 'active' : ''}" data-notefilter="${s}">${s}</button>`).join('')}
          </div>
          <button class="scroll-arrow" id="notes-scroll-right">&#9654;</button>
        </div>
      </div>
      <div class="glass-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:600;font-size:14px;">${activeSubject}</span>
          ${note ? `<span style="font-size:11px;color:var(--ink-muted);">${note.updated}</span>` : ''}
        </div>
        <textarea class="notes-textarea" id="notes-area" placeholder="Escribe tus notas aquí...">${note?.content || ''}</textarea>
      </div>`;

    el.querySelectorAll('[data-notefilter]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSubject = (btn as HTMLElement).dataset.notefilter!;
        render();
      });
    });

    const scrollList = el.querySelector('#notes-subject-list') as HTMLElement;
    const scrollLeftBtn = el.querySelector('#notes-scroll-left') as HTMLButtonElement;
    const scrollRightBtn = el.querySelector('#notes-scroll-right') as HTMLButtonElement;

    if (scrollList && scrollLeftBtn && scrollRightBtn) {
      const scrollAmount = 160;
      scrollLeftBtn.addEventListener('click', () => {
        scrollList.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      });
      scrollRightBtn.addEventListener('click', () => {
        scrollList.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      });
    }

    const textarea = el.querySelector('#notes-area') as HTMLTextAreaElement;
    let saveTimeout: number | null = null;

    textarea?.addEventListener('input', () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = window.setTimeout(() => {
        const content = textarea.value;
        const idx = notes.findIndex(n => n.subject === activeSubject);
        const now = new Date().toLocaleString('es-ES');
        if (idx >= 0) {
          notes[idx].content = content;
          notes[idx].updated = now;
        } else {
          notes.push({ id: Date.now().toString(36), subject: activeSubject, content, updated: now });
        }
        storage.set('notes', notes);
      }, 500);
    });
  };

  render();
}
