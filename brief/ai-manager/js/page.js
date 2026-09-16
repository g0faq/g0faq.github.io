/* Демо и бриф AI-менеджера: фразы для проверки бота и многошаговая анкета.
 * Черновик хранится в localStorage (все обращения в try/catch), ответы
 * уходят JSON-ом на API бота. Пользовательский ввод попадает в DOM только
 * через value/textContent. */

(function () {
  'use strict';

  var API_URL = document.body.getAttribute('data-api') || '';
  var BOT = (document.body.getAttribute('data-bot') || '').replace(/^@/, '');
  var BOT_URL = 'https://t.me/' + BOT;
  var STORAGE_KEY = 'aimgr-brief-v1';
  var TIMEOUT_MS = 15000;

  var PHRASES = [
    'У меня новый клиент Лофт, 5 роликов за 60 тысяч, дедлайн 20 октября',
    'По Lumo съёмку перенесли на пятницу, напомни в четверг в 18:00 подготовить свет',
    'Новый проект для White Smile',
    'Напомни завтра в 12:00 отправить договор',
    'Что у меня по Lumo?',
    'Клиент просит скидку 20%, что ответить?',
    'придумай 5 хуков для Lumo',
    'контент-план на неделю для Зерна'
  ];

  var FEATURE_OPTIONS = ['Оставить как в демо', 'Изменить', 'Убрать из MVP'];
  var FEATURES = [
    'Регистрация и подписка', 'AI-диалог', 'Клиенты и проекты', 'Задачи и напоминания',
    'Пересылка сообщений', 'Документы', 'Ответы клиентам', 'Креативный помощник',
    'Память и сводки', 'Проактивные уведомления', 'Утренний дайджест', 'Вечерний дайджест'
  ];

  // Вопросы по шагам. type: radio | check | text | textarea | date | feature
  var STEPS = [
    { title: 'Запуск', questions: [
      { id: 'status', label: 'Ваш статус', type: 'radio', options: ['ИП', 'ООО', 'Самозанятая', 'Физлицо', 'Пока не оформлено'] },
      { id: 'botName', label: 'Название бота', type: 'text', placeholder: 'Если уже придумано' },
      { id: 'audience', label: 'Целевая аудитория', type: 'textarea', placeholder: 'Кто будет пользоваться ботом' },
      { id: 'usersCount', label: 'Ожидаемое число пользователей в первые 1–3 месяца', type: 'text', placeholder: 'Например, 50–100' },
      { id: 'launchDate', label: 'Желаемая дата запуска', type: 'date' }
    ] },
    { title: 'Подписка и оплата', questions: [
      { id: 'payment', label: 'Платёжная система', type: 'radio', options: ['Уже подключена', 'Нужна помощь с выбором'] },
      { id: 'renewal', label: 'Продление подписки', type: 'radio', options: ['Автоматическое', 'По ссылке на оплату'] },
      { id: 'singlePlan', label: 'Один тариф на старте?', type: 'radio', options: ['Да', 'Нет'] },
      { id: 'singlePlanComment', label: 'Комментарий к тарифам', type: 'textarea' },
      { id: 'limits', label: 'Лимиты в пробный период и в подписке', type: 'radio', options: ['Свои значения', 'На усмотрение разработчика'] },
      { id: 'limitsValues', label: 'Если свои — какие', type: 'textarea' }
    ] },
    { title: 'Админка', questions: [
      { id: 'adminFormat', label: 'Формат админки', type: 'radio', options: ['Веб-страница с логином', 'Отдельный бот-админка', 'На усмотрение разработчика'] },
      { id: 'adminCount', label: 'Сколько администраторов', type: 'text', placeholder: 'Например, 1' }
    ] },
    { title: 'ИИ', questions: [
      { id: 'aiPriority', label: 'Что важнее', type: 'radio', options: ['Качество ответов', 'Низкая стоимость', 'Баланс'] },
      { id: 'dataRu', label: 'Есть требования к хранению данных в РФ?', type: 'radio', options: ['Да', 'Не знаю'] }
    ] },
    { title: 'Функции по итогам демо', note: 'Для каждой функции: оставить как в демо, изменить или убрать из первой версии.', questions: FEATURES.map(function (name, i) {
      return { id: 'feature' + i, label: name, type: 'feature' };
    }) },
    { title: 'Уведомления', questions: [
      { id: 'deadlineDays', label: 'За сколько дней предупреждать о дедлайне', type: 'text', placeholder: 'В демо — 2' },
      { id: 'silenceDays', label: 'Через сколько дней молчания клиента напоминать', type: 'text', placeholder: 'В демо — 3' },
      { id: 'rightsDays', label: 'За сколько дней предупреждать об окончании прав на контент', type: 'text', placeholder: 'В демо — 14' },
      { id: 'digestTime', label: 'Время дайджестов по умолчанию', type: 'text', placeholder: 'Например, 09:00 и 20:00' },
      { id: 'timezones', label: 'Будут пользователи в разных часовых поясах?', type: 'radio', options: ['Да', 'Нет', 'Не знаю'] }
    ] },
    { title: 'Документы', questions: [
      { id: 'docTypes', label: 'Какие документы чаще', type: 'check', options: ['Договоры', 'ТЗ', 'Брифы', 'Другое'] },
      { id: 'docTypesOther', label: 'Если другое — какие', type: 'text' },
      { id: 'docPages', label: 'Типичный объём в страницах', type: 'text', placeholder: 'Например, 3–10' }
    ] },
    { title: 'Тексты и оформление', questions: [
      { id: 'address', label: 'Обращение к пользователю', type: 'radio', options: ['На «ты»', 'На «вы»'] },
      { id: 'welcomeAuthor', label: 'Кто пишет приветствие', type: 'radio', options: ['Я', 'Разработчик'] },
      { id: 'avatar', label: 'Есть аватар и описание бота?', type: 'radio', options: ['Есть', 'Нет', 'Частично'] }
    ] },
    { title: 'Юридическое', questions: [
      { id: 'legal', label: 'Есть публичная оферта и политика обработки персональных данных?', type: 'radio', options: ['Есть', 'Нет', 'Нужен перечень, что подготовить'] }
    ] },
    { title: 'Материалы для тестирования', questions: [
      { id: 'materials', label: 'Сможете дать 5–10 примеров переписок и 3–5 договоров или ТЗ без персональных данных?', type: 'radio', options: ['Да', 'Частично', 'Нет'] }
    ] },
    { title: 'Голосовые сообщения', questions: [
      { id: 'voice', label: 'Голосовые сообщения', type: 'radio', options: ['В следующем этапе', 'Обсудить включение в первую версию'] }
    ] },
    { title: 'Завершение', final: true, questions: [
      { id: 'comment', label: 'Свободный комментарий', type: 'textarea', placeholder: 'Что ещё важно учесть' },
      { id: 'contact', label: 'Контакт для связи (необязательно)', type: 'text', placeholder: 'Телеграм, телефон или почта' }
    ] }
  ];

  var root = document.getElementById('brief');
  var toastEl = document.querySelector('[data-toast]');
  var state = { step: 0, values: {}, consent: false, done: false };
  var sending = false;

  // ---------- утилиты ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        state.values = saved.values || {};
        state.step = Math.min(Math.max(0, saved.step | 0), STEPS.length - 1);
        state.consent = !!saved.consent;
      }
    } catch (e) { /* хранилище недоступно — работаем без черновика */ }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step: state.step, values: state.values, consent: state.consent }));
    } catch (e) { /* хранилище недоступно */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* хранилище недоступно */ }
  }

  var toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2000);
  }

  function copy(text) {
    var fallback = function () {
      var ta = el('textarea', { class: 'hp', readonly: '' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? 'Скопировано' : 'Не удалось скопировать — выделите текст вручную');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('Скопировано'); }, fallback);
    } else fallback();
  }

  // ---------- фразы ----------
  function renderPhrases() {
    var list = document.querySelector('[data-phrases]');
    PHRASES.forEach(function (p) {
      var btn = el('button', { type: 'button', class: 'btn btn--small', text: 'Скопировать', 'aria-label': 'Скопировать фразу: ' + p });
      btn.addEventListener('click', function () { copy(p); });
      list.appendChild(el('li', { class: 'phrase' }, [el('span', { class: 'phrase__text', text: p }), btn]));
    });
    document.querySelectorAll('[data-bot-link]').forEach(function (a) { a.href = BOT_URL; });
  }

  // ---------- поля ----------
  function renderChoices(q, name, options, type, value, onChange) {
    var wrap = el('div', { class: 'choices' + (options.length <= 3 ? ' choices--row' : '') });
    options.forEach(function (opt) {
      var input = el('input', { type: type, name: name, value: opt });
      input.checked = type === 'radio' ? value === opt : Array.isArray(value) && value.indexOf(opt) !== -1;
      input.addEventListener('change', function () { onChange(input); });
      wrap.appendChild(el('label', { class: 'choice' }, [input, el('span', { class: 'choice__key', 'aria-hidden': 'true' }), el('span', { text: opt })]));
    });
    return wrap;
  }

  function renderQuestion(q) {
    var v = state.values[q.id];
    var set = function (val) { state.values[q.id] = val; save(); };

    if (q.type === 'radio' || q.type === 'check') {
      var fs = el('fieldset', { class: 'q' }, [el('legend', { class: 'q__label', text: q.label })]);
      fs.appendChild(renderChoices(q, q.id, q.options, q.type === 'radio' ? 'radio' : 'checkbox', v, function (input) {
        if (q.type === 'radio') set(input.value);
        else {
          var arr = Array.isArray(state.values[q.id]) ? state.values[q.id].slice() : [];
          var i = arr.indexOf(input.value);
          if (input.checked && i === -1) arr.push(input.value);
          if (!input.checked && i !== -1) arr.splice(i, 1);
          set(arr);
        }
      }));
      return fs;
    }

    if (q.type === 'feature') {
      var fv = v && typeof v === 'object' ? v : {};
      var box = el('fieldset', { class: 'q feature' }, [el('legend', { class: 'q__label', text: q.label })]);
      box.appendChild(renderChoices(q, q.id, FEATURE_OPTIONS, 'radio', fv.choice, function (input) {
        set({ choice: input.value, comment: (state.values[q.id] || {}).comment || '' });
      }));
      var c = el('input', { type: 'text', class: 'field', placeholder: 'Комментарий', 'aria-label': 'Комментарий: ' + q.label, maxlength: '1000' });
      c.value = fv.comment || '';
      c.addEventListener('input', function () { set({ choice: (state.values[q.id] || {}).choice || '', comment: c.value }); });
      box.appendChild(c);
      return box;
    }

    var id = 'f-' + q.id;
    var input = q.type === 'textarea'
      ? el('textarea', { id: id, class: 'field', maxlength: '4000' })
      : el('input', { id: id, class: 'field', type: q.type === 'date' ? 'date' : 'text', maxlength: '300' });
    if (q.placeholder) input.setAttribute('placeholder', q.placeholder);
    input.value = typeof v === 'string' ? v : '';
    input.addEventListener('input', function () { set(input.value); });
    return el('div', { class: 'q' }, [el('label', { class: 'q__label', for: id, text: q.label }), input]);
  }

  // ---------- экраны ----------
  function render() {
    root.textContent = '';
    if (state.done) return renderThanks();
    var step = STEPS[state.step];
    var pct = Math.round(((state.step + 1) / STEPS.length) * 100);

    var bar = el('span', { class: 'progress__bar' });
    bar.style.width = pct + '%';
    root.appendChild(el('div', { class: 'progress' }, [
      el('div', { class: 'progress__info' }, [el('span', { text: step.title }), el('span', { text: 'Шаг ' + (state.step + 1) + ' из ' + STEPS.length })]),
      el('div', { class: 'progress__track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': 'Прогресс анкеты' }, [bar])
    ]));

    var form = el('form', { novalidate: '' });
    form.appendChild(el('h3', { text: step.title }));
    if (step.note) form.appendChild(el('p', { class: 'q__note', text: step.note }));
    step.questions.forEach(function (q) { form.appendChild(renderQuestion(q)); });

    var errorBox = el('div', { 'data-error': '' });
    if (step.final) {
      var consent = el('input', { type: 'checkbox', name: 'consent' });
      consent.checked = state.consent;
      consent.addEventListener('change', function () { state.consent = consent.checked; save(); });
      var link = el('a', { href: '/privacy.html', target: '_blank', rel: 'noopener', text: 'политикой обработки данных' });
      var text = el('span', {}, [document.createTextNode('Согласен(на) на обработку персональных данных в соответствии с '), link]);
      form.appendChild(el('label', { class: 'choice consent' }, [consent, el('span', { class: 'choice__key', 'aria-hidden': 'true' }), text]));
    }
    form.appendChild(errorBox);

    var nav = el('div', { class: 'nav' });
    if (state.step > 0) {
      var back = el('button', { type: 'button', class: 'btn', text: '← Назад' });
      back.addEventListener('click', function () { go(state.step - 1); });
      nav.appendChild(back);
    }
    var next = el('button', { type: 'submit', class: 'btn btn--primary', text: step.final ? 'Отправить' : 'Далее →' });
    nav.appendChild(next);
    form.appendChild(nav);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!step.final) return go(state.step + 1);
      submit(form, next, errorBox);
    });
    root.appendChild(form);
  }

  function go(i) {
    state.step = Math.min(Math.max(0, i), STEPS.length - 1);
    save();
    render();
    root.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- отправка ----------
  function answerText(q) {
    var v = state.values[q.id];
    if (q.type === 'feature') {
      if (!v || (!v.choice && !v.comment)) return '';
      return (v.choice || 'не выбрано') + (v.comment ? ' — ' + v.comment : '');
    }
    if (Array.isArray(v)) return v.join(', ');
    return typeof v === 'string' ? v.trim() : '';
  }

  function collectSections() {
    return STEPS.map(function (s) {
      return {
        title: s.title,
        items: s.questions.filter(function (q) { return q.id !== 'contact'; }).map(function (q) {
          return { question: q.label, answer: answerText(q) || '—' };
        })
      };
    });
  }

  function answersAsText() {
    var contact = answerText({ id: 'contact' });
    var lines = ['Бриф: AI-менеджер', 'Контакт: ' + (contact || 'не указан')];
    collectSections().forEach(function (sec) {
      lines.push('', sec.title);
      sec.items.forEach(function (a) { lines.push('• ' + a.question + ': ' + a.answer); });
    });
    return lines.join('\n');
  }

  function submit(form, button, errorBox) {
    if (sending) return;
    errorBox.textContent = '';
    if (!state.consent) {
      errorBox.appendChild(el('p', { class: 'error', text: 'Чтобы отправить анкету, отметьте согласие на обработку персональных данных.' }));
      return;
    }
    sending = true;
    button.disabled = true;
    button.textContent = 'Отправляю…';

    var payload = { contact: answerText({ id: 'contact' }).slice(0, 200), sections: collectSections() };

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, TIMEOUT_MS);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data || data.ok !== true) {
            var err = new Error((data && data.message) || ('Сервер ответил ' + res.status));
            err.server = true;
            throw err;
          }
        });
      })
      .then(function () {
        clearDraft();
        state = { step: 0, values: {}, consent: false, done: true };
        render();
        root.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (err) {
        sending = false;
        button.disabled = false;
        button.textContent = 'Отправить ещё раз';
        showError(errorBox, err && err.server ? err.message : 'Не удалось связаться с сервером.');
      })
      .then(function () { clearTimeout(timer); });
  }

  function showError(box, reason) {
    box.textContent = '';
    var copyBtn = el('button', { type: 'button', class: 'btn btn--primary', text: 'Скопировать ответы текстом' });
    copyBtn.addEventListener('click', function () { copy(answersAsText()); });
    var download = el('button', { type: 'button', class: 'btn', text: 'Скачать ответы (.txt)' });
    download.addEventListener('click', function () {
      var blob = new Blob([answersAsText()], { type: 'text/plain;charset=utf-8' });
      var a = el('a', { href: URL.createObjectURL(blob), download: 'brief-ai-manager.txt' });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    box.appendChild(el('div', { class: 'status status--error', role: 'alert' }, [
      el('h3', { text: 'Ответы не отправились' }),
      el('p', { text: reason + ' Черновик сохранён в браузере. Можно попробовать ещё раз, скопировать или скачать ответы и прислать их в Telegram.' }),
      el('div', { class: 'nav' }, [copyBtn, download])
    ]));
  }

  function renderThanks() {
    var again = el('button', { type: 'button', class: 'btn', text: 'Заполнить заново' });
    again.addEventListener('click', function () { state.done = false; render(); });
    root.appendChild(el('div', { class: 'status status--ok', role: 'status' }, [
      el('h3', { text: 'Спасибо, ответы получены' }),
      el('p', { text: 'На их основе будет подготовлено финальное ТЗ. Если что-то нужно уточнить — свяжусь с вами.' }),
      el('div', { class: 'nav' }, [again])
    ]));
  }

  renderPhrases();
  load();
  render();
})();
