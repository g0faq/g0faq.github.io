/* Приём заявок отключён: сайт хостится статикой, serverless-эндпоинт
   /api/contact удалён. Вписать сюда адрес приёмника, когда он появится, —
   разметка и обработчики форм для этого уже готовы. */
window.CONTACT_ENDPOINT = window.CONTACT_ENDPOINT || '';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function caseAssetUrl(origin, path) {
  const version = window.CASE_ASSET_VERSION;
  const url = `${origin || ''}${path}`;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

function setupCaseImage(media, caseData, index) {
  const image = createElement('img', 'case-media__image');
  const picture = document.createElement('picture');
  const webp = document.createElement('source');
  const configuredOrigins = Array.isArray(window.CASE_MEDIA_ORIGINS)
    ? window.CASE_MEDIA_ORIGINS.filter((origin) => typeof origin === 'string')
    : [];
  const origins = configuredOrigins.length ? configuredOrigins : [''];
  const orderedOrigins = origins.map((_, offset) => origins[(index + offset) % origins.length]);
  let attempt = 0;
  let retryTimer = 0;
  let isNearViewport = index === 0;

  webp.type = 'image/webp';
  webp.sizes = '(max-width: 760px) 320px, min(42vw, 620px)';
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'lazy';
  image.fetchPriority = 'low';
  image.width = Number(caseData.imageWidth) || 1280;
  image.height = Number(caseData.imageHeight) || 720;

  const clearRetry = () => {
    window.clearTimeout(retryTimer);
    retryTimer = 0;
  };

  const scheduleRetry = () => {
    clearRetry();
    if (!isNearViewport || attempt >= orderedOrigins.length - 1) return;
    retryTimer = window.setTimeout(() => {
      if (!image.complete || image.naturalWidth === 0) {
        attempt += 1;
        applyOrigin();
      }
    }, index === 0 ? 2400 : 3200);
  };

  const applyOrigin = () => {
    const origin = orderedOrigins[attempt] || '';
    const variants = caseData.imageWebp;
    if (variants?.['640'] && variants?.['1280']) {
      webp.srcset = `${caseAssetUrl(origin, variants['640'])} 640w, ${caseAssetUrl(origin, variants['1280'])} 1280w`;
    }
    image.src = caseAssetUrl(origin, caseData.image);
    scheduleRetry();
  };

  image.addEventListener('load', () => {
    clearRetry();
    media.classList.add('is-image-loaded');
  });
  image.addEventListener('error', () => {
    clearRetry();
    if (attempt >= orderedOrigins.length - 1) return;
    attempt += 1;
    applyOrigin();
  });

  picture.append(webp, image);
  media.append(picture);
  applyOrigin();

  if (!isNearViewport && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      isNearViewport = true;
      observer.disconnect();
      scheduleRetry();
    }, { rootMargin: '500px' });
    observer.observe(media);
  } else {
    isNearViewport = true;
    scheduleRetry();
  }
}

/* Карточка кейса. Класс case-panel и заголовок h3 читает аналитика
   (js/analytics.js → observeCases), поэтому их не переименовываем. */
