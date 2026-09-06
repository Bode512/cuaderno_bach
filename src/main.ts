import { renderOrganizer } from './modules/organizer';
import { renderCalculator } from './modules/calculator';
import { renderFlashcards, cleanupFlashcards } from './modules/flashcards';
import { renderFormulas } from './modules/formulas';
import { renderExtras, cleanupExtras } from './modules/extras';
import { renderCalendar } from './modules/calendar';
import { renderPauPrep } from './modules/pauprep';
import { storage } from './storage';

type Tab = 'organizer' | 'calendar' | 'pauprep' | 'calculator' | 'flashcards' | 'formulas' | 'extras';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'organizer', label: 'Organizar', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>' },
  { id: 'calendar', label: 'Calendario', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><rect x="7" y="13" width="3" height="3" rx="0.5"/><rect x="14" y="13" width="3" height="3" rx="0.5"/></svg>' },
  { id: 'pauprep', label: 'PAU', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>' },
  { id: 'calculator', label: 'Notas', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h4M8 18h4"/></svg>' },
  { id: 'flashcards', label: 'Fichas', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>' },
  { id: 'formulas', label: 'Fórmulas', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 7h6M9 11h6M9 15h4"/><circle cx="12" cy="12" r="10"/></svg>' },
  { id: 'extras', label: 'Extras', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' },
];

let currentTab: Tab = (storage.get<string>('lastTab', 'organizer') as Tab) || 'organizer';

const renderers: Record<Tab, (el: HTMLElement) => void> = {
  organizer: renderOrganizer,
  calendar: renderCalendar,
  pauprep: renderPauPrep,
  calculator: renderCalculator,
  flashcards: renderFlashcards,
  formulas: renderFormulas,
  extras: renderExtras,
};

function renderTabBar() {
  const tabBar = document.getElementById('tab-bar')!;
  tabBar.innerHTML = tabs.map(t => `
    <button class="tab-btn ${t.id === currentTab ? 'active' : ''}" data-tab="${t.id}">
      ${t.icon}
      <span>${t.label}</span>
    </button>
  `).join('');

  tabBar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.tab as Tab;
      if (tab === currentTab) return;
      switchTab(tab);
    });
  });
}

function switchTab(tab: Tab) {
  const main = document.getElementById('main-content')!;
  const doSwitch = () => {
    cleanupExtras();
    cleanupFlashcards();
    currentTab = tab;
    storage.set('lastTab', tab);
    renderTabBar();
    renderers[tab](main);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (document.startViewTransition) {
    document.startViewTransition(doSwitch);
  } else {
    doSwitch();
  }
}

function initScrollBehavior() {
  const tabBar = document.getElementById('tab-bar')!;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      tabBar.classList.add('scrolled');
    } else {
      tabBar.classList.remove('scrolled');
    }
  }, { passive: true });
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle')!;
  const updateIcon = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  };

  updateIcon();

  btn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      storage.set('theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      storage.set('theme', 'dark');
    }
    updateIcon();
  });
}

function initBackupReminder() {
  const lastReminder = storage.get<number>('backupReminder', 0);
  const now = Date.now();
  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
  if (now - lastReminder > TWO_WEEKS) {
    setTimeout(() => {
      const main = document.getElementById('main-content')!;
      const existing = main.querySelector('.backup-reminder');
      if (existing) return;
      const div = document.createElement('div');
      div.className = 'backup-reminder';
      div.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <span style="font-size:13px;">💾 Recuerda hacer una copia de seguridad periódica en Organizar → Copia de seguridad.</span>
        <button class="btn btn-ghost" style="font-size:11px;flex-shrink:0;" id="backup-dismiss">Cerrar</button>
      </div>`;
      main.prepend(div);
      div.querySelector('#backup-dismiss')?.addEventListener('click', () => div.remove());
      storage.set('backupReminder', now);
    }, 5000);
  }
}

function initGestureNavigation() {
  const tabBar = document.getElementById('tab-bar')!;
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = false;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 80 && Math.abs(dy) < 50) {
      const tabOrder = tabs.map(t => t.id);
      const currentIdx = tabOrder.indexOf(currentTab);

      if (dx < 0 && currentIdx < tabOrder.length - 1) {
        switchTab(tabOrder[currentIdx + 1]);
      } else if (dx > 0 && currentIdx > 0) {
        switchTab(tabOrder[currentIdx - 1]);
      }
    }
    isSwiping = false;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (isSwiping) return;
    const touchMoveX = e.touches[0].clientX;
    const touchMoveY = e.touches[0].clientY;
    const dx = Math.abs(touchMoveX - touchStartX);
    const dy = Math.abs(touchMoveY - touchStartY);
    if (dx > 30 && dx > dy * 2) {
      isSwiping = true;
    }
  }, { passive: true });
}

function initMobileNavScroll() {
  if (window.innerWidth >= 768) return;
  const tabBar = document.getElementById('tab-bar')!;

  const checkOverflow = () => {
    if (tabBar.scrollWidth > tabBar.clientWidth) {
      tabBar.classList.add('has-overflow');
    } else {
      tabBar.classList.remove('has-overflow');
    }
  };

  checkOverflow();
  window.addEventListener('resize', checkOverflow);

  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  tabBar.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].pageX - tabBar.offsetLeft;
    scrollLeft = tabBar.scrollLeft;
  }, { passive: true });

  tabBar.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const x = e.touches[0].pageX - tabBar.offsetLeft;
    const walk = (x - startX) * 1.5;
    tabBar.scrollLeft = scrollLeft - walk;
  }, { passive: true });

  tabBar.addEventListener('touchend', () => { isDragging = false; }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  renderTabBar();
  renderers[currentTab](document.getElementById('main-content')!);
  initScrollBehavior();
  initThemeToggle();
  initBackupReminder();
  initGestureNavigation();
  initMobileNavScroll();
});
