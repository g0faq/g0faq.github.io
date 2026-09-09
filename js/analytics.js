/* Согласие на аналитику и собственный трекер.
 *
 * Порядок жёсткий: пока посетитель не нажал «Принять», не создаётся ни
 * идентификатор, ни одно событие, и не загружается Яндекс.Метрика. Единственное,
 * что хранится до согласия, — сам факт выбора: без него пришлось бы спрашивать
 * на каждой странице.
 *
 * Всё, что здесь происходит, некритично для сайта: любая ошибка гасится, и
 * интерфейс продолжает работать, даже если бэкенд, Telegram или Метрика недоступны.
 */

(function initAnalytics() {
  'use strict';

  const ENDPOINT = 'https://portfolio-ten-umber-3z9vgkulzy.vercel.app/api/collect';
  const METRIKA_ID = '112416202';

  const KEYS = {
    consent: 'g0faq.consent',
    visitor: 'g0faq.visitor',
    session: 'g0faq.session',
  };

  const SESSION_IDLE_MIN = 30;
  const BATCH_SIZE = 12;
  const BATCH_INTERVAL_MS = 5000;

  const params = new URLSearchParams(location.search);
  const DEBUG = params.get('analytics_debug') === '1'
    || ['localhost', '127.0.0.1'].includes(location.hostname);

  const log = (...args) => {
    if (DEBUG) console.info('%c[analytics]', 'color:#ff4105', ...args);
  };

  /* ── хранилище: любое обращение может бросить в приватном режиме ────────── */

  const store = {
    get(key, session) {
      try {
        return (session ? sessionStorage : localStorage).getItem(key);
      } catch { return null; }
    },
    set(key, value, session) {
      try {
        (session ? sessionStorage : localStorage).setItem(key, value);
      } catch { /* приватный режим — работаем без памяти между визитами */ }
    },
    remove(key, session) {
      try {
        (session ? sessionStorage : localStorage).removeItem(key);
      } catch { /* см. выше */ }
    },
  };

  /* ── определение окружения ─────────────────────────────────────────────── */

  const uuid = () => (crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
    }));

  /** Короткий ярлык для Telegram: #A82F. Из самого UUID, не из данных о человеке. */
  const shortId = (id) => id.replace(/-/g, '').slice(0, 4).toUpperCase();

  function environment() {
    const ua = navigator.userAgent;
    const mobile = /iPhone|Android.+Mobile|Windows Phone/i.test(ua);
    const tablet = /iPad|Android(?!.+Mobile)|Tablet/i.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
      : /Android/i.test(ua) ? 'Android'
        : /Mac OS X/i.test(ua) ? 'macOS'
          : /Windows/i.test(ua) ? 'Windows'
            : /Linux/i.test(ua) ? 'Linux' : null;

    const browser = /YaBrowser/i.test(ua) ? 'Яндекс.Браузер'
      : /Edg\//i.test(ua) ? 'Edge'
        : /OPR\//i.test(ua) ? 'Opera'
          : /Firefox\//i.test(ua) ? 'Firefox'
            : /Chrome\//i.test(ua) ? 'Chrome'
              : /Safari\//i.test(ua) ? 'Safari' : null;

    const model = /iPhone/i.test(ua) ? 'iPhone'
      : /iPad/i.test(ua) ? 'iPad'
        : /Android/i.test(ua) ? 'Android'
          : os === 'macOS' ? 'Mac' : os;

    let timezone = null;
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* редкие движки */ }

    return {
      device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop',
      model, os, browser,
      screen: { w: window.screen?.width || null, h: window.screen?.height || null },
      language: navigator.language || null,
      timezone,
    };
  }

  function utmFromUrl() {
    const utm = {};
    ['source', 'medium', 'campaign', 'content', 'term'].forEach((key) => {
      const value = params.get(`utm_${key}`);
      if (value) utm[key] = value.slice(0, 200);
    });
    return utm;
  }

  /* ── трекер ────────────────────────────────────────────────────────────── */

  const tracker = {
    started: false,
    visitorId: null,
    sessionId: null,
    startedAt: 0,
    queue: [],
    timer: 0,
    maxScroll: 0,
    seenSections: new Set(),
    calc: null,

    start() {
      if (this.started) return;
      this.started = true;

      let visitorId = store.get(KEYS.visitor);
      if (!visitorId) {
        visitorId = uuid();
        store.set(KEYS.visitor, visitorId);
      }

      // Сессия живёт во вкладке и обрывается после получаса без активности.
      let session = null;
      try { session = JSON.parse(store.get(KEYS.session, true) || 'null'); } catch { session = null; }
      const fresh = !session || (Date.now() - session.at) > SESSION_IDLE_MIN * 60000;
      if (fresh) session = { id: uuid(), at: Date.now(), start: Date.now() };

      this.visitorId = visitorId;
      this.sessionId = session.id;
      this.startedAt = session.start || Date.now();
      this.touch();

      const env = environment();
      this.ctx = {
        landing: location.pathname + location.search,
        referrer: document.referrer || null,
        utm: utmFromUrl(),
        ...env,
      };

      log('старт', { visitor: shortId(visitorId), session: shortId(session.id), ctx: this.ctx });

      this.push('session_start');
      this.trackPage();
      this.observeSections();
      this.observeScroll();
      this.observeClicks();
      this.observeCalculator();
      this.observeLeave();
      metrika.load();
    },

    touch() {
      store.set(KEYS.session, JSON.stringify({
        id: this.sessionId, at: Date.now(), start: this.startedAt,
      }), true);
    },

    push(type, data, calc) {
      if (!this.started) return;
      const event = { t: Date.now() - this.startedAt, type };
      if (data) event.data = data;
      if (calc) event.calc = calc;
      this.queue.push(event);
      this.touch();
      log('событие', type, data || '');

      if (this.queue.length >= BATCH_SIZE) this.flush();
      else if (!this.timer) this.timer = window.setTimeout(() => this.flush(), BATCH_INTERVAL_MS);
    },

    payload(extra) {
      return JSON.stringify({
        v: 1,
        visitor_id: this.visitorId,
        session_id: this.sessionId,
        visitor_short: shortId(this.visitorId),
        session_short: shortId(this.sessionId),
        duration_sec: Math.round((Date.now() - this.startedAt) / 1000),
        ctx: this.ctx,
        events: this.queue.splice(0, 60),
        ...extra,
      });
    },

    flush(useBeacon) {
      window.clearTimeout(this.timer);
      this.timer = 0;
      if (!this.queue.length) return;
      const body = this.payload();

      try {
        if (useBeacon && navigator.sendBeacon) {
          // Blob с типом: без него Safari отбрасывает маяк на выгрузке страницы.
          navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
          return;
        }
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
          mode: 'cors',
        }).catch(() => { /* бэкенд недоступен — сайту всё равно */ });
      } catch { /* см. выше */ }
    },

    trackPage() {
      const title = document.title.split('—')[0].trim() || location.pathname;
      this.push('page_view', { path: location.pathname, title: title.slice(0, 80) });
    },

    observeSections() {
      const sections = document.querySelectorAll('[data-section-name]');
      if (!sections.length || !('IntersectionObserver' in window)) return;

      const enteredAt = new Map();
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const name = entry.target.dataset.sectionName;
          if (entry.isIntersecting) {
            if (!enteredAt.has(name)) enteredAt.set(name, Date.now());
            if (!this.seenSections.has(name)) {
              this.seenSections.add(name);
              this.push('section_view', { name });
              metrika.goalForSection(name);
            }
          } else if (enteredAt.has(name)) {
            const seconds = Math.round((Date.now() - enteredAt.get(name)) / 1000);
            enteredAt.delete(name);
            // Мелькнувшую секцию не считаем просмотренной.
            if (seconds >= 3) this.push('section_view', { name, seconds });
          }
        });
      }, { threshold: 0.4 });

      sections.forEach((section) => observer.observe(section));
    },

    observeScroll() {
      const marks = [25, 50, 75, 90, 100];
      const reached = new Set();
      let ticking = false;

      const measure = () => {
        ticking = false;
        const doc = document.documentElement;
        const height = doc.scrollHeight - window.innerHeight;
        if (height <= 0) return;
        const depth = Math.min(100, Math.round(((window.scrollY || 0) / height) * 100));
        if (depth > this.maxScroll) this.maxScroll = depth;
        marks.forEach((mark) => {
          if (depth >= mark && !reached.has(mark)) {
            reached.add(mark);
            this.push('scroll_depth', { depth: mark });
          }
        });
      };

      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(measure);
      }, { passive: true });
    },

    observeClicks() {
      document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href], button');
        if (!link) return;

        const text = (link.textContent || '').trim().slice(0, 60);
        const href = link.getAttribute('href') || '';

        // Контакты: определяем по протоколу и известным доменам.
        if (/^(tel:|mailto:)/.test(href) || /t\.me|vk\.com|github\.com|web\.max\.ru/.test(href)) {
          const channel = href.startsWith('tel:') ? 'телефон'
            : href.startsWith('mailto:') ? 'почта'
              : /t\.me/.test(href) ? 'Telegram'
                : /vk\.com/.test(href) ? 'VK'
                  : /github\.com/.test(href) ? 'GitHub' : 'MAX';
          this.push('contact_click', { channel, label: text });
          metrika.goal('contact_clicked');
          if (channel === 'Telegram') metrika.goal('telegram_clicked');
          return;
        }

        // Кейс: карточка в стопке или ссылка «Открыть сайт».
        const panel = link.closest('.case-panel');
        if (panel) {
          const title = panel.querySelector('h3')?.textContent?.trim().slice(0, 60) || null;
          this.push('case_open', { title, href: href.slice(0, 200) });
          metrika.goal('portfolio_opened');
          return;
        }

        if (link.classList.contains('button') || link.classList.contains('header-chip')) {
          this.push('cta_click', { label: text, href: href.slice(0, 200) });
          return;
        }

        if (/^https?:/.test(href) && !href.includes(location.host)) {
          let host = '';
          try { host = new URL(href).hostname; } catch { host = ''; }
          this.push('outbound_click', { host });
        }
      }, { capture: true });
    },

    /** Калькулятор шлёт свои события через CustomEvent — здесь только приём. */
    observeCalculator() {
      window.addEventListener('portfolio:calculator', (event) => {
        const detail = event.detail || {};
        this.calc = detail.state || this.calc;
        this.push(detail.type, detail.data, this.calc);

        if (detail.type === 'calculator_open') metrika.goal('calculator_open');
        if (detail.type === 'calculated_price_changed') metrika.goal('calculator_completed');
        if (detail.type === 'form_started') metrika.goal('lead_form_started');
        if (detail.type === 'form_submitted') metrika.goal('lead_form_submitted');

        // Важное отправляем немедленно, не дожидаясь окна батча.
        if (['calculator_open', 'calculated_price_changed', 'form_started',
          'form_submitted', 'form_abandoned'].includes(detail.type)) this.flush();
      });
    },

    observeLeave() {
      const finish = (reason) => {
        if (!this.started) return;
        // Незавершённая заявка — отдельное событие: это самый ценный сигнал.
        if (this.calc && this.calc.form_started && !this.calc.form_submitted) {
          this.push('form_abandoned', { reason }, this.calc);
        }
        this.push('session_end', { reason, max_scroll: this.maxScroll }, this.calc);
        this.flush(true);
      };

      window.addEventListener('pagehide', () => finish('pagehide'));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') { this.flush(true); }
      });
    },
  };

  /* ── Яндекс.Метрика ────────────────────────────────────────────────────── */

  const metrika = {
    ready: false,

    load() {
      if (this.ready || !METRIKA_ID) return;
      this.ready = true;

      window.ym = window.ym || function ym(...args) {
        (window.ym.a = window.ym.a || []).push(args);
      };
      window.ym.l = Date.now();

      const script = document.createElement('script');
      script.src = 'https://mc.yandex.ru/metrika/tag.js';
      script.async = true;
      // Блокировщик рекламы уронит запрос — это нормально и ни на что не влияет.
      script.onerror = () => log('Метрика заблокирована на стороне браузера');
      document.head.append(script);

      window.ym(METRIKA_ID, 'init', {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: 'dataLayer',
        referrer: document.referrer,
        url: location.href,
        accurateTrackBounce: true,
        trackLinks: true,
      });
      log('Метрика подключена');
    },

    goal(name) {
      if (!this.ready || typeof window.ym !== 'function') return;
      try { window.ym(METRIKA_ID, 'reachGoal', name); } catch { /* не критично */ }
    },

    goalForSection(name) {
      if (name === 'Кейсы') this.goal('portfolio_opened');
      if (name === 'Стоимость') this.goal('calculator_open');
    },
  };

  /* ── экран согласия ────────────────────────────────────────────────────── */

  const consent = {
    value() { return store.get(KEYS.consent); },

    apply(choice) {
      store.set(KEYS.consent, choice);
      this.hide();
      if (choice === 'granted') tracker.start();
      log('выбор:', choice);
    },

    revoke() {
      store.remove(KEYS.consent);
      store.remove(KEYS.visitor);
      store.remove(KEYS.session, true);
      // Перезагрузка — самый честный способ остановить уже запущенный трекер
      // и снять счётчик Метрики: половинчатое отключение оставило бы хвосты.
      location.reload();
    },

    show() {
      const modal = document.querySelector('#consent-screen');
      if (!modal) return;
      modal.hidden = false;
      window.setTimeout(() => modal.classList.add('is-visible'), 30);
      const accept = modal.querySelector('[data-consent="granted"]');
      if (accept) window.setTimeout(() => accept.focus({ preventScroll: true }), 320);
    },

    hide() {
      const modal = document.querySelector('#consent-screen');
      if (!modal) return;
      modal.classList.remove('is-visible');
      window.setTimeout(() => { modal.hidden = true; }, 260);
    },

    init() {
      document.addEventListener('click', (event) => {
        const choice = event.target.closest('[data-consent]');
        if (choice) { this.apply(choice.dataset.consent); return; }
        if (event.target.closest('[data-consent-revoke]')) {
          event.preventDefault();
          this.revoke();
        }
      });

      const saved = this.value();
      if (saved === 'granted') { tracker.start(); return; }
      if (saved === 'denied') return;
      this.show();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => consent.init());
  } else {
    consent.init();
  }

  // Наружу отдаём только то, что нужно калькулятору и странице политики.
  window.PortfolioAnalytics = Object.freeze({
    track: (type, data, calc) => tracker.push(type, data, calc),
    revoke: () => consent.revoke(),
    get consent() { return consent.value(); },
  });
})();
