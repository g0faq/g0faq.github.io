/**
 * ВЕЩДОК — каталог: клиентские фильтры, сортировка, синхронизация с URL.
 */

import {
  products,
  CATEGORIES,
  GENDERS,
  ALL_SIZES,
  PRICE_MIN,
  PRICE_MAX
} from './products.js';
import { createCard, observeReveals, formatPrice } from './main.js';

const SORTS = [
  { slug: 'new', title: 'По новизне' },
  { slug: 'price-asc', title: 'Цена ↑' },
  { slug: 'price-desc', title: 'Цена ↓' }
];

const DEFAULTS = { cat: 'all', gender: 'all', size: 'all', max: PRICE_MAX, sort: 'new' };

const el = {
  gender: document.getElementById('f-gender'),
  cat: document.getElementById('f-cat'),
  size: document.getElementById('f-size'),
  sort: document.getElementById('f-sort'),
  price: document.getElementById('f-price'),
  priceOut: document.getElementById('f-price-out'),
  results: document.getElementById('results'),
  empty: document.getElementById('empty'),
  count: document.getElementById('count'),
  filters: document.getElementById('filters')
};

const state = { ...DEFAULTS };

/* ---------------------------------------------------------------
   URL ⇄ состояние
   --------------------------------------------------------------- */

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  const cat = q.get('cat');
  if (cat && CATEGORIES.some((c) => c.slug === cat)) state.cat = cat;

  const gender = q.get('gender');
  if (gender && GENDERS.some((g) => g.slug === gender)) state.gender = gender;

  const size = q.get('size');
  if (size && ALL_SIZES.includes(size)) state.size = size;

  const max = Number(q.get('max'));
  if (Number.isFinite(max) && max >= PRICE_MIN && max <= PRICE_MAX) state.max = max;

  const sort = q.get('sort');
  if (sort && SORTS.some((s) => s.slug === sort)) state.sort = sort;
}

function writeUrl() {
  const q = new URLSearchParams();
  Object.keys(DEFAULTS).forEach((key) => {
    if (String(state[key]) !== String(DEFAULTS[key])) q.set(key, state[key]);
  });
  const qs = q.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

/* ---------------------------------------------------------------
   Фильтрация
   --------------------------------------------------------------- */

function filtered() {
  const list = products.filter(
    (p) =>
      (state.cat === 'all' || p.category === state.cat) &&
      (state.gender === 'all' || p.gender === state.gender) &&
      (state.size === 'all' || p.sizes.includes(state.size)) &&
      p.price <= Number(state.max)
  );

  if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else list.sort((a, b) => admittedKey(b) - admittedKey(a));

  return list;
}

/** «дд.мм» → сортируемое число */
function admittedKey(p) {
  const [d, m] = p.admitted.split('.').map(Number);
  return m * 100 + d;
}

/* ---------------------------------------------------------------
   Чипы фильтров
   --------------------------------------------------------------- */

function buildChips(host, key, items, extraClass = '') {
  if (!host) return;
  host.innerHTML = '';
  items.forEach(({ slug, title }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip${extraClass ? ` ${extraClass}` : ''}`;
    btn.textContent = title;
    btn.dataset.key = key;
    btn.dataset.value = slug;
    btn.setAttribute('aria-pressed', String(state[key] === slug));
    host.appendChild(btn);
  });
}

function syncChips() {
  document.querySelectorAll('.chip[data-key]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(String(state[btn.dataset.key]) === btn.dataset.value));
  });
  if (el.price) el.price.value = String(state.max);
  if (el.priceOut) el.priceOut.textContent = formatPrice(Number(state.max));
}

/* ---------------------------------------------------------------
   Отрисовка
   --------------------------------------------------------------- */

function render() {
  const list = filtered();

  el.results.innerHTML = '';
  const frag = document.createDocumentFragment();
  list.forEach((p) => frag.appendChild(createCard(p, true)));
  el.results.appendChild(frag);

  el.results.hidden = list.length === 0;
  el.empty.hidden = list.length > 0;

  el.count.innerHTML = `Найдено: <b>${list.length}</b> из ${products.length}`;

  observeReveals(el.results);
  syncChips();
  writeUrl();
}

/* ---------------------------------------------------------------
   События
   --------------------------------------------------------------- */

document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip[data-key]');
  if (chip) {
    const { key, value } = chip.dataset;
    // повторный клик по активному чипу снимает фильтр (кроме сортировки)
    state[key] = state[key] === value && key !== 'sort' ? DEFAULTS[key] : value;
    render();
    return;
  }

  if (e.target.closest('[data-reset]')) {
    Object.assign(state, DEFAULTS);
    render();
    if (el.filters && !el.filters.open) el.filters.open = true;
  }
});

if (el.price) {
  el.price.addEventListener('input', () => {
    state.max = Number(el.price.value);
    if (el.priceOut) el.priceOut.textContent = formatPrice(state.max);
  });
  el.price.addEventListener('change', render);
}

/* Панель фильтров: раскрыта на десктопе, сворачивается на мобильном */
const wide = window.matchMedia('(min-width: 760px)');
const syncFilters = () => {
  if (el.filters) el.filters.open = wide.matches;
};
wide.addEventListener('change', syncFilters);

/* ---------------------------------------------------------------
   Старт
   --------------------------------------------------------------- */

readUrl();
syncFilters();

buildChips(el.gender, 'gender', [{ slug: 'all', title: 'Все' }, ...GENDERS]);
buildChips(el.cat, 'cat', [{ slug: 'all', title: 'Все разделы' }, ...CATEGORIES]);
buildChips(
  el.size,
  'size',
  [{ slug: 'all', title: 'Все' }, ...ALL_SIZES.map((s) => ({ slug: s, title: s }))],
  'chip--size'
);
buildChips(el.sort, 'sort', SORTS);

if (el.price) {
  el.price.min = String(PRICE_MIN);
  el.price.max = String(PRICE_MAX);
}

render();
