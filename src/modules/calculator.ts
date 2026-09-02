import { storage } from '../storage';

// Types
interface GradeEntry {
  id: string;
  subject: string;
  evaluation: string;
  grade: number;
}

type SubTab = 'ebau' | 'simulador' | 'notas' | 'conversor';

let subTab: SubTab = 'ebau';

export function renderCalculator(el: HTMLElement) {
  el.innerHTML = `
    <h1>Notas</h1>
    <div class="module-tabs">
      <button class="module-tab ${subTab==='ebau'?'active':''}" data-stab="ebau">EBAU</button>
      <button class="module-tab ${subTab==='simulador'?'active':''}" data-stab="simulador">Simulador</button>
      <button class="module-tab ${subTab==='notas'?'active':''}" data-stab="notas">Notas</button>
      <button class="module-tab ${subTab==='conversor'?'active':''}" data-stab="conversor">Conversor</button>
    </div>
    <div id="calc-content"></div>
  `;

  el.querySelectorAll('.module-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      subTab = (btn as HTMLElement).dataset.stab as SubTab;
      renderCalculator(el);
    });
  });

  const content = el.querySelector('#calc-content')! as HTMLElement;
  switch (subTab) {
    case 'ebau': renderEbau(content); break;
    case 'simulador': renderSimulator(content); break;
    case 'notas': renderGrades(content); break;
    case 'conversor': renderConverter(content); break;
  }
}

// ===== Feature 6: Calculadora EBAU =====
function renderEbau(el: HTMLElement) {
  el.innerHTML = `
    <div class="glass-card">
      <h3>Calculadora de nota de acceso (EBAU)</h3>
      <p style="font-size:13px;margin-bottom:16px;">Fórmula: 0.6 × NMB + 0.4 × Calificación EBAU</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Nota Media Bachillerato (NMB)</label>
          <input class="input" id="ebau-nmb" type="number" min="0" max="10" step="0.01" placeholder="0.00">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Calificación EBAU (0-10)</label>
          <input class="input" id="ebau-exam" type="number" min="0" max="10" step="0.01" placeholder="0.00">
        </div>
        <h3 style="margin-top:8px;">Asignaturas ponderadas (opcional)</h3>
        <div id="ebau-extra-subjects">
          <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
            <input class="input" placeholder="Asignatura" style="flex:1;min-width:120px;" data-ebau-name="0">
            <input class="input" type="number" min="0" max="10" step="0.01" placeholder="Nota" style="width:80px;" data-ebau-grade="0">
            <select class="input" style="width:auto;" data-ebau-ponderacion="0">
              <option value="0.1">×0.1</option>
              <option value="0.14">×0.14</option>
              <option value="0.2" selected>×0.2</option>
            </select>
          </div>
        </div>
        <button class="btn btn-secondary" id="ebau-add-subject" style="align-self:flex-start;">+ Añadir asignatura</button>
        <div style="padding:16px;background:var(--accent-soft);border-radius:var(--radius-sm);text-align:center;">
          <div style="font-size:12px;font-weight:600;color:var(--ink-muted);">Nota de acceso</div>
          <div id="ebau-result" style="font-family:var(--font-display);font-size:2.5rem;font-weight:700;color:var(--accent);">—</div>
        </div>
      </div>
    </div>
  `;

  let extraCount = 1;

  const calc = () => {
    const nmb = parseFloat((el.querySelector('#ebau-nmb') as HTMLInputElement)?.value || '0') || 0;
    const exam = parseFloat((el.querySelector('#ebau-exam') as HTMLInputElement)?.value || '0') || 0;
    let extraPoints = 0;
    for (let i = 0; i < extraCount; i++) {
      const grade = parseFloat((el.querySelector(`[data-ebau-grade="${i}"]`) as HTMLInputElement)?.value || '0') || 0;
      const ponderacion = parseFloat((el.querySelector(`[data-ebau-ponderacion="${i}"]`) as HTMLSelectElement)?.value || '0') || 0;
      extraPoints += grade * ponderacion;
    }
    const base = 0.6 * nmb + 0.4 * exam;
    const total = Math.min(10, base + extraPoints);
    const resultEl = el.querySelector('#ebau-result');
    if (resultEl) {
      resultEl.textContent = total > 0 ? total.toFixed(2) : '—';
    }
  };

  el.querySelectorAll('#ebau-nmb, #ebau-exam, [data-ebau-grade]').forEach(input => {
    input.addEventListener('input', calc);
  });

  el.querySelector('#ebau-add-subject')?.addEventListener('click', () => {
    const container = el.querySelector('#ebau-extra-subjects');
    if (!container) return;
    const i = extraCount++;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;';
    div.innerHTML = `
      <input class="input" placeholder="Asignatura" style="flex:1;min-width:120px;" data-ebau-name="${i}">
      <input class="input" type="number" min="0" max="10" step="0.01" placeholder="Nota" style="width:80px;" data-ebau-grade="${i}">
      <select class="input" style="width:auto;" data-ebau-ponderacion="${i}">
        <option value="0.1">×0.1</option>
        <option value="0.14">×0.14</option>
        <option value="0.2" selected>×0.2</option>
      </select>
    `;
    container.appendChild(div);
    div.querySelector('[data-ebau-grade]')?.addEventListener('input', calc);
  });
}

