/* Помощь с ТЗ — интерфейс опроса.
 *
 * Страница — тонкий клиент: какой вопрос показать, решает сервер. Здесь только
 * отрисовка, ввод, переходы и возобновление. Все строки от модели и сервера
 * попадают в DOM через textContent — HTML из ответов не интерпретируется.
 *
 * Режимы:
 *   ?b=<token>              персональная ссылка от разработчика
 *   ?b=<token>&preview=1    предпросмотр для разработчика, ничего не сохраняется
 *   без параметров          открытый опрос, вопросы подстраиваются под ответы
 */

(function initBrief() {
  'use strict';

  // На локальной разработке ходим в локальный API, чтобы не трогать продакшн.
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = LOCAL
    ? `http://${location.hostname}:8911/api/brief`
    : 'https://portfolio-ten-umber-3z9vgkulzy.vercel.app/api/brief';
  const TELEGRAM = 'https://t.me/g0_faq';
  const RESUME_KEY = 'g0faq.brief';
  const TIMEOUT_MS = 75000;

  const CHANNELS = [
    { id: 'Telegram', placeholder: '@username' },
    { id: 'WhatsApp', placeholder: '+7 900 000-00-00' },
    { id: 'MAX', placeholder: '+7 900 000-00-00' },
    { id: 'Телефон', placeholder: '+7 900 000-00-00' },
    { id: 'Почта', placeholder: 'name@example.com' },
  ];

  const THINKING = [
    'Обдумываю ваш ответ',
    'Подбираю следующий вопрос',
    'Уточняю детали проекта',
    'Сверяю с тем, что уже известно',
  ];

  const params = new URLSearchParams(location.search);
  const linkToken = params.get('b');
  const isPreview = params.get('preview') === '1';

  const app = document.getElementById('brief-app');
  const progressBox = document.querySelector('[data-brief-progress]');
  const progressBar = document.querySelector('[data-brief-bar]');
  const progressTrack = progressBox?.querySelector('[role="progressbar"]');
  const sectionLabel = document.querySelector('[data-brief-section]');
  const counterLabel = document.querySelector('[data-brief-counter]');
  const metaLabel = document.querySelector('[data-brief-meta]');

  const state = {
    token: linkToken,
    mode: linkToken ? 'owner' : 'public',
    busy: false,
    view: null,
    preview: null,
  };

  const track = (type, data) => {
    try { window.PortfolioAnalytics?.track?.(type, data); } catch { /* аналитика необязательна */ }
  };

  const store = {
    get() { try { return localStorage.getItem(RESUME_KEY); } catch { return null; } },
    set(value) { try { localStorage.setItem(RESUME_KEY, value); } catch { /* приватный режим */ } },
    clear() { try { localStorage.removeItem(RESUME_KEY); } catch { /* приватный режим */ } },
  };

  /* ── DOM ─────────────────────────────────────────────────────────────────── */

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (key === 'style') el.style.cssText = value;
      else el.setAttribute(key, value === true ? '' : value);
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }

  function mount(screen, focusSelector) {
    app.replaceChildren(screen);
    const target = focusSelector ? app.querySelector(focusSelector) : null;
    if (target) target.focus({ preventScroll: true });
    const top = app.getBoundingClientRect().top + window.scrollY - 120;
    if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function setProgress(view) {
    if (!view || !['question', 'contact', 'thinking'].includes(view.status)) {
      progressBox.hidden = true;
      return;
    }
    progressBox.hidden = false;
    const value = Math.max(2, Math.min(100, view.progress || 0));
    progressBar.style.width = `${value}%`;
    progressTrack?.setAttribute('aria-valuenow', String(value));
    sectionLabel.textContent = view.status === 'contact' ? 'Последний шаг' : (view.question?.section || '');
    if (view.status === 'contact') counterLabel.textContent = 'Контакты';
    else if (view.total) counterLabel.textContent = `Вопрос ${view.index + 1} из ${view.total}`;
    else counterLabel.textContent = `Вопрос ${(view.index || 0) + 1}`;
  }

  /* ── Сеть ────────────────────────────────────────────────────────────────── */

  async function api(body, method = 'POST') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = method === 'GET' ? `${API}?${new URLSearchParams(body)}` : API;
      const response = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        const error = new Error(data.message || 'Сервис временно недоступен');
        error.code = data.code || `http_${response.status}`;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeout = new Error('Сервер отвечает слишком долго. Попробуйте ещё раз.');
        timeout.code = 'timeout';
        throw timeout;
      }
      if (!error.code) error.code = 'network';
      if (error.code === 'network') error.message = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ── Маршрутизация состояний ─────────────────────────────────────────────── */

  function render(view) {
    state.view = view;
    if (view.token) state.token = view.token;
    if (view.mode) state.mode = view.mode;
    metaLabel.textContent = view.mode === 'owner' && view.title ? view.title : 'Помощь с ТЗ';

    // Незавершённый открытый опрос запоминаем, чтобы вернуться к нему позже.
    if (state.mode === 'public' && view.token) {
      if (['question', 'contact'].includes(view.status)) store.set(view.token);
      if (['completed', 'expired', 'deleted'].includes(view.status)) store.clear();
    }

    setProgress(view);

    switch (view.status) {
      case 'intro': return renderIntro(view);
      case 'question': return renderQuestion(view);
      case 'contact': return renderContact(view);
      case 'completed': return renderDone(view);
      case 'expired': return renderState('ССЫЛКА ИСТЕКЛА', 'Срок действия опроса закончился', 'Напишите мне — пришлю новую ссылку или помогу с ТЗ лично.');
      case 'deleted': return renderState('ОПРОС ЗАКРЫТ', 'Этот опрос больше не активен', 'Если он всё ещё нужен, напишите мне — пришлю актуальную ссылку.');
      default: return renderState('ОШИБКА', 'Не удалось открыть опрос', 'Попробуйте обновить страницу.');
    }
  }

  function renderState(code, title, text, retry) {
    progressBox.hidden = true;
    mount(h('section', { class: 'brief-screen brief-card brief-state' },
      h('p', { class: 'brief-state__code', text: code }),
      h('h1', { class: 'brief-question__title', text: title, tabindex: '-1' }),
      h('p', { class: 'brief-lead', text }),
      h('div', { class: 'brief-actions' },
        retry ? h('button', { class: 'button brief-primary', type: 'button', onclick: retry, text: 'Попробовать снова' }) : null,
        h('a', { class: 'button', href: TELEGRAM, target: '_blank', rel: 'noreferrer', text: 'Написать в Telegram ↗' }),
        h('a', { class: 'brief-link', href: './index.html', text: 'На главную' }),
      ),
    ), '.brief-question__title');
  }

  function showError(container, error) {
    container.querySelector('.brief-error')?.remove();
    container.append(h('p', { class: 'brief-error', role: 'alert', text: error.message }));
  }

  /* ── Вступление ──────────────────────────────────────────────────────────── */

  function renderIntro(view, options = {}) {
    const owner = state.mode === 'owner';
    const consent = h('input', { type: 'checkbox', id: 'brief-consent' });
    const start = h('button', { class: 'button brief-primary', type: 'button', disabled: true, text: owner ? 'Начать опрос →' : 'Начать →' });
    consent.addEventListener('change', () => { start.disabled = !consent.checked; });

    const resumeToken = !owner && !options.fresh ? store.get() : null;

    const card = h('section', { class: 'brief-screen brief-card' },
      h('p', { class: 'brief-eyebrow' }, h('b', { text: '●' }), owner ? ' Опрос по вашему проекту' : ' Помощь с ТЗ'),
      owner
        ? h('h1', { class: 'brief-title', text: view.title || 'Опрос по проекту' })
        : h('h1', { class: 'brief-title' }, 'Нет ТЗ? ', h('span', { text: 'Соберём его вместе' })),
      h('p', {
        class: 'brief-lead',
        text: owner
          ? (view.intro || 'Несколько вопросов о вашем проекте — ответы помогут точно подготовить техническое задание.')
          : 'Ответьте на вопросы о проекте — каждый следующий подстраивается под ваши ответы. Сначала опишете идею своими словами, дальше — уточняющие вопросы. Займёт 10–15 минут, разбираться в технических терминах не нужно.',
      }),
      resumeToken ? h('div', { class: 'brief-resume' },
        h('span', { text: 'У вас есть незавершённый опрос.' }),
        h('div', { class: 'brief-actions' },
          h('button', { class: 'button brief-primary', type: 'button', onclick: () => resume(resumeToken), text: 'Продолжить' }),
          h('button', { class: 'brief-link', type: 'button', onclick: () => { store.clear(); renderIntro(view, { fresh: true }); }, text: 'Начать заново' }),
        ),
      ) : null,
      h('ul', { class: 'brief-steps' },
        h('li', {}, h('strong', { text: '01' }), h('span', { text: owner ? 'Отвечаете на вопросы, подготовленные под ваш проект' : 'Отвечаете на вопросы — без жаргона, в основном выбором вариантов' })),
        h('li', {}, h('strong', { text: '02' }), h('span', { text: 'Я получаю структурированный бриф и изучаю задачу' })),
        h('li', {}, h('strong', { text: '03' }), h('span', { text: 'Вы сразу видите похожие проекты из моего портфолио' })),
      ),
      h('p', { class: 'brief-note', text: 'Техническое задание я готовлю лично: после опроса свяжитесь со мной — обсудим детали и я пришлю ТЗ.' }),
      h('label', { class: 'brief-check', for: 'brief-consent' },
        consent,
        h('span', {},
          'Согласен на обработку ответов, в том числе с помощью сервиса OpenAI, для подготовки брифа. Не указывайте в ответах пароли и чувствительные данные. ',
          h('a', { href: './privacy.html', target: '_blank', text: 'Подробнее' }),
        ),
      ),
      h('div', { class: 'brief-actions' }, start),
    );

    start.addEventListener('click', async () => {
      if (state.busy || !consent.checked) return;
      state.busy = true;
      start.disabled = true;
      start.textContent = 'Готовлю первый вопрос…';
      try {
        const next = await api(owner ? { action: 'start', consent: true, token: state.token } : { action: 'start', consent: true });
        track('brief_start', { mode: state.mode });
        render(next);
      } catch (error) {
        start.disabled = false;
        start.textContent = owner ? 'Начать опрос →' : 'Начать →';
        showError(card, error);
      } finally {
        state.busy = false;
      }
    });

    mount(card);
  }

  /* ── Вопрос ──────────────────────────────────────────────────────────────── */

  function renderQuestion(view) {
    const q = view.question;
    const prefill = view.answer || null;
    const choice = q.type === 'single' || q.type === 'multi';
    const selected = new Set(prefill?.choices || []);
    let otherActive = Boolean(prefill?.other);

    const next = h('button', { class: 'button brief-primary', type: 'button', text: 'Далее →' });
    const body = h('div', {});
    let otherInput = null;
    let textInput = null;

    const valid = () => {
      if (choice) return selected.size > 0 || (otherActive && otherInput && otherInput.value.trim().length > 0);
      return Boolean(textInput && textInput.value.trim().length > 0);
    };
    const refresh = () => { next.disabled = !valid() || state.busy; };

    if (choice) {
      const group = h('div', {
        class: 'brief-options',
        role: q.type === 'single' ? 'radiogroup' : 'group',
        'aria-label': q.title,
        'data-type': q.type,
      });
      const buttons = [];

      const toggle = (label) => {
        if (q.type === 'single') {
          selected.clear();
          selected.add(label);
          otherActive = false;
        } else if (selected.has(label)) {
          selected.delete(label);
        } else {
          selected.add(label);
        }
        sync();
      };

      const sync = () => {
        buttons.forEach(({ el, label }) => {
          const on = label === '__other' ? otherActive : selected.has(label);
          el.setAttribute('aria-checked', String(on));
        });
        if (otherInput) otherInput.parentElement.hidden = !otherActive;
        refresh();
      };

      q.options.forEach((label, i) => {
        const el = h('button', {
          class: 'brief-option',
          type: 'button',
          role: q.type === 'single' ? 'radio' : 'checkbox',
          'aria-checked': 'false',
          style: `--order:${i}`,
          onclick: () => toggle(label),
        }, h('span', { class: 'brief-option__key', text: String(i + 1), 'aria-hidden': 'true' }), h('span', { text: label }));
        buttons.push({ el, label });
        group.append(el);
      });

      if (q.allow_other) {
        const el = h('button', {
          class: 'brief-option',
          type: 'button',
          role: q.type === 'single' ? 'radio' : 'checkbox',
          'aria-checked': 'false',
          style: `--order:${q.options.length}`,
          onclick: () => {
            if (q.type === 'single') selected.clear();
            otherActive = q.type === 'single' ? true : !otherActive;
            sync();
            if (otherActive) setTimeout(() => otherInput.focus(), 30);
          },
        }, h('span', { class: 'brief-option__key', text: '✎', 'aria-hidden': 'true' }), h('span', { text: 'Свой вариант' }));
        buttons.push({ el, label: '__other' });
        group.append(el);

        otherInput = h('input', {
          class: 'brief-field', type: 'text', maxlength: '300', placeholder: 'Опишите свой вариант', 'aria-label': 'Свой вариант',
        });
        otherInput.value = prefill?.other || '';
        otherInput.addEventListener('input', refresh);
        body.append(group, h('div', { class: 'brief-other', hidden: true }, otherInput));
      } else {
        body.append(group);
      }

      if (q.type === 'multi') body.append(h('p', { class: 'brief-muted', text: 'Можно выбрать несколько вариантов.' }));
      sync();

      // Цифры 1–9 — быстрый выбор, если фокус не в поле ввода.
      state.keyHandler = (event) => {
        if (event.target.closest('input, textarea')) return;
        const n = Number(event.key);
        if (n >= 1 && n <= q.options.length) { event.preventDefault(); toggle(q.options[n - 1]); }
      };
    } else {
      const long = q.type === 'long_text';
      textInput = h(long ? 'textarea' : 'input', {
        class: 'brief-field',
        type: long ? null : 'text',
        maxlength: '3000',
        placeholder: q.placeholder || (long ? 'Напишите своими словами' : 'Ваш ответ'),
        'aria-label': q.title,
        rows: long ? (q.required ? '9' : '6') : null,
      });
      textInput.value = prefill?.text || '';
      const counter = h('span', { text: `${textInput.value.length} / 3000` });
      textInput.addEventListener('input', () => { counter.textContent = `${textInput.value.length} / 3000`; refresh(); });
      textInput.addEventListener('keydown', (event) => {
        const submit = long ? (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) : event.key === 'Enter';
        if (submit && valid()) { event.preventDefault(); next.click(); }
      });
      body.append(textInput, h('div', { class: 'brief-field-meta' },
        h('span', { text: long ? 'Ctrl/⌘ + Enter — дальше' : 'Enter — дальше' }), counter));
      state.keyHandler = null;
    }

    // Описание идеи обязательно — без него уточнять нечего.
    const skip = q.required ? null : h('button', { class: 'brief-link', type: 'button', text: 'Затрудняюсь ответить' });
    const back = view.canBack ? h('button', { class: 'button', type: 'button', text: '← Назад' }) : null;

    const card = h('section', { class: 'brief-screen brief-card brief-question' },
      h('h1', { class: 'brief-question__title', text: q.title, tabindex: '-1' }),
      q.hint ? h('p', { class: 'brief-question__hint', text: q.hint }) : null,
      body,
      h('div', { class: 'brief-controls' },
        h('div', { class: 'brief-controls__side' }, back, skip),
        h('div', { class: 'brief-controls__side' },
          choice ? h('span', { class: 'brief-kbd', text: `1–${Math.min(9, q.options.length)} — выбор` }) : null,
          next),
      ),
    );

    const collect = (skipped) => {
      if (skipped) return { skipped: true };
      if (choice) return { choices: [...selected], other: otherActive && otherInput ? otherInput.value.trim() : '' };
      return { text: textInput.value.trim() };
    };

    const submit = async (skipped) => {
      if (state.busy || (!skipped && !valid())) return;
      if (isPreview) { previewAdvance(1); return; }
      const answer = collect(skipped);
      renderThinking(view);
      state.busy = true;
      try {
        const result = await api({ action: 'answer', token: state.token, index: view.index, answer });
        track('brief_answer', { step: view.index + 1, section: q.section });
        render(result);
      } catch (error) {
        render({ ...view, answer });
        showError(app.querySelector('.brief-card'), error);
      } finally {
        state.busy = false;
        refresh();
      }
    };

    next.addEventListener('click', () => submit(false));
    skip?.addEventListener('click', () => submit(true));
    back?.addEventListener('click', async () => {
      if (state.busy) return;
      if (isPreview) { previewAdvance(-1); return; }
      state.busy = true;
      renderThinking(view, 'Возвращаюсь к прошлому вопросу');
      try {
        const result = await api({ action: 'back', token: state.token });
        track('brief_back', { step: view.index });
        render(result);
      } catch (error) {
        render(view);
        showError(app.querySelector('.brief-card'), error);
      } finally {
        state.busy = false;
      }
    });

    mount(card, textInput ? '.brief-field' : '.brief-question__title');
    refresh();
  }

  function renderThinking(view, label) {
    setProgress({ ...view, status: 'thinking' });
    const status = h('span', { text: label || THINKING[0] });
    let i = 0;
    const timer = setInterval(() => {
      if (!status.isConnected) { clearInterval(timer); return; }
      i = (i + 1) % THINKING.length;
      status.textContent = THINKING[i];
    }, 2600);

    mount(h('section', { class: 'brief-screen brief-card brief-thinking', 'aria-busy': 'true' },
      h('div', { class: 'brief-thinking__status' },
        h('span', { class: 'brief-dots', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
        status),
      h('div', { class: 'brief-skeleton brief-skeleton--title' }),
      h('div', { class: 'brief-skeleton brief-skeleton--line' }),
      h('div', { class: 'brief-skeleton-grid' },
        h('div', { class: 'brief-skeleton' }), h('div', { class: 'brief-skeleton' }),
        h('div', { class: 'brief-skeleton' }), h('div', { class: 'brief-skeleton' })),
    ));
  }

  /* ── Контакты ────────────────────────────────────────────────────────────── */

  function renderContact(view) {
    const owner = state.mode === 'owner';
    let channel = CHANNELS[0];

    const name = h('input', { class: 'brief-field', id: 'brief-name', type: 'text', maxlength: '80', autocomplete: 'name', placeholder: 'Как к вам обращаться' });
    const contact = h('input', { class: 'brief-field', id: 'brief-contact', type: 'text', maxlength: '120', placeholder: channel.placeholder });
    const consent = h('input', { type: 'checkbox', id: 'brief-pd' });
    const submit = h('button', { class: 'button brief-primary', type: 'button', text: 'Отправить ответы' });
    const back = h('button', { class: 'button', type: 'button', text: '← Назад' });

    const segment = h('div', { class: 'brief-segment', role: 'group', 'aria-label': 'Способ связи' });
    CHANNELS.forEach((item) => {
      const button = h('button', {
        type: 'button',
        'aria-pressed': String(item === channel),
        text: item.id,
        onclick: () => {
          channel = item;
          segment.querySelectorAll('button').forEach((el) => el.setAttribute('aria-pressed', String(el.textContent === item.id)));
          contact.placeholder = item.placeholder;
          contact.focus();
        },
      });
      segment.append(button);
    });

    const refresh = () => {
      const needContact = !owner;
      submit.disabled = state.busy || !consent.checked || (needContact && !contact.value.trim());
    };
    [contact, name].forEach((el) => el.addEventListener('input', refresh));
    consent.addEventListener('change', refresh);

    const card = h('section', { class: 'brief-screen brief-card' },
      h('p', { class: 'brief-eyebrow' }, h('b', { text: '●' }), ' Почти готово'),
      h('h1', { class: 'brief-question__title', text: 'Куда вам ответить?', tabindex: '-1' }),
      h('p', { class: 'brief-question__hint', text: owner
        ? 'Контакт можно не указывать, если мы уже на связи. Ответы уйдут мне сразу после отправки.'
        : 'Я изучу ответы и напишу вам сам. Контакт нужен только для этого.' }),
      h('div', { class: 'brief-form' },
        h('div', {}, h('label', { class: 'brief-label', for: 'brief-name', text: 'Имя' }), name),
        h('div', {}, h('span', { class: 'brief-label', text: 'Удобный способ связи' }), segment),
        h('div', {}, h('label', { class: 'brief-label', for: 'brief-contact', text: owner ? 'Контакт · необязательно' : 'Контакт' }), contact),
        h('label', { class: 'brief-check', for: 'brief-pd' }, consent,
          h('span', {}, 'Согласен на обработку персональных данных для ответа на заявку. ',
            h('a', { href: './privacy.html', target: '_blank', text: 'Подробнее' }))),
      ),
      h('div', { class: 'brief-controls' },
        h('div', { class: 'brief-controls__side' }, back),
        h('div', { class: 'brief-controls__side' }, submit)),
    );

    back.addEventListener('click', async () => {
      if (state.busy) return;
      if (isPreview) { previewAdvance(-1); return; }
      state.busy = true;
      try {
        render(await api({ action: 'back', token: state.token }));
      } catch (error) {
        showError(card, error);
      } finally {
        state.busy = false;
      }
    });

    submit.addEventListener('click', async () => {
      if (state.busy || submit.disabled) return;
      if (isPreview) { renderPreviewEnd(); return; }
      state.busy = true;
      submit.disabled = true;
      renderFinishing();
      try {
        const result = await api({
          action: 'complete',
          token: state.token,
          consent: true,
          contact: { name: name.value.trim(), channel: channel.id, value: contact.value.trim() },
        });
        track('brief_completed', { mode: state.mode });
        state.clientName = name.value.trim();
        render(result);
      } catch (error) {
        render(view);
        showError(app.querySelector('.brief-card'), error);
      } finally {
        state.busy = false;
      }
    });

    mount(card, '#brief-name');
    refresh();
  }

  function renderFinishing() {
    progressBox.hidden = true;
    mount(h('section', { class: 'brief-screen brief-screen--loading' },
      h('div', { class: 'brief-dots', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
      h('h1', { class: 'brief-question__title', text: 'Анализирую ответы' }),
      h('p', { class: 'brief-muted', text: 'Отправляю бриф и подбираю похожие проекты из портфолио…' }),
    ));
  }

  /* ── Финал ───────────────────────────────────────────────────────────────── */

  function renderDone(view) {
    progressBox.hidden = true;
    const cases = Array.isArray(view.cases) ? view.cases : [];
    const greeting = state.clientName ? `Спасибо, ${state.clientName}!` : 'Спасибо!';

    const caseCards = cases.map((item, i) => {
      const external = /^https?:/.test(item.url);
      return h('a', {
        class: 'brief-case',
        href: item.url,
        target: external ? '_blank' : null,
        rel: external ? 'noreferrer' : null,
        style: `--order:${i}`,
        onclick: () => track('case_open', { title: item.title }),
      },
      h('div', { class: 'brief-case__media' },
        h('img', { src: `.${item.image}`, alt: '', loading: 'lazy', decoding: 'async' })),
      h('div', { class: 'brief-case__body' },
        h('span', { class: 'brief-case__category', text: item.category }),
        h('h3', { class: 'brief-case__title', text: item.title }),
        h('p', { class: 'brief-case__reason', text: item.reason }),
        h('span', { class: 'brief-case__link', text: external ? 'Открыть сайт ↗' : 'Смотреть демо →' })));
    });

    const money = (value) => new Intl.NumberFormat('ru-RU').format(value);
    const estimate = view.estimate && view.estimate.min ? view.estimate : null;

    mount(h('section', { class: 'brief-screen' },
      h('div', { class: 'brief-card' },
        h('div', { class: 'brief-done__mark', 'aria-hidden': 'true', text: '✓' }),
        h('h1', { class: 'brief-title', text: greeting, tabindex: '-1' }),
        h('p', { class: 'brief-lead', text: 'Ответы уже у меня. Я изучу задачу и подготовлю техническое задание.' }),
        estimate ? h('div', { class: 'brief-estimate' },
          h('p', { class: 'brief-estimate__label', text: 'Примерная стоимость реализации' }),
          h('p', { class: 'brief-estimate__value' },
            h('span', { class: 'brief-estimate__from', text: 'от ' }),
            `${money(estimate.min)} до ${money(estimate.max)} ₽`),
          h('p', { class: 'brief-estimate__note', text: 'Это предварительная оценка по вашим ответам. Финальная стоимость уточняется у исполнителя после обсуждения задачи и зависит от деталей ТЗ.' }),
        ) : null,
        h('div', { class: 'brief-callout' },
          h('h2', { text: 'Чтобы получить ТЗ, свяжитесь с исполнителем' }),
          h('p', { text: 'ТЗ я отправляю лично — после короткого обсуждения, чтобы учесть всё, что не уместилось в опрос. Напишите мне, и договоримся о деталях.' }),
          h('div', { class: 'brief-actions' },
            h('a', { class: 'button brief-primary', href: TELEGRAM, target: '_blank', rel: 'noreferrer', text: 'Написать в Telegram ↗',
              onclick: () => track('contact_click', { channel: 'Telegram', label: 'brief' }) }),
            h('a', { class: 'button', href: './index.html#calculator', text: 'Рассчитать стоимость' })),
        ),
        cases.length ? h('div', {},
          h('h2', { class: 'brief-cases__title', text: 'Похожие проекты из портфолио' }),
          h('div', { class: 'brief-cases' }, caseCards)) : null,
      ),
    ), '.brief-title');
  }

  /* ── Предпросмотр ────────────────────────────────────────────────────────── */

  function previewAdvance(step) {
    const p = state.preview;
    p.index = Math.max(0, Math.min(p.questions.length, p.index + step));
    showPreview();
  }

  function showPreview() {
    const p = state.preview;
    if (p.index >= p.questions.length) {
      renderContact({ status: 'contact', progress: 100, mode: 'owner' });
    } else {
      renderQuestion({
        status: 'question',
        mode: 'owner',
        index: p.index,
        total: p.questions.length,
        progress: Math.round((p.index / p.questions.length) * 100),
        question: p.questions[p.index],
        canBack: p.index > 0,
      });
    }
    app.prepend(h('p', { class: 'brief-banner', text: 'Предпросмотр · ответы не сохраняются и клиенту ничего не отправляется' }));
  }

  function renderPreviewEnd() {
    renderState('ПРЕДПРОСМОТР', 'Так клиент увидит конец опроса', 'После отправки клиент увидит похожие кейсы и призыв связаться с вами, а вам придёт PDF с ответами и черновиком ТЗ.');
  }

  /* ── Запуск ──────────────────────────────────────────────────────────────── */

  async function resume(token) {
    renderThinking({ status: 'thinking', progress: 0 }, 'Возвращаю ваш опрос');
    try {
      const view = await api({ action: 'load', token }, 'GET');
      state.token = token;
      state.mode = view.mode;
      render(view);
    } catch (error) {
      store.clear();
      renderIntro({}, { fresh: true });
    }
  }

  document.addEventListener('keydown', (event) => {
    if (typeof state.keyHandler === 'function' && state.view?.status === 'question' && !state.busy) {
      state.keyHandler(event);
    }
  });

  async function boot() {
    if (!linkToken) {
      track('brief_open', { mode: 'public' });
      renderIntro({ status: 'intro', mode: 'public' });
      return;
    }

    try {
      if (isPreview) {
        const data = await api({ action: 'load', token: linkToken, preview: '1' }, 'GET');
        state.preview = { questions: data.questions || [], index: 0 };
        metaLabel.textContent = data.title || 'Предпросмотр';
        renderIntro({ status: 'intro', mode: 'owner', title: data.title, intro: data.intro });
        const start = app.querySelector('.brief-primary');
        app.prepend(h('p', { class: 'brief-banner', text: 'Предпросмотр · так клиент увидит опрос' }));
        start.replaceWith(h('button', { class: 'button brief-primary', type: 'button', text: 'Смотреть вопросы →', onclick: showPreview }));
        return;
      }

      const view = await api({ action: 'load', token: linkToken }, 'GET');
      track('brief_open', { mode: 'owner' });
      render(view);
    } catch (error) {
      if (error.code === 'not_found') {
        renderState('404', 'Опрос не найден', 'Проверьте ссылку — возможно, она скопировалась не целиком. Или напишите мне, пришлю новую.');
      } else {
        renderState('НЕТ СВЯЗИ', 'Не получилось загрузить опрос', error.message, boot);
      }
    }
  }

  boot();
})();
