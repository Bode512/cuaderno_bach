import { storage } from '../storage';

// Types
interface Note {
  id: string;
  subject: string;
  content: string;
  updated: string;
}

type SubTab = 'pomodoro' | 'unidades' | 'notas';

let subTab: SubTab = 'pomodoro';

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

// ===== Feature 14: Pomodoro =====
function renderPomodoro(el: HTMLElement) {
  let workMinutes = 25;
  let breakMinutes = 5;
  let longBreakMinutes = 15;
  let timeLeft = workMinutes * 60;
  let isRunning = false;
  let isBreak = false;
  let pomodoroCount = 0;
  let interval: number | null = null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const render = () => {
    el.innerHTML = `
      <div class="glass-card" style="text-align:center;">
        <h3>Pomodoro</h3>
        <p style="font-size:13px;margin-bottom:8px;">${isBreak ? (pomodoroCount % 4 === 0 ? 'Descanso largo' : 'Descanso corto') : 'Tiempo de estudio'}</p>
        <div class="pomodoro-display">${formatTime(timeLeft)}</div>
        <div style="font-size:13px;color:var(--ink-muted);margin-bottom:16px;">Pomodoros completados: ${pomodoroCount}</div>
        <div class="pomodoro-controls">
          <button class="btn btn-primary" id="pom-toggle">${isRunning ? 'Pausar' : 'Iniciar'}</button>
          <button class="btn btn-secondary" id="pom-reset">Reiniciar</button>
        </div>
      </div>
      <div class="glass-card">
        <h3>Configuración</h3>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label style="font-size:13px;">Estudio (min)</label>
            <input class="input" id="pom-work" type="number" min="1" max="60" value="${workMinutes}" style="width:70px;text-align:center;">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label style="font-size:13px;">Descanso corto (min)</label>
            <input class="input" id="pom-break" type="number" min="1" max="30" value="${breakMinutes}" style="width:70px;text-align:center;">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label style="font-size:13px;">Descanso largo (min)</label>
            <input class="input" id="pom-long" type="number" min="1" max="60" value="${longBreakMinutes}" style="width:70px;text-align:center;">
          </div>
        </div>
      </div>`;

    el.querySelector('#pom-toggle')?.addEventListener('click', () => {
      if (isRunning) {
        if (interval) clearInterval(interval);
        isRunning = false;
      } else {
        isRunning = true;
        interval = window.setInterval(() => {
          timeLeft--;
          if (timeLeft <= 0) {
            if (interval) clearInterval(interval);
            isRunning = false;
            if (isBreak) {
              isBreak = false;
              timeLeft = workMinutes * 60;
            } else {
              pomodoroCount++;
              if (pomodoroCount % 4 === 0) {
                timeLeft = longBreakMinutes * 60;
              } else {
                timeLeft = breakMinutes * 60;
              }
              isBreak = true;
            }
            render();
          } else {
            const display = el.querySelector('.pomodoro-display');
            if (display) display.textContent = formatTime(timeLeft);
          }
        }, 1000);
      }
      render();
    });

    el.querySelector('#pom-reset')?.addEventListener('click', () => {
      if (interval) clearInterval(interval);
      isRunning = false;
      isBreak = false;
      timeLeft = workMinutes * 60;
      render();
    });

    ['pom-work', 'pom-break', 'pom-long'].forEach(id => {
      el.querySelector(`#${id}`)?.addEventListener('change', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value) || 25;
        if (id === 'pom-work') workMinutes = val;
        else if (id === 'pom-break') breakMinutes = val;
        else longBreakMinutes = val;
      });
    });
  };

  render();
}

// ===== Feature 15: Conversor de unidades =====
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

// ===== Feature 16: Bloc de notas =====
function renderNotes(el: HTMLElement) {
  const notes = storage.get<Note[]>('notes', []);
  const subjects = ['General', 'Valenciano','Lengua Castellana','Física','Química','Historia','Filosofía','Matemáticas','Tecnología','Biología'];
  let activeSubject = 'General';

  const render = () => {
    const note = notes.find(n => n.subject === activeSubject);

    el.innerHTML = `
      <div class="glass-card">
        <h3>Bloc de notas</h3>
        <div class="module-tabs" style="margin-top:8px;">
          ${subjects.map(s => `<button class="module-tab ${s === activeSubject ? 'active' : ''}" data-notefilter="${s}">${s}</button>`).join('')}
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