function createCaseCard(caseData, index, allCases) {
  const card = createElement('article', 'case-panel case-card');
  card.id = `case-${caseData.id}`;
  // Первый кейс — широкий. Если после него остаётся нечётное число карточек,
  // последнюю тоже растягиваем, чтобы в сетке не было дыры.
  if (index === 0) card.classList.add('case-card--wide');
  if (index > 0 && index === allCases.length - 1 && (allCases.length - 1) % 2 === 1) {
    card.classList.add('case-card--wide', 'case-card--flip');
  }

  const media = createElement('div', 'case-media');
  media.setAttribute('aria-hidden', 'true');
  if (caseData.image) {
    setupCaseImage(media, caseData, index);
    media.classList.add('case-media--image');
  }

  const meta = createElement('div', 'case-card__meta');
  meta.append(
    createElement('span', 'case-card__num', `${caseData.num} / ${String(allCases.length).padStart(2, '0')}`),
    createElement('span', 'case-card__category', caseData.category)
  );
  if (caseData.demo) meta.append(createElement('span', 'case-card__badge', 'Демо'));

  const body = createElement('div', 'case-card__body');
  body.append(
    meta,
    createElement('h3', '', caseData.title),
    createElement('p', 'case-card__description', caseData.description)
  );

  const tags = createElement('ul', 'case-tags');
  tags.setAttribute('aria-label', 'Технологии проекта');
  caseData.stack.forEach((item) => tags.append(createElement('li', '', item)));
  body.append(tags);

  if (caseData.url) {
    const link = createElement('a', 'button button--small case-card__link', caseData.demo ? 'Открыть демо ↗' : 'Открыть сайт ↗');
    link.href = caseData.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    body.append(link);
  }

  card.append(media, body);
  return card;
}

async function initCases() {
  const grid = document.querySelector('#cases-stack');
  if (!grid) return;

  try {
    let cases = window.CASES_DATA;
    if (!Array.isArray(cases)) {
      const response = await fetch(`./data/cases.json?v=${document.querySelector('meta[name="build-commit"]')?.content || ''}`);
      if (!response.ok) throw new Error('Cases request failed');
      cases = await response.json();
    }
    if (!Array.isArray(cases) || cases.length === 0) throw new Error('Cases data is empty');

    grid.replaceChildren(...cases.map(createCaseCard));
    observeReveal(grid.querySelectorAll('.case-card'));
  } catch {
    grid.replaceChildren(createElement('p', 'cases-loading', 'Не удалось загрузить кейсы.'));
  }
}

/* Появление блоков при прокрутке: короткий подъём, один раз. */
let revealObserver = null;

function observeReveal(elements) {
  const items = Array.from(elements);
  if (!items.length) return;

  if (reducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-revealed'));
    return;
  }

  revealObserver = revealObserver || new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  items.forEach((item, index) => {
    item.classList.add('reveal');
    item.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 60}ms`);
    revealObserver.observe(item);
  });
}

function initReveal() {
  if (!reducedMotion()) document.documentElement.classList.add('motion-ready');
  observeReveal(document.querySelectorAll(
    '.section__head, .service-card, .tag-grid, .faq-list > details, .calculator-frame, .contact-card'
  ));
}

/* Часы в первом экране — по Москве, как и договорённости о сроках. */
function initClock() {
  const clock = document.querySelector('[data-clock]');
  if (!clock) return;
  const format = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
  const tick = () => {
    const [hours, minutes] = format.format(new Date()).split(':');
    clock.innerHTML = `${hours}<span class="colon">:</span>${minutes}`;
  };
  tick();
  window.setInterval(tick, 15000);
}

/* Fig. 2 — 14 дней базового запуска. Интенсивность клетки = нагрузка этапа. */
function initRoute() {
  const grid = document.querySelector('[data-route]');
  if (!grid) return;

  const stages = [
    { from: 1, to: 1, level: 2 },
    { from: 2, to: 3, level: 3 },
    { from: 4, to: 11, level: 4 },
    { from: 12, to: 13, level: 3 },
    { from: 14, to: 14, level: 1 }
  ];
  const rows = 7;
  const days = 14;
  // Детерминированный «шум», чтобы сетка выглядела живой, но не менялась при перезагрузке.
  const noise = (day, row) => ((day * 37 + row * 17) % 7) / 7;

  const cells = [];
  for (let day = 1; day <= days; day += 1) {
    const stage = stages.find((item) => day >= item.from && day <= item.to);
    for (let row = 0; row < rows; row += 1) {
      const level = clamp(Math.round(stage.level - noise(day, row) * 1.6), 0, 4);
      const cell = createElement('span', `route__cell l${level}`);
      cell.style.setProperty('--i', String(day + row));
      cells.push(cell);
    }
  }
  grid.style.setProperty('--days', String(days));
  grid.replaceChildren(...cells);
}

function initFaq() {
  document.querySelectorAll('.faq-list > details').forEach((details) => {
    const summary = details.querySelector('summary');
    const answer = details.querySelector('.faq-answer');
    if (!summary || !answer) return;

    summary.addEventListener('click', (event) => {
      if (reducedMotion()) return;
      event.preventDefault();
      details.faqAnimation?.cancel();

      if (!details.open) {
        details.open = true;
        const height = answer.scrollHeight;
        details.faqAnimation = answer.animate(
          [{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }],
          { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' }
        );
        return;
      }

      const height = answer.getBoundingClientRect().height;
      details.faqAnimation = answer.animate(
        [{ height: `${height}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 200, easing: 'cubic-bezier(.4,0,.8,.4)' }
      );
      details.faqAnimation.finished.then(() => { details.open = false; }).catch(() => {});
    });
  });
}

