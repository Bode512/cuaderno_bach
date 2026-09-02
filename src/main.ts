import { renderOrganizer } from './modules/organizer';
import { renderCalculator } from './modules/calculator';
import { renderFlashcards } from './modules/flashcards';
import { renderFormulas } from './modules/formulas';
import { renderExtras } from './modules/extras';
import { storage } from './storage';

type Tab = 'organizer' | 'calculator' | 'flashcards' | 'formulas' | 'extras';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'organizer', label: 'Organizar', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>' },
  { id: 'calculator', label: 'Notas', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h4M8 18h4"/></svg>' },
  { id: 'flashcards', label: 'Fichas', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>' },
  { id: 'formulas', label: 'Fórmulas', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 7h6M9 11h6M9 15h4"/><circle cx="12" cy="12" r="10"/></svg>' },
  { id: 'extras', label: 'Extras', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' },
];

let currentTab: Tab = (storage.get<string>('lastTab', 'organizer') as Tab) || 'organizer';

const renderers: Record<Tab, (el: HTMLElement) => void> = {
  organizer: renderOrganizer,
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

document.addEventListener('DOMContentLoaded', () => {
  renderTabBar();
  renderers[currentTab](document.getElementById('main-content')!);
  initScrollBehavior();
  initThemeToggle();
});
