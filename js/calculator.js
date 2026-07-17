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

  const defaultAnswers = () => ({
    product: null,
    scale: null,
    features: [],
    design: null,
    timeline: null
  });

  const validId = (items, id) => Boolean(findById(items, id));

  const loadState = () => {
    const fallback = { step: 0, result: false, answers: defaultAnswers() };
    try {
      const saved = JSON.parse(localStorage.getItem(config.storageKey));
      if (!saved || typeof saved !== 'object') return fallback;
      const answers = {
        product: validId(config.products, saved.answers?.product) ? saved.answers.product : null,
        scale: validId(config.scales, saved.answers?.scale) ? saved.answers.scale : null,
        features: Array.isArray(saved.answers?.features)
          ? saved.answers.features.filter((id) => validId(config.features, id))
          : [],
        design: validId(config.designs, saved.answers?.design) ? saved.answers.design : null,
        timeline: validId(config.timelines, saved.answers?.timeline) ? saved.answers.timeline : null
      };
      const step = Number.isInteger(saved.step) ? Math.min(Math.max(saved.step, 0), steps.length - 1) : 0;
      const complete = answers.product && answers.scale && answers.design && answers.timeline;
      return { step, result: Boolean(saved.result && complete), answers };
    } catch {
      return fallback;
    }
  };

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
    const state = loadState();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let advanceTimer = 0;

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
      const percent = Math.round(((state.step + 1) / steps.length) * 100);
      shell.classList.remove('is-result');
      stage.classList.remove('is-choice-locked');
      stepLabel.textContent = `${String(state.step + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
      progress.style.setProperty('--calculator-progress', String((state.step + 1) / steps.length));
      progress.setAttribute('aria-valuenow', String(percent));
      progressText.textContent = `${percent}%`;
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

    const renderResult = () => {
      const estimate = calculateEstimate(config, state.answers);
      const featureSummary = estimate.features.length
        ? estimate.features.map((item) => item.title).join(', ')
        : 'Ничего из перечисленного';
      const telegramUrl = `https://t.me/g0_faq?text=${encodeURIComponent(resultText(estimate))}`;
      shell.classList.add('is-result');
      stage.classList.remove('is-choice-locked');
      stepLabel.textContent = 'ГОТОВО';
      progress.style.setProperty('--calculator-progress', '1');
      progress.setAttribute('aria-valuenow', '100');
      progressText.textContent = '100%';
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
            <a class="button calculator-result__telegram" href="${telegramUrl}" target="_blank" rel="noreferrer">Обсудить в Telegram ↗</a>
            <button class="button" type="button" data-calculator-copy>Скопировать расчёт</button>
            <a class="button" href="#contacts">Оставить заявку</a>
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
      const target = stage.querySelector('.calculator-stage__heading, .calculator-result');
      if (!target) return;
      const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
      const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - 20;
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

    const goForward = () => {
      const step = steps[state.step];
      if (!isStepValid(step)) return;
      if (state.step < steps.length - 1) {
        state.step += 1;
        saveState();
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
      if (event.target.closest('[data-calculator-edit]')) {
        state.result = false;
        state.step = 0;
        saveState();
        transitionTo(renderStep);
      }
      if (event.target.closest('[data-calculator-reset]')) reset();
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
      transitionTo(renderStep);
    });

    nextButton.addEventListener('click', goForward);

    if (state.result) renderResult();
    else renderStep();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
