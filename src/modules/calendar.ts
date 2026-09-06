import { storage } from '../storage';
import { SUBJECTS, SUBJECT_COLORS } from '../subjects';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  subject: string;
  type: 'entrega' | 'trabajo' | 'examen' | 'evento' | 'recordatorio';
  color: string;
  isTask: boolean;
}

interface Task {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  done: boolean;
}

interface CourseConfig {
  yearStart: string;
  tri1ExamStart: string;
  tri1ExamEnd: string;
  tri2ExamStart: string;
  tri2ExamEnd: string;
  tri3ExamStart: string;
  tri3ExamEnd: string;
  reviewStart: string;
  reviewEnd: string;
  pauDate: string;
}

type CalendarView = 'month' | 'week' | '3day' | 'day';

const EVENT_TYPE_COLORS: Record<string, string> = {
  'examen': '#e74c3c',
  'entrega': '#f39c12',
  'trabajo': '#3498db',
  'evento': '#95a5a6',
  'recordatorio': '#9b59b6',
};

const PRESET_COLORS = [
  '#6C5CE7','#00B894','#E17055','#FDCB6E','#E84393',
  '#0984E3','#D63031','#00CEC9','#55EFC4','#e74c3c',
  '#f39c12','#3498db','#95a5a6','#9b59b6','#1abc9c',
];

const DEFAULT_COURSE: CourseConfig = {
  yearStart: '2026-09-08',
  tri1ExamStart: '2026-12-15',
  tri1ExamEnd: '2026-12-23',
  tri2ExamStart: '2027-03-15',
  tri2ExamEnd: '2027-03-23',
  tri3ExamStart: '2027-05-25',
  tri3ExamEnd: '2027-06-04',
  reviewStart: '2027-05-01',
  reviewEnd: '2027-05-24',
  pauDate: '2027-06-08',
};

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DAY_NAMES_FULL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

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

