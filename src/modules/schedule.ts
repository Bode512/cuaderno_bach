import { storage } from '../storage';
import { SUBJECTS, SUBJECT_COLORS } from '../subjects';

interface ScheduleEntry {
  dayOfWeek: number; // 0 = Monday, 6 = Sunday
  startHour: number;
  endHour: number;
  subject: string;
  color: string;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function renderSchedule(el: HTMLElement) {
  let schedule = storage.get<ScheduleEntry[]>('schedule', []);
  let selectedCell: { day: number; hour: number } | null = null;

  const render = () => {
    const html = `
      <h1>Horario</h1>
      ${renderScheduleGrid()}
      ${renderQuickForm()}
      ${renderEntryList()}
    `;
    el.innerHTML = html;
    attachEvents();
  };

  const renderScheduleGrid = (): string => {
    let s = '<div class="glass-card" style="overflow-x:auto;"><div class="schedule-grid">';
    
    // Header with day names
    s += '<div class="schedule-cell schedule-header" style="background:var(--bg-secondary);">Hora</div>';
    DAYS.forEach((day, i) => {
      s += `<div class="schedule-cell schedule-header" style="background:var(--bg-secondary);">${day}</div>`;
    });

    // Hour rows
    HOURS.forEach(hour => {
      s += `<div class="schedule-cell schedule-hour-label">${String(hour).padStart(2, '0')}:00</div>`;
      
      DAYS.forEach((_, dayIndex) => {
        const entry = schedule.find(e => e.dayOfWeek === dayIndex && e.startHour <= hour && hour < e.endHour);
        if (entry) {
          // Only render if this is the first hour of the block
          if (entry.startHour === hour) {
            const duration = entry.endHour - entry.startHour;
            s += `<div 
              class="schedule-cell schedule-entry" 
              data-day="${dayIndex}" 
              data-hour="${hour}"
              style="
                background:${entry.color}20;
                border-left:3px solid ${entry.color};
                color:${entry.color};
                grid-row:span ${duration};
                display:flex;
                align-items:center;
                justify-content:center;
                cursor:pointer;
                font-weight:600;
              "
              data-edit-schedule="${entry.dayOfWeek}-${entry.startHour}"
              title="${entry.subject}"
            >${entry.subject.split(' ')[0]}</div>`;
          }
          // Skip rendering for other hours this entry spans
        } else {
          s += `<div 
            class="schedule-cell schedule-slot" 
            data-day="${dayIndex}" 
            data-hour="${hour}"
            style="background:var(--bg-secondary);cursor:pointer;border:1px solid var(--border-color);"
          ></div>`;
        }
      });
    });

    s += '</div></div>';
    return s;
  };

  const renderQuickForm = (): string => {
    return `<div class="glass-card" style="margin-top:16px;">
      <h3>Agregar clase rápido</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <select class="input" id="sch-day" style="flex:1;min-width:120px;">
          ${DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('')}
        </select>
        <select class="input" id="sch-start-hour" style="width:auto;">
          <option value="">Hora inicio</option>
          ${HOURS.map(h => `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('')}
        </select>
        <select class="input" id="sch-end-hour" style="width:auto;">
          <option value="">Hora fin</option>
          ${HOURS.map(h => `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('')}
        </select>
        <select class="input" id="sch-subject" style="flex:1;min-width:140px;">
          <option value="">Asignatura</option>
          ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="sch-add">Agregar</button>
      </div>
    </div>`;
  };

  const renderEntryList = (): string => {
    if (schedule.length === 0) {
      return '<div class="glass-card" style="margin-top:16px;"><p style="font-size:13px;color:var(--ink-muted);">No hay clases en el horario.</p></div>';
    }

    const sorted = [...schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startHour - b.startHour);
    
    let s = '<div class="glass-card" style="margin-top:16px;"><h3>Clases del horario</h3>';
    sorted.forEach(entry => {
      const dayName = DAYS[entry.dayOfWeek];
      s += `<div class="task-item" data-edit-schedule="${entry.dayOfWeek}-${entry.startHour}" style="cursor:pointer;">
        <div style="width:4px;height:32px;border-radius:2px;background:${entry.color};flex-shrink:0;"></div>
        <div class="task-info">
          <div class="task-title">${entry.subject}</div>
          <div class="task-meta">${dayName} · ${String(entry.startHour).padStart(2, '0')}:00 – ${String(entry.endHour).padStart(2, '0')}:00</div>
        </div>
        <button class="btn btn-ghost" style="font-size:11px;color:#e74c3c;" data-del-schedule="${entry.dayOfWeek}-${entry.startHour}" title="Eliminar">×</button>
      </div>`;
    });
    s += '</div>';
    return s;
  };

  const attachEvents = () => {
    // Click on empty slots to open editor
    el.querySelectorAll('.schedule-slot').forEach(cell => {
      cell.addEventListener('click', () => {
        const day = parseInt((cell as HTMLElement).dataset.day!);
        const hour = parseInt((cell as HTMLElement).dataset.hour!);
        showScheduleModal(day, hour, undefined, render);
      });
    });

    // Click on existing entries to edit
    el.querySelectorAll('[data-edit-schedule]').forEach(elem => {
      elem.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const [dayStr, hourStr] = (elem as HTMLElement).dataset.editSchedule!.split('-');
        const day = parseInt(dayStr);
        const hour = parseInt(hourStr);
        const entry = schedule.find(e => e.dayOfWeek === day && e.startHour === hour);
        if (entry) showScheduleModal(day, hour, entry, render);
      });
    });

    // Delete buttons
    el.querySelectorAll('[data-del-schedule]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const [dayStr, hourStr] = (btn as HTMLElement).dataset.delSchedule!.split('-');
        const day = parseInt(dayStr);
        const hour = parseInt(hourStr);
        if (!confirm('¿Eliminar esta clase del horario?')) return;
        schedule = schedule.filter(e => !(e.dayOfWeek === day && e.startHour === hour));
        storage.set('schedule', schedule);
        render();
      });
    });

    // Quick form submission
    el.querySelector('#sch-add')?.addEventListener('click', () => {
      const day = parseInt((el.querySelector('#sch-day') as HTMLSelectElement).value);
      const startHour = parseInt((el.querySelector('#sch-start-hour') as HTMLSelectElement).value);
      const endHour = parseInt((el.querySelector('#sch-end-hour') as HTMLSelectElement).value);
      const subject = (el.querySelector('#sch-subject') as HTMLSelectElement).value;

      if (!subject || !startHour || !endHour || endHour <= startHour) {
        alert('Por favor completa todos los campos correctamente (hora fin > hora inicio)');
        return;
      }

      // Check for conflicts
      const hasConflict = schedule.some(e => 
        e.dayOfWeek === day && 
        !(e.endHour <= startHour || e.startHour >= endHour)
      );
      if (hasConflict) {
        alert('Hay un conflicto de horario. Edita o elimina la clase existente.');
        return;
      }

      // Remove old entry if exists
      schedule = schedule.filter(e => !(e.dayOfWeek === day && e.startHour === startHour));

      // Add new entry
      const color = SUBJECT_COLORS[subject] || '#6C5CE7';
      schedule.push({ dayOfWeek: day, startHour, endHour, subject, color });
      storage.set('schedule', schedule);
      
      // Clear form
      (el.querySelector('#sch-subject') as HTMLSelectElement).value = '';
      render();
    });
  };

  render();
}

