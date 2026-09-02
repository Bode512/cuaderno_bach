import { storage } from '../storage';
import katex from 'katex';

interface Formula {
  id: string;
  name: string;
  expression: string;
  subject: string;
}

const DEFAULT_FORMULAS: Formula[] = [
  // Matemáticas
  { id: 'm1', name: 'Cuadrática', expression: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', subject: 'Matemáticas' },
  { id: 'm2', name: 'Teorema de Pitágoras', expression: 'a^2 + b^2 = c^2', subject: 'Matemáticas' },
  { id: 'm3', name: 'Área del círculo', expression: 'A = \\pi r^2', subject: 'Matemáticas' },
  { id: 'm4', name: 'Volumen del cilindro', expression: 'V = \\pi r^2 h', subject: 'Matemáticas' },
  { id: 'm5', name: 'Perímetro del rectángulo', expression: 'P = 2(l + a)', subject: 'Matemáticas' },
  { id: 'm6', name: 'Identidad pitagórica', expression: '\\sin^2\\theta + \\cos^2\\theta = 1', subject: 'Matemáticas' },
  { id: 'm7', name: 'Ley de senos', expression: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}', subject: 'Matemáticas' },
  { id: 'm8', name: 'Ley de cosenos', expression: 'c^2 = a^2 + b^2 - 2ab\\cos C', subject: 'Matemáticas' },
  { id: 'm9', name: 'Derivada potencia', expression: '\\frac{d}{dx}x^n = nx^{n-1}', subject: 'Matemáticas' },
  { id: 'm10', name: 'Integral potencia', expression: '\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C', subject: 'Matemáticas' },
  // Física
  { id: 'f1', name: 'Velocidad media', expression: 'v = \\frac{\\Delta x}{\\Delta t}', subject: 'Física' },
  { id: 'f2', name: 'Aceleración', expression: 'a = \\frac{\\Delta v}{\\Delta t}', subject: 'Física' },
  { id: 'f3', name: 'Segunda ley de Newton', expression: 'F = m \\cdot a', subject: 'Física' },
  { id: 'f4', name: 'Trabajo', expression: 'W = F \\cdot d \\cdot \\cos\\theta', subject: 'Física' },
  { id: 'f5', name: 'Energía cinética', expression: 'E_k = \\frac{1}{2}mv^2', subject: 'Física' },
  { id: 'f6', name: 'Energía potencial', expression: 'E_p = m \\cdot g \\cdot h', subject: 'Física' },
  { id: 'f7', name: 'Ley de gravitación', expression: 'F = G\\frac{m_1 m_2}{r^2}', subject: 'Física' },
  { id: 'f8', name: 'Ley de Ohm', expression: 'V = I \\cdot R', subject: 'Física' },
  { id: 'f9', name: 'Potencia eléctrica', expression: 'P = V \\cdot I = I^2 R', subject: 'Física' },
  { id: 'f10', name: 'Ecuación de la cinemática', expression: 'x = x_0 + v_0 t + \\frac{1}{2}at^2', subject: 'Física' },
  // Química
  { id: 'q1', name: 'Moles', expression: 'n = \\frac{m}{M}', subject: 'Química' },
  { id: 'q2', name: 'Concentración molar', expression: 'C = \\frac{n}{V}', subject: 'Química' },
  { id: 'q3', name: 'Gases ideales', expression: 'PV = nRT', subject: 'Química' },
  { id: 'q4', name: 'pH', expression: 'pH = -\\log[H^+]', subject: 'Química' },
  { id: 'q5', name: 'Diluciones', expression: 'C_1 V_1 = C_2 V_2', subject: 'Química' },
  { id: 'q6', name: 'Masa molar', expression: 'M = \\frac{m}{n}', subject: 'Química' },
  { id: 'q7', name: 'Entalpía', expression: '\\Delta H = \\sum H(\\text{prod}) - \\sum H(\\text{react})', subject: 'Química' },
  { id: 'q8', name: 'Velocidad de reacción', expression: 'v = k[A]^n[B]^m', subject: 'Química' },
];

function renderKatex(expression: string): string {
  try {
    return katex.renderToString(expression, {
      displayMode: true,
      throwOnError: false,
      trust: true,
    });
  } catch {
    return `<span style="color:var(--ink-muted)">${expression}</span>`;
  }
}

export function renderFormulas(el: HTMLElement) {
  const customFormulas = storage.get<Formula[]>('customFormulas', []);
  const allFormulas = [...DEFAULT_FORMULAS, ...customFormulas];
  const subjects = ['Todos', ...new Set(allFormulas.map(f => f.subject))];
  let filter = 'Todos';
  let search = '';

  const render = () => {
    const filtered = allFormulas.filter(f => {
      if (filter !== 'Todos' && f.subject !== filter) return false;
      if (search && !f.name.toLowerCase().includes(search) && !f.expression.toLowerCase().includes(search)) return false;
      return true;
    });

    const bySubject = filtered.reduce((acc, f) => {
      acc[f.subject] = acc[f.subject] || [];
      acc[f.subject].push(f);
      return acc;
    }, {} as Record<string, Formula[]>);

    el.innerHTML = `
      <h1>Chuletario de fórmulas</h1>
      <div class="glass-card">
        <input class="input" id="formula-search" placeholder="Buscar fórmula..." value="${search}" style="margin-bottom:12px;">
        <div class="module-tabs">
          ${subjects.map(s => `<button class="module-tab ${filter === s ? 'active' : ''}" data-filter="${s}">${s}</button>`).join('')}
        </div>
      </div>
      ${Object.entries(bySubject).map(([subject, list]) => `
        <div class="glass-card">
          <h3>${subject}</h3>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
            ${list.map(f => `
              <div class="formula-card">
                <div class="formula-name">${f.name}</div>
                <div class="formula-expr">${renderKatex(f.expression)}</div>
                ${customFormulas.some(cf => cf.id === f.id) ? `<button class="btn btn-ghost" style="font-size:11px;margin-top:6px;" data-del-formula="${f.id}">Eliminar</button>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <div class="glass-card">
        <h3>Agregar fórmula</h3>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
          <input class="input" id="formula-name" placeholder="Nombre">
          <input class="input" id="formula-expr" placeholder="Expresión LaTeX (ej: F = m \\cdot a)">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <select class="input" id="formula-subject" style="flex:1;min-width:120px;">
              ${['Matemáticas','Física','Química'].map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="formula-add">Agregar</button>
          </div>
        </div>
      </div>`;

    el.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = (btn as HTMLElement).dataset.filter!;
        render();
      });
    });

    el.querySelector('#formula-search')?.addEventListener('input', (e) => {
      search = (e.target as HTMLInputElement).value.toLowerCase();
      render();
    });

    el.querySelectorAll('[data-del-formula]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.delFormula!;
        const idx = customFormulas.findIndex(f => f.id === id);
        if (idx >= 0) { customFormulas.splice(idx, 1); storage.set('customFormulas', customFormulas); render(); }
      });
    });

    el.querySelector('#formula-add')?.addEventListener('click', () => {
      const name = (el.querySelector('#formula-name') as HTMLInputElement).value.trim();
      const expression = (el.querySelector('#formula-expr') as HTMLInputElement).value.trim();
      const subject = (el.querySelector('#formula-subject') as HTMLSelectElement).value;
      if (!name || !expression) return;
      customFormulas.push({ id: Date.now().toString(36), name, expression, subject });
      storage.set('customFormulas', customFormulas);
      render();
    });
  };

  render();
}
