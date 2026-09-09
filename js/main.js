/* Приём заявок отключён: сайт хостится статикой, serverless-эндпоинт
   /api/contact удалён. Вписать сюда адрес приёмника, когда он появится, —
   разметка и обработчики форм для этого уже готовы. */
window.CONTACT_ENDPOINT = window.CONTACT_ENDPOINT || '';

const CASES_BREAKPOINT = 760;

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
  let lastRenderedAt = 0;
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

    if ((time - lastRenderedAt) >= (1000 / 30)) {
      lastRenderedAt = time;
      drawParticles(time, true);
    }
    animationFrame = window.requestAnimationFrame(animate);
  };

  const startAnimation = () => {
    if (animationFrame || !isVisible || reducedMotion.matches) return;
    lastFrameTime = performance.now();
    lastRenderedAt = 0;
    canvas.dataset.animationState = 'running';
    animationFrame = window.requestAnimationFrame(animate);
  };

  const resizeCanvas = () => {
    width = Math.max(1, Math.round(window.innerWidth));
    height = Math.max(1, Math.round(window.innerHeight));
    pixelRatio = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.5 : 2);
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

function createCasePanel(caseData, index, allCases) {
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
    createElement(
      'span',
      '',
      // Знаменатель берём из самих данных: число кейсов меняется.
      `${caseData.num} / ${String(allCases?.length ?? 0).padStart(2, '0')}`
    )
  );

  const number = createElement('p', 'case-number', caseData.num);
  number.setAttribute('aria-hidden', 'true');
  number.dataset.caseNumber = caseData.num;
  number.style.setProperty('--case-number-delay', `${index * -0.55}s`);

  const media = createElement('div', 'case-media');
  media.dataset.image = caseData.image;
  media.setAttribute('aria-hidden', 'true');
  if (caseData.image) {
    setupCaseImage(media, caseData, index);
    media.classList.add('case-media--image');
  }

  const content = createElement('div', 'case-content');
  const meta = createElement('div', 'case-content__meta');
  meta.append(createElement('p', 'case-content__category', caseData.category));
  if (caseData.demo) meta.append(createElement('span', 'case-content__demo', 'ДЕМО'));
  content.append(
    meta,
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

  [topline, media, content].forEach((element, pieceIndex) => {
    element.dataset.assemblyPiece = '';
    element.style.setProperty('--assembly-order', String(pieceIndex));
    element.style.setProperty('--assembly-x', pieceIndex % 2 === 0 ? '-24px' : '24px');
  });

  body.append(topline, number, media, content);
  panel.append(spine, body);
  return panel;
}