function showScheduleModal(day: number, hour: number, existingEntry: ScheduleEntry | undefined, onDone: () => void) {
  const existing = document.getElementById('schedule-modal');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'schedule-modal';
  
  const dayName = DAYS[day];
  const isEdit = !!existingEntry;
  
  overlay.innerHTML = `
    <div class="modal">
      <h3 style="margin-bottom:12px;">${isEdit ? 'Editar clase' : 'Nueva clase'}</h3>
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:12px;">${dayName} · ${String(hour).padStart(2, '0')}:00</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div><label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Asignatura</label>
          <select class="input" id="modal-sch-subject">
            <option value="">Selecciona una asignatura</option>
            ${SUBJECTS.map(s => `<option value="${s}" ${s === existingEntry?.subject ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;">
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Hora inicio</label>
            <select class="input" id="modal-sch-start">
              ${HOURS.map(h => `<option value="${h}" ${h === existingEntry?.startHour ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}
            </select>
          </div>
          <div style="flex:1;"><label style="font-size:12px;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:4px;">Hora fin</label>
            <select class="input" id="modal-sch-end">
              ${HOURS.map(h => `<option value="${h}" ${h === existingEntry?.endHour ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-primary" id="modal-sch-save" style="flex:1;">${isEdit ? 'Guardar cambios' : 'Crear clase'}</button>
          <button class="btn btn-ghost" id="modal-sch-cancel">Cancelar</button>
        </div>
        ${isEdit ? `<button class="btn btn-ghost" id="modal-sch-delete" style="color:#e74c3c;width:100%;margin-top:4px;">Eliminar clase</button>` : ''}
      </div>
    </div>`;
  
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  
  const schedule = storage.get<ScheduleEntry[]>('schedule', []);
  
  const subjectSelect = overlay.querySelector('#modal-sch-subject') as HTMLSelectElement;
  const startSelect = overlay.querySelector('#modal-sch-start') as HTMLSelectElement;
  const endSelect = overlay.querySelector('#modal-sch-end') as HTMLSelectElement;
  const saveBtn = overlay.querySelector('#modal-sch-save') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('#modal-sch-cancel') as HTMLButtonElement;
  const deleteBtn = overlay.querySelector('#modal-sch-delete') as HTMLButtonElement;

  const doSave = () => {
    const subject = subjectSelect.value;
    const startHour = parseInt(startSelect.value);
    const endHour = parseInt(endSelect.value);

    if (!subject || !startHour || !endHour || endHour <= startHour) {
      alert('Por favor completa todos los campos correctamente (hora fin > hora inicio)');
      return;
    }

    // Remove old entry
    const oldIdx = schedule.findIndex(e => e.dayOfWeek === day && e.startHour === hour);
    if (oldIdx >= 0) schedule.splice(oldIdx, 1);

    // Check for conflicts (excluding the entry we're editing)
    const hasConflict = schedule.some(e => 
      e.dayOfWeek === day && 
      !(e.endHour <= startHour || e.startHour >= endHour)
    );
    if (hasConflict) {
      alert('Hay un conflicto de horario con otra clase.');
      return;
    }

    const color = SUBJECT_COLORS[subject] || '#6C5CE7';
    schedule.push({ dayOfWeek: day, startHour, endHour, subject, color });
    storage.set('schedule', schedule);
    
    closeOverlay(overlay);
    onDone();
  };

  saveBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', () => closeOverlay(overlay));
  
  if (deleteBtn && isEdit) {
    deleteBtn.addEventListener('click', () => {
      if (!confirm('¿Eliminar esta clase del horario?')) return;
      const idx = schedule.findIndex(e => e.dayOfWeek === day && e.startHour === hour);
      if (idx >= 0) schedule.splice(idx, 1);
      storage.set('schedule', schedule);
      closeOverlay(overlay);
      onDone();
    });
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(overlay); });
  subjectSelect.focus();
}

function closeOverlay(overlay: HTMLElement) {
  overlay.classList.remove('open');
  setTimeout(() => overlay.remove(), 250);
}
