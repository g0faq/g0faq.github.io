const CASES_BREAKPOINT = 1024;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createCasePanel(caseData, index) {
  const panel = createElement('article', 'case-panel');
  panel.id = `case-${caseData.id}`;
  panel.dataset.accent = caseData.accent;
  panel.dataset.surface = String((index % 3) + 1);
  panel.style.zIndex = String(index + 1);

  const spine = createElement('a', 'case-spine');
  spine.href = `#${panel.id}`;
  spine.dataset.caseIndex = String(index);
  spine.setAttribute('aria-label', `Перейти к кейсу ${caseData.num}: ${caseData.title}`);
  spine.append(
    createElement('span', 'case-spine__num', caseData.num),
    createElement('span', 'case-spine__title', caseData.title)
  );

  const body = createElement('div', 'case-panel__body');
  const topline = createElement('div', 'case-panel__topline');
  topline.append(
    createElement('span', '', 'КЕЙСЫ'),
    createElement('span', '', `${caseData.num} / 09`)
  );

  const number = createElement('p', 'case-number', caseData.num);
  number.setAttribute('aria-hidden', 'true');

  const media = createElement('div', 'case-media');
  media.dataset.image = caseData.image;
  media.setAttribute('aria-hidden', 'true');

  const content = createElement('div', 'case-content');
  content.append(
    createElement('p', 'case-content__category', caseData.category),
    createElement('h3', '', caseData.title),
    createElement('p', 'case-content__description', caseData.description)
  );

  const tags = createElement('ul', 'case-tags');
  tags.setAttribute('aria-label', 'Технологии проекта');
  caseData.stack.forEach((item) => tags.append(createElement('li', '', item)));
  content.append(tags);

  if (caseData.url) {
    const link = createElement('a', 'button', 'Открыть сайт');
    link.href = caseData.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    content.append(link);
  }

  body.append(topline, number, media, content);
  panel.append(spine, body);
  return panel;
}

async function initCases() {
  const section = document.querySelector('.cases-section');
  const stack = document.querySelector('#cases-stack');
  if (!section || !stack) return;

  try {
    const response = await fetch('/data/cases.json');
    if (!response.ok) throw new Error('Cases request failed');

    const cases = await response.json();
    if (!Array.isArray(cases) || cases.length === 0) throw new Error('Cases data is empty');

    section.style.setProperty('--case-count', String(cases.length));
    stack.replaceChildren(...cases.map(createCasePanel));

    const panels = Array.from(stack.querySelectorAll('.case-panel'));
    let frameRequested = false;

    const updatePanels = () => {
      frameRequested = false;

      if (window.innerWidth <= CASES_BREAKPOINT) {
        panels.forEach((panel) => {
          panel.style.removeProperty('width');
          panel.style.removeProperty('transform');
          panel.classList.remove('is-active');
        });
        return;
      }

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      const progress = clamp(
        (window.scrollY - sectionTop) / viewportHeight,
        0,
        panels.length - 1
      );
      const spineWidth = panels[0].querySelector('.case-spine').getBoundingClientRect().width;
      const activeIndex = Math.min(Math.round(progress), panels.length - 1);

      panels.forEach((panel, index) => {
        const offset = index * spineWidth;
        const phase = index === 0 ? 1 : clamp(progress - (index - 1), 0, 1);
        const translateX = index === 0
          ? 0
          : viewportWidth + ((offset - viewportWidth) * phase);

        panel.style.width = `${Math.max(viewportWidth - offset, spineWidth)}px`;
        panel.style.transform = `translate3d(${translateX}px, 0, 0)`;
        panel.classList.toggle('is-active', index === activeIndex);
      });
    };

    const requestUpdate = () => {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(updatePanels);
    };

    stack.addEventListener('click', (event) => {
      const spine = event.target.closest('.case-spine');
      if (!spine || window.innerWidth <= CASES_BREAKPOINT) return;

      event.preventDefault();
      const targetIndex = Number(spine.dataset.caseIndex);
      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: sectionTop + (targetIndex * window.innerHeight),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    });

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    updatePanels();
  } catch {
    stack.replaceChildren(createElement('p', 'cases-loading', 'Не удалось загрузить кейсы.'));
  }
}

function initContactForm() {
  const form = document.querySelector('#contact-form');
  const status = document.querySelector('#form-status');
  if (!form || !status) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      contact: String(formData.get('contact') || '').trim(),
      message: String(formData.get('message') || '').trim()
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Отправляю…';
    status.textContent = '';
    status.removeAttribute('data-state');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось отправить заявку');
      }

      form.reset();
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
  initCases();
  initContactForm();
});
