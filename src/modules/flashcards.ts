import { storage } from '../storage';

// Types
interface Flashcard {
  id: string;
  question: string;
  answer: string;
  subject: string;
  box: number; // spaced repetition box (0-4)
  lastReview: string;
}

interface TestQuestion {
  cardId: string;
  question: string;
  options: string[];
  correct: number;
}

type SubTab = 'fichas' | 'repaso' | 'test' | 'ruleta';

let subTab: SubTab = 'fichas';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const SUBJECTS = ['Valenciano','Lengua Castellana','Física','Química','Historia','Filosofía','Matemáticas','Tecnología','Biología'];

export function renderFlashcards(el: HTMLElement) {
  el.innerHTML = `
    <h1>Fichas de repaso</h1>
    <div class="module-tabs">
      <button class="module-tab ${subTab==='fichas'?'active':''}" data-stab="fichas">Mis fichas</button>
      <button class="module-tab ${subTab==='repaso'?'active':''}" data-stab="repaso">Repaso espaciado</button>
      <button class="module-tab ${subTab==='test'?'active':''}" data-stab="test">Test</button>
      <button class="module-tab ${subTab==='ruleta'?'active':''}" data-stab="ruleta">Ruleta</button>
    </div>
    <div id="flashcard-content"></div>
  `;

  el.querySelectorAll('.module-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      subTab = (btn as HTMLElement).dataset.stab as SubTab;
      renderFlashcards(el);
    });
  });

  const content = el.querySelector('#flashcard-content')! as HTMLElement;
  switch (subTab) {
    case 'fichas': renderCardList(content); break;
    case 'repaso': renderSpacedReview(content); break;
    case 'test': renderTest(content); break;
    case 'ruleta': renderRoulette(content); break;
  }
}

// ===== Feature 10: Fichas de repaso =====
function renderCardList(el: HTMLElement) {
  const cards = storage.get<Flashcard[]>('flashcards', []);

  let html = `<div class="glass-card">
    <div class="section-header"><h3>Mis fichas</h3><span class="badge">${cards.length}</span></div>`;

  if (cards.length === 0) {
    html += `<div class="empty-state"><p>Crea tu primera ficha de repaso</p></div>`;
  } else {
    const bySubject = cards.reduce((acc, c) => {
      acc[c.subject] = acc[c.subject] || [];
      acc[c.subject].push(c);
      return acc;
    }, {} as Record<string, Flashcard[]>);

    Object.entries(bySubject).forEach(([subject, list]) => {
      html += `<div style="margin-bottom:16px;">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;">${subject} <span class="badge">${list.length}</span></div>`;
      list.forEach(c => {
        html += `<div class="task-item" style="cursor:pointer;" data-preview="${c.id}">
          <div class="task-info">
            <div class="task-title">${c.question}</div>
            <div class="task-meta">Caja ${c.box + 1}/5 · Último repaso: ${c.lastReview || 'Nunca'}</div>
          </div>
          <button class="btn btn-ghost" style="font-size:11px;" data-del-card="${c.id}">×</button>
        </div>`;
      });
      html += `</div>`;
    });
  }
  html += `</div>`;

  html += `<div class="glass-card"><h3>Nueva ficha</h3>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
      <input class="input" id="card-question" placeholder="Pregunta">
      <textarea class="input" id="card-answer" placeholder="Respuesta" rows="3" style="resize:vertical;"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select class="input" id="card-subject" style="flex:1;min-width:120px;">
          ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="card-add">Crear ficha</button>
      </div>
    </div>
  </div>`;

  el.innerHTML = html;

  el.querySelectorAll('[data-del-card]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.delCard!;
      const idx = cards.findIndex(c => c.id === id);
      if (idx >= 0) { cards.splice(idx, 1); storage.set('flashcards', cards); renderCardList(el); }
    });
  });

  el.querySelectorAll('[data-preview]').forEach(item => {
    item.addEventListener('click', () => {
      const id = (item as HTMLElement).dataset.preview!;
      const card = cards.find(c => c.id === id);
      if (!card) return;
      showCardPreview(card);
    });
  });

  el.querySelector('#card-add')?.addEventListener('click', () => {
    const question = (el.querySelector('#card-question') as HTMLInputElement).value.trim();
    const answer = (el.querySelector('#card-answer') as HTMLTextAreaElement).value.trim();
    const subject = (el.querySelector('#card-subject') as HTMLSelectElement).value;
    if (!question || !answer) return;
    cards.push({ id: genId(), question, answer, subject, box: 0, lastReview: '' });
    storage.set('flashcards', cards);
    renderCardList(el);
  });
}