// ===== Feature 7: Simulador =====
function renderSimulator(el: HTMLElement) {
  el.innerHTML = `
    <div class="glass-card">
      <h3>¿Qué nota necesito sacar?</h3>
      <p style="font-size:13px;margin-bottom:16px;">Introduce la nota que tienes y la que quieres alcanzar</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Nota media actual</label>
          <input class="input" id="sim-current" type="number" min="0" max="10" step="0.01" placeholder="0.00">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Nota de acceso objetivo</label>
          <input class="input" id="sim-target" type="number" min="0" max="10" step="0.01" placeholder="0.00">
        </div>
        <div style="padding:16px;background:var(--accent-soft);border-radius:var(--radius-sm);text-align:center;">
          <div style="font-size:12px;font-weight:600;color:var(--ink-muted);">Necesitas sacar en la EBAU</div>
          <div id="sim-result" style="font-family:var(--font-display);font-size:2.5rem;font-weight:700;color:var(--accent);">—</div>
        </div>
      </div>
    </div>
  `;

  const calc = () => {
    const current = parseFloat((el.querySelector('#sim-current') as HTMLInputElement)?.value || '0') || 0;
    const target = parseFloat((el.querySelector('#sim-target') as HTMLInputElement)?.value || '0') || 0;
    if (target <= 0 || current <= 0) {
      (el.querySelector('#sim-result') as HTMLElement).textContent = '—';
      return;
    }
    const needed = (target - 0.6 * current) / 0.4;
    const resultEl = el.querySelector('#sim-result') as HTMLElement;
    if (needed > 10) {
      resultEl.textContent = 'Imposible';
      resultEl.style.color = '#e74c3c';
    } else if (needed < 0) {
      resultEl.textContent = '¡Ya la tienes!';
      resultEl.style.color = '#27ae60';
    } else {
      resultEl.textContent = needed.toFixed(2);
      resultEl.style.color = 'var(--accent)';
    }
  };

  el.querySelectorAll('#sim-current, #sim-target').forEach(input => {
    input.addEventListener('input', calc);
  });
}