async function initCases() {
  const section = document.querySelector('.cases-section');
  const stack = document.querySelector('#cases-stack');
  if (!section || !stack) return;

  try {
    let cases = window.CASES_DATA;
    if (!Array.isArray(cases)) {
      const response = await fetch('./data/cases.json');
      if (!response.ok) throw new Error('Cases request failed');
      cases = await response.json();
    }
    if (!Array.isArray(cases) || cases.length === 0) throw new Error('Cases data is empty');

    section.style.setProperty('--case-count', String(cases.length));
    stack.replaceChildren(...cases.map(createCasePanel));

    const panels = Array.from(stack.querySelectorAll('.case-panel'));
    let frameRequested = false;
    let numberLayoutWidth = 0;
    let numberLayoutIndex = -1;
    let casesInView = false;
    let mobileMotionFrame = 0;

    const updateMobileCardMotion = () => {
      mobileMotionFrame = 0;

      if (window.innerWidth > CASES_BREAKPOINT) return;

      if (!casesInView) {
        panels.forEach((panel) => panel.classList.remove('is-card-motion'));
        return;
      }

      const stackRect = stack.getBoundingClientRect();
      const stackCenter = stackRect.left + (stackRect.width / 2);
      let closestPanel = panels[0];
      let closestDistance = Number.POSITIVE_INFINITY;

      panels.forEach((panel) => {
        const rect = panel.getBoundingClientRect();
        const distance = Math.abs((rect.left + (rect.width / 2)) - stackCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPanel = panel;
        }
      });

      panels.forEach((panel) => panel.classList.toggle('is-card-motion', panel === closestPanel));
    };

    const requestMobileCardMotion = () => {
      if (mobileMotionFrame) return;
      mobileMotionFrame = window.requestAnimationFrame(updateMobileCardMotion);
    };

    const updateCaseNumberLayout = (targetIndex = null) => {
      const targets = targetIndex === null
        ? panels.map((panel, index) => ({ panel, index }))
        : [{ panel: panels[targetIndex], index: targetIndex }];

      targets.forEach(({ panel, index }) => {
        const body = panel.querySelector('.case-panel__body');
        const media = panel.querySelector('.case-media');
        const number = panel.querySelector('.case-number');
        if (!body || !media || !number) return;

        panel.classList.remove('is-number-compact');

        const sequenceSize = Math.max(36, 260 - (index * 28));
        number.style.setProperty('--case-number-size', `${sequenceSize}px`);

        const mediaLeft = media.getBoundingClientRect().left;
        const numberLeft = number.getBoundingClientRect().left;
        const availableWidth = mediaLeft - numberLeft - 20;
        const fittedSize = number.offsetWidth > availableWidth
          ? Math.floor(sequenceSize * (availableWidth / number.offsetWidth))
          : sequenceSize;
        const compact = availableWidth < 72 || fittedSize < 52;

        if (compact) {
          const compactSize = Math.max(32, 92 - (index * 8));
          number.style.setProperty('--case-number-size', `${Math.min(sequenceSize, compactSize)}px`);
          panel.classList.add('is-number-compact');
        } else {
          number.style.setProperty('--case-number-size', `${Math.min(sequenceSize, fittedSize)}px`);
        }
      });
    };

    const updatePanels = () => {
      frameRequested = false;

      if (window.innerWidth <= CASES_BREAKPOINT) {
        panels.forEach((panel) => {
          panel.style.removeProperty('width');
          panel.style.removeProperty('transform');
          panel.classList.remove('is-active');
          panel.classList.remove('is-number-compact');
          panel.querySelector('.case-number')?.style.removeProperty('--case-number-size');
        });
        numberLayoutWidth = 0;
        numberLayoutIndex = -1;
        requestMobileCardMotion();
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
        panel.classList.toggle('is-card-motion', casesInView && index === activeIndex);
      });

      if (numberLayoutWidth !== viewportWidth) {
        numberLayoutWidth = viewportWidth;
        numberLayoutIndex = activeIndex;
        updateCaseNumberLayout();
      } else if (numberLayoutIndex !== activeIndex) {
        numberLayoutIndex = activeIndex;
        updateCaseNumberLayout(activeIndex);
      }
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

    stack.addEventListener('scroll', requestMobileCardMotion, { passive: true });
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('resize', requestMobileCardMotion);

    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        casesInView = entry.isIntersecting;
        requestUpdate();
        requestMobileCardMotion();
      }, { rootMargin: '-10% 0px -10%', threshold: 0 });
      visibilityObserver.observe(stack);
    } else {
      casesInView = true;
    }

    updatePanels();
  } catch {
    stack.replaceChildren(createElement('p', 'cases-loading', 'Не удалось загрузить кейсы.'));
  }
}

function initHeroFlow() {
  const hero = document.querySelector('.hero');
  const flow = hero?.querySelector('[data-hero-flow]');
  if (!hero || !flow || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let frame = 0;

  const render = () => {
    currentX += (targetX - currentX) * 0.09;
    currentY += (targetY - currentY) * 0.09;
    flow.style.setProperty('--hero-flow-x', `${currentX.toFixed(2)}px`);
    flow.style.setProperty('--hero-flow-y', `${currentY.toFixed(2)}px`);
    if (Math.abs(targetX - currentX) > 0.08 || Math.abs(targetY - currentY) > 0.08) {
      frame = window.requestAnimationFrame(render);
    } else {
      frame = 0;
    }
  };

  const requestRender = () => {
    if (!frame) frame = window.requestAnimationFrame(render);
  };

  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 30;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 20;
    requestRender();
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    requestRender();
  });
}