function showCardPreview(card: Flashcard) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="flashcard-container">
        <div class="flashcard" id="preview-flip">
          <div class="flashcard-face flashcard-front">
            <div class="flashcard-label">Pregunta</div>
            <div class="flashcard-text">${card.question}</div>
          </div>
          <div class="flashcard-face flashcard-back">
            <div class="flashcard-label">Respuesta</div>
            <div class="flashcard-text">${card.answer}</div>
          </div>
        </div>
      </div>
      <p style="text-align:center;font-size:12px;color:var(--ink-muted);margin-top:12px;">Toca para voltear · ${card.subject}</p>
      <button class="btn btn-ghost" style="width:100%;margin-top:12px;" id="close-preview">Cerrar</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.querySelector('#preview-flip')?.addEventListener('click', () => {
    overlay.querySelector('#preview-flip')?.classList.toggle('flipped');
  });
  overlay.querySelector('#close-preview')?.addEventListener('click', () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    }
  });
}

// ===== Feature 11: Repaso espaciado =====
function renderSpacedReview(el: HTMLElement) {
  const cards = storage.get<Flashcard[]>('flashcards', []);
  const today = new Date().toISOString().slice(0, 10);

  const INTERVALS = [1, 3, 7, 14, 30];
  const due = cards.filter(c => {
    if (!c.lastReview) return true;
    const last = new Date(c.lastReview);
    const diff = Math.floor((new Date(today).getTime() - last.getTime()) / 86400000);
    return diff >= INTERVALS[c.box];
  });

  if (due.length === 0) {
    el.innerHTML = `
      <div class="glass-card">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p style="font-weight:600;margin-bottom:4px;">¡Todo al día!</p>
          <p style="font-size:13px;">No hay fichas pendientes de repaso ahora mismo.</p>
        </div>
      </div>`;
    return;
  }

  let currentIdx = 0;

  const renderCurrent = () => {
    if (currentIdx >= due.length) {
      el.innerHTML = `<div class="glass-card"><div class="empty-state">
        <p style="font-weight:600;">¡Repaso completado!</p>
        <p style="font-size:13px;">Has repasado todas las fichas pendientes.</p>
      </div></div>`;
      return;
    }

    const card = due[currentIdx];
    el.innerHTML = `
      <div class="glass-card" style="text-align:center;">
        <div style="font-size:12px;color:var(--ink-muted);margin-bottom:8px;">${currentIdx + 1} de ${due.length} · ${card.subject}</div>
        <div class="flashcard-container">
          <div class="flashcard" id="review-flip">
            <div class="flashcard-face flashcard-front">
              <div class="flashcard-label">Pregunta</div>
              <div class="flashcard-text">${card.question}</div>
            </div>
            <div class="flashcard-face flashcard-back">
              <div class="flashcard-label">Respuesta</div>
              <div class="flashcard-text">${card.answer}</div>
            </div>
          </div>
        </div>
        <p style="font-size:12px;color:var(--ink-muted);margin:12px 0;">Toca para ver la respuesta</p>
        <div style="display:flex;gap:8px;justify-content:center;">
          <button class="btn btn-secondary" id="review-hard">Difícil</button>
          <button class="btn btn-primary" id="review-good">Bien</button>
          <button class="btn" id="review-easy" style="background:#27ae60;color:white;">Fácil</button>
        </div>
      </div>`;

    el.querySelector('#review-flip')?.addEventListener('click', () => {
      el.querySelector('#review-flip')?.classList.toggle('flipped');
    });

    const answer = (quality: 'hard' | 'good' | 'easy') => {
      const idx = cards.findIndex(c => c.id === card.id);
      if (idx >= 0) {
        if (quality === 'hard') cards[idx].box = 0;
        else if (quality === 'good') cards[idx].box = Math.min(4, cards[idx].box + 1);
        else cards[idx].box = Math.min(4, cards[idx].box + 2);
        cards[idx].lastReview = today;
        storage.set('flashcards', cards);
      }
      currentIdx++;
      renderCurrent();
    };

    el.querySelector('#review-hard')?.addEventListener('click', () => answer('hard'));
    el.querySelector('#review-good')?.addEventListener('click', () => answer('good'));
    el.querySelector('#review-easy')?.addEventListener('click', () => answer('easy'));
  };

  el.innerHTML = '';
  renderCurrent();

  el.querySelector('#review-flip')?.addEventListener('click', () => {
    el.querySelector('#review-flip')?.classList.toggle('flipped');
  });
}