// ===== Feature 8: Registro de notas =====
function renderGrades(el: HTMLElement) {
  const grades = storage.get<GradeEntry[]>('grades', []);
  const evaluations = ['1ª Evaluación', '2ª Evaluación', '3ª Evaluación'];
  const subjects = ['Valenciano','Lengua Castellana','Física','Química','Historia','Filosofía','Matemáticas','Tecnología','Biología'];

  let html = `<div class="glass-card"><h3>Mis notas</h3>`;

  evaluations.forEach(ev => {
    const evGrades = grades.filter(g => g.evaluation === ev);
    if (evGrades.length === 0) return;
    const avg = evGrades.reduce((s, g) => s + g.grade, 0) / evGrades.length;
    html += `<div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:600;font-size:14px;">${ev}</span>
        <span class="badge">Media: ${avg.toFixed(2)}</span>
      </div>`;
    evGrades.forEach(g => {
      const color = g.grade >= 9 ? '#27ae60' : g.grade >= 7 ? 'var(--accent)' : g.grade >= 5 ? '#f39c12' : '#e74c3c';
      html += `<div class="task-item">
        <div class="task-info">
          <div class="task-title">${g.subject}</div>
          <div class="task-meta">${ev}</div>
        </div>
        <div style="font-weight:700;font-size:16px;color:${color};">${g.grade.toFixed(2)}</div>
        <button class="btn btn-ghost" style="font-size:11px;" data-del-grade="${g.id}">×</button>
      </div>`;
    });
    html += `</div>`;
  });

  if (grades.length === 0) {
    html += `<div class="empty-state"><p>No hay notas registradas</p></div>`;
  }
  html += `</div>`;

  html += `<div class="glass-card"><h3>Agregar nota</h3>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <select class="input" id="grade-subject" style="width:auto;flex:1;min-width:120px;">
        ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select class="input" id="grade-eval" style="width:auto;">
        ${evaluations.map(e => `<option value="${e}">${e}</option>`).join('')}
      </select>
      <input class="input" id="grade-value" type="number" min="0" max="10" step="0.01" placeholder="Nota" style="width:80px;">
      <button class="btn btn-primary" id="grade-add">Agregar</button>
    </div>
  </div>`;

  el.innerHTML = html;

  el.querySelectorAll('[data-del-grade]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.delGrade!;
      const idx = grades.findIndex(g => g.id === id);
      if (idx >= 0) { grades.splice(idx, 1); storage.set('grades', grades); renderGrades(el); }
    });
  });

  el.querySelector('#grade-add')?.addEventListener('click', () => {
    const subject = (el.querySelector('#grade-subject') as HTMLSelectElement).value;
    const evaluation = (el.querySelector('#grade-eval') as HTMLSelectElement).value;
    const grade = parseFloat((el.querySelector('#grade-value') as HTMLInputElement).value);
    if (isNaN(grade) || grade < 0 || grade > 10) return;
    grades.push({ id: Date.now().toString(36), subject, evaluation, grade });
    storage.set('grades', grades);
    renderGrades(el);
  });
}

// ===== Feature 9: Conversor de calificaciones =====
function renderConverter(el: HTMLElement) {
  el.innerHTML = `
    <div class="glass-card">
      <h3>Conversor de calificaciones</h3>
      <div class="module-tabs" style="margin-top:12px;">
        <button class="module-tab active" data-conv="num">Número</button>
        <button class="module-tab" data-conv="letra">Letra</button>
        <button class="module-tab" data-conv="percentil">Percentil</button>
      </div>
      <div id="conv-content" style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Nota (0-10)</label>
          <input class="input" id="conv-input" type="number" min="0" max="10" step="0.01" placeholder="0.00">
        </div>
        <div style="padding:16px;background:var(--accent-soft);border-radius:var(--radius-sm);text-align:center;">
          <div id="conv-result" style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:var(--accent);">—</div>
          <div id="conv-label" style="font-size:12px;color:var(--ink-muted);margin-top:4px;"></div>
        </div>
        <div style="font-size:12px;color:var(--ink-muted);">
          <strong>Escala:</strong> 9-10 Sobresaliente · 7-8 Notable · 5-6 Aprobado · 0-4 Insuficiente
        </div>
      </div>
    </div>
  `;

  let mode = 'num';

  const gradeToLetter = (n: number): string => {
    if (n >= 9) return 'Sobresaliente';
    if (n >= 7) return 'Notable';
    if (n >= 5) return 'Aprobado';
    return 'Insuficiente';
  };

  const gradeToPercentile = (n: number): number => {
    return Math.round((n / 10) * 100);
  };

  const convert = () => {
    const val = parseFloat((el.querySelector('#conv-input') as HTMLInputElement)?.value || '');
    const resultEl = el.querySelector('#conv-result') as HTMLElement;
    const labelEl = el.querySelector('#conv-label') as HTMLElement;
    if (isNaN(val)) { resultEl.textContent = '—'; labelEl.textContent = ''; return; }
    const clamped = Math.max(0, Math.min(10, val));
    if (mode === 'num') {
      resultEl.textContent = gradeToLetter(clamped);
      labelEl.textContent = `${clamped.toFixed(2)} equivale a`;
    } else if (mode === 'letra') {
      resultEl.textContent = clamped.toFixed(2);
      labelEl.textContent = `${gradeToLetter(clamped)} equivale a`;
    } else {
      resultEl.textContent = `${gradeToPercentile(clamped)}%`;
      labelEl.textContent = `Percentil`;
    }
  };

  el.querySelectorAll('[data-conv]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-conv]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = (btn as HTMLElement).dataset.conv!;
      convert();
    });
  });

  el.querySelector('#conv-input')?.addEventListener('input', convert);
}
