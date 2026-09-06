import { storage } from '../storage';
import { SUBJECTS } from '../subjects';

interface PauSubject {
  id: string;
  name: string;
  selected: boolean;
  topics: PauTopic[];
}

interface PauTopic {
  id: string;
  title: string;
  done: boolean;
  doneDate?: string;
}

interface ExamCountdown {
  id: string;
  name: string;
  date: string;
  subject: string;
}

interface CourseConfig {
  yearStart: string;
  pauDate: string;
  [key: string]: string;
}

const DEFAULT_SUBJECTS: PauSubject[] = SUBJECTS.map(name => ({
  id: name.toLowerCase().replace(/\s+/g, '_'),
  name,
  selected: false,
  topics: [],
}));

const DEFAULT_COURSE: CourseConfig = {
  yearStart: '2026-09-08',
  pauDate: '2027-06-08',
  tri1ExamStart: '', tri1ExamEnd: '', tri2ExamStart: '', tri2ExamEnd: '',
  tri3ExamStart: '', tri3ExamEnd: '', reviewStart: '', reviewEnd: '',
};

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(d: string): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function daysDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type SubTab = 'progreso' | 'temario' | 'cuentaatras' | 'examenes';

let subTab: SubTab = 'progreso';

export function renderPauPrep(el: HTMLElement) {
  const subjects = storage.get<PauSubject[]>('pauSubjects', DEFAULT_SUBJECTS);
  const cfg = storage.get<CourseConfig>('courseConfig', DEFAULT_COURSE);
  const exams = storage.get<ExamCountdown[]>('exams', []);

  el.innerHTML = `
    <h1>Preparación PAU</h1>
    <div class="module-tabs">
      <button class="module-tab ${subTab === 'progreso' ? 'active' : ''}" data-stab="progreso">Progreso</button>
      <button class="module-tab ${subTab === 'temario' ? 'active' : ''}" data-stab="temario">Temario</button>
      <button class="module-tab ${subTab === 'cuentaatras' ? 'active' : ''}" data-stab="cuentaatras">Cuenta atrás</button>
      <button class="module-tab ${subTab === 'examenes' ? 'active' : ''}" data-stab="examenes">Exámenes</button>
    </div>
    <div id="pau-content"></div>
  `;

  el.querySelectorAll('.module-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      subTab = (btn as HTMLElement).dataset.stab as SubTab;
      renderPauPrep(el);
    });
  });

  const content = el.querySelector('#pau-content')! as HTMLElement;
  switch (subTab) {
    case 'progreso': renderProgress(content, subjects, cfg); break;
    case 'temario': renderSyllabus(content, subjects); break;
    case 'cuentaatras': renderCountdown(content, subjects, cfg); break;
    case 'examenes': renderExamsView(content, subjects, exams, cfg); break;
  }
}