// ===== Feature 12: Generador de tests =====
function renderTest(el: HTMLElement) {
  const cards = storage.get<Flashcard[]>('flashcards', []);

  if (cards.length < 4) {
    el.innerHTML = `<div class="glass-card"><div class="empty-state">
      <p>Necesitas al menos 4 fichas para generar un test</p>
      <p style="font-size:13px;">Tienes ${cards.length} ficha(s)</p>
    </div></div>`;
    return;
  }

  const testSize = Math.min(10, cards.length);
  const shuffled = [...cards].sort(() => Math.random() - 0.5).slice(0, testSize);
  const questions: TestQuestion[] = shuffled.map(card => {
    const otherCards = cards.filter(c => c.id !== card.id);
    const wrongAnswers = otherCards.sort(() => Math.random() - 0.5).slice(0, 3).map(c => c.answer);
    const options = [card.answer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    return {
      cardId: card.id,
      question: card.question,
      options,
      correct: options.indexOf(card.answer)
    };
  });

  let currentQ = 0;
  let score = 0;
  let answered = false;

  const renderQuestion = () => {
    if (currentQ >= questions.length) {
      el.innerHTML = `<div class="glass-card" style="text-align:center;">
        <h2>Test completado</h2>
        <div class="countdown-number" style="margin:16px 0;">${score}/${questions.length}</div>
        <p style="margin-bottom:16px;">${score === questions.length ? '¡Perfecto!' : score >= questions.length * 0.7 ? '¡Bien hecho!' : 'Sigue practicando'}</p>
        <button class="btn btn-primary" id="test-retry">Volver a intentar</button>
      </div>`;
      el.querySelector('#test-retry')?.addEventListener('click', () => renderTest(el));
      return;
    }

    const q = questions[currentQ];
    el.innerHTML = `
      <div class="glass-card">
        <div style="font-size:12px;color:var(--ink-muted);margin-bottom:8px;">Pregunta ${currentQ + 1} de ${questions.length}</div>
        <div class="tracker-bar" style="margin-bottom:16px;"><div class="tracker-fill" style="width:${(currentQ/questions.length)*100}%;"></div></div>
        <h3 style="margin-bottom:16px;">${q.question}</h3>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${q.options.map((opt, i) => `
            <button class="btn btn-secondary test-option" data-idx="${i}" style="text-align:left;justify-content:flex-start;padding:12px 16px;">${opt}</button>
          `).join('')}
        </div>
      </div>`;

    el.querySelectorAll('.test-option').forEach((btn: Element) => {
      (btn as HTMLElement).addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const idx = parseInt((btn as HTMLElement).dataset.idx!);
        if (idx === q.correct) {
          score++;
          (btn as HTMLElement).style.background = '#27ae60';
          (btn as HTMLElement).style.color = 'white';
        } else {
          (btn as HTMLElement).style.background = '#e74c3c';
          (btn as HTMLElement).style.color = 'white';
          (el.querySelector(`[data-idx="${q.correct}"]`) as HTMLElement).style.background = '#27ae60';
          (el.querySelector(`[data-idx="${q.correct}"]`) as HTMLElement).style.color = 'white';
        }
        setTimeout(() => {
          currentQ++;
          answered = false;
          renderQuestion();
        }, 1000);
      });
    });
  };

  el.innerHTML = '';
  renderQuestion();
}

// ===== Feature 17: Ruleta de estudio =====
function renderRoulette(el: HTMLElement) {
  const cards = storage.get<Flashcard[]>('flashcards', []);

  if (cards.length === 0) {
    el.innerHTML = `<div class="glass-card"><div class="empty-state">
      <p>No hay fichas para la ruleta</p>
      <p style="font-size:13px;">Crea fichas primero en "Mis fichas"</p>
    </div></div>`;
    return;
  }

  let spinning = false;

  el.innerHTML = `
    <div class="glass-card" style="text-align:center;">
      <h3>Ruleta de estudio</h3>
      <p style="font-size:13px;margin-bottom:16px;">Pulsa para elegir una ficha al azar</p>
      <div id="roulette-display" style="min-height:160px;display:flex;align-items:center;justify-content:center;">
        <div style="font-size:4rem;">🎰</div>
      </div>
      <button class="btn btn-primary" id="roulette-spin" style="margin-top:16px;padding:12px 32px;font-size:16px;">¡Girar!</button>
    </div>`;

  el.querySelector('#roulette-spin')?.addEventListener('click', () => {
    if (spinning) return;
    spinning = true;
    const display = el.querySelector('#roulette-display')!;
    const btn = el.querySelector('#roulette-spin') as HTMLButtonElement;
    btn.disabled = true;

    let count = 0;
    const maxCount = 15;
    const interval = setInterval(() => {
      const randomCard = cards[Math.floor(Math.random() * cards.length)];
      display.innerHTML = `<div style="font-family:var(--font-display);font-size:1.3rem;font-weight:600;padding:16px;">${randomCard.question}</div>`;
      count++;
      if (count >= maxCount) {
        clearInterval(interval);
        const finalCard = cards[Math.floor(Math.random() * cards.length)];
        showCardPreview(finalCard);
        spinning = false;
        btn.disabled = false;
      }
    }, 100 + count * 20);
  });
}
