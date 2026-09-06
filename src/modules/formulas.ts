import { storage } from '../storage';
import katex from 'katex';

interface Formula {
  id: string;
  name: string;
  expression: string;
  subject: string;
  topic: string;
}

const ALL_SUBJECTS = ['Valenciano','Inglés','Lengua Castellana','Física','Química','Historia','Filosofía','Matemáticas','Tecnología','Biología'];

const DEFAULT_FORMULAS: Formula[] = [
  // Matemáticas
  { id: 'm1', name: 'Cuadrática', expression: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', subject: 'Matemáticas', topic: 'Álgebra' },
  { id: 'm2', name: 'Teorema de Pitágoras', expression: 'a^2 + b^2 = c^2', subject: 'Matemáticas', topic: 'Geometría' },
  { id: 'm3', name: 'Área del círculo', expression: 'A = \\pi r^2', subject: 'Matemáticas', topic: 'Geometría' },
  { id: 'm4', name: 'Volumen del cilindro', expression: 'V = \\pi r^2 h', subject: 'Matemáticas', topic: 'Geometría' },
  { id: 'm5', name: 'Perímetro del rectángulo', expression: 'P = 2(l + a)', subject: 'Matemáticas', topic: 'Geometría' },
  { id: 'm6', name: 'Identidad pitagórica', expression: '\\sin^2\\theta + \\cos^2\\theta = 1', subject: 'Matemáticas', topic: 'Trigonometría' },
  { id: 'm7', name: 'Ley de senos', expression: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}', subject: 'Matemáticas', topic: 'Trigonometría' },
  { id: 'm8', name: 'Ley de cosenos', expression: 'c^2 = a^2 + b^2 - 2ab\\cos C', subject: 'Matemáticas', topic: 'Trigonometría' },
  { id: 'm9', name: 'Derivada potencia', expression: '\\frac{d}{dx}x^n = nx^{n-1}', subject: 'Matemáticas', topic: 'Cálculo' },
  { id: 'm10', name: 'Integral potencia', expression: '\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C', subject: 'Matemáticas', topic: 'Cálculo' },
  // Física
  { id: 'f1', name: 'Velocidad media', expression: 'v = \\frac{\\Delta x}{\\Delta t}', subject: 'Física', topic: 'Cinemática' },
  { id: 'f2', name: 'Aceleración', expression: 'a = \\frac{\\Delta v}{\\Delta t}', subject: 'Física', topic: 'Cinemática' },
  { id: 'f3', name: 'Segunda ley de Newton', expression: 'F = m \\cdot a', subject: 'Física', topic: 'Dinámica' },
  { id: 'f4', name: 'Trabajo', expression: 'W = F \\cdot d \\cdot \\cos\\theta', subject: 'Física', topic: 'Dinámica' },
  { id: 'f5', name: 'Energía cinética', expression: 'E_k = \\frac{1}{2}mv^2', subject: 'Física', topic: 'Energía' },
  { id: 'f6', name: 'Energía potencial', expression: 'E_p = m \\cdot g \\cdot h', subject: 'Física', topic: 'Energía' },
  { id: 'f7', name: 'Ley de gravitación', expression: 'F = G\\frac{m_1 m_2}{r^2}', subject: 'Física', topic: 'Gravitación' },
  { id: 'f8', name: 'Ley de Ohm', expression: 'V = I \\cdot R', subject: 'Física', topic: 'Electricidad' },
  { id: 'f9', name: 'Potencia eléctrica', expression: 'P = V \\cdot I = I^2 R', subject: 'Física', topic: 'Electricidad' },
  { id: 'f10', name: 'Ecuación de la cinemática', expression: 'x = x_0 + v_0 t + \\frac{1}{2}at^2', subject: 'Física', topic: 'Cinemática' },
  // Química
  { id: 'q1', name: 'Moles', expression: 'n = \\frac{m}{M}', subject: 'Química', topic: 'Estequiometría' },
  { id: 'q2', name: 'Concentración molar', expression: 'C = \\frac{n}{V}', subject: 'Química', topic: 'Estequiometría' },
  { id: 'q3', name: 'Gases ideales', expression: 'PV = nRT', subject: 'Química', topic: 'Gases' },
  { id: 'q4', name: 'pH', expression: 'pH = -\\log[H^+]', subject: 'Química', topic: 'Acidez y basicidad' },
  { id: 'q5', name: 'Diluciones', expression: 'C_1 V_1 = C_2 V_2', subject: 'Química', topic: 'Disoluciones' },
  { id: 'q6', name: 'Masa molar', expression: 'M = \\frac{m}{n}', subject: 'Química', topic: 'Estequiometría' },
  { id: 'q7', name: 'Entalpía', expression: '\\Delta H = \\sum H(\\text{prod}) - \\sum H(\\text{react})', subject: 'Química', topic: 'Termodinámica' },
  { id: 'q8', name: 'Velocidad de reacción', expression: 'v = k[A]^n[B]^m', subject: 'Química', topic: 'Cinética' },
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
  const subjects = ['Todos', ...ALL_SUBJECTS];
  let filter = 'Todos';
  let search = '';
  let expandedSubjects: Record<string, boolean> = {};
  let expandedTopics: Record<string, boolean> = {};

  const render = () => {
    const filtered = allFormulas.filter(f => {
      if (filter !== 'Todos' && f.subject !== filter) return false;
      if (search && !f.name.toLowerCase().includes(search) && !f.expression.toLowerCase().includes(search) && !f.topic.toLowerCase().includes(search)) return false;
      return true;
    });

    const bySubject = filtered.reduce((acc, f) => {
      acc[f.subject] = acc[f.subject] || {};
      acc[f.subject][f.topic] = acc[f.subject][f.topic] || [];
      acc[f.subject][f.topic].push(f);
      return acc;
    }, {} as Record<string, Record<string, Formula[]>>);

    const subjectOrder = ALL_SUBJECTS.filter(s => bySubject[s]);
    if (filter !== 'Todos' && bySubject[filter]) {
      subjectOrder.splice(0, subjectOrder.length, filter);
    }

    el.innerHTML = `
      <h1>Chuletario de fórmulas</h1>
      <div class="glass-card">
        <input class="input" id="formula-search" placeholder="Buscar fórmula..." value="${search}" style="margin-bottom:12px;">
        <div class="notes-subject-scroll">
          <button class="scroll-arrow" id="formula-scroll-left">&#9664;</button>
          <div class="notes-subject-list" id="formula-subject-list">
            ${subjects.map(s => `<button class="module-tab ${filter === s ? 'active' : ''}" data-filter="${s}">${s}</button>`).join('')}
          </div>
          <button class="scroll-arrow" id="formula-scroll-right">&#9654;</button>
        </div>
      </div>
      ${subjectOrder.map(subject => {
        const topics = bySubject[subject];
        const topicNames = Object.keys(topics);
        const isSubjectExpanded = expandedSubjects[subject] !== false;
        return `
        <div class="glass-card">
          <div class="formula-subject-header" data-toggle-subject="${subject}" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 0;">
            <span class="formula-toggle-icon" style="font-size:12px;color:var(--ink-muted);transition:transform 0.2s;${isSubjectExpanded ? 'transform:rotate(90deg);' : ''}">&#9654;</span>
            <h3 style="margin:0;">${subject}</h3>
            <span style="font-size:12px;color:var(--ink-muted);margin-left:auto;">${topics[topicNames[0]]?.length || 0}${topicNames.length > 1 ? ` + ${topicNames.reduce((sum, t, i) => i === 0 ? 0 : sum + (topics[t]?.length || 0), 0)} más` : ''} fórmula${(topics[topicNames[0]]?.length || 0) !== 1 ? 's' : ''}</span>
          </div>
          ${isSubjectExpanded ? `<div style="margin-top:12px;">${topicNames.map(topic => {
            const isTopicExpanded = expandedTopics[`${subject}|${topic}`] !== false;
            return `
            <div style="margin-bottom:8px;">
              <div class="formula-topic-header" data-toggle-topic="${subject}|${topic}" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 8px;border-radius:8px;background:var(--accent-soft);transition:background 0.15s;">
                <span style="font-size:10px;color:var(--ink-muted);transition:transform 0.2s;${isTopicExpanded ? 'transform:rotate(90deg);' : ''}">&#9654;</span>
                <span style="font-size:13px;font-weight:600;color:var(--ink);">${topic}</span>
                <span style="font-size:11px;color:var(--ink-muted);margin-left:auto;">${topics[topic].length}</span>
              </div>
              ${isTopicExpanded ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;padding-left:16px;">
                ${topics[topic].map(f => `
                  <div class="formula-card">
                    <div class="formula-name">${f.name}</div>
                    <div class="formula-expr">${renderKatex(f.expression)}</div>
                    ${customFormulas.some(cf => cf.id === f.id) ? `<button class="btn btn-ghost" style="font-size:11px;margin-top:6px;" data-del-formula="${f.id}">Eliminar</button>` : ''}
                  </div>
                `).join('')}
              </div>` : ''}
            </div>`;
          }).join('')}</div>` : ''}
        </div>`;
      }).join('')}
      <div class="glass-card">
        <h3>Agregar fórmula</h3>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <select class="input" id="formula-subject" style="flex:1;min-width:120px;">
              ${ALL_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <input class="input" id="formula-topic" placeholder="Tema" style="flex:1;min-width:120px;" list="topic-list">
            <datalist id="topic-list"></datalist>
          </div>
          <input class="input" id="formula-name" placeholder="Nombre de la fórmula">
          <input class="input" id="formula-expr" placeholder="Expresión LaTeX (ej: F = m \\cdot a)">
          <button class="btn btn-primary" id="formula-add">Agregar fórmula</button>
        </div>
      </div>`;

    el.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = (btn as HTMLElement).dataset.filter!;
        render();
      });
    });

    const formulaScrollList = el.querySelector('#formula-subject-list') as HTMLElement;
    const formulaScrollLeft = el.querySelector('#formula-scroll-left') as HTMLButtonElement;
    const formulaScrollRight = el.querySelector('#formula-scroll-right') as HTMLButtonElement;
    if (formulaScrollList && formulaScrollLeft && formulaScrollRight) {
      formulaScrollLeft.addEventListener('click', () => formulaScrollList.scrollBy({ left: -160, behavior: 'smooth' }));
      formulaScrollRight.addEventListener('click', () => formulaScrollList.scrollBy({ left: 160, behavior: 'smooth' }));
    }

    el.querySelector('#formula-search')?.addEventListener('input', (e) => {
      search = (e.target as HTMLInputElement).value.toLowerCase();
      render();
    });

    el.querySelectorAll('[data-toggle-subject]').forEach(el2 => {
      el2.addEventListener('click', () => {
        const subj = (el2 as HTMLElement).dataset.toggleSubject!;
        expandedSubjects[subj] = expandedSubjects[subj] === false ? true : false;
        render();
      });
    });

    el.querySelectorAll('[data-toggle-topic]').forEach(el2 => {
      el2.addEventListener('click', () => {
        const key = (el2 as HTMLElement).dataset.toggleTopic!;
        expandedTopics[key] = expandedTopics[key] === false ? true : false;
        render();
      });
    });

    el.querySelectorAll('[data-del-formula]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.delFormula!;
        const idx = customFormulas.findIndex(f => f.id === id);
        if (idx >= 0) { customFormulas.splice(idx, 1); storage.set('customFormulas', customFormulas); render(); }
      });
    });

    const subjectSelect = el.querySelector('#formula-subject') as HTMLSelectElement;
    const topicInput = el.querySelector('#formula-topic') as HTMLInputElement;
    const datalist = el.querySelector('#topic-list') as HTMLDataListElement;

    const updateTopicSuggestions = () => {
      const subj = subjectSelect.value;
      const existingTopics = [...new Set(allFormulas.filter(f => f.subject === subj).map(f => f.topic))];
      datalist.innerHTML = existingTopics.map(t => `<option value="${t}">`).join('');
    };
    updateTopicSuggestions();
    subjectSelect?.addEventListener('change', updateTopicSuggestions);

    el.querySelector('#formula-add')?.addEventListener('click', () => {
      const name = (el.querySelector('#formula-name') as HTMLInputElement).value.trim();
      const expression = (el.querySelector('#formula-expr') as HTMLInputElement).value.trim();
      const subject = subjectSelect.value;
      const topic = topicInput.value.trim() || 'General';
      if (!name || !expression) return;
      customFormulas.push({ id: Date.now().toString(36), name, expression, subject, topic });
      storage.set('customFormulas', customFormulas);
      (el.querySelector('#formula-name') as HTMLInputElement).value = '';
      (el.querySelector('#formula-expr') as HTMLInputElement).value = '';
      render();
    });
  };

  render();
}
