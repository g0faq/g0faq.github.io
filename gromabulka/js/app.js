/* Демо сайта груминг-студии: витрина, услуги, работы «до/после», мастер
   записи в четыре шага и админ-панель. Всё состояние — в памяти вкладки,
   данные из ./data/mock.json, сервера нет. */

(function () {
  'use strict';

  var app = document.getElementById('app');

  var state = {
    data: null,
    page: 'home',
    /* мастер записи */
    step: 1,
    serviceId: null,
    dayId: null,
    slot: null,
    petKind: 'DOG',
    booked: false,
    /* админка */
    adminTab: 'today',
    /* заявки, созданные в демо, живут до перезагрузки */
    created: [],
  };

  var NAV = [
    { key: 'home', label: 'Главная' },
    { key: 'services', label: 'Услуги' },
    { key: 'works', label: 'Работы' },
    { key: 'reviews', label: 'Отзывы' },
    { key: 'contacts', label: 'Контакты' },
    { key: 'admin', label: 'Админка' },
  ];

  var ICONS = {
    dog: '<path d="M4.5 9.5 3 4l4 2.2h6L17 4l-1.5 5.5v5A3.5 3.5 0 0 1 12 18h-2a3.5 3.5 0 0 1-3.5-3.5z"/><circle cx="8.2" cy="11.5" r=".9" fill="currentColor" stroke="none"/><circle cx="13.8" cy="11.5" r=".9" fill="currentColor" stroke="none"/>',
    cat: '<path d="M4 10 3 4.5 7 7h6l4-2.5L16 10v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/><circle cx="8" cy="11.5" r=".9" fill="currentColor" stroke="none"/><circle cx="14" cy="11.5" r=".9" fill="currentColor" stroke="none"/>',
    check: '<path d="M5 12.5 9.5 17 19 7"/>',
    tg: '<path d="M21 4 3 11l5 2 2 6 3-4 5 4z"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5 20 18M8 16.5 20 6"/>',
  };

  function icon(name, size) {
    return (
      '<svg viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) +
      '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.check) + '</svg>'
    );
  }

  /* Силуэт вместо фотографии: чужих снимков в демо нет. */
  function petSilhouette(kind) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (kind === 'cat' ? ICONS.cat : ICONS.dog) + '</svg>'
    );
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function money(min, max) {
    var fmt = function (n) { return n.toLocaleString('ru-RU'); };
    return max ? fmt(min) + '–' + fmt(max) + ' ₽' : 'от ' + fmt(min) + ' ₽';
  }

  function duration(min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    return (h ? h + ' ч' : '') + (h && m ? ' ' : '') + (m ? m + ' мин' : '');
  }

  function service(id) {
    return state.data.services.filter(function (s) { return s.id === id; })[0] || null;
  }

  function day(id) {
    return state.data.days.filter(function (d) { return d.id === id; })[0] || null;
  }

  /* ─── Каркас ─── */

  function chrome(content) {
    var s = state.data.studio;
    return (
      '<header class="head"><div class="head__row">' +
      '<button class="head__brand" type="button" data-page="home">' + esc(s.name) + '</button>' +
      '<button class="head__book" type="button" data-page="booking">Записаться</button>' +
      '</div><nav class="head__nav" aria-label="Разделы сайта"><ul>' +
      NAV.map(function (item) {
        return (
          '<li><button type="button" data-page="' + item.key + '"' +
          (state.page === item.key ? ' aria-current="page"' : '') + '>' + esc(item.label) + '</button></li>'
        );
      }).join('') +
      '</ul></nav></header><main>' + content + '</main>' + footer()
    );
  }

  function footer() {
    var s = state.data.studio;
    return (
      '<footer class="foot"><div class="foot__cta">Готовы записать питомца?</div>' +
      '<button class="cta cta--primary cta--sm" type="button" data-page="booking" ' +
      'style="margin:0 auto;max-width:280px">' + icon('dog', 18) + 'Записаться онлайн</button>' +
      '<div class="foot__note">' + esc(s.hours) + ' · ' + esc(s.address) + '</div>' +
      '<div class="foot__note">Демо-версия. Данные вымышлены, запись не создаётся.</div></footer>'
    );
  }

  /* ─── Главная ─── */

  function homePage() {
    var s = state.data.studio;
    return (
      '<section class="hero wrap"><div class="hero__media">' +
      '<span class="hero__pet hero__pet--cat">' + petSilhouette('cat') + '</span>' +
      '<div class="hero__photo">' + petSilhouette('dog') + '</div>' +
      '<span class="hero__pet hero__pet--dog">' + petSilhouette('dog') + '</span>' +
      '</div>' +
      '<h1 class="display-xl hero__title">' + esc(s.heroTitle) + '</h1>' +
      '<p class="hero__sub">' + esc(s.heroSubtitle) + '</p>' +
      '<div class="hero__text">' + s.heroText.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
      '<div class="hero__actions">' +
      '<button class="cta cta--primary" type="button" data-page="booking">' + icon('dog') + 'Записаться онлайн</button>' +
      '<button class="cta cta--ghost" type="button" data-page="contacts">' + icon('tg') + 'Написать в Telegram</button>' +
      '</div></section>' +

      '<section class="section wrap"><div class="section__head">' +
      '<h2 class="display-lg">Как проходит стрижка</h2></div>' +
      '<div class="steps">' +
      state.data.steps.map(function (step) {
        return (
          '<div class="card"><div class="step__num">' + esc(step.num) + '</div>' +
          '<div class="step__title">' + esc(step.title) + '</div>' +
          '<p class="step__text">' + esc(step.text) + '</p></div>'
        );
      }).join('') +
      '</div></section>' +

      '<section class="section wrap"><div class="section__head">' +
      '<h2 class="display-lg">Услуги и цены</h2>' +
      '<p class="section__note">Точную цену называю после осмотра — она зависит от состояния шерсти.</p></div>' +
      '<div class="cards cards--2">' +
      state.data.services.slice(0, 4).map(serviceCard).join('') +
      '</div>' +
      '<div style="margin-top:16px;text-align:center">' +
      '<button class="cta cta--ghost cta--sm" type="button" data-page="services" ' +
      'style="display:inline-flex">Все услуги</button></div></section>' +

      '<section class="section wrap wrap--wide"><div class="section__head">' +
      '<h2 class="display-lg">Работы «до и после»</h2></div>' +
      '<div class="gallery">' + state.data.gallery.slice(0, 3).map(shot).join('') + '</div></section>' +

      '<section class="section wrap"><div class="section__head">' +
      '<h2 class="display-lg">Отзывы</h2></div>' +
      '<div class="cards cards--2">' + state.data.reviews.slice(0, 2).map(review).join('') + '</div></section>' +

      locationSection()
    );
  }

  function serviceCard(item) {
    return (
      '<article class="card service"><div class="service__top">' +
      '<span class="service__title">' + esc(item.title) + '</span>' +
      '<span class="service__price">' + money(item.priceMin, item.priceMax) + '</span></div>' +
      '<div class="service__meta"><span class="pill">' + esc(item.category) + '</span>' +
      '<span class="pill">' + duration(item.duration) + '</span></div>' +
      '<p class="service__desc">' + esc(item.desc) + '</p>' +
      '<button class="cta cta--primary cta--sm" type="button" data-book="' + esc(item.id) + '">Записаться</button>' +
      '</article>'
    );
  }

  function shot(item) {
    return (
      '<article class="shot"><div class="shot__pair">' +
      '<div class="shot__half"><span class="shot__tag">до</span>' + petSilhouette(item.pet) + '</div>' +
      '<div class="shot__half shot__half--after"><span class="shot__tag">после</span>' + petSilhouette(item.pet) + '</div>' +
      '</div><div class="shot__body"><div class="shot__name">' + esc(item.name) + '</div>' +
      '<div class="shot__meta">' + esc(item.meta) + '</div></div></article>'
    );
  }

  function review(item) {
    return (
      '<article class="card review"><div class="review__head">' +
      '<span class="review__ava">' + esc(item.initials) + '</span>' +
      '<span><span class="review__name">' + esc(item.name) + '</span>' +
      '<span class="review__date" style="display:block">' + esc(item.date) + '</span></span></div>' +
      '<div class="review__stars">' + '★'.repeat(item.stars) + '☆'.repeat(5 - item.stars) + '</div>' +
      '<p class="review__text">' + esc(item.text) + '</p></article>'
    );
  }

  function locationSection() {
    var s = state.data.studio;
    return (
      '<section class="section wrap"><div class="section__head">' +
      '<h2 class="display-lg">Где принимаю</h2></div><div class="card">' +
      '<div class="contact">' +
      '<div class="contact__row"><span class="contact__label">Адрес</span><span>' + esc(s.address) + '</span></div>' +
      '<div class="contact__row"><span class="contact__label">Часы</span><span>' + esc(s.hours) + '</span></div>' +
      '<div class="contact__row"><span class="contact__label">Телефон</span><span>' + esc(s.phone) + '</span></div>' +
      '</div>' +
      '<p class="small muted" style="margin-top:12px">' + esc(s.addressNote) + '</p>' +
      '<div class="map">Карта в демо-версии не подключена</div></div></section>'
    );
  }

  /* ─── Страницы разделов ─── */

  function servicesPage() {
    var groups = ['Собаки', 'Кошки', 'Дополнительно'];
    return (
      '<section class="section wrap"><div class="section__head">' +
      '<h1 class="display-lg">Услуги и цены</h1>' +
      '<p class="section__note">Вилка цен — не хитрость: сколько займёт стрижка, видно только по шерсти.</p></div>' +
      groups.map(function (group) {
        var items = state.data.services.filter(function (s) { return s.category === group; });
        if (!items.length) return '';
        return (
          '<h2 class="display-md" style="margin:26px 0 12px">' + esc(group) + '</h2>' +
          '<div class="cards cards--2">' + items.map(serviceCard).join('') + '</div>'
        );
      }).join('') +
      '</section>'
    );
  }

  function worksPage() {
    return (
      '<section class="section wrap wrap--wide"><div class="section__head">' +
      '<h1 class="display-lg">Работы «до и после»</h1>' +
      '<p class="section__note">В демо вместо фотографий — силуэты: чужие снимки сюда не переносятся.</p></div>' +
      '<div class="gallery">' + state.data.gallery.map(shot).join('') + '</div></section>'
    );
  }

  function reviewsPage() {
    return (
      '<section class="section wrap"><div class="section__head">' +
      '<h1 class="display-lg">Отзывы</h1></div>' +
      '<div class="cards cards--2">' + state.data.reviews.map(review).join('') + '</div></section>'
    );
  }

  function contactsPage() {
    var s = state.data.studio;
    return (
      '<section class="section wrap"><div class="section__head">' +
      '<h1 class="display-lg">Контакты</h1></div><div class="card">' +
      '<div class="contact">' +
      '<div class="contact__row"><span class="contact__label">Телефон</span><span>' + esc(s.phone) + '</span></div>' +
      '<div class="contact__row"><span class="contact__label">Telegram</span><span>в демо не подключён</span></div>' +
      '<div class="contact__row"><span class="contact__label">Адрес</span><span>' + esc(s.address) + '</span></div>' +
      '<div class="contact__row"><span class="contact__label">Часы</span><span>' + esc(s.hours) + '</span></div>' +
      '</div><p class="small muted" style="margin-top:12px">' + esc(s.addressNote) + '</p>' +
      '<div class="map">Карта в демо-версии не подключена</div></div></section>'
    );
  }

  /* ─── Мастер записи ─── */

  function bookingPage() {
    if (state.booked) return donePage();

    var chosenService = service(state.serviceId);
    var chosenDay = day(state.dayId);

    var summary = [];
    if (chosenService && state.step !== 1) summary.push({ label: chosenService.title, step: 1 });
    if (chosenDay && state.step > 2) summary.push({ label: chosenDay.num + ' ' + chosenDay.month, step: 2 });
    if (state.slot && state.step > 3) summary.push({ label: state.slot, step: 3 });

    var body = '';

    if (state.step === 1) {
      body =
        '<h2 class="display-md" style="margin-bottom:14px">Что нужно питомцу</h2>' +
        state.data.services.map(function (item) {
          return (
            '<button class="choice" type="button" data-service="' + esc(item.id) + '"' +
            ' data-on="' + (state.serviceId === item.id) + '">' +
            '<span><span class="choice__title">' + esc(item.title) + '</span>' +
            '<span class="choice__note">' + duration(item.duration) + ' · ' + esc(item.category) + '</span></span>' +
            '<span class="choice__price">' + money(item.priceMin, item.priceMax) + '</span></button>'
          );
        }).join('');
    }

    if (state.step === 2) {
      body =
        '<h2 class="display-md" style="margin-bottom:14px">Когда удобно</h2>' +
        '<div class="days">' +
        state.data.days.map(function (item) {
          var full = item.free === 0;
          return (
            '<button class="day" type="button" data-day="' + esc(item.id) + '"' +
            ' data-on="' + (state.dayId === item.id) + '"' + (full ? ' disabled' : '') + '>' +
            '<span class="day__dow">' + esc(item.dow) + '</span>' +
            '<span class="day__num" style="display:block">' + esc(item.num) + '</span>' +
            '<span class="day__free">' + (full ? 'занято' : item.free + ' окна') + '</span></button>'
          );
        }).join('') +
        '</div>';
    }

    if (state.step === 3 && chosenDay) {
      body =
        '<h2 class="display-md" style="margin-bottom:14px">Свободное время, ' +
        esc(chosenDay.num + ' ' + chosenDay.month) + '</h2><div class="slots">' +
        state.data.allSlots.map(function (time) {
          var free = chosenDay.slots.indexOf(time) !== -1;
          return (
            '<button class="slot" type="button" data-slot="' + esc(time) + '"' +
            ' data-on="' + (state.slot === time) + '"' + (free ? '' : ' disabled') + '>' + esc(time) + '</button>'
          );
        }).join('') +
        '</div><p class="small muted" style="margin-top:12px">Занятое время закрыто: между визитами закладывается уборка.</p>';
    }

    if (state.step === 4) {
      body =
        '<h2 class="display-md" style="margin-bottom:14px">Куда прислать подтверждение</h2>' +
        '<form data-booking-form>' +
        '<label class="field"><span class="field__label">Кто питомец</span>' +
        '<span class="radios">' +
        '<button type="button" data-pet="DOG" data-on="' + (state.petKind === 'DOG') + '">Собака</button>' +
        '<button type="button" data-pet="CAT" data-on="' + (state.petKind === 'CAT') + '">Кошка</button>' +
        '</span></label>' +
        '<label class="field"><span class="field__label">Кличка и порода</span>' +
        '<input type="text" name="pet" placeholder="Кекс, бишон" required></label>' +
        '<label class="field"><span class="field__label">Ваше имя</span>' +
        '<input type="text" name="name" placeholder="Анна" required></label>' +
        '<label class="field"><span class="field__label">Телефон</span>' +
        '<input type="tel" name="phone" placeholder="+7 900 000-00-00" required></label>' +
        '<label class="field"><span class="field__label">Что важно знать</span>' +
        '<textarea name="note" rows="3" placeholder="Боится машинки, шерсть в колтунах на боках"></textarea></label>' +
        '<div class="wnav"><button class="cta cta--ghost" type="button" data-step="3">Назад</button>' +
        '<button class="cta cta--primary" type="submit">Записаться</button></div></form>';
    }

    var nav = '';
    if (state.step < 4) {
      var canForward =
        (state.step === 1 && state.serviceId) ||
        (state.step === 2 && state.dayId) ||
        (state.step === 3 && state.slot);
      nav =
        '<div class="wnav">' +
        (state.step > 1 ? '<button class="cta cta--ghost" type="button" data-step="' + (state.step - 1) + '">Назад</button>' : '') +
        '<button class="cta cta--primary" type="button" data-step="' + (state.step + 1) + '"' +
        (canForward ? '' : ' disabled') + '>Дальше</button></div>';
    }

    return (
      '<section class="section wrap"><div class="wizard">' +
      '<h1 class="display-lg" style="margin-bottom:18px">Онлайн-запись</h1>' +
      '<div class="wsteps">' +
      [1, 2, 3, 4].map(function (n) {
        return '<span class="wstep" data-on="' + (n <= state.step) + '"></span>';
      }).join('') +
      '</div>' +
      (summary.length
        ? '<div class="wsummary">' +
          summary.map(function (item) {
            return '<button type="button" data-step="' + item.step + '">' + esc(item.label) + '</button>';
          }).join('') +
          '</div>'
        : '') +
      body + nav + '</div></section>'
    );
  }

  function donePage() {
    var chosenService = service(state.serviceId);
    var chosenDay = day(state.dayId);
    return (
      '<section class="section wrap"><div class="wizard done">' +
      '<div class="done__mark">' + icon('check', 32) + '</div>' +
      '<h1 class="display-lg" style="margin-bottom:12px">Записали</h1>' +
      '<p style="margin-bottom:8px">' + esc(chosenService ? chosenService.title : '') + '</p>' +
      '<p class="muted" style="margin-bottom:24px">' +
      esc(chosenDay ? chosenDay.num + ' ' + chosenDay.month : '') + ', ' + esc(state.slot || '') +
      '</p>' +
      '<p class="small muted" style="margin-bottom:24px">В демо заявка никуда не уходит — она появилась ' +
      'в админ-панели и пропадёт при перезагрузке страницы.</p>' +
      '<div class="hero__actions">' +
      '<button class="cta cta--primary" type="button" data-page="admin">Посмотреть в админке</button>' +
      '<button class="cta cta--ghost" type="button" data-reset="1">Записаться ещё раз</button>' +
      '</div></div></section>'
    );
  }

  /* ─── Админка ─── */

  function adminPage() {
    var a = state.data.admin;
    var list = state.adminTab === 'today' ? state.created.concat(a.bookings) : a.week;

    return (
      '<section class="section wrap wrap--wide">' +
      '<div class="admin__top"><div>' +
      '<h1 class="display-lg">Записи</h1>' +
      '<p class="muted small">' + esc(a.date) + '</p></div>' +
      '<div class="admin__tabs">' +
      '<button class="admin__tab" type="button" data-admin="today" data-on="' + (state.adminTab === 'today') + '">Сегодня</button>' +
      '<button class="admin__tab" type="button" data-admin="week" data-on="' + (state.adminTab === 'week') + '">Прошедшие</button>' +
      '</div></div>' +

      (state.adminTab === 'today'
        ? '<div class="kpis">' +
          a.kpis.map(function (kpi) {
            return (
              '<div class="card"><div class="kpi__label">' + esc(kpi.label) + '</div>' +
              '<div class="kpi__value">' + esc(kpi.value) + '</div></div>'
            );
          }).join('') +
          '</div>'
        : '') +

      '<div class="card">' +
      list.map(function (item) {
        return (
          '<div class="booking"><div><div class="booking__time">' + esc(item.time) + '</div>' +
          '<div class="booking__dur">' + esc(item.dur) + '</div></div>' +
          '<div><div class="booking__pet">' + esc(item.pet) + '</div>' +
          '<div class="booking__meta">' + esc(item.meta) + '</div></div>' +
          '<span class="status status--' + esc(item.status) + '">' + esc(item.statusLabel) + '</span></div>'
        );
      }).join('') +
      '</div>' +
      '<p class="small muted" style="margin-top:14px">В исходном проекте это защищённая паролем ' +
      'админ-панель: мастер меняет статусы, часы работы, цены и тексты сайта. В демо панель открыта ' +
      'и доступна только на чтение.</p></section>'
    );
  }

  /* ─── Отрисовка ─── */

  function render() {
    var content =
      state.page === 'home' ? homePage()
      : state.page === 'services' ? servicesPage()
      : state.page === 'works' ? worksPage()
      : state.page === 'reviews' ? reviewsPage()
      : state.page === 'contacts' ? contactsPage()
      : state.page === 'booking' ? bookingPage()
      : adminPage();
    app.innerHTML = chrome(content);
    window.scrollTo(0, 0);
  }

  /* ─── События ─── */

  document.addEventListener('click', function (event) {
    var el;

    el = event.target.closest('[data-page]');
    if (el) { state.page = el.getAttribute('data-page'); render(); return; }

    el = event.target.closest('[data-book]');
    if (el) {
      state.serviceId = el.getAttribute('data-book');
      state.page = 'booking';
      state.step = 2;
      state.booked = false;
      render();
      return;
    }

    el = event.target.closest('[data-service]');
    if (el) { state.serviceId = el.getAttribute('data-service'); render(); return; }

    el = event.target.closest('[data-day]');
    if (el) { state.dayId = el.getAttribute('data-day'); state.slot = null; render(); return; }

    el = event.target.closest('[data-slot]');
    if (el) { state.slot = el.getAttribute('data-slot'); render(); return; }

    el = event.target.closest('[data-pet]');
    if (el) { state.petKind = el.getAttribute('data-pet'); render(); return; }

    el = event.target.closest('[data-step]');
    if (el) { state.step = Number(el.getAttribute('data-step')); render(); return; }

    el = event.target.closest('[data-admin]');
    if (el) { state.adminTab = el.getAttribute('data-admin'); render(); return; }

    el = event.target.closest('[data-reset]');
    if (el) {
      state.booked = false;
      state.step = 1;
      state.serviceId = null;
      state.dayId = null;
      state.slot = null;
      render();
    }
  });

  document.addEventListener('submit', function (event) {
    if (!event.target.closest('[data-booking-form]')) return;
    event.preventDefault();
    var form = event.target;
    var get = function (name) {
      var field = form.querySelector('[name="' + name + '"]');
      return field ? field.value.trim() : '';
    };
    var chosenService = service(state.serviceId);
    var chosenDay = day(state.dayId);

    state.created.unshift({
      time: state.slot || '—',
      dur: chosenService ? duration(chosenService.duration) : '',
      pet: (state.petKind === 'CAT' ? 'Кошка' : 'Собака') + ' «' + (get('pet') || 'без клички') + '»',
      meta: (get('name') || 'Гость') + ' · ' + (chosenService ? chosenService.title : '') +
        (chosenDay ? ' · ' + chosenDay.num + ' ' + chosenDay.month : ''),
      status: 'new',
      statusLabel: 'Новая',
    });

    state.booked = true;
    render();
  });

  fetch('./data/mock.json')
    .then(function (response) { return response.json(); })
    .then(function (data) { state.data = data; render(); })
    .catch(function () {
      app.innerHTML = '<section class="section wrap"><h1 class="display-lg">Не удалось загрузить демо-данные</h1></section>';
    });
})();
