// Internationalization module
// Supports runtime language switching with JSON translation files

import { APP_VERSION } from '../config/config.public.js';

const SUPPORTED_LANGS = new Set(['de', 'en', 'fr']);
const DEFAULT_LANG = 'en';

let translations = {};
let currentLang = DEFAULT_LANG;

/**
 * Pick the best supported language from the browser's ordered preference list.
 * navigator.languages = ['fr-FR', 'fr', 'en-US', 'en'] -> 'fr'
 */
function detectBrowserLang() {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of preferred) {
    const code = lang.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGS.has(code)) return code;
  }
  return DEFAULT_LANG;
}

/**
 * Initialize i18n: honour localStorage override first, then browser preferences.
 * Must be awaited before calling applyTranslations().
 */
export async function initI18n() {
  const saved = localStorage.getItem('lang');
  currentLang = (saved && SUPPORTED_LANGS.has(saved)) ? saved : detectBrowserLang();
  await loadTranslations(currentLang);
  document.documentElement.lang = currentLang;
}

async function loadTranslations(lang) {
  try {
    const res = await fetch(`./js/i18n/${lang}.json?v=${APP_VERSION}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    translations = await res.json();
  } catch (e) {
    console.warn(`[i18n] Failed to load translations for "${lang}":`, e);
    translations = {};
  }
}

/**
 * Translate a dot-notated key, e.g. t('routing.calculate')
 * Returns the key itself as fallback if not found.
 */
export function t(key) {
  const result = key.split('.').reduce((obj, k) => obj?.[k], translations);
  return result ?? key;
}

/**
 * Switch language, reload translations, and re-render the DOM.
 */
export async function setLang(lang) {
  if (!SUPPORTED_LANGS.has(lang)) {
    console.warn('[i18n] Unsupported language:', lang);
    return;
  }
  console.debug('[i18n] setLang:', lang);
  const _paq = window._paq;
  if (Array.isArray(_paq)) _paq.push(['trackEvent', 'UI', 'Language', lang]);
  localStorage.setItem('lang', lang);
  currentLang = lang;
  await loadTranslations(lang);
  document.documentElement.lang = lang;
  applyTranslations();
  _updateSwitcherUI();
}

// Provide explicit helper to force full translation refresh
export async function refreshLanguage() {
  console.debug('[i18n] refreshLanguage:', currentLang);
  await loadTranslations(currentLang);
  applyTranslations();
  _updateSwitcherUI();
}

export function getLang() {
  return currentLang;
}

/**
 * Apply translations to all annotated DOM elements.
 * Called once on init and again on every language switch.
 */
export function applyTranslations() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  // Placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  // Title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  // HTML content (for strings that contain HTML tags like <br>)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  _updateSwitcherUI();
}

function _updateSwitcherUI() {
  const select = document.getElementById('lang-switcher');
  if (select) select.value = currentLang;
}
