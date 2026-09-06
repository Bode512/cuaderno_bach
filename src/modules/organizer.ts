import { storage } from '../storage';
import { SUBJECTS } from '../subjects';

interface ScheduleSlot {
  day: number;
  hour: number;
  subject: string;
}

interface Task {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  done: boolean;
}

interface ExamCountdown {
  id: string;
  name: string;
  date: string;
  subject: string;
}

interface StudySession {
  id: string;
  subject: string;
  date: string;
  hours: number;
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const HOURS = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(d: string): string {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function daysUntil(d: string): number {
  const now = new Date();
  now.setHours(0,0,0,0);
  const target = new Date(d + 'T00:00:00');
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

type SubTab = 'horario' | 'tareas' | 'examenes' | 'horas' | 'copia';

let subTab: SubTab = 'horario';

const ALL_STORAGE_KEYS = [
  'theme', 'lastTab', 'schedule', 'tasks', 'exams', 'study',
  'calendar', 'grades', 'flashcards', 'customFormulas', 'notes',
  'courseConfig', 'pauSubjects', 'backupReminder',
];

export function renderOrganizer(el: HTMLElement) {
  el.innerHTML = `
    <h1>Organizar</h1>
    <div class="module-tabs">
      <button class="module-tab ${subTab==='horario'?'active':''}" data-stab="horario">Horario</button>
      <button class="module-tab ${subTab==='tareas'?'active':''}" data-stab="tareas">Tareas</button>
      <button class="module-tab ${subTab==='examenes'?'active':''}" data-stab="examenes">Exámenes</button>
      <button class="module-tab ${subTab==='horas'?'active':''}" data-stab="horas">Horas</button>
      <button class="module-tab ${subTab==='copia'?'active':''}" data-stab="copia">Copia</button>
    </div>
    <div id="organizer-content"></div>
  `;

  el.querySelectorAll('.module-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      subTab = (btn as HTMLElement).dataset.stab as SubTab;
      renderOrganizer(el);
    });
  });

  const content = el.querySelector('#organizer-content')! as HTMLElement;
  switch (subTab) {
    case 'horario': renderSchedule(content); break;
    case 'tareas': renderTasks(content); break;
    case 'examenes': renderExams(content); break;
    case 'horas': renderStudyTracker(content); break;
    case 'copia': renderBackup(content); break;
  }
}

function renderSchedule(el: HTMLElement) {
  const schedule = storage.get<ScheduleSlot[]>('schedule', []);

  let html = `<div class="glass-card"><div class="schedule-grid">`;
  html += `<div class="schedule-cell"></div>`;
  DAYS.forEach(d => { html += `<div class="schedule-cell day-header">${d}</div>`; });

  HOURS.forEach((h, hi) => {
    html += `<div class="schedule-cell time-label">${h}</div>`;
    DAYS.forEach((_, di) => {
      const slot = schedule.find(s => s.day === di && s.hour === hi);
      html += `<div class="schedule-cell ${slot ? 'filled' : ''}" data-day="${di}" data-hour="${hi}" title="${slot?.subject || 'Vacío'}">${slot ? slot.subject.slice(0, 6) : ''}</div>`;
    });
  });

  html += `</div></div>`;

  html += `<div class="glass-card"><h3>Agregar asignatura al horario</h3>
    <div class="glass-form-row" style="margin-top:12px;">
      <select class="input" id="sched-subject" style="flex:1;min-width:130px;">
        ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select class="input" id="sched-day" style="width:auto;">
        ${DAYS.map((d,i) => `<option value="${i}">${d}</option>`).join('')}
      </select>
      <select class="input" id="sched-hour" style="width:auto;">
        ${HOURS.map((h,i) => `<option value="${i}">${h}</option>`).join('')}
      </select>
      <button class="btn btn-primary" id="sched-add">Agregar</button>
    </div>
  </div>`;

  el.innerHTML = html;

  el.querySelectorAll('.schedule-cell[data-day]').forEach(cell => {
    cell.addEventListener('click', () => {
      const day = parseInt((cell as HTMLElement).dataset.day!);
      const hour = parseInt((cell as HTMLElement).dataset.hour!);
      const idx = schedule.findIndex(s => s.day === day && s.hour === hour);
      if (idx >= 0) {
        schedule.splice(idx, 1);
      } else {
        const subject = (el.querySelector('#sched-subject') as HTMLSelectElement).value;
        schedule.push({ day, hour, subject });
      }
      storage.set('schedule', schedule);
      renderSchedule(el);
    });
  });

  el.querySelector('#sched-add')?.addEventListener('click', () => {
    const subject = (el.querySelector('#sched-subject') as HTMLSelectElement).value;
    const day = parseInt((el.querySelector('#sched-day') as HTMLSelectElement).value);
    const hour = parseInt((el.querySelector('#sched-hour') as HTMLSelectElement).value);
    const existing = schedule.findIndex(s => s.day === day && s.hour === hour);
    if (existing >= 0) schedule[existing].subject = subject;
    else schedule.push({ day, hour, subject });
    storage.set('schedule', schedule);
    renderSchedule(el);
  });
}