function ds(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getMonday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  r.setDate(r.getDate() + diff);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateStrFromDate(d: Date): string {
  return ds(d.getFullYear(), d.getMonth(), d.getDate());
}

function eventsOnDate(events: CalendarEvent[], dateStr: string): CalendarEvent[] {
  return events.filter(e => {
    const end = e.endDate || e.date;
    return e.date <= dateStr && end >= dateStr;
  });
}

function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

function getTriName(cfg: CourseConfig, today: string): string {
  if (today < cfg.yearStart) return 'Antes del curso';
  if (today >= cfg.reviewStart && today <= cfg.reviewEnd) return 'Repaso PAU';
  if (today >= cfg.tri1ExamStart && today <= cfg.tri1ExamEnd) return 'Exámenes 1º Trimestre';
  if (today >= cfg.tri2ExamStart && today <= cfg.tri2ExamEnd) return 'Exámenes 2º Trimestre';
  if (today >= cfg.tri3ExamStart && today <= cfg.tri3ExamEnd) return 'Exámenes 3º Trimestre';
  if (today >= cfg.yearStart && today < cfg.tri1ExamStart) return '1º Trimestre';
  if (today > cfg.tri1ExamEnd && today < cfg.tri2ExamStart) return '2º Trimestre';
  if (today > cfg.tri2ExamEnd && today < cfg.reviewStart) return '3º Trimestre';
  if (today > cfg.reviewEnd && today < cfg.pauDate) return 'Pre-PAU';
  if (today === cfg.pauDate) return '¡PAU!';
  if (today > cfg.pauDate) return 'Post-PAU';
  return '';
}

export function renderCalendar(el: HTMLElement) {
  const cfg = storage.get<CourseConfig>('courseConfig', DEFAULT_COURSE);
  const today = new Date();
  const todayStr = dateStrFromDate(today);

  let view: CalendarView = 'month';
  let viewDate = new Date(today);
  let dragStart: string | null = null;
  let dragEnd: string | null = null;

  function getEvents(): CalendarEvent[] {
    const evs = storage.get<CalendarEvent[]>('calendar', []);
    const tks = storage.get<Task[]>('tasks', []);
    tks.forEach(t => {
      if (!evs.find(e => e.isTask && e.id === t.id)) {
        evs.push({
          id: t.id, title: t.title, date: t.deadline, subject: t.subject,
          type: 'entrega', color: SUBJECT_COLORS[t.subject] || '#6C5CE7', isTask: true,
        });
      }
    });
    return evs;
  }

  function save(evs: CalendarEvent[]) {
    const tasks2 = storage.get<Task[]>('tasks', []);
    evs.forEach(e => {
      if (e.isTask) {
        const idx = tasks2.findIndex(t => t.id === e.id);
        if (idx >= 0) { tasks2[idx].title = e.title; tasks2[idx].subject = e.subject; tasks2[idx].deadline = e.date; }
        else tasks2.push({ id: e.id, title: e.title, subject: e.subject, deadline: e.date, done: false });
      }
    });
    storage.set('tasks', tasks2);
    storage.set('calendar', evs);
  }

  const render = () => {
    const evs = getEvents();
    let html = '<h1>Calendario</h1>';
    html += renderBanner(cfg, todayStr);
    html += renderViewSwitcher(view);
    html += renderNav(view, viewDate);
    switch (view) {
      case 'month': html += renderMonth(evs, cfg); break;
      case 'week': html += renderTimeView(evs, 7); break;
      case '3day': html += renderTimeView(evs, 3); break;
      case 'day': html += renderTimeView(evs, 1); break;
    }
    html += renderQuickForm();
    html += renderEventList(evs);
    el.innerHTML = html;
    attachEvents(evs);
  };

  function renderBanner(cfg: CourseConfig, today: string): string {
    const tri = getTriName(cfg, today);
    const pauLeft = daysDiff(today, cfg.pauDate);
    let s = `<div class="glass-card cal-banner"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">`;
    s += `<div><span style="font-weight:600;">${tri}</span>`;
    if (pauLeft > 0) s += `<span style="margin-left:12px;font-size:13px;color:var(--ink-muted);">PAU: <strong style="color:var(--accent);">${pauLeft} días</strong></span>`;
    else if (pauLeft === 0) s += `<span style="margin-left:12px;font-size:13px;color:#e74c3c;font-weight:700;">¡Hoy es la PAU!</span>`;
    s += `</div><button class="btn btn-ghost" id="cal-cfg-btn" style="font-size:12px;padding:4px 10px;">⚙ Curso</button></div></div>`;
    return s;
  }

  function renderViewSwitcher(current: CalendarView): string {
    const views: { id: CalendarView; label: string }[] = [
      { id: 'month', label: 'Mes' }, { id: 'week', label: 'Semana' },
      { id: '3day', label: '3 días' }, { id: 'day', label: 'Día' },
    ];
    return `<div class="cal-view-switcher">${views.map(v =>
      `<button class="cal-view-btn ${v.id === current ? 'active' : ''}" data-view="${v.id}">${v.label}</button>`
    ).join('')}</div>`;
  }

  function renderNav(v: CalendarView, vd: Date): string {
    let label = '';
    if (v === 'month') label = `${MONTH_NAMES[vd.getMonth()]} ${vd.getFullYear()}`;
    else if (v === 'week') {
      const mon = getMonday(vd);
      const sun = addDays(mon, 6);
      label = `${fmtDate(dateStrFromDate(mon))} – ${fmtDate(dateStrFromDate(sun))}`;
    } else if (v === '3day') {
      label = `${DAY_NAMES_FULL[(vd.getDay() + 6) % 7]} ${vd.getDate()} – ${DAY_NAMES_FULL[(addDays(vd, 2).getDay() + 6) % 7]} ${addDays(vd, 2).getDate()}`;
    } else {
      label = `${DAY_NAMES_FULL[(vd.getDay() + 6) % 7]} ${vd.getDate()} de ${MONTH_NAMES[vd.getMonth()]}`;
    }
    return `<div class="glass-card" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">
      <button class="btn btn-ghost" id="cal-prev" style="padding:8px 12px;">&#9664;</button>
      <div style="display:flex;align-items:center;gap:12px;">
        <h3 style="margin:0;text-transform:capitalize;font-size:1rem;">${label}</h3>
        <button class="btn btn-secondary" id="cal-today" style="font-size:12px;padding:4px 12px;">Hoy</button>
      </div>
      <button class="btn btn-ghost" id="cal-next" style="padding:8px 12px;">&#9654;</button>
    </div>`;
  }

  function renderMonth(evs: CalendarEvent[], cfg: CourseConfig): string {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const offset = (firstDay + 6) % 7;

    let s = '<div class="glass-card"><div class="cal-grid">';
    s += DAY_NAMES.map(d => `<div class="cal-day-header">${d}</div>`).join('');
    for (let i = 0; i < offset; i++) s += '<div class="cal-day-cell cal-day-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds2 = ds(y, m, d);
      const dayEvs = eventsOnDate(evs, ds2);
      const isToday = ds2 === todayStr;
      let cls = 'cal-day-cell';
      if (isToday) cls += ' cal-today';
      if (inRange(ds2, cfg.reviewStart, cfg.reviewEnd)) cls += ' cal-review';
      else if (inRange(ds2, cfg.tri1ExamStart, cfg.tri1ExamEnd)) cls += ' cal-exam-period';
      else if (inRange(ds2, cfg.tri2ExamStart, cfg.tri2ExamEnd)) cls += ' cal-exam-period';
      else if (inRange(ds2, cfg.tri3ExamStart, cfg.tri3ExamEnd)) cls += ' cal-exam-period';
      s += `<div class="${cls}" data-date="${ds2}">
        <span class="cal-day-num">${d}</span>
        <div class="cal-day-events">
          ${dayEvs.slice(0, 3).map(e => `<div class="cal-event-dot" style="background:${e.color};" title="${e.title}"></div>`).join('')}
          ${dayEvs.length > 3 ? `<span class="cal-more-events">+${dayEvs.length - 3}</span>` : ''}
        </div>
      </div>`;
    }
    s += '</div></div>';
    return s;
  }

  function renderTimeView(evs: CalendarEvent[], numDays: number): string {
    const days: Date[] = [];
    if (numDays === 7) {
      const mon = getMonday(viewDate);
      for (let i = 0; i < 7; i++) days.push(addDays(mon, i));
    } else if (numDays === 3) {
      for (let i = 0; i < 3; i++) days.push(addDays(viewDate, i));
    } else {
      days.push(new Date(viewDate));
    }
    const isSingle = numDays === 1;
    const dayNameFn = (d: Date) => DAY_NAMES_FULL[(d.getDay() + 6) % 7];
    const dayShortFn = (d: Date) => DAY_NAMES[(d.getDay() + 6) % 7];

    let s = `<div class="glass-card cal-time-container"><div class="cal-time-grid${isSingle ? ' cal-time-single' : ''}" style="grid-template-columns:56px repeat(${numDays}, 1fr);${isSingle ? '' : numDays === 3 ? ' min-width:420px;' : ''}">`;
    s += '<div class="cal-time-gutter"></div>';
    days.forEach(d => {
      const isT = sameDay(d, today);
      const numLabel = isSingle
        ? `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`
        : (numDays === 3 ? `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}` : `${d.getDate()}`);
      const dayLabel = isSingle ? dayNameFn(d) : (numDays === 3 ? dayNameFn(d) : dayShortFn(d));
      s += `<div class="cal-time-header${isT ? ' cal-time-today' : ''}"><div class="cal-time-header-day">${dayLabel}</div><div class="cal-time-header-num${isT ? ' cal-today-num' : ''}">${numLabel}</div></div>`;
    });
    HOURS.forEach(h => {
      s += `<div class="cal-time-gutter"><span>${String(h).padStart(2, '0')}:00</span></div>`;
      days.forEach(d => {
        const ds2 = dateStrFromDate(d);
        const hourEvs = evs.filter(e => {
          const end = e.endDate || e.date;
          if (e.date > ds2 || end < ds2) return false;
          if (!e.time) return h === 8;
          const eh = parseInt(e.time.split(':')[0]);
          return eh === h;
        });
        const isT = sameDay(d, today);
        s += `<div class="cal-time-cell${isT ? ' cal-time-today' : ''}" data-date="${ds2}" data-hour="${h}">`;
        hourEvs.forEach(e => {
          const c = e.color;
          const timeLabel = e.time ? `${e.time}${e.endTime ? '–' + e.endTime : ''}` : '';
          s += `<div class="cal-time-event" data-edit-cal="${e.id}" style="background:${c}20;border-left:3px solid ${c};color:${c};"><span class="cal-time-event-title">${e.title}</span>${timeLabel ? `<span class="cal-time-event-time">${timeLabel}</span>` : ''}</div>`;
        });
        s += '</div>';
      });
    });
    s += '</div></div>';
    return s;
  }

  function renderQuickForm(): string {
    return `<div class="glass-card"><h3>Nuevo evento rápido</h3>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <input class="input" id="cal-title" placeholder="Título" style="flex:1;min-width:120px;">
        <select class="input" id="cal-subject" style="width:auto;flex:1;min-width:120px;">
          ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <select class="input" id="cal-type" style="width:auto;">
          <option value="evento">Evento</option>
          <option value="entrega">Entrega</option>
          <option value="trabajo">Trabajo</option>
          <option value="examen">Examen</option>
          <option value="recordatorio">Recordatorio</option>
        </select>
        <input class="input" id="cal-date" type="date" style="width:auto;">
        <button class="btn btn-primary" id="cal-add">Agregar</button>
      </div>
    </div>`;
  }

  function renderEventList(evs: CalendarEvent[]): string {
    const monthEvs = evs.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    }).sort((a, b) => a.date.localeCompare(b.date));

    let s = '<div class="glass-card"><h3>Eventos del mes</h3>';
    if (monthEvs.length === 0) {
      s += '<p style="font-size:13px;">No hay eventos este mes.</p>';
    } else {
      monthEvs.forEach(e => {
        const endStr = e.endDate && e.endDate !== e.date ? ` → ${fmtDate(e.endDate)}` : '';
        const typeColor = EVENT_TYPE_COLORS[e.type] || '#95a5a6';
        const timeStr = e.time ? ` ${e.time}${e.endTime ? '–' + e.endTime : ''}` : '';
        s += `<div class="task-item" data-edit-cal="${e.id}" style="cursor:pointer;">
          <div style="width:4px;height:32px;border-radius:2px;background:${e.color};flex-shrink:0;"></div>
          <div class="task-info">
            <div class="task-title">${e.title}</div>
            <div class="task-meta">${e.subject} · ${fmtDate(e.date)}${endStr}${timeStr} · <span class="badge" style="background:${typeColor}20;color:${typeColor};">${e.type}</span>${e.isTask ? ' <span class="badge badge-success">Tarea</span>' : ''}</div>
          </div>
          ${!e.isTask ? `<button class="btn btn-ghost" style="font-size:11px;" data-make-task="${e.id}">+Tarea</button>` : ''}
          <button class="btn btn-ghost" style="font-size:11px;color:#e74c3c;" data-del-cal="${e.id}" title="Eliminar">×</button>
        </div>`;
      });
    }
    s += '</div>';
    return s;
  }

  function attachEvents(evs: CalendarEvent[]) {
    el.querySelector('#cal-cfg-btn')?.addEventListener('click', () => showCourseConfigModal(cfg, render));

    el.querySelector('#cal-prev')?.addEventListener('click', () => {
      if (view === 'month') viewDate.setMonth(viewDate.getMonth() - 1);
      else if (view === 'week') viewDate = addDays(viewDate, -7);
      else if (view === '3day') viewDate = addDays(viewDate, -3);
      else viewDate = addDays(viewDate, -1);
      render();
    });

    el.querySelector('#cal-next')?.addEventListener('click', () => {
      if (view === 'month') viewDate.setMonth(viewDate.getMonth() + 1);
      else if (view === 'week') viewDate = addDays(viewDate, 7);
      else if (view === '3day') viewDate = addDays(viewDate, 3);
      else viewDate = addDays(viewDate, 1);
      render();
    });

    el.querySelector('#cal-today')?.addEventListener('click', () => { viewDate = new Date(today); render(); });

    el.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => { view = (btn as HTMLElement).dataset.view as CalendarView; render(); });
    });

    el.querySelectorAll('.cal-day-cell:not(.cal-day-empty)').forEach(cell => {
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragStart = (cell as HTMLElement).dataset.date!;
        dragEnd = dragStart;
        render();
      });
      cell.addEventListener('mouseenter', () => {
        if (dragStart) {
          dragEnd = (cell as HTMLElement).dataset.date!;
          el.querySelectorAll('.cal-day-cell').forEach(c => {
            const ds2 = (c as HTMLElement).dataset.date;
            if (ds2 && dragStart && dragEnd) {
              const s = dragStart < dragEnd ? dragStart : dragEnd;
              const e = dragStart < dragEnd ? dragEnd : dragStart;
              if (ds2 >= s && ds2 <= e) c.classList.add('cal-drag-range');
              else c.classList.remove('cal-drag-range');
            }
          });
        }
      });
      cell.addEventListener('mouseup', () => {
        if (dragStart && dragEnd) {
          const s = dragStart < dragEnd ? dragStart : dragEnd;
          const e = dragStart < dragEnd ? dragEnd : dragStart;
          dragStart = null; dragEnd = null;
          showCreateEventModal(s, e, undefined, evs, render, () => { save(evs); render(); });
        }
      });
    });

    el.querySelectorAll('.cal-time-cell').forEach(cell => {
      cell.addEventListener('click', (ev) => {
        if ((ev.target as HTMLElement).closest('.cal-time-event')) return;
        const dateVal = (cell as HTMLElement).dataset.date!;
        const hourVal = (cell as HTMLElement).dataset.hour!;
        showCreateEventModal(dateVal, dateVal, `${String(hourVal).padStart(2, '0')}:00`, evs, render, () => { save(evs); render(); });
      });
    });

    document.addEventListener('mouseup', () => {
      if (dragStart) {
        dragStart = null; dragEnd = null;
        el.querySelectorAll('.cal-drag-range').forEach(c => c.classList.remove('cal-drag-range'));
      }
    });

    el.querySelectorAll('[data-edit-cal]').forEach(elem => {
      elem.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = (elem as HTMLElement).dataset.editCal!;
        const evData = evs.find(e => e.id === id);
        if (evData) showEditEventModal(evData, evs, render, () => { save(evs); render(); });
      });
    });

    el.querySelectorAll('[data-make-task]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = (btn as HTMLElement).dataset.makeTask!;
        const evData = evs.find(e => e.id === id);
        if (evData && !evData.isTask) {
          evData.isTask = true;
          save(evs);
          render();
        }
      });
    });

    el.querySelectorAll('[data-del-cal]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = (btn as HTMLElement).dataset.delCal!;
        if (!confirm('¿Eliminar este evento?')) return;
        const idx = evs.findIndex(e => e.id === id);
        if (idx >= 0) {
          const wasTask = evs[idx].isTask;
          evs.splice(idx, 1);
          if (wasTask) {
            const tks = storage.get<Task[]>('tasks', []);
            const ti = tks.findIndex(t => t.id === id);
            if (ti >= 0) tks.splice(ti, 1);
            storage.set('tasks', tks);
          }
          save(evs);
          render();
        }
      });
    });

    el.querySelector('#cal-add')?.addEventListener('click', () => {
      const title = (el.querySelector('#cal-title') as HTMLInputElement).value.trim();
      const subject = (el.querySelector('#cal-subject') as HTMLSelectElement).value;
      const type = (el.querySelector('#cal-type') as HTMLSelectElement).value as CalendarEvent['type'];
      const date = (el.querySelector('#cal-date') as HTMLInputElement).value;
      if (!title || !date) return;
      evs.push({ id: genId(), title, date, subject, type, color: SUBJECT_COLORS[subject] || '#6C5CE7', isTask: false });
      save(evs);
      (el.querySelector('#cal-title') as HTMLInputElement).value = '';
      render();
    });
  }

  render();
}

