/* Текстовые страницы: оглавление из заголовков разделов, подсветка текущего
   раздела при прокрутке и меню шапки на телефоне. */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const toggle = header?.querySelector('.nav-toggle');
  if (header && toggle) {
    toggle.addEventListener('click', () => {
      const open = !header.classList.contains('is-menu-open');
      header.classList.toggle('is-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  }
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const toc = document.querySelector('[data-doc-toc]');
  const sections = Array.from(document.querySelectorAll('.doc-section'));
  if (!toc || !sections.length) return;

  // На телефоне оглавление свёрнуто, чтобы не занимать экран.
  if (window.matchMedia('(max-width: 860px)').matches) toc.open = false;

  const links = sections.map((section, index) => {
    const heading = section.querySelector('h2');
    const num = String(index + 1).padStart(2, '0');
    section.id = section.id || `section-${num}`;
    if (heading) heading.dataset.num = num;
    const link = document.createElement('a');
    link.href = `#${section.id}`;
    const badge = document.createElement('span');
    badge.textContent = num;
    link.append(badge, document.createTextNode(heading ? heading.textContent : num));
    toc.append(link);
    return link;
  });

  toc.addEventListener('click', (event) => {
    if (event.target.closest('a') && window.matchMedia('(max-width: 860px)').matches) toc.open = false;
  });

  let frame = 0;
  const update = () => {
    frame = 0;
    const line = window.innerHeight * 0.3;
    let active = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= line) active = index;
    });
    links.forEach((link, index) => link.classList.toggle('is-active', index === active));
  };
  window.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  update();
});