function initSectionAssembly() {
  const sections = Array.from(document.querySelectorAll('.section-assembly'));
  if (sections.length === 0) return;

  const pieceGroups = [
    ['#top', '.hero__inner > *'],
    ['#cases', '.cases-loading'],
    ['#services', '.section-heading, .service-card'],
    ['#calculator', '.section-heading, .calculator-shell'],
    ['#process', '.section-heading, .process-visual, .process-list > li'],
    ['#stack', '.section-heading, .stack-readout, .tag-list > li'],
    ['#faq', '.section-heading, .faq-visual, .faq-list > details'],
    ['#contacts', '.contact-card__intro > *, .contact-form > *']
  ];

  pieceGroups.forEach(([sectionSelector, pieceSelector]) => {
    const section = document.querySelector(sectionSelector);
    if (!section) return;

    section.querySelectorAll(pieceSelector).forEach((element, index) => {
      element.dataset.assemblyPiece = '';
      element.style.setProperty('--assembly-order', String(index));
      element.style.setProperty('--assembly-x', index % 2 === 0 ? '-24px' : '24px');
    });
  });

  document.documentElement.classList.add('section-motion-ready');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    sections.forEach((section) => section.classList.add('is-assembled'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      window.requestAnimationFrame(() => entry.target.classList.add('is-assembled'));
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.01,
    rootMargin: '-5% 0px -35% 0px'
  });

  sections.forEach((section) => observer.observe(section));
}

