/* Приём заявок отключён: сайт хостится статикой, serverless-эндпоинт
   /api/contact удалён. Вписать сюда адрес приёмника, когда он появится, —
   разметка и обработчики форм для этого уже готовы. */
window.CONTACT_ENDPOINT = window.CONTACT_ENDPOINT || '';

(function setupProjectCalculator() {
  const config = window.CALCULATOR_CONFIG;
  if (!config) return;

  const roundToThousand = (value) => Math.round(value / 1000) * 1000;
  const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value);

  const findById = (items, id) => items.find((item) => item.id === id);

  const calculateEstimate = (calculatorConfig, answers) => {
    const product = findById(calculatorConfig.products, answers.product);
    const scale = findById(calculatorConfig.scales, answers.scale);
    const design = findById(calculatorConfig.designs, answers.design);
    const timeline = findById(calculatorConfig.timelines, answers.timeline);
    if (!product || !scale || !design || !timeline) {
      throw new Error('Для расчёта заполните обязательные шаги');
    }

    const features = (answers.features || [])
      .map((id) => findById(calculatorConfig.features, id))
      .filter((item) => item && !item.exclusive);
    const featureMin = features.reduce((total, item) => total + item.min, 0);
    const featureMax = features.reduce((total, item) => total + item.max, 0);

    const rawMin = ((product.min * scale.minMultiplier) + featureMin + design.min)
      * timeline.minMultiplier;
    const rawMax = ((product.max * scale.maxMultiplier) + featureMax + design.max)
      * timeline.maxMultiplier;
    const min = Math.max(1000, roundToThousand(rawMin));
    const roundedMax = Math.max(1000, roundToThousand(rawMax));
    const max = roundedMax > min ? roundedMax : min + 1000;

    return { min, max, product, scale, features, design, timeline };
  };

  window.PortfolioCalculator = Object.freeze({ calculateEstimate, formatCurrency });

  const iconMarkup = (name) => {
    const icons = {
      layout: '<path d="M3 4h18v16H3zM3 9h18M9 9v11"/>',
      building: '<path d="M4 21V5l8-3 8 3v16M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2M2 21h20"/>',
      cart: '<path d="M3 4h2l2.2 10h9.9l2-7H6M9 19h.01M17 19h.01"/>',
      bot: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 3h6M12 3v4M8 12h.01M16 12h.01M8 16h8"/>',
      'mini-app': '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M9 6h6M8 10h8v6H8zM11 19h2"/>',
      dashboard: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',
      spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
      custom: '<path d="M4 20 20 4M13 4h7v7M4 7h5M4 12h8M4 17h4M13 20h7v-5"/>'
    };
    const path = icons[name] || icons.custom;
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  };

  const priceLabel = (stepKey, option) => {
    if (stepKey === 'product') {
      return `${formatCurrency(option.min)}–${formatCurrency(option.max)} ₽`;
    }
    if (stepKey === 'scale' || stepKey === 'timeline') {
      return `×${String(option.minMultiplier).replace('.', ',')}–×${String(option.maxMultiplier).replace('.', ',')}`;
    }
    if (option.min === 0 && option.max === 0) return '+0 ₽';
    return `+${formatCurrency(option.min)}–${formatCurrency(option.max)} ₽`;
  };

  const steps = [
    {
      key: 'product',
      eyebrow: 'Тип продукта',
      title: 'Что нужно разработать?',
      description: 'Выберите один основной формат — от него начинается расчёт.',
      options: config.products,
      required: true,
      icon: true
    },
    {
      key: 'scale',
      eyebrow: 'Масштаб проекта',
      title: 'Какой объём предполагается?',
      description: 'Если пока сложно оценить объём, выберите «Пока не знаю».',
      options: config.scales,
      required: true
    },
    {
      key: 'features',
      eyebrow: 'Дополнительные функции',
      title: 'Что должно быть внутри?',
      description: 'Можно выбрать несколько пунктов или пропустить шаг.',
      options: config.features,
      required: false,
      multiple: true
    },
    {
      key: 'design',
      eyebrow: 'Дизайн',
      title: 'Какой уровень визуала нужен?',
      description: 'Стоимость дизайна добавляется к разработке.',
      options: config.designs,
      required: true
    },
    {
      key: 'timeline',
      eyebrow: 'Сроки',
      title: 'Насколько быстро нужен запуск?',
      description: 'Срочность влияет на приоритет и итоговую вилку.',
      options: config.timelines,
      required: true
    }
  ];


  /* Мост к аналитике. Калькулятор ничего не знает про трекер: он лишь
     объявляет о происходящем, а слушателя может не быть вовсе. Наружу уходят
     только заранее заданные варианты ответов и расчётная вилка — свободный
     текст полей заявки не покидает браузер до отправки формы. */
  const emit = (type, data, state, extra) => {
    try {
      const snapshot = state ? calculatorSnapshot(state, extra) : null;
      window.dispatchEvent(new CustomEvent('portfolio:calculator', {
        detail: { type, data: data || null, state: snapshot },
      }));
    } catch (error) {
      // Аналитика не имеет права ломать анкету, но и молчать о поломке нельзя.
      if (window.console) console.warn('[calculator] событие аналитики не ушло:', error);
    }
  };

  const calculatorSnapshot = (state, extra = {}) => {
    // Расчёт возможен только на полностью заполненной анкете — на середине
    // пути он бросает исключение, и это нормальный ход событий, а не сбой.
    let estimate = null;
    try {
      estimate = calculateEstimate(config, state.answers);
    } catch {
      estimate = null;
    }
    const labelOf = (stepKey, id) => {
      if (!id) return null;
      const step = steps.find((item) => item.key === stepKey);
      const option = step && step.options.find((item) => item.id === id);
      return option ? option.title : id;
    };
    return {
      step: state.step,
      result: state.result,
      answers: {
        product: state.answers.product,
        scale: state.answers.scale,
        features: state.answers.features.slice(),
        design: state.answers.design,
        timeline: state.answers.timeline,
      },
      labels: {
        product: labelOf('product', state.answers.product),
        scale: labelOf('scale', state.answers.scale),
        features: state.answers.features.map((id) => labelOf('features', id)),
        design: labelOf('design', state.answers.design),
        timeline: labelOf('timeline', state.answers.timeline),
      },
      price_min: estimate ? estimate.min : null,
      price_max: estimate ? estimate.max : null,
      ...extra,
    };
  };

  const defaultAnswers = () => ({
    product: null,
    scale: null,
    features: [],
    design: null,
    timeline: null
  });

  const init = () => {
    const shell = document.querySelector('[data-calculator]');
    if (!shell) return;

    const stepLabel = shell.querySelector('[data-calculator-step]');
    const progress = shell.querySelector('[data-calculator-progress]');
    const progressText = shell.querySelector('[data-calculator-progress-text]');
    const stage = shell.querySelector('[data-calculator-stage]');
    const backButton = shell.querySelector('[data-calculator-back]');
    const nextButton = shell.querySelector('[data-calculator-next]');
    const hint = shell.querySelector('[data-calculator-hint]');
    const state = { step: 0, result: false, answers: defaultAnswers() };
    try {
      localStorage.removeItem(config.storageKey);
    } catch {
      // Each new visit starts from a clean questionnaire even without storage access.
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let advanceTimer = 0;
    let formStarted = false;
    let fieldsTimer = 0;

    emit('calculator_open', null, state);

    const saveState = () => {
      try {
        localStorage.setItem(config.storageKey, JSON.stringify(state));
      } catch {
        // The calculator remains fully usable when storage is unavailable.
      }
    };

    const selectedIds = (step) => {
      const value = state.answers[step.key];
      return step.multiple ? value : value ? [value] : [];
    };

    const isStepValid = (step) => !step.required || selectedIds(step).length > 0;

    const animateProgress = () => {
      progress.classList.remove('is-advancing');
      void progress.offsetWidth;
      progress.classList.add('is-advancing');
    };

    const renderOption = (step, option, index) => {
      const selected = selectedIds(step).includes(option.id);
      const role = step.multiple ? 'checkbox' : 'radio';
      return `
        <button
          class="calculator-option${selected ? ' is-selected' : ''}${option.exclusive ? ' calculator-option--exclusive' : ''}"
          type="button"
          role="${role}"
          aria-checked="${selected}"
          data-option-id="${option.id}"
          style="--option-order:${index}"
        >
          <span class="calculator-option__check" aria-hidden="true">${selected ? '×' : '+'}</span>
          ${step.icon ? `<span class="calculator-option__icon">${iconMarkup(option.icon)}</span>` : ''}
          <span class="calculator-option__title">${option.title}</span>
          ${option.description ? `<span class="calculator-option__description">${option.description}</span>` : ''}
          <span class="calculator-option__price">${priceLabel(step.key, option)}</span>
        </button>
      `;
    };

    const updateSelectionUI = () => {
      const step = steps[state.step];
      const ids = selectedIds(step);
      stage.querySelectorAll('[data-option-id]').forEach((button) => {
        const selected = ids.includes(button.dataset.optionId);
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-checked', String(selected));
        button.querySelector('.calculator-option__check').textContent = selected ? '×' : '+';
      });
      nextButton.disabled = !isStepValid(step);
      hint.textContent = isStepValid(step) ? '' : 'Выберите один вариант, чтобы продолжить';
    };

    const renderStep = () => {
      const step = steps[state.step];
      const percent = Math.round((state.step / steps.length) * 100);
      emit('calculator_step_view', { step: step.key, title: step.eyebrow }, state);
      shell.classList.remove('is-result');
      stage.classList.remove('is-choice-locked');
      stepLabel.textContent = `${String(state.step + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
      progress.style.setProperty('--calculator-progress', String(state.step / steps.length));
      progress.setAttribute('aria-valuenow', String(percent));
      progressText.textContent = `${percent}%`;
      animateProgress();
      stage.innerHTML = `
        <div class="calculator-stage__heading">
          <p class="eyebrow">${step.eyebrow}</p>
          <h3 tabindex="-1">${step.title}</h3>
          <p>${step.description}</p>
        </div>
        <div class="calculator-options calculator-options--${step.key}" role="${step.multiple ? 'group' : 'radiogroup'}" aria-label="${step.title}">
          ${step.options.map((option, index) => renderOption(step, option, index)).join('')}
        </div>
      `;
      backButton.disabled = state.step === 0;
      nextButton.textContent = state.step === steps.length - 1 ? 'Рассчитать →' : 'Далее →';
      updateSelectionUI();
    };

    const resultText = (estimate) => {
      const featureNames = estimate.features.length
        ? estimate.features.map((item) => item.title).join(', ')
        : 'без дополнительных функций';
      return [
        'Здравствуйте! Я рассчитал проект на сайте.',
        '',
        `Тип проекта: ${estimate.product.title}`,
        `Масштаб: ${estimate.scale.title}`,
        `Функции: ${featureNames}`,
        `Дизайн: ${estimate.design.title}`,
        `Сроки: ${estimate.timeline.title}`,
        `Предварительная стоимость: ${formatCurrency(estimate.min)}–${formatCurrency(estimate.max)} ₽`,
        '',
        'Хочу обсудить детали проекта.'
      ].join('\n');
    };

    const leadChannels = {
      Telegram: { label: 'Ваш Telegram', placeholder: '@username', phone: false },
      VK: { label: 'Ссылка или ID во VK', placeholder: 'vk.com/username', phone: false },
      MAX: { label: 'Номер в MAX', placeholder: '+7(999)-999-99-99', phone: true },
      'Телефон': { label: 'Номер телефона', placeholder: '+7(999)-999-99-99', phone: true }
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

    const updateLeadContactField = (form, resetValue = false) => {
      const channel = form.querySelector('[data-calculator-lead-channel]');
      const contact = form.querySelector('[data-calculator-lead-contact]');
      const labelText = form.querySelector('[data-calculator-lead-contact-label-text]');
      if (!channel || !contact || !labelText) return;
      const field = leadChannels[channel.value] || leadChannels.Telegram;
      labelText.textContent = field.label;
      contact.placeholder = field.placeholder;
      contact.inputMode = field.phone ? 'tel' : 'text';
      contact.autocomplete = field.phone ? 'tel' : 'off';
      contact.maxLength = field.phone ? 17 : 200;
      if (field.phone) {
        contact.pattern = '\\+7\\(\\d{3}\\)-\\d{3}-\\d{2}-\\d{2}';
        contact.value = resetValue ? '+7' : formatRussianPhone(contact.value);
      } else {
        contact.removeAttribute('pattern');
        if (resetValue) contact.value = '';
      }
    };

    const renderResult = () => {
      const estimate = calculateEstimate(config, state.answers);
      emit('calculated_price_changed', { min: estimate.min, max: estimate.max }, state);
      const featureSummary = estimate.features.length
        ? estimate.features.map((item) => item.title).join(', ')
        : 'Ничего из перечисленного';
      shell.classList.add('is-result');
      stage.classList.remove('is-choice-locked');
      stepLabel.textContent = 'ГОТОВО';
      progress.style.setProperty('--calculator-progress', '1');
      progress.setAttribute('aria-valuenow', '100');
      progressText.textContent = '100%';
      animateProgress();
      hint.textContent = '';
      stage.innerHTML = `
        <div class="calculator-result">
          <p class="eyebrow">Предварительная стоимость проекта</p>
          <p class="calculator-result__price" tabindex="-1">
            <span>от ${formatCurrency(estimate.min)}</span>
            <span>до ${formatCurrency(estimate.max)} ₽</span>
          </p>
          <dl class="calculator-result__summary">
            <div><dt>Продукт</dt><dd>${estimate.product.title}</dd></div>
            <div><dt>Масштаб</dt><dd>${estimate.scale.title}</dd></div>
            <div><dt>Функции</dt><dd>${featureSummary}</dd></div>
            <div><dt>Дизайн</dt><dd>${estimate.design.title}</dd></div>
            <div><dt>Сроки</dt><dd>${estimate.timeline.title}</dd></div>
          </dl>
          <div class="calculator-result__notice">
            <p>Это предварительная оценка. Финальная стоимость обсуждается на коротком созвоне или в Telegram после уточнения задач и фиксируется до начала разработки.</p>
            <p>Без скрытых доплат: если требования не меняются, зафиксированная стоимость остаётся прежней.</p>
          </div>
          <div class="calculator-result__actions">
            <button class="button button--primary calculator-result__discuss" type="button" data-calculator-discuss aria-expanded="false">Обсудить</button>
            <button class="button" type="button" data-calculator-copy>Скопировать расчёт</button>
          </div>
          <div class="calculator-lead" data-calculator-lead hidden>
            <div class="calculator-lead__head">
              <p class="eyebrow">ОТПРАВИТЬ РАСЧЁТ</p>
              <h4>Куда ответить?</h4>
              <p>Оставьте контакт — выбранные параметры и стоимость автоматически прикрепятся к заявке.</p>
            </div>
            <form class="calculator-lead__form" data-calculator-lead-form>
              <label>Имя<input name="name" type="text" maxlength="100" autocomplete="name" required></label>
              <label>Способ связи
                <select name="channel" data-calculator-lead-channel required>
                  <option value="Telegram">Telegram</option>
                  <option value="VK">VK</option>
                  <option value="MAX">MAX</option>
                  <option value="Телефон">Телефон</option>
                </select>
              </label>
              <label><span data-calculator-lead-contact-label-text>Ваш Telegram</span><input name="contact" type="text" maxlength="200" placeholder="@username" data-calculator-lead-contact required></label>
              <label class="calculator-lead__comment">Комментарий<textarea name="comment" rows="3" maxlength="800" placeholder="Что ещё важно учесть?"></textarea></label>
              <label class="calculator-lead__consent"><input name="consent" type="checkbox" required><span>Согласен на обработку персональных данных для ответа на заявку</span></label>
              <button class="button" type="submit">Отправить расчёт</button>
              <p class="calculator-lead__status" data-calculator-lead-status aria-live="polite"></p>
            </form>
          </div>
          <div class="calculator-result__secondary">
            <button type="button" data-calculator-edit>Изменить ответы</button>
            <button type="button" data-calculator-reset>Рассчитать заново</button>
          </div>
          <p class="calculator-copy-status" data-calculator-copy-status aria-live="polite"></p>
        </div>
      `;
    };

    const scrollQuestionToTop = () => {
      const target = shell.querySelector('.calculator-head');
      if (!target) return;
      const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
      const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - 16;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: reducedMotion.matches ? 'auto' : 'smooth'
      });
    };

    const transitionTo = (render) => {
      const delay = reducedMotion.matches ? 0 : 170;
      stage.classList.add('is-changing');
      window.setTimeout(() => {
        render();
        window.requestAnimationFrame(() => {
          stage.classList.remove('is-changing');
          stage.querySelector('h3, .calculator-result__price')?.focus?.({ preventScroll: true });
          scrollQuestionToTop();
        });
      }, delay);
    };


    /* О свободных полях заявки собираем только метаданные: заполнено или нет,
       сколько символов и какого типа поле. Сам текст остаётся в браузере,
       пока человек не отправит форму сам. */
    const formFields = (form) => {
      const fields = {};
      form.querySelectorAll('input, textarea, select').forEach((field) => {
        const name = field.name;
        if (!name || field.type === 'password' || field.type === 'hidden') return;
        if (field.type === 'checkbox') {
          fields[name] = { type: 'checkbox', filled: field.checked };
          return;
        }
        if (field.tagName === 'SELECT') {
          fields[name] = { type: 'select', filled: Boolean(field.value), value: field.value };
          return;
        }
        const value = String(field.value || '').trim();
        fields[name] = { type: field.type || 'text', filled: value.length > 0, len: value.length };
      });
      return fields;
    };

    const goForward = () => {
      const step = steps[state.step];
      if (!isStepValid(step)) return;
      if (state.step < steps.length - 1) {
        state.step += 1;
        saveState();
        emit('calculator_next', { step: steps[state.step].key }, state);
        transitionTo(renderStep);
        return;
      }
      state.result = true;
      saveState();
      transitionTo(renderResult);
    };

    const reset = () => {
      state.step = 0;
      state.result = false;
      state.answers = defaultAnswers();
      try {
        localStorage.removeItem(config.storageKey);
      } catch {
        // Ignore storage failures.
      }
      transitionTo(renderStep);
    };

    const copyResult = async () => {
      const text = resultText(calculateEstimate(config, state.answers));
      const status = stage.querySelector('[data-calculator-copy-status]');
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      if (status) status.textContent = 'Расчёт скопирован';
    };

    stage.addEventListener('click', (event) => {
      const option = event.target.closest('[data-option-id]');
      if (option && !state.result) {
        const step = steps[state.step];
        const id = option.dataset.optionId;
        // Отличаем первый выбор от смены решения — это разные события.
        const previous = step.multiple
          ? state.answers.features.includes(id)
          : Boolean(state.answers[step.key]);
        if (step.multiple) {
          const current = new Set(state.answers.features);
          const selectedOption = findById(step.options, id);
          if (selectedOption.exclusive) {
            current.clear();
            current.add(id);
          } else {
            current.delete('none');
            if (current.has(id)) current.delete(id);
            else current.add(id);
          }
          state.answers.features = Array.from(current);
        } else {
          state.answers[step.key] = id;
        }
        saveState();
        const chosen = findById(step.options, id);
        emit(
          previous ? 'calculator_option_changed' : 'calculator_option_selected',
          { step: step.key, id, label: chosen ? chosen.title : id },
          state,
        );
        updateSelectionUI();
        if (!step.multiple) {
          window.clearTimeout(advanceTimer);
          stage.classList.add('is-choice-locked');
          nextButton.disabled = true;
          advanceTimer = window.setTimeout(goForward, reducedMotion.matches ? 0 : 130);
        }
        return;
      }

      if (event.target.closest('[data-calculator-copy]')) copyResult();
      const discussButton = event.target.closest('[data-calculator-discuss]');
      if (discussButton) {
        const lead = stage.querySelector('[data-calculator-lead]');
        if (lead) {
          lead.hidden = false;
          discussButton.setAttribute('aria-expanded', 'true');
          window.requestAnimationFrame(() => {
            lead.classList.add('is-visible');
            lead.querySelector('input[name="name"]')?.focus({ preventScroll: true });
            lead.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
          });
        }
      }
      if (event.target.closest('[data-calculator-edit]')) {
        state.result = false;
        state.step = 0;
        saveState();
        transitionTo(renderStep);
      }
      if (event.target.closest('[data-calculator-reset]')) reset();
    });

    stage.addEventListener('input', (event) => {
      const form = event.target.closest('[data-calculator-lead-form]');
      if (!form) return;
      if (!formStarted) {
        formStarted = true;
        emit('form_started', null, state, { form_started: true, form_fields: formFields(form) });
        return;
      }
      window.clearTimeout(fieldsTimer);
      // Состояние полей обновляем не на каждую букву, а спустя паузу.
      fieldsTimer = window.setTimeout(() => {
        emit('form_completed', null, state, {
          form_started: true,
          form_fields: formFields(form),
        });
      }, 1500);
    });

    stage.addEventListener('change', (event) => {
      const channel = event.target.closest('[data-calculator-lead-channel]');
      if (channel) updateLeadContactField(channel.form, true);
    });

    stage.addEventListener('input', (event) => {
      const contact = event.target.closest('[data-calculator-lead-contact]');
      if (!contact) return;
      const form = contact.form;
      const channel = form?.querySelector('[data-calculator-lead-channel]');
      if (leadChannels[channel?.value]?.phone) contact.value = formatRussianPhone(contact.value);
    });

    stage.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-calculator-lead-form]');
      if (!form) return;
      event.preventDefault();

      const submit = form.querySelector('button[type="submit"]');
      const status = form.querySelector('[data-calculator-lead-status]');
      const data = new FormData(form);
      const estimate = calculateEstimate(config, state.answers);
      const comment = String(data.get('comment') || '').trim();
      const payload = {
        name: String(data.get('name') || '').trim(),
        channel: String(data.get('channel') || '').trim(),
        contact: String(data.get('contact') || '').trim(),
        message: `${resultText(estimate)}${comment ? `\n\nКомментарий клиента: ${comment}` : ''}`,
        consent: data.get('consent') === 'on'
      };

      emit('form_submitted', null, state, {
        form_started: true,
        form_submitted: true,
        form_fields: formFields(form),
      });

      submit.disabled = true;
      submit.textContent = 'Отправляю…';
      status.textContent = '';
      status.removeAttribute('data-state');

      try {
        if (!window.CONTACT_ENDPOINT) {
          throw new Error('Отправка расчёта отключена — пришлите его в Telegram @g0_faq');
        }
        const response = await fetch(window.CONTACT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const responseData = await response.json();
        if (!response.ok || !responseData.ok) throw new Error(responseData.error || 'Не удалось отправить расчёт');
        form.reset();
        updateLeadContactField(form, true);
        status.dataset.state = 'success';
        status.textContent = 'Расчёт отправлен — отвечу в течение дня';
      } catch (error) {
        status.dataset.state = 'error';
        status.textContent = error.message || 'Не удалось отправить расчёт';
      } finally {
        submit.disabled = false;
        submit.textContent = 'Отправить расчёт';
      }
    });

    stage.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const option = event.target.closest('[data-option-id]');
      const step = steps[state.step];
      if (!option || step.multiple) return;
      const buttons = Array.from(stage.querySelectorAll('[data-option-id]'));
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const nextIndex = (buttons.indexOf(option) + direction + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[nextIndex].focus();
    });

    backButton.addEventListener('click', () => {
      if (state.step === 0) return;
      window.clearTimeout(advanceTimer);
      state.step -= 1;
      saveState();
      emit('calculator_back', { step: steps[state.step].key }, state);
      transitionTo(renderStep);
    });

    nextButton.addEventListener('click', goForward);

    if (state.result) renderResult();
    else renderStep();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