function renderTasks(el: HTMLElement) {
  const tasks = storage.get<Task[]>('tasks', []);

  let html = `<div class="glass-card">
    <div class="section-header"><h3>Tareas pendientes</h3><span class="badge">${tasks.filter(t => !t.done).length}</span></div>`;

  if (tasks.length === 0) {
    html += `<div class="empty-state"><p>No tienes tareas aún</p></div>`;
  } else {
    const sorted = [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
    sorted.forEach(t => {
      const days = daysUntil(t.deadline);
      const urgent = !t.done && days <= 2 && days >= 0;
      const overdue = !t.done && days < 0;
      html += `<div class="task-item">
        <div class="task-checkbox ${t.done ? 'checked' : ''}" data-id="${t.id}"></div>
        <div class="task-info">
          <div class="task-title ${t.done ? 'done' : ''}">${t.title}</div>
          <div class="task-meta">${t.subject} · ${formatDate(t.deadline)}${overdue ? ' <span class="badge badge-danger">Vencida</span>' : urgent ? ' <span class="badge badge-warning">Urgente</span>' : ''}</div>
        </div>
        <div class="task-actions"><button class="delete" data-id="${t.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
      </div>`;
    });
  }

  html += `</div><div class="glass-card"><h3>Nueva tarea</h3>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
      <input class="input" id="task-title" placeholder="Nombre de la tarea">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select class="input" id="task-subject" style="width:auto;flex:1;min-width:120px;">
          ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <input class="input" id="task-deadline" type="date" style="width:auto;">
        <button class="btn btn-primary" id="task-add">Agregar</button>
      </div>
    </div>
  </div>`;

  el.innerHTML = html;

  el.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('click', () => {
      const id = (cb as HTMLElement).dataset.id!;
      const task = tasks.find(t => t.id === id);
      if (task) { task.done = !task.done; storage.set('tasks', tasks); renderTasks(el); }
    });
  });

  el.querySelectorAll('.task-actions .delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      const idx = tasks.findIndex(t => t.id === id);
      if (idx >= 0) { tasks.splice(idx, 1); storage.set('tasks', tasks); renderTasks(el); }
    });
  });

  el.querySelector('#task-add')?.addEventListener('click', () => {
    const title = (el.querySelector('#task-title') as HTMLInputElement).value.trim();
    const subject = (el.querySelector('#task-subject') as HTMLSelectElement).value;
    const deadline = (el.querySelector('#task-deadline') as HTMLInputElement).value;
    if (!title || !deadline) return;
    tasks.push({ id: genId(), title, subject, deadline, done: false });
    storage.set('tasks', tasks);
    renderTasks(el);
  });
}