function colorPickerHTML(currentColor: string): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;">` +
    PRESET_COLORS.map(c =>
      `<button type="button" class="cal-color-swatch ${c === currentColor ? 'cal-color-swatch-active' : ''}" data-color="${c}" style="width:28px;height:28px;border-radius:50%;border:2px solid ${c === currentColor ? 'var(--ink)' : 'transparent'};background:${c};cursor:pointer;transition:transform 0.15s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></button>`
    ).join('') +
    `</div>`;
}

function eventModalHTML(
  title: string, startDate: string, endDate: string, time: string, endTime: string,
  subject: string, type: string, color: string, isTask: boolean, isEdit: boolean
): string {
  return `
    <div class="modal">
      <h3 style="margin-bottom:12px;">${isEdit ? 'Editar evento' : 'Nuevo evento'}</h3>
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:12px;">${fmtDate(startDate)}${startDate !== endDate ? ` → ${fmtDate(endDate)}` : ''}</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <input class="input" id="modal-title" placeholder="Título del evento" value="${title}" autofocus>
        <select class="input" id="modal-type">
          ${['evento','entrega','trabajo','examen','recordatorio'].map(t =>
            `<option value="${t}" ${t === type ? 'selected' : ''}>${t === 'evento' ? 'Evento general' : t === 'entrega' ? 'Entrega / Tarea' : t === 'trabajo' ? 'Trabajo' : t === 'examen' ? 'Examen' : 'Recordatorio de estudio'}</option>`
          ).join('')}
        </select>
        <div><label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Asignatura (opcional)</label>
        <select class="input" id="modal-subject">
          <option value="">Sin asignatura</option>
          ${SUBJECTS.map(s => `<option value="${s}" ${s === subject ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
        <div style="display:flex;gap:8px;">
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Hora inicio</label>
            <input class="input" id="modal-time" type="time" value="${time}"></div>
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Hora fin</label>
            <input class="input" id="modal-endtime" type="time" value="${endTime}"></div>
        </div>
        <div><label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Color</label>
          ${colorPickerHTML(color)}</div>
        <label style="font-size:13px;display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="checkbox" id="modal-is-task" ${isTask ? 'checked' : ''}> Añadir como tarea
        </label>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button class="btn btn-primary" id="modal-save" style="flex:1;">${isEdit ? 'Guardar cambios' : 'Crear evento'}</button>
          <button class="btn btn-ghost" id="modal-cancel">Cancelar</button>
        </div>
        ${isEdit ? `<button class="btn btn-ghost" id="modal-delete" style="color:#e74c3c;width:100%;margin-top:4px;">Eliminar evento</button>` : ''}
      </div>
    </div>`;
}

function initModal(
  overlay: HTMLElement, evs: CalendarEvent[], renderFn: () => void,
  onDone: () => void, existingEvent?: CalendarEvent, createStartDate?: string, createEndDate?: string
) {
  const titleInput = overlay.querySelector('#modal-title') as HTMLInputElement;
  const saveBtn = overlay.querySelector('#modal-save') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('#modal-cancel') as HTMLButtonElement;
  const deleteBtn = overlay.querySelector('#modal-delete') as HTMLButtonElement;

  let selectedColor = existingEvent?.color || SUBJECT_COLORS[(overlay.querySelector('#modal-subject') as HTMLSelectElement).value] || '#6C5CE7';

  overlay.querySelectorAll('[data-color]').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      e.preventDefault();
      selectedColor = (swatch as HTMLElement).dataset.color!;
      overlay.querySelectorAll('[data-color]').forEach(s => {
        s.classList.toggle('cal-color-swatch-active', (s as HTMLElement).dataset.color === selectedColor);
        (s as HTMLElement).style.borderColor = (s as HTMLElement).dataset.color === selectedColor ? 'var(--ink)' : 'transparent';
      });
    });
  });

  (overlay.querySelector('#modal-subject') as HTMLSelectElement)?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val && SUBJECT_COLORS[val]) {
      selectedColor = SUBJECT_COLORS[val];
      overlay.querySelectorAll('[data-color]').forEach(s => {
        s.classList.toggle('cal-color-swatch-active', (s as HTMLElement).dataset.color === selectedColor);
        (s as HTMLElement).style.borderColor = (s as HTMLElement).dataset.color === selectedColor ? 'var(--ink)' : 'transparent';
      });
    }
  });

  const doSave = () => {
    const title = titleInput.value.trim();
    const subject = (overlay.querySelector('#modal-subject') as HTMLSelectElement).value;
    const type = (overlay.querySelector('#modal-type') as HTMLSelectElement).value as CalendarEvent['type'];
    const time = (overlay.querySelector('#modal-time') as HTMLInputElement).value || undefined;
    const endTime = (overlay.querySelector('#modal-endtime') as HTMLInputElement).value || undefined;
    const isTask = (overlay.querySelector('#modal-is-task') as HTMLInputElement).checked;
    if (!title) { titleInput.focus(); return; }

    if (existingEvent) {
      existingEvent.title = title;
      existingEvent.subject = subject;
      existingEvent.type = type;
      existingEvent.time = time;
      existingEvent.endTime = endTime;
      existingEvent.color = selectedColor;
      existingEvent.isTask = isTask;
    } else {
      const startDate = createStartDate || '';
      const endDate = createEndDate || startDate;
      evs.push({
        id: genId(), title, date: startDate, endDate: startDate !== endDate ? endDate : undefined,
        time, endTime, subject, type, color: selectedColor, isTask,
      });
      if (isTask) {
        const tks = storage.get<Task[]>('tasks', []);
        tks.push({ id: genId(), title, subject, deadline: startDate, done: false });
        storage.set('tasks', tks);
      }
    }
    closeOverlay(overlay);
    onDone();
    renderFn();
  };

  saveBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', () => closeOverlay(overlay));
  titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(overlay); });

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (!existingEvent || !confirm('¿Eliminar este evento?')) return;
      const idx = evs.findIndex(e => e.id === existingEvent.id);
      if (idx >= 0) {
        const wasTask = evs[idx].isTask;
        evs.splice(idx, 1);
        if (wasTask) {
          const tks = storage.get<Task[]>('tasks', []);
          const ti = tks.findIndex(t => t.id === existingEvent.id);
          if (ti >= 0) tks.splice(ti, 1);
          storage.set('tasks', tks);
        }
      }
      closeOverlay(overlay);
      onDone();
      renderFn();
    });
  }

  setTimeout(() => titleInput.focus(), 100);
}

function closeOverlay(overlay: HTMLElement) {
  overlay.classList.remove('open');
  setTimeout(() => overlay.remove(), 250);
}

function showCreateEventModal(
  startDate: string, endDate: string, time: string | undefined,
  events: CalendarEvent[], renderFn: () => void, onDone: () => void
) {
  const existing = document.getElementById('cal-event-modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'cal-event-modal';
  overlay.innerHTML = eventModalHTML('', startDate, endDate, time || '', '', '', 'evento', '#95a5a6', false, false);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  initModal(overlay, events, renderFn, onDone, undefined, startDate, endDate);
}

function showEditEventModal(
  ev: CalendarEvent, events: CalendarEvent[], renderFn: () => void, onDone: () => void
) {
  const existing = document.getElementById('cal-event-modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'cal-event-modal';
  overlay.innerHTML = eventModalHTML(
    ev.title, ev.date, ev.endDate || ev.date, ev.time || '', ev.endTime || '',
    ev.subject, ev.type, ev.color, ev.isTask, true
  );
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  initModal(overlay, events, renderFn, onDone, ev);
}

function showCourseConfigModal(cfg: CourseConfig, onDone: () => void) {
  const existing = document.getElementById('cal-cfg-modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'cal-cfg-modal';
  overlay.innerHTML = `
    <div class="modal">
      <h3 style="margin-bottom:12px;">Configuración del curso</h3>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div><label style="font-size:12px;font-weight:600;color:var(--ink-muted);">Inicio de curso</label>
          <input class="input" id="cfg-start" type="date" value="${cfg.yearStart}"></div>
        <div style="font-size:12px;font-weight:600;color:var(--ink-muted);margin-top:4px;">1º Trimestre — Exámenes</div>
        <div style="display:flex;gap:8px;">
          <input class="input" id="cfg-tri1s" type="date" value="${cfg.tri1ExamStart}" style="flex:1;">
          <input class="input" id="cfg-tri1e" type="date" value="${cfg.tri1ExamEnd}" style="flex:1;">
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--ink-muted);margin-top:4px;">2º Trimestre — Exámenes</div>
        <div style="display:flex;gap:8px;">
          <input class="input" id="cfg-tri2s" type="date" value="${cfg.tri2ExamStart}" style="flex:1;">
          <input class="input" id="cfg-tri2e" type="date" value="${cfg.tri2ExamEnd}" style="flex:1;">
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--ink-muted);margin-top:4px;">3º Trimestre — Exámenes</div>
        <div style="display:flex;gap:8px;">
          <input class="input" id="cfg-tri3s" type="date" value="${cfg.tri3ExamStart}" style="flex:1;">
          <input class="input" id="cfg-tri3e" type="date" value="${cfg.tri3ExamEnd}" style="flex:1;">
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--ink-muted);margin-top:4px;">Periodo de repaso PAU</div>
        <div style="display:flex;gap:8px;">
          <input class="input" id="cfg-rev-s" type="date" value="${cfg.reviewStart}" style="flex:1;">
          <input class="input" id="cfg-rev-e" type="date" value="${cfg.reviewEnd}" style="flex:1;">
        </div>
        <div><label style="font-size:12px;font-weight:600;color:var(--ink-muted);">Fecha de la PAU</label>
          <input class="input" id="cfg-pau" type="date" value="${cfg.pauDate}"></div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-primary" id="cfg-save" style="flex:1;">Guardar</button>
          <button class="btn btn-ghost" id="cfg-cancel">Cancelar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.querySelector('#cfg-save')?.addEventListener('click', () => {
    const newCfg: CourseConfig = {
      yearStart: (overlay.querySelector('#cfg-start') as HTMLInputElement).value,
      tri1ExamStart: (overlay.querySelector('#cfg-tri1s') as HTMLInputElement).value,
      tri1ExamEnd: (overlay.querySelector('#cfg-tri1e') as HTMLInputElement).value,
      tri2ExamStart: (overlay.querySelector('#cfg-tri2s') as HTMLInputElement).value,
      tri2ExamEnd: (overlay.querySelector('#cfg-tri2e') as HTMLInputElement).value,
      tri3ExamStart: (overlay.querySelector('#cfg-tri3s') as HTMLInputElement).value,
      tri3ExamEnd: (overlay.querySelector('#cfg-tri3e') as HTMLInputElement).value,
      reviewStart: (overlay.querySelector('#cfg-rev-s') as HTMLInputElement).value,
      reviewEnd: (overlay.querySelector('#cfg-rev-e') as HTMLInputElement).value,
      pauDate: (overlay.querySelector('#cfg-pau') as HTMLInputElement).value,
    };
    storage.set('courseConfig', newCfg);
    closeOverlay(overlay);
    onDone();
  });

  overlay.querySelector('#cfg-cancel')?.addEventListener('click', () => closeOverlay(overlay));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(overlay); });
}
