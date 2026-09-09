/**
 * ВЕЩДОК — общая логика: меню, появление по скроллу, интро, карточки, модалка.
 * Модуль подключается на обеих страницах; catalog.js импортирует отсюда хелперы.
 */

import { products, BADGES, categoryTitle, countByCategory } from './products.js';

/* ---------------------------------------------------------------
   Формат
   --------------------------------------------------------------- */

export const formatPrice = (n) => n.toLocaleString('ru-RU') + '\u00A0₽';

export const badgeText = (p) => BADGES[p.badge] || BADGES.stock;

const available = (p) => p.sizes.filter((s) => !p.taken.includes(s));

/* ---------------------------------------------------------------
   SVG-плейсхолдер: плашка + номер дела + силуэт вещи
   --------------------------------------------------------------- */

const SILHOUETTES = {
  coat: 'M36 20 L14 30 L7 66 L20 71 L24 55 L24 128 L76 128 L76 55 L80 71 L93 66 L86 30 L64 20 L50 38 Z M50 38 L50 128',
  trench:
    'M36 20 L14 30 L7 64 L20 69 L24 54 L24 126 L76 126 L76 54 L80 69 L93 64 L86 30 L64 20 L50 38 Z M50 38 L50 126 M22 78 L78 78',
  bomber:
    'M36 20 L14 30 L9 58 L21 63 L25 51 L25 100 L75 100 L75 51 L79 63 L91 58 L86 30 L64 20 L50 34 Z M25 100 L25 110 L75 110 L75 100',
  vest: 'M38 20 L24 27 L18 60 L29 64 L32 52 L32 116 L68 116 L68 52 L71 64 L82 60 L76 27 L62 20 L50 36 Z M50 36 L50 116 M32 74 L68 74 M32 92 L68 92',
  sweater:
    'M35 20 C41 14 59 14 65 20 L86 29 L94 56 L80 61 L76 49 L76 118 L24 118 L24 49 L20 61 L6 56 L14 29 Z M35 20 C41 26 59 26 65 20',
  shirt:
    'M36 20 L16 28 L9 52 L22 57 L26 46 L26 124 L74 124 L74 46 L78 57 L91 52 L84 28 L64 20 L50 33 Z M50 33 L50 124 M36 20 L50 33 L64 20',
  tee: 'M36 20 L16 28 L9 50 L22 55 L26 44 L26 112 L74 112 L74 44 L78 55 L91 50 L84 28 L64 20 C60 27 40 27 36 20 Z',
  dress:
    'M37 20 L28 26 L20 48 L31 52 L34 43 L27 122 L73 122 L66 43 L69 52 L80 48 L72 26 L63 20 L50 30 Z M50 30 L50 122',
  jeans: 'M27 20 L73 20 L77 44 L69 126 L54 126 L50 66 L46 126 L31 126 L23 44 Z M27 20 L73 20 M23 36 L77 36',
  cargo:
    'M27 20 L73 20 L77 44 L69 126 L54 126 L50 66 L46 126 L31 126 L23 44 Z M23 36 L77 36 M26 62 L38 62 L39 82 L27 82 Z M62 62 L74 62 L73 82 L61 82 Z',
  skirt: 'M30 34 L70 34 L85 118 L15 118 Z M30 34 L70 34 M40 40 L33 118 M50 40 L50 118 M60 40 L67 118',
  boots:
    'M33 22 L55 22 L57 78 C57 87 64 92 80 97 L88 102 L88 114 L33 114 Z M33 22 L55 22 M33 104 L88 104',
  belt: 'M12 56 L74 56 L74 82 L12 82 Z M74 58 L92 58 L92 80 L74 80 Z M79 62 L79 76 M12 56 C6 56 6 82 12 82',
  beanie:
    'M18 84 C18 50 32 30 50 30 C68 30 82 50 82 84 Z M18 84 L82 84 L82 100 L18 100 Z M50 30 L50 18'
};

/**
 * Возвращает разметку SVG-плейсхолдера. Второй ракурс — пунктирный «обмер».
 */