function renderExams(el: HTMLElement) {
  const exams = storage.get<ExamCountdown[]>('exams', []);

  let html = `<div class="glass-card">
    <div class="section-header"><h3>Próximos exámenes</h3></div>`;

  if (exams.length === 0) {
    html += `<div class="empty-state"><p>No hay exámenes programados</p></div>`;
  } else {
    const sorted = [...exams].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    html += `<div class="grid-3">`;
    sorted.forEach(ex => {
      const days = daysUntil(ex.date);
      const urgent = days <= 3 && days >= 0;
      html += `<div class="glass-card" style="text-align:center;padding:16px;">
        <div style="font-size:12px;font-weight:600;color:var(--ink-muted);margin-bottom:4px;">${ex.subject}</div>
        <div style="font-weight:600;margin-bottom:8px;">${ex.name}</div>
        <div class="countdown-number" style="${urgent ? 'color:#e74c3c;' : ''}">${days >= 0 ? days : 0}</div>
        <div class="countdown-label">${days === 0 ? '¡Hoy!' : days === 1 ? 'día' : 'días'}</div>
        <div style="font-size:11px;color:var(--ink-muted);margin-top:4px;">${formatDate(ex.date)}</div>
        <button class="btn btn-ghost" style="margin-top:8px;font-size:11px;" data-del="${ex.id}">Eliminar</button>
      </div>`;
    });
    html += `</div>`;
  }

  html += `</div><div class="glass-card"><h3>Agregar examen</h3>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <input class="input" id="exam-name" placeholder="Nombre" style="flex:1;min-width:120px;">
      <select class="input" id="exam-subject" style="width:auto;">
        ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <input class="input" id="exam-date" type="date" style="width:auto;">
      <button class="btn btn-primary" id="exam-add">Agregar</button>
    </div>
  </div>`;

  el.innerHTML = html;

  el.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.del!;
      const idx = exams.findIndex(e => e.id === id);
      if (idx >= 0) { exams.splice(idx, 1); storage.set('exams', exams); renderExams(el); }
    });
  });

  el.querySelector('#exam-add')?.addEventListener('click', () => {
    const name = (el.querySelector('#exam-name') as HTMLInputElement).value.trim();
    const subject = (el.querySelector('#exam-subject') as HTMLSelectElement).value;
    const date = (el.querySelector('#exam-date') as HTMLInputElement).value;
    if (!name || !date) return;
    exams.push({ id: genId(), name, date, subject });
    storage.set('exams', exams);
    renderExams(el);
  });
}

function renderStudyTracker(el: HTMLElement) {
  const sessions = storage.get<StudySession[]>('study', []);
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekStr = weekStart.toISOString().slice(0, 10);

  const weekSessions = sessions.filter(s => s.date >= weekStr);
  const totals: Record<string, number> = {};
  SUBJECTS.forEach(s => totals[s] = 0);
  weekSessions.forEach(s => { totals[s.subject] = (totals[s.subject] || 0) + s.hours; });
  const maxHours = Math.max(...Object.values(totals), 1);

  let html = `<div class="glass-card"><h3>Horas esta semana</h3>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">`;

  SUBJECTS.forEach(s => {
    const h = totals[s] || 0;
    if (h > 0 || sessions.some(sess => sess.subject === s)) {
      html += `<div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span>${s}</span><span style="font-weight:600;">${h.toFixed(1)}h</span>
        </div>
        <div class="tracker-bar"><div class="tracker-fill" style="width:${(h/maxHours)*100}%;"></div></div>
      </div>`;
    }
  });

  html += `</div></div>`;

  html += `<div class="glass-card"><h3>Registrar sesión</h3>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <select class="input" id="study-subject" style="width:auto;flex:1;min-width:120px;">
        ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <input class="input" id="study-hours" type="number" min="0.5" step="0.5" value="1" style="width:80px;">
      <input class="input" id="study-date" type="date" value="${today}" style="width:auto;">
      <button class="btn btn-primary" id="study-add">Registrar</button>
    </div>
  </div>`;

  html += `<div class="glass-card"><h3>Sesiones recientes</h3>`;
  const recent = [...sessions].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (recent.length === 0) {
    html += `<p style="font-size:13px;">No hay sesiones registradas</p>`;
  } else {
    recent.forEach(s => {
      html += `<div class="task-item">
        <div class="task-info">
          <div class="task-title">${s.subject}</div>
          <div class="task-meta">${formatDate(s.date)} · ${s.hours}h</div>
        </div>
        <button class="btn btn-ghost" style="font-size:11px;" data-del-study="${s.id}">×</button>
      </div>`;
    });
  }
  html += `</div>`;

  el.innerHTML = html;

  el.querySelectorAll('[data-del-study]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.delStudy!;
      const idx = sessions.findIndex(s => s.id === id);
      if (idx >= 0) { sessions.splice(idx, 1); storage.set('study', sessions); renderStudyTracker(el); }
    });
  });

  el.querySelector('#study-add')?.addEventListener('click', () => {
    const subject = (el.querySelector('#study-subject') as HTMLSelectElement).value;
    const hours = parseFloat((el.querySelector('#study-hours') as HTMLInputElement).value) || 1;
    const date = (el.querySelector('#study-date') as HTMLInputElement).value;
    sessions.push({ id: genId(), subject, date, hours });
    storage.set('study', sessions);
    renderStudyTracker(el);
  });
}