function initPageSlider() {
  const slider = document.querySelector('[data-page-slider]');
  const track = slider?.querySelector('.page-slider__track');
  const markersContainer = slider?.querySelector('.page-slider__markers');
  const indexLabel = slider?.querySelector('.page-slider__index');
  const percentLabel = slider?.querySelector('.page-slider__percent');
  const sectionLabel = slider?.querySelector('.page-slider__section');
  const sections = Array.from(document.querySelectorAll('main > section[data-section-name]'));
  if (!slider || !track || !markersContainer || !indexLabel || !percentLabel || !sectionLabel || sections.length === 0) return;

  slider.style.setProperty('--section-count', String(sections.length));
  const markers = sections.map((section, index) => {
    const marker = createElement('span', 'page-slider__marker');
    marker.dataset.index = String(index + 1).padStart(2, '0');
    marker.dataset.name = section.dataset.sectionName;
    marker.title = section.dataset.sectionName;
    markersContainer.append(marker);
    return marker;
  });
  let frameRequested = false;
  let dragging = false;

  const getMaxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const getSectionTops = () => sections.map((section) => (
    section.getBoundingClientRect().top + window.scrollY
  ));

  const update = () => {
    frameRequested = false;
    const maxScroll = getMaxScroll();
    const progress = clamp(window.scrollY / maxScroll, 0, 1);
    const activePoint = window.scrollY + (window.innerHeight * 0.42);
    let activeIndex = 0;

    const sectionTops = getSectionTops();
    sectionTops.forEach((sectionTop, index) => {
      if (sectionTop <= activePoint) activeIndex = index;
    });

    const activeSection = sections[activeIndex];
    const sectionStart = sectionTops[activeIndex];
    const sectionEnd = sectionTops[activeIndex + 1] || (maxScroll + window.innerHeight);
    const sectionProgress = clamp((activePoint - sectionStart) / Math.max(1, sectionEnd - sectionStart), 0, 1);
    const segmentedProgress = (activeIndex + sectionProgress) / sections.length;
    const accent = getComputedStyle(activeSection).getPropertyValue('--section-accent').trim() || '#1f58f2';
    const percent = Math.round(progress * 100);

    slider.style.setProperty('--slider-progress', String(segmentedProgress));
    slider.style.setProperty('--slider-color', accent);
    indexLabel.textContent = String(activeIndex + 1).padStart(2, '0');
    percentLabel.textContent = `${String(percent).padStart(3, '0')}%`;
    sectionLabel.textContent = activeSection.dataset.sectionName;
    track.setAttribute('aria-valuenow', String(percent));
    track.setAttribute('aria-valuetext', `${percent}% · ${activeSection.dataset.sectionName}`);
    sections.forEach((section, index) => section.classList.toggle('is-tone-active', index === activeIndex));
    markers.forEach((marker, index) => marker.classList.toggle('is-active', index === activeIndex));
  };

  const requestUpdate = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(update);
  };

  const scrollToProgress = (progress, behavior = 'auto') => {
    const normalized = clamp(progress, 0, 0.999999);
    const scaled = normalized * sections.length;
    const index = Math.min(Math.floor(scaled), sections.length - 1);
    const localProgress = scaled - index;
    const maxScroll = getMaxScroll();
    const sectionTops = getSectionTops();
    const start = Math.min(sectionTops[index], maxScroll);
    const end = index < sections.length - 1
      ? Math.min(sectionTops[index + 1], maxScroll)
      : maxScroll;
    window.scrollTo({ top: start + ((end - start) * localProgress), behavior });
  };

  const scrollFromPointer = (clientY) => {
    const rect = track.getBoundingClientRect();
    scrollToProgress((clientY - rect.top) / rect.height);
  };

  track.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    document.documentElement.classList.add('slider-dragging');
    slider.classList.add('is-dragging');
    track.setPointerCapture(event.pointerId);
    scrollFromPointer(event.clientY);
  });

  track.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    scrollFromPointer(event.clientY);
  });

  const stopDragging = (event) => {
    if (!dragging) return;
    dragging = false;
    document.documentElement.classList.remove('slider-dragging');
    slider.classList.remove('is-dragging');
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
  };

  track.addEventListener('pointerup', stopDragging);
  track.addEventListener('pointercancel', stopDragging);

  track.addEventListener('keydown', (event) => {
    const current = clamp(Number(slider.style.getPropertyValue('--slider-progress')) || 0, 0, 1);
    const stepByKey = {
      ArrowUp: -0.025,
      ArrowDown: 0.025,
      PageUp: -0.1,
      PageDown: 0.1
    };

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      scrollToProgress(event.key === 'Home' ? 0 : 1, 'smooth');
      return;
    }

    if (!(event.key in stepByKey)) return;
    event.preventDefault();
    scrollToProgress(current + stepByKey[event.key], 'smooth');
  });

  const resizeObserver = new ResizeObserver(requestUpdate);
  resizeObserver.observe(document.body);
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();
}

function initStackVisualizer() {
  const section = document.querySelector('#stack');
  const readout = section?.querySelector('.stack-readout');
  const activeLabel = readout?.querySelector('[data-stack-active]');
  const indexLabel = readout?.querySelector('[data-stack-index]');
  const tools = Array.from(section?.querySelectorAll('.tag-list > li') || []);
  if (!section || !readout || !activeLabel || !indexLabel || tools.length === 0) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeIndex = 0;
  let switchTimer = 0;
  let cycleTimer = 0;

  const activate = (index) => {
    activeIndex = (index + tools.length) % tools.length;
    window.clearTimeout(switchTimer);
    readout.classList.add('is-switching');
    switchTimer = window.setTimeout(() => {
      activeLabel.textContent = tools[activeIndex].textContent;
      indexLabel.textContent = String(activeIndex + 1).padStart(2, '0');
      tools.forEach((tool, toolIndex) => tool.classList.toggle('is-active', toolIndex === activeIndex));
      readout.classList.remove('is-switching');
    }, reducedMotion ? 0 : 140);
  };

  tools.forEach((tool, index) => tool.addEventListener('pointerenter', () => activate(index)));
  activate(0);

  if (!reducedMotion) {
    const observer = new IntersectionObserver(([entry]) => {
      window.clearInterval(cycleTimer);
      if (!entry.isIntersecting) return;
      cycleTimer = window.setInterval(() => activate(activeIndex + 1), 1800);
    }, { threshold: 0.35 });
    observer.observe(section);
  }
}