export function productSvg(p, variant = 'main', opts = {}) {
  const alt = variant === 'alt';
  const d = SILHOUETTES[p.silhouette] || SILHOUETTES.tee;
  const uid = `p${p.id}${alt ? 'b' : 'a'}`;
  const stroke = alt ? 'rgba(20,20,20,.5)' : 'rgba(20,20,20,.62)';

  return `
<svg class="card__svg card__svg--${alt ? 'alt' : 'main'}" viewBox="0 0 300 400"
     preserveAspectRatio="xMidYMid slice" role="img"
     aria-label="Схематическое изображение: ${escapeAttr(p.title)}. ${escapeAttr(p.caseNo)}">
  <defs>
    <pattern id="hatch-${uid}" width="22" height="22" patternUnits="userSpaceOnUse"
             patternTransform="rotate(${alt ? 45 : 135})">
      <rect width="22" height="22" fill="${alt ? '#e2dcd0' : '#e6e1d7'}"/>
      <rect width="11" height="22" fill="${alt ? '#d9d2c4' : '#ded8cb'}"/>
    </pattern>
  </defs>
  <rect width="300" height="400" fill="url(#hatch-${uid})"/>
  <rect x="18" y="18" width="264" height="364" fill="none"
        stroke="rgba(20,20,20,.18)" stroke-width="1"/>
  <path d="M18 44 H282 M18 356 H282" stroke="rgba(20,20,20,.14)" stroke-width="1"/>
  <g transform="translate(150 208) scale(1.62) translate(-50 -74)">
    <path d="${d}" fill="none" stroke="${stroke}" stroke-width="${alt ? 1.6 : 2.1}"
          stroke-linejoin="round" stroke-linecap="round"
          ${alt ? 'stroke-dasharray="6 4"' : ''}/>
  </g>
  ${
    alt
      ? `<path d="M40 200 H62 M238 200 H260" stroke="rgba(20,20,20,.4)" stroke-width="1"/>
         <path d="M51 190 V210 M249 190 V210" stroke="rgba(20,20,20,.4)" stroke-width="1"/>`
      : ''
  }
  <text x="26" y="36" font-family="JetBrains Mono, monospace" font-size="12"
        letter-spacing="1.4" fill="rgba(20,20,20,.62)">${escapeAttr(p.caseNo)}</text>
  ${
    opts.footer
      ? `<text x="26" y="374" font-family="JetBrains Mono, monospace" font-size="11"
              letter-spacing="1.2" fill="rgba(20,20,20,.5)">ФОТОФИКСАЦИЯ / РАКУРС ${
                alt ? 'B' : 'A'
              }</text>`
      : ''
  }
</svg>`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/* ---------------------------------------------------------------
   Карточка-улика
   --------------------------------------------------------------- */

/**
 * @param {object} p товар
 * @param {boolean} withHold показывать кнопку «Отложить и примерить»
 */
export function createCard(p, withHold = false) {
  const card = document.createElement('article');
  card.className = 'card reveal';

  const free = available(p);
  const last = p.badge === 'last';

  card.innerHTML = `
    <button class="card__shot" type="button" data-open="${p.id}"
            aria-label="Открыть карточку: ${escapeAttr(p.title)}, ${escapeAttr(p.caseNo)}">
      ${productSvg(p, 'main')}
      ${productSvg(p, 'alt')}
      <span class="card__stamp${last ? ' card__stamp--last' : ''}">${badgeText(p)}</span>
      <span class="card__view">Ракурс B</span>
      <span class="card__tag">
        <span class="card__tag-label">Размеры</span>
        <span class="card__tag-sizes">${free.length ? free.join(' · ') : '—'}</span>
      </span>
    </button>
    <div class="card__perf" aria-hidden="true"></div>
    <div class="card__body">
      <h3 class="card__title">${escapeAttr(p.title)}</h3>
      <div class="card__meta">
        <span class="card__price">${formatPrice(p.price)}</span>
        <span class="card__cat">${categoryTitle(p.category)}</span>
      </div>
      ${
        withHold
          ? `<button class="card__hold" type="button" data-hold="${p.id}">Отложить и примерить</button>`
          : ''
      }
    </div>`;

  return card;
}

/* ---------------------------------------------------------------
   Модалка товара: Esc, клик по подложке, фокус-трап, возврат фокуса
   --------------------------------------------------------------- */

const modal = document.getElementById('modal');
let lastFocused = null;

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function openProduct(id, trigger, showBooking = false) {
  const p = products.find((item) => item.id === Number(id));
  if (!p || !modal) return;

  lastFocused = trigger || document.activeElement;
  const last = p.badge === 'last';

  modal.querySelector('[data-m="shot"]').innerHTML = productSvg(p, 'main', { footer: true });
  modal.querySelector('[data-m="case"]').textContent = `${p.caseNo} · ${categoryTitle(p.category)}`;
  modal.querySelector('[data-m="title"]').textContent = p.title;
  modal.querySelector('[data-m="price"]').textContent = formatPrice(p.price);
  modal.querySelector('[data-m="desc"]').textContent = p.description;
  modal.querySelector('[data-m="composition"]').textContent = p.composition;
  modal.querySelector('[data-m="admitted"]').textContent = `${p.admitted}.2024`;

  const stamp = modal.querySelector('[data-m="stamp"]');
  stamp.textContent = badgeText(p);
  stamp.classList.toggle('modal__bigstamp--last', last);

  const sizes = modal.querySelector('[data-m="sizes"]');
  sizes.innerHTML = '';
  p.sizes.forEach((s) => {
    const out = p.taken.includes(s);
    const el = document.createElement('span');
    el.className = `size${out ? ' size--out' : ''}`;
    el.textContent = s;
    if (out) el.setAttribute('aria-label', `${s} — изъят`);
    sizes.appendChild(el);
  });

  const booking = modal.querySelector('[data-m="booking"]');
  booking.hidden = !showBooking;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modal.querySelector('.modal__close').focus();
}

function closeModal() {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  lastFocused = null;
}

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) closeModal();
  });

  modal.querySelector('[data-m="book"]').addEventListener('click', () => {
    modal.querySelector('[data-m="booking"]').hidden = false;
  });

  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key !== 'Tab') return;

    const items = [...modal.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (!items.length) return;

    const first = items[0];
    const lastItem = items[items.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      lastItem.focus();
    } else if (!e.shiftKey && document.activeElement === lastItem) {
      e.preventDefault();
      first.focus();
    }
  });
}