function renderBackup(el: HTMLElement) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  let html = `<div class="glass-card">
    <h3>Copia de seguridad</h3>
    <p style="font-size:13px;margin-bottom:16px;">
      Esta app almacena todos los datos en el navegador (localStorage). Si borras la caché del navegador, pierdes los datos.
      Haz copias de seguridad periódicas para no perder nada.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-primary" id="backup-export">💾 Exportar copia de seguridad</button>
      <button class="btn btn-secondary" id="backup-import-btn">📂 Importar copia de seguridad</button>
      <input type="file" id="backup-import-input" accept=".json" style="display:none;">
    </div>
  </div>`;

  html += `<div class="glass-card">
    <h3>Datos actuales</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">`;
  ALL_STORAGE_KEYS.forEach(key => {
    const val = localStorage.getItem('bachi_' + key);
    const size = val ? (new Blob([val]).size / 1024).toFixed(1) : '0';
    html += `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--border-subtle);">
      <span style="color:var(--ink-muted);">${key}</span><span style="font-weight:500;">${size} KB</span>
    </div>`;
  });
  html += '</div></div>';

  html += `<div class="glass-card">
    <h3>Advertencia importante</h3>
    <p style="font-size:13px;">
      Esta app se aloja en Vercel (plan gratuito) como sitio estático. <strong>No hay base de datos en servidor.</strong>
      Todos viven en el navegador del usuario. Borrar caché del navegador borra los datos si no hay backup.
      Exporta regularmente tu copia de seguridad.
    </p>
  </div>`;

  el.innerHTML = html;

  el.querySelector('#backup-export')?.addEventListener('click', () => {
    const data: Record<string, unknown> = {};
    ALL_STORAGE_KEYS.forEach(key => {
      const val = localStorage.getItem('bachi_' + key);
      if (val !== null) data[key] = JSON.parse(val);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuaderno-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  el.querySelector('#backup-import-btn')?.addEventListener('click', () => {
    (el.querySelector('#backup-import-input') as HTMLInputElement).click();
  });

  el.querySelector('#backup-import-input')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!confirm('¿Seguro que quieres restaurar esta copia de seguridad? Se sobrescribirán todos los datos actuales.')) return;
        ALL_STORAGE_KEYS.forEach(key => {
          if (data[key] !== undefined) {
            localStorage.setItem('bachi_' + key, JSON.stringify(data[key]));
          }
        });
        alert('Copia de seguridad restaurada. Recarga la página para ver los cambios.');
        window.location.reload();
      } catch {
        alert('Error al leer el archivo. Asegúrate de que es un archivo de backup válido.');
      }
    };
    reader.readAsText(file);
  });
}