function initContentVisuals() {
  const updateVisual = (visual, index, label) => {
    if (!visual) return;
    window.clearTimeout(visual.updateTimer);
    visual.classList.add('is-updating');
    visual.updateTimer = window.setTimeout(() => {
      visual.querySelector('[data-process-current], [data-faq-current]').textContent = String(index + 1).padStart(2, '0');
      visual.querySelector('[data-process-label], [data-faq-label]').textContent = label;
      visual.querySelectorAll('.process-visual__track span, .faq-visual__deck span').forEach((marker, markerIndex) => {
        marker.classList.toggle('is-active', markerIndex === index);
      });
      if (visual.classList.contains('faq-visual')) {
        visual.style.setProperty('--faq-index', String(index));
      }
      visual.classList.remove('is-updating');
    }, 130);
  };

  const processVisual = document.querySelector('.process-visual');
  const processItems = Array.from(document.querySelectorAll('.process-list > li'));
  const activateProcess = (index) => {
    processItems.forEach((item, itemIndex) => item.classList.toggle('is-active', itemIndex === index));
    updateVisual(processVisual, index, processItems[index]?.querySelector('h3')?.textContent || '');
  };

  processItems.forEach((item, index) => item.addEventListener('pointerenter', () => activateProcess(index)));
  if (processItems.length) {
    activateProcess(0);
    const processObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) activateProcess(processItems.indexOf(visible.target));
    }, { threshold: [0.35, 0.6], rootMargin: '-28% 0px -28% 0px' });
    processItems.forEach((item) => processObserver.observe(item));
  }

  const faqVisual = document.querySelector('.faq-visual');
  const faqItems = Array.from(document.querySelectorAll('.faq-list > details'));
  const activateFaq = (index) => updateVisual(
    faqVisual,
    index,
    faqItems[index]?.querySelector('summary')?.childNodes[0]?.textContent?.trim() || ''
  );

  faqItems.forEach((details, index) => {
    details.addEventListener('pointerenter', () => activateFaq(index));
    const summary = details.querySelector('summary');
    const answer = details.querySelector('.faq-answer');
    const inner = details.querySelector('.faq-answer__inner');
    summary?.addEventListener('focus', () => activateFaq(index));
    details.addEventListener('toggle', () => {
      if (details.open) activateFaq(index);
    });

    if (!summary || !answer || !inner) return;
    summary.addEventListener('click', (event) => {
      event.preventDefault();
      activateFaq(index);

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        details.open = !details.open;
        return;
      }

      details.faqAnimation?.cancel();
      inner.getAnimations().forEach((animation) => animation.cancel());

      if (!details.open) {
        details.open = true;
        answer.style.height = '0px';
        answer.style.opacity = '0';
        const targetHeight = inner.scrollHeight;
        details.faqAnimation = answer.animate([
          { height: '0px', opacity: 0 },
          { height: `${targetHeight}px`, opacity: 1 }
        ], {
          duration: 520,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
        });
        inner.animate([
          { transform: 'translate3d(30px, -14px, 0) skewX(-2deg)', clipPath: 'inset(0 100% 0 0)' },
          { transform: 'translate3d(0, 0, 0) skewX(0)', clipPath: 'inset(0 0 0 0)' }
        ], {
          duration: 620,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
        });
        details.faqAnimation.finished.then(() => {
          answer.style.height = 'auto';
          answer.style.opacity = '1';
        }).catch(() => {});
        return;
      }

      const startHeight = answer.getBoundingClientRect().height;
      answer.style.height = `${startHeight}px`;
      details.faqAnimation = answer.animate([
        { height: `${startHeight}px`, opacity: 1 },
        { height: '0px', opacity: 0 }
      ], {
        duration: 300,
        easing: 'cubic-bezier(0.7, 0, 0.84, 0)'
      });
      details.faqAnimation.finished.then(() => {
        details.open = false;
        answer.style.height = '';
        answer.style.opacity = '';
      }).catch(() => {});
    });
  });
  if (faqItems.length) activateFaq(0);
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