/** Делегированные клики по карточкам — работают и для перерисованного каталога. */
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) {
    openProduct(open.dataset.open, open);
    return;
  }
  const hold = e.target.closest('[data-hold]');
  if (hold) {
    openProduct(hold.dataset.hold, hold, true);
    return;
  }

  const contact = e.target.closest('[data-contact]');
  if (contact) {
    const note = document.getElementById(contact.getAttribute('aria-controls'));
    if (!note) return;
    note.hidden = false;
    document
      .querySelectorAll('[data-contact]')
      .forEach((b) => b.setAttribute('aria-expanded', 'true'));
  }
});

/* ---------------------------------------------------------------
   Появление по скроллу
   --------------------------------------------------------------- */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let observer = null;
if ('IntersectionObserver' in window && !reduceMotion.matches) {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
  );
}

export function observeReveals(root = document) {
  const items = root.querySelectorAll('.reveal:not(.is-in)');
  if (!observer) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  items.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i, 6) * 45}ms`;
    observer.observe(el);
  });
}

/* ---------------------------------------------------------------
   Меню
   --------------------------------------------------------------- */

const burger = document.querySelector('.burger');
const nav = document.getElementById('nav');

if (burger && nav) {
  burger.addEventListener('click', () => {
    const open = nav.dataset.open === 'true';
    nav.dataset.open = String(!open);
    burger.setAttribute('aria-expanded', String(!open));
  });

  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      nav.dataset.open = 'false';
      burger.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ---------------------------------------------------------------
   Интро: лупа проявляет логотип, затем логотип улетает в шапку
   --------------------------------------------------------------- */

function runIntro() {
  const root = document.documentElement;
  const intro = document.getElementById('intro');
  const introLogo = intro && intro.querySelector('.intro__logo');
  const headLogo = document.querySelector('.head__logo');

  if (!intro || !introLogo || !headLogo || !root.classList.contains('intro-run')) return;

  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    root.classList.remove('intro-run');
    intro.remove();
    headLogo.style.opacity = '';
    try {
      sessionStorage.setItem('vd-intro', 'done');
    } catch (e) {
      /* приватный режим — просто проигрываем интро каждый раз */
    }
  };

  const fly = () => {
    if (finished) return;
    const from = introLogo.getBoundingClientRect();
    const to = headLogo.getBoundingClientRect();

    if (!from.width || !to.width) {
      finish();
      return;
    }

    const scale = to.width / from.width;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    intro.classList.add('is-flying');
    introLogo.style.animation = 'none';
    introLogo.style.clipPath = 'inset(0 0 0 0)';
    introLogo.style.transition = 'transform 780ms cubic-bezier(.75,.02,.24,1)';
    introLogo.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;

    let done = false;
    const land = () => {
      if (done) return;
      done = true;
      headLogo.style.opacity = '1';
      window.setTimeout(finish, 30);
    };

    introLogo.addEventListener('transitionend', land, { once: true });
    window.setTimeout(land, 900);
  };

  // «Пропустить», клик по подложке и Esc — мгновенно завершают интро
  intro.addEventListener('click', finish);
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onEsc);
      finish();
    }
  });

  const start = () => window.setTimeout(fly, 1900);

  if (headLogo.complete && introLogo.complete) start();
  else window.setTimeout(start, 400);

  // страховка: интро не должно залипнуть ни при каких условиях
  window.setTimeout(finish, 6000);
}

/* ---------------------------------------------------------------
   Витрина на главной
   --------------------------------------------------------------- */

function renderShowcase() {
  const host = document.getElementById('showcase');
  if (!host) return;
  const frag = document.createDocumentFragment();
  products.slice(0, 8).forEach((p) => frag.appendChild(createCard(p)));
  host.appendChild(frag);
}

function renderCategoryCounts() {
  document.querySelectorAll('[data-cat-count]').forEach((el) => {
    const n = countByCategory(el.dataset.catCount);
    el.textContent = `${n} ${plural(n, 'позиция', 'позиции', 'позиций')} в описи`;
  });
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/* ---------------------------------------------------------------
   Запуск
   --------------------------------------------------------------- */

renderShowcase();
renderCategoryCounts();
observeReveals();
runIntro();

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