/* «От задачи до запуска»: шкала заполняется по мере прокрутки,
   шаги подсвечиваются, когда до них доходит линия чтения. */
function initProcess() {
  const list = document.querySelector('[data-process]');
  if (!list) return;
  const steps = Array.from(list.querySelectorAll('li:not(.process-list__track)'));
  let frame = 0;

  const update = () => {
    frame = 0;
    const line = window.innerHeight * 0.7;
    const rect = list.getBoundingClientRect();
    const vertical = window.innerWidth <= 1024;
    let progress;
    if (vertical) {
      progress = clamp((line - rect.top) / rect.height, 0, 1);
      steps.forEach((step) => step.classList.toggle('is-reached', step.getBoundingClientRect().top < line));
    } else {
      // По горизонтали шаги открываются по очереди, пока секция проходит экран.
      progress = clamp((line - rect.top) / (window.innerHeight * 0.55), 0, 1);
      steps.forEach((step, index) => step.classList.toggle('is-reached', progress >= index / steps.length + 0.02));
    }
    list.style.setProperty('--process-progress', progress.toFixed(3));
  };

  const request = () => { if (!frame) frame = window.requestAnimationFrame(update); };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}

/* Логотип первого экрана наклоняется за курсором. */
function initHeroTilt() {
  const hero = document.querySelector('.hero__figure');
  const logo = hero?.querySelector('.hero__logo');
  if (!hero || !logo || reducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    logo.style.setProperty('--tilt-x', `${(x * 14).toFixed(2)}deg`);
    logo.style.setProperty('--tilt-y', `${(-y * 10).toFixed(2)}deg`);
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    logo.style.setProperty('--tilt-x', '0deg');
    logo.style.setProperty('--tilt-y', '0deg');
  });
}

/* Логотип первого экрана «уходит под страницу»: чем дальше прокрутка, тем
   сильнее он уменьшается и гаснет, а над листом появляется тень. */