/* ── Подсказка о горизонтальной прокрутке кейсов ───────────────────────────
   Только на телефоне и только при первом заходе: дальше человек уже знает,
   что лента листается, и повторное напоминание превращается в мусор. */

const CASES_HINT_KEY = 'g0faq.cases.hint';

function initCasesHint() {
  const hint = document.querySelector('#cases-hint');
  const stack = document.querySelector('#cases-stack');
  if (!hint || !stack) return;
  if (window.innerWidth > CASES_BREAKPOINT) return;

  // Приватный режим запрещает доступ к хранилищу — тогда просто показываем.
  try {
    if (window.localStorage.getItem(CASES_HINT_KEY) === 'seen') return;
  } catch {
    /* см. выше */
  }

  let hideTimer = 0;

  const dismiss = () => {
    window.clearTimeout(hideTimer);
    hint.classList.remove('is-visible');
    window.setTimeout(() => { hint.hidden = true; }, 300);
    stack.removeEventListener('scroll', dismiss);
    stack.removeEventListener('pointerdown', dismiss);
    try {
      window.localStorage.setItem(CASES_HINT_KEY, 'seen');
    } catch {
      /* см. выше */
    }
  };

  // Показываем, только когда кейсы действительно на экране, — иначе подсказка
  // отработает вхолостую, пока человек читает первый экран.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      hint.hidden = false;
      // setTimeout, а не rAF: в фоновой вкладке кадры не рисуются и класс не встал бы.
      window.setTimeout(() => hint.classList.add('is-visible'), 30);
      hideTimer = window.setTimeout(dismiss, 6000);
    });
  }, { threshold: 0.4 });

  observer.observe(stack);

  stack.addEventListener('scroll', dismiss, { passive: true, once: true });
  stack.addEventListener('pointerdown', dismiss, { passive: true, once: true });
}

/* ── Согласие на cookie и Яндекс.Метрика ───────────────────────────────────
   Счётчик не загружается, пока не нажато «Принять»: до согласия на сайте нет
   ни одного стороннего запроса. Номер счётчика вписать в METRIKA_ID — больше
   ничего менять не нужно. */

const CONSENT_KEY = 'g0faq.consent';
const METRIKA_ID = '112416202';

function loadMetrika() {
  if (!METRIKA_ID) return;
  if (window.ym) return;

  window.ym = window.ym || function ymStub(...args) {
    (window.ym.a = window.ym.a || []).push(args);
  };
  window.ym.l = Date.now();

  const script = document.createElement('script');
  script.src = 'https://mc.yandex.ru/metrika/tag.js';
  script.async = true;
  document.head.append(script);

  // Параметры один в один из сниппета, выданного Метрикой для этого счётчика.
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
}

function initConsent() {
  const bar = document.querySelector('#cookie-bar');
  if (!bar) return;

  let saved = null;
  try {
    saved = window.localStorage.getItem(CONSENT_KEY);
  } catch {
    // Приватный режим: спрашиваем каждый раз, но ничего не грузим без ответа.
  }

  if (saved === 'granted') {
    loadMetrika();
    return;
  }

  if (saved === 'denied') return;

  bar.hidden = false;
  window.setTimeout(() => bar.classList.add('is-visible'), 30);

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cookie]');
    if (!button) return;
    const choice = button.dataset.cookie;

    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      /* см. выше */
    }

    bar.classList.remove('is-visible');
    window.setTimeout(() => { bar.hidden = true; }, 260);

    if (choice === 'granted') loadMetrika();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSiteParticles();
  initCases();
  initCasesHint();
  initHeroFlow();
  initSectionAssembly();
  initPageSlider();
  initContentVisuals();
  initStackVisualizer();
  initContactForm();
  initConsent();
});