function renderProgress(el: HTMLElement, subjects: PauSubject[], cfg: CourseConfig) {
  const selected = subjects.filter(s => s.selected);
  const today = todayStr();
  const pauDate = cfg.pauDate || '2027-06-08';
  const yearStart = cfg.yearStart || '2026-09-08';

  const totalWeeks = Math.max(1, Math.ceil(daysDiff(yearStart, pauDate) / 7));
  const weeksPassed = Math.max(0, Math.ceil(daysDiff(yearStart, today) / 7));
  const weeksRemaining = Math.max(0, totalWeeks - weeksPassed);

  let html = '<div class="glass-card"><h3>Seleccionar asignaturas</h3>';
  html += '<p class="help-text">Elige las asignaturas que cursas. Solo aparecerán en el resto del módulo.</p>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
  subjects.forEach(s => {
    html += `<button class="btn ${s.selected ? 'btn-primary' : 'btn-secondary'} pau-subject-chip" data-toggle-subj="${s.id}" style="font-size:13px;padding:6px 14px;">${s.name}</button>`;
  });
  html += '</div></div>';

  if (selected.length === 0) {
    html += '<div class="glass-card"><div class="empty-state"><p>Selecciona asignaturas para ver tu progreso</p></div></div>';
    el.innerHTML = html;
    attachSubjectToggles(el, subjects, cfg);
    return;
  }

  let totalTopics = 0;
  let totalDone = 0;
  selected.forEach(s => { totalTopics += s.topics.length; totalDone += s.topics.filter(t => t.done).length; });
  const globalPct = totalTopics > 0 ? Math.round((totalDone / totalTopics) * 100) : 0;

  html += `<div class="glass-card"><h3>Progreso global</h3>`;
  html += `<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px;"><span style="font-size:2.5rem;font-weight:700;font-family:var(--font-display);color:var(--accent);">${globalPct}%</span><span style="font-size:13px;color:var(--ink-muted);">${totalDone} de ${totalTopics} temas completados</span></div>`;
  html += `<div class="tracker-bar" style="height:12px;"><div class="tracker-fill" style="width:${globalPct}%;"></div></div>`;
  html += '</div>';

  html += '<div class="glass-card"><h3>Progreso por asignatura</h3>';
  html += '<div style="display:flex;flex-direction:column;gap:14px;">';
  selected.forEach(s => {
    const done = s.topics.filter(t => t.done).length;
    const total = s.topics.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    let alert = '';
    if (weeksRemaining > 0 && total > 0 && done < total) {
      const remaining = total - done;
      const rate = remaining / weeksRemaining;
      if (rate > 1.5) alert = `<div class="pau-alert">⚠ Quedan ${weeksRemaining} semanas y ${remaining} temas pendientes — vas a un ritmo que no llega</div>`;
      else if (rate > 1) alert = `<div class="pau-alert pau-alert-warn">⚡ Quedan ${weeksRemaining} semanas y ${remaining} temas — ve ajustado</div>`;
    } else if (total === 0) {
      alert = `<div class="pau-alert pau-alert-info">ℹ Sin temas añadidos — ve a la pestaña Temario</div>`;
    }

    html += `<div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-weight:600;font-size:14px;">${s.name}</span>
        <span style="font-size:13px;color:var(--ink-muted);">${done}/${total} · ${pct}%</span>
      </div>
      <div class="tracker-bar"><div class="tracker-fill" style="width:${pct}%;"></div></div>
      ${alert}
    </div>`;
  });
  html += '</div></div>';

  html += `<div class="glass-card"><h3>Resumen temporal</h3>
    <p class="help-text">Las semanas se calculan desde el inicio del curso hasta la fecha de la PAU.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;">
      <div><div class="countdown-number" style="font-size:1.8rem;">${weeksPassed}</div><div class="countdown-label">Semanas transcurridas</div></div>
      <div><div class="countdown-number" style="font-size:1.8rem;">${weeksRemaining}</div><div class="countdown-label">Semanas restantes</div></div>
      <div><div class="countdown-number" style="font-size:1.8rem;">${totalWeeks}</div><div class="countdown-label">Total semanas curso</div></div>
    </div>
  </div>`;

  el.innerHTML = html;
  attachSubjectToggles(el, subjects, cfg);
}