function initHeroSink() {
  const figure = document.querySelector('.hero__figure');
  const identity = document.querySelector('.hero__identity');
  if (!figure || !identity || reducedMotion()) return;

  let frame = 0;
  const update = () => {
    frame = 0;
    const height = figure.offsetHeight || 1;
    const sink = clamp(window.scrollY / height, 0, 1);
    figure.style.setProperty('--sink', sink.toFixed(3));
    identity.style.setProperty('--sheet-shadow', clamp(sink * 4, 0, 1).toFixed(2));
  };

  window.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function initHeader() {
  const header = document.querySelector('.site-header');
  const toggle = header?.querySelector('.nav-toggle');
  const nav = header?.querySelector('.site-nav');
  if (!header) return;

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (!toggle || !nav) return;
  const setOpen = (open) => {
    header.classList.toggle('is-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!header.classList.contains('is-menu-open')));
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
}

function initContactForm() {
  const form = document.querySelector('#contact-form');
  const status = document.querySelector('#form-status');
  if (!form || !status) return;

  const channelSelect = form.querySelector('#contact-channel');
  const contactInput = form.querySelector('#contact');
  const contactLabel = form.querySelector('[data-contact-label]');
  const channelFields = {
    Telegram: { label: 'Ваш Telegram', placeholder: '@username', autocomplete: 'off', inputMode: 'text', phone: false },
    VK: { label: 'Ссылка или ID во VK', placeholder: 'vk.com/username', autocomplete: 'url', inputMode: 'url', phone: false },
    MAX: { label: 'Номер в MAX', placeholder: '+7(999)-999-99-99', autocomplete: 'tel', inputMode: 'tel', phone: true },
    'Телефон': { label: 'Номер телефона', placeholder: '+7(999)-999-99-99', autocomplete: 'tel', inputMode: 'tel', phone: true }
  };

  const formatRussianPhone = (value) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('7') || digits.startsWith('8')) digits = digits.slice(1);
    digits = digits.slice(0, 10);

    let formatted = '+7';
    if (digits.length > 0) formatted += `(${digits.slice(0, 3)}`;
    if (digits.length >= 3) formatted += ')';
    if (digits.length > 3) formatted += `-${digits.slice(3, 6)}`;
    if (digits.length > 6) formatted += `-${digits.slice(6, 8)}`;
    if (digits.length > 8) formatted += `-${digits.slice(8, 10)}`;
    return formatted;
  };

  let previousField = channelFields[channelSelect.value] || channelFields.Telegram;

  const updateContactField = () => {
    const field = channelFields[channelSelect.value] || channelFields.Telegram;
    contactLabel.textContent = field.label;
    contactInput.placeholder = field.placeholder;
    contactInput.autocomplete = field.autocomplete;
    contactInput.inputMode = field.inputMode;
    contactInput.maxLength = field.phone ? 17 : 200;
    if (field.phone) {
      contactInput.pattern = '\\+7\\(\\d{3}\\)-\\d{3}-\\d{2}-\\d{2}';
      contactInput.value = previousField.phone
        ? formatRussianPhone(contactInput.value)
        : '+7';
    } else {
      contactInput.removeAttribute('pattern');
      if (previousField.phone && /^\+7(?:\D|$)/.test(contactInput.value)) contactInput.value = '';
    }
    previousField = field;
  };

  channelSelect.addEventListener('change', updateContactField);
  contactInput.addEventListener('focus', () => {
    const field = channelFields[channelSelect.value] || channelFields.Telegram;
    if (field.phone && !contactInput.value) contactInput.value = '+7';
  });
  contactInput.addEventListener('input', () => {
    const field = channelFields[channelSelect.value] || channelFields.Telegram;
    if (field.phone) contactInput.value = formatRussianPhone(contactInput.value);
  });
  updateContactField();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      channel: String(formData.get('channel') || '').trim(),
      contact: String(formData.get('contact') || '').trim(),
      message: String(formData.get('message') || '').trim(),
      consent: formData.get('consent') === 'on'
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Отправляю…';
    status.textContent = '';
    status.removeAttribute('data-state');

    try {
      if (!window.CONTACT_ENDPOINT) {
        throw new Error('Форма временно отключена — напишите в Telegram @g0_faq');
      }
      const response = await fetch(window.CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось отправить заявку');
      }

      form.reset();
      updateContactField();
      status.dataset.state = 'success';
      status.textContent = 'Заявка отправлена, отвечу в течение дня';
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = error.message || 'Не удалось отправить заявку';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Отправить';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initClock();
  initProcess();
  initHeroTilt();
  initHeroSink();
  document.querySelectorAll('.tag-grid li').forEach((item, index) => item.style.setProperty('--t', String(index)));
  initRoute();
  initCases();
  initReveal();
  initFaq();
  initContactForm();
});
