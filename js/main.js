const CASES_BREAKPOINT = 1024;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function initSiteParticles() {
  const canvas = document.querySelector('.site-particles');
  const context = canvas?.getContext('2d', { alpha: true, desynchronized: true });
  if (!canvas || !context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const alphaBuckets = Array.from({ length: 6 }, () => []);
  let particles = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let animationFrame = 0;
  let resizeFrame = 0;
  let scrollFrame = 0;
  let lastFrameTime = 0;
  let isVisible = !document.hidden;
  let scrollOffset = window.scrollY;
  let pointerX = 0;
  let pointerY = 0;
  let pointerActive = false;

  const fade = (value) => value * value * (3 - (2 * value));
  const hash = (x, y) => {
    const value = Math.sin((x * 127.1) + (y * 311.7)) * 43758.5453;
    return value - Math.floor(value);
  };
  const valueNoise = (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const top = hash(x0, y0) + ((hash(x0 + 1, y0) - hash(x0, y0)) * tx);
    const bottom = hash(x0, y0 + 1) + ((hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * tx);
    return top + ((bottom - top) * ty);
  };

  const particleTarget = () => {
    if (width < 768) return 3000;
    return 4000;
  };

  const getScreenY = (particleY) => {
    const fieldHeight = height + 48;
    return ((((particleY - scrollOffset) + 24) % fieldHeight) + fieldHeight) % fieldHeight - 24;
  };

  const rebuildParticles = () => {
    const target = particleTarget();
    const clusters = [
      { x: 0.24, y: 0.28, size: 0.14 },
      { x: 0.42, y: 0.62, size: 0.18 },
      { x: 0.58, y: 0.22, size: 0.21 },
      { x: 0.66, y: 0.52, size: 0.24 },
      { x: 0.58, y: 0.82, size: 0.18 },
      { x: 0.80, y: 0.24, size: 0.17 },
      { x: 0.88, y: 0.48, size: 0.20 },
      { x: 0.80, y: 0.76, size: 0.19 }
    ];
    const nextParticles = [];
    let attempts = 0;

    while (nextParticles.length < target && attempts < target * 30) {
      attempts += 1;
      const normalizedX = Math.random();
      const normalizedY = Math.random();
      const noise = valueNoise((normalizedX * 4.2) + 1.7, (normalizedY * 4.2) + 3.1);
      let clusterStrength = 0;

      clusters.forEach((cluster) => {
        const dx = normalizedX - cluster.x;
        const dy = normalizedY - cluster.y;
        const distance = ((dx * dx) + (dy * dy)) / (cluster.size * cluster.size);
        clusterStrength = Math.max(clusterStrength, Math.exp(-distance * 2.2));
      });

      const density = clamp(0.08 + (noise * 0.42) + (clusterStrength * 0.82), 0, 1);
      if (Math.random() > density * 0.58) continue;

      const alpha = clamp(0.15 + (Math.random() * 0.42) + (density * 0.28), 0.15, 0.9);
      nextParticles.push({
        x: normalizedX * width,
        y: normalizedY * height,
        radius: 0.45 + (Math.random() * 0.65),
        alphaBucket: Math.min(5, Math.floor(((alpha - 0.15) / 0.75) * 6)),
        velocityX: (Math.random() - 0.5) * 0.032,
        velocityY: (Math.random() - 0.5) * 0.024,
        phase: Math.random() * Math.PI * 2,
        interactionX: 0,
        interactionY: 0,
        response: 0.7 + (Math.random() * 0.6)
      });
    }

    while (nextParticles.length < target) {
      nextParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.45 + (Math.random() * 0.65),
        alphaBucket: Math.floor(Math.random() * 6),
        velocityX: (Math.random() - 0.5) * 0.032,
        velocityY: (Math.random() - 0.5) * 0.024,
        phase: Math.random() * Math.PI * 2,
        interactionX: 0,
        interactionY: 0,
        response: 0.7 + (Math.random() * 0.6)
      });
    }

    particles = nextParticles;
    alphaBuckets.forEach((bucket) => bucket.splice(0));
    particles.forEach((particle) => alphaBuckets[particle.alphaBucket].push(particle));
    canvas.dataset.particleCount = String(particles.length);
  };

  const drawParticles = (time, shouldMove) => {
    const frameScale = shouldMove && lastFrameTime
      ? Math.min((time - lastFrameTime) / 16.67, 2)
      : 0;
    lastFrameTime = time;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#1f58f2';

    alphaBuckets.forEach((bucket, bucketIndex) => {
      context.globalAlpha = 0.15 + ((0.75 / 5) * bucketIndex);
      context.beginPath();

      bucket.forEach((particle) => {
        if (shouldMove) {
          particle.phase += 0.0015 * frameScale;
          particle.x += (particle.velocityX + (Math.sin(particle.phase) * 0.006)) * frameScale;
          particle.y += (particle.velocityY + (Math.cos(particle.phase) * 0.004)) * frameScale;

          if (particle.x < -24) particle.x = width + 24;
          if (particle.x > width + 24) particle.x = -24;
          if (particle.y < -24) particle.y = height + 24;
          if (particle.y > height + 24) particle.y = -24;
        }

        let interactionTargetX = 0;
        let interactionTargetY = 0;
        const screenY = getScreenY(particle.y);

        if (pointerActive && shouldMove) {
          const dx = particle.x - pointerX;
          const dy = screenY - pointerY;
          const interactionRadius = 180;

          if (Math.abs(dx) < interactionRadius && Math.abs(dy) < interactionRadius) {
            const distance = Math.sqrt((dx * dx) + (dy * dy));
            if (distance > 0 && distance < interactionRadius) {
              const force = ((1 - (distance / interactionRadius)) ** 2) * 28 * particle.response;
              interactionTargetX = (dx / distance) * force;
              interactionTargetY = (dy / distance) * force;
            }
          }
        }

        const interactionEase = pointerActive ? 0.16 : 0.07;
        particle.interactionX += (interactionTargetX - particle.interactionX) * interactionEase;
        particle.interactionY += (interactionTargetY - particle.interactionY) * interactionEase;

        const drawX = particle.x + particle.interactionX;
        const drawY = screenY + particle.interactionY;
        context.moveTo(drawX + particle.radius, drawY);
        context.arc(drawX, drawY, particle.radius, 0, Math.PI * 2);
      });

      context.fill();
    });

    context.globalAlpha = 1;
  };

  const stopAnimation = () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    canvas.dataset.animationState = reducedMotion.matches ? 'static' : 'paused';
  };

  const animate = (time) => {
    if (!isVisible || reducedMotion.matches) {
      stopAnimation();
      return;
    }

    drawParticles(time, true);
    animationFrame = window.requestAnimationFrame(animate);
  };

  const startAnimation = () => {
    if (animationFrame || !isVisible || reducedMotion.matches) return;
    lastFrameTime = performance.now();
    canvas.dataset.animationState = 'running';
    animationFrame = window.requestAnimationFrame(animate);
  };

  const resizeCanvas = () => {
    width = Math.max(1, Math.round(window.innerWidth));
    height = Math.max(1, Math.round(window.innerHeight));
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    rebuildParticles();
    drawParticles(performance.now(), false);
  };

  const clearPointer = () => {
    pointerActive = false;
    canvas.dataset.pointerActive = 'false';
  };

  window.addEventListener('pointermove', (event) => {
    if (reducedMotion.matches) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    pointerActive = true;
    canvas.dataset.pointerActive = 'true';
  }, { passive: true });

  document.documentElement.addEventListener('pointerleave', clearPointer);
  window.addEventListener('blur', clearPointer);

  window.addEventListener('resize', () => {
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      resizeCanvas();
    });
  });

  window.addEventListener('scroll', () => {
    scrollOffset = window.scrollY;
    if (!reducedMotion.matches || scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      drawParticles(performance.now(), false);
    });
  }, { passive: true });

  const handleMotionPreference = () => {
    if (reducedMotion.matches) {
      clearPointer();
      particles.forEach((particle) => {
        particle.interactionX = 0;
        particle.interactionY = 0;
      });
      stopAnimation();
      drawParticles(performance.now(), false);
    } else {
      startAnimation();
    }
  };
  reducedMotion.addEventListener?.('change', handleMotionPreference);

  resizeCanvas();
  canvas.dataset.animationState = reducedMotion.matches ? 'static' : 'paused';

  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
    if (isVisible) startAnimation();
    else stopAnimation();
  });

  startAnimation();
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
  const spineTitle = createElement('span', 'case-spine__title', caseData.title);
  if ([...caseData.title].length >= 10) spineTitle.classList.add('case-spine__title--long');
  spine.append(
    createElement('span', 'case-spine__num', caseData.num),
    spineTitle
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
  initSiteParticles();
  initCases();
  initContactForm();
});