function renderSyllabus(el: HTMLElement, subjects: PauSubject[]) {
  const selected = subjects.filter(s => s.selected);

  let html = '<div class="glass-card"><h3>Añadir tema</h3>';
  if (selected.length === 0) {
    html += '<p class="help-text">Primero selecciona asignaturas en la pestaña Progreso.</p>';
  } else {
    html += '<p class="help-text">Añade los temas del temario oficial de cada asignatura. Marca cada tema una vez que lo domines.</p>';
    html += `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <select class="input" id="pau-add-subj" style="flex:1;min-width:120px;">
        ${selected.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
      <input class="input" id="pau-add-topic" placeholder="Ej: Tema 1: Álgebra lineal" style="flex:2;min-width:200px;">
      <button class="btn btn-primary" id="pau-add-btn">Agregar</button>
    </div>`;
  }
  html += '</div>';

  if (selected.length === 0) {
    el.innerHTML = html;
    return;
  }

  selected.forEach(s => {
    const done = s.topics.filter(t => t.done).length;
    const total = s.topics.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    html += `<div class="glass-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h3 style="margin:0;">${s.name}</h3>
      <span style="font-size:13px;color:var(--ink-muted);">${done}/${total} · ${pct}%</span>
    </div>`;

    if (s.topics.length === 0) {
      html += '<p style="font-size:13px;">No hay temas añadidos.</p>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:6px;">';
      s.topics.forEach(t => {
        html += `<div class="task-item" style="padding:8px 12px;">
          <div class="task-checkbox ${t.done ? 'checked' : ''}" data-toggle-topic="${s.id}" data-topic-id="${t.id}"></div>
          <div class="task-info">
            <div class="task-title ${t.done ? 'done' : ''}" style="font-size:13px;">${t.title}</div>
            ${t.done && t.doneDate ? `<div class="task-meta">Completado ${fmtDate(t.doneDate)}</div>` : ''}
          </div>
          <button class="btn btn-ghost" style="font-size:11px;" data-del-topic="${s.id}" data-topic-id="${t.id}">×</button>
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';
  });

  el.innerHTML = html;

  el.querySelector('#pau-add-btn')?.addEventListener('click', () => {
    const subjId = (el.querySelector('#pau-add-subj') as HTMLSelectElement).value;
    const title = (el.querySelector('#pau-add-topic') as HTMLInputElement).value.trim();
    if (!title) return;
    const subj = subjects.find(s => s.id === subjId);
    if (subj) {
      subj.topics.push({ id: genId(), title, done: false });
      storage.set('pauSubjects', subjects);
      renderSyllabus(el, subjects);
    }
  });

  el.querySelectorAll('[data-toggle-topic]').forEach(cb => {
    cb.addEventListener('click', () => {
      const subjId = (cb as HTMLElement).dataset.toggleTopic!;
      const topicId = (cb as HTMLElement).dataset.topicId!;
      const subj = subjects.find(s => s.id === subjId);
      if (subj) {
        const topic = subj.topics.find(t => t.id === topicId);
        if (topic) {
          topic.done = !topic.done;
          topic.doneDate = topic.done ? todayStr() : undefined;
          storage.set('pauSubjects', subjects);
          renderSyllabus(el, subjects);
        }
      }
    });
  });

  el.querySelectorAll('[data-del-topic]').forEach(btn => {
    btn.addEventListener('click', () => {
      const subjId = (btn as HTMLElement).dataset.delTopic!;
      const topicId = (btn as HTMLElement).dataset.topicId!;
      const subj = subjects.find(s => s.id === subjId);
      if (subj) {
        subj.topics = subj.topics.filter(t => t.id !== topicId);
        storage.set('pauSubjects', subjects);
        renderSyllabus(el, subjects);
      }
    });
  });
}

function renderCountdown(el: HTMLElement, subjects: PauSubject[], cfg: CourseConfig) {
  const today = todayStr();
  const pauDate = cfg.pauDate || '2027-06-08';
  const yearStart = cfg.yearStart || '2026-09-08';
  const daysLeft = daysDiff(today, pauDate);
  const totalDays = daysDiff(yearStart, pauDate);
  const elapsed = Math.max(0, totalDays - daysLeft);
  const pct = totalDays > 0 ? Math.round((elapsed / totalDays) * 100) : 0;

  let html = `<div class="glass-card" style="text-align:center;">
    <h3>Cuenta atrás para la PAU</h3>
    <p class="help-text">La fecha de la PAU se configura en Calendario → ⚙ Curso.</p>
    <div class="countdown-number" style="margin:24px 0;">${daysLeft >= 0 ? daysLeft : 0}</div>
    <div class="countdown-label" style="font-size:14px;">${daysLeft === 0 ? '¡Hoy es la PAU!' : daysLeft > 0 ? 'días restantes' : 'La PAU ya pasó'}</div>
    <div style="font-size:13px;color:var(--ink-muted);margin-top:8px;">${fmtDate(pauDate)}</div>
    <div class="tracker-bar" style="height:10px;margin-top:16px;"><div class="tracker-fill" style="width:${pct}%;"></div></div>
    <div style="font-size:11px;color:var(--ink-muted);margin-top:4px;">${pct}% del curso completado</div>
  </div>`;

  const selected = subjects.filter(s => s.selected);
  if (selected.length > 0) {
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    const weeksRemaining = Math.max(1, Math.ceil(daysLeft / 7));

    html += '<div class="glass-card"><h3>Alertas de ritmo</h3>';
    html += '<p class="help-text">Se calcula cuántos temas semanales necesitas completar para llegar a tiempo.</p>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    let hasAlerts = false;

    selected.forEach(s => {
      const total = s.topics.length;
      const done = s.topics.filter(t => t.done).length;
      if (total === 0) return;
      const remaining = total - done;
      if (remaining <= 0) return;
      const rate = remaining / weeksRemaining;
      const needed = Math.ceil(remaining / weeksRemaining);

      hasAlerts = true;
      let cls = 'pau-alert pau-alert-ok';
      let msg = '';
      if (rate > 1.5) {
        cls = 'pau-alert';
        msg = `${s.name}: quedan ${remaining} temas en ${weeksRemaining} semanas — necesitas ${needed}/semana. <strong>No llegas.</strong>`;
      } else if (rate > 1) {
        cls = 'pau-alert pau-alert-warn';
        msg = `${s.name}: quedan ${remaining} temas en ${weeksRemaining} semanas — necesitas ${needed}/semana. <strong>Ajustado.</strong>`;
      } else {
        msg = `${s.name}: quedan ${remaining} temas en ${weeksRemaining} semanas — necesitas ${needed}/semana. <strong>Vas bien.</strong>`;
      }
      html += `<div class="${cls}">${msg}</div>`;
    });

    if (!hasAlerts) {
      html += '<p style="font-size:13px;">Todas las asignaturas están al día o no tienen temas.</p>';
    }
    html += '</div></div>';
  }

  el.innerHTML = html;
}

function renderExamsView(el: HTMLElement, subjects: PauSubject[], exams: ExamCountdown[], cfg: CourseConfig) {
  const selected = subjects.filter(s => s.selected).map(s => s.name);
  const today = todayStr();

  let html = '<div class="glass-card"><h3>Exámenes de trimestre</h3>';
  html += '<p class="help-text">Los exámenes se añaden en Organizar → Exámenes. Aquí se filtran por las asignaturas seleccionadas.</p>';
  const filtered = exams.filter(e => selected.length === 0 || selected.includes(e.subject))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (filtered.length === 0) {
    html += '<p style="font-size:13px;">No hay exámenes. Añade exámenes en Organizar → Exámenes.</p>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    filtered.forEach(ex => {
      const daysLeft = daysDiff(today, ex.date);
      const urgent = daysLeft >= 0 && daysLeft <= 3;
      html += `<div class="task-item">
        <div style="width:4px;height:32px;border-radius:2px;background:${urgent ? '#e74c3c' : 'var(--accent)'};flex-shrink:0;"></div>
        <div class="task-info">
          <div class="task-title">${ex.name}</div>
          <div class="task-meta">${ex.subject} · ${fmtDate(ex.date)}${daysLeft >= 0 ? ` · <strong>${daysLeft} días</strong>` : ' · <span style="color:#e74c3c;">Pasado</span>'}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  html += `<div class="glass-card"><h3>PAU</h3>
    <p class="help-text">La fecha oficial de la PAU se configura en Calendario → ⚙ Curso. La preparación continua incluye repaso de temario y tests.</p>
    <div class="task-item">
      <div style="width:4px;height:32px;border-radius:2px;background:#e74c3c;flex-shrink:0;"></div>
      <div class="task-info">
        <div class="task-title">Examen PAU</div>
        <div class="task-meta">${fmtDate(cfg.pauDate || '2027-06-08')} · Preparación continua</div>
      </div>
    </div>
  </div>`;

  el.innerHTML = html;
}

function attachSubjectToggles(el: HTMLElement, subjects: PauSubject[], cfg: CourseConfig) {
  el.querySelectorAll('[data-toggle-subj]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.toggleSubj!;
      const subj = subjects.find(s => s.id === id);
      if (subj) {
        subj.selected = !subj.selected;
        storage.set('pauSubjects', subjects);
        renderPauPrep(el.closest('#main-content')!);
      }
    });
  });
}
