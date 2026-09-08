/* Демо кабинета ershdesign: одна страница, пять экранов, всё состояние — в
   памяти вкладки. Разметка повторяет шаблоны исходника (EJS), поэтому классы
   берутся оттуда без изменений, а данные приходят из ./data/mock.json. */

(function () {
  'use strict';

  var app = document.getElementById('app');
  var roleSwitch = document.getElementById('role-switch');

  var state = {
    data: null,
    role: 'owner',
    screen: 'login',
    fileSection: 'docs',
    chatId: null,
    adminTab: 'overview',
    code: ['', '', '', '', '', ''],
    loginError: '',
    /* Отправленные в демо сообщения живут здесь и пропадают при перезагрузке. */
    sent: {},
  };

  var NAV = {
    owner: [
      { key: 'project', label: 'Проект' },
      { key: 'finance', label: 'Финансы' },
      { key: 'chats', label: 'Чаты' },
      { key: 'admin', label: 'Управление' },
    ],
    member: [
      { key: 'project', label: 'Проект' },
      { key: 'finance', label: 'Финансы' },
      { key: 'chats', label: 'Чаты' },
      { key: 'admin', label: 'Управление' },
    ],
    client: [
      { key: 'project', label: 'Проект' },
      { key: 'finance', label: 'Финансы' },
      { key: 'chats', label: 'Чат' },
    ],
  };

  var TAB_ICONS = {
    project: '<path d="M3.75 4.75h16.5v14.5H3.75z"/><path d="M9.25 4.75v14.5"/><path d="M9.25 11.5h11"/>',
    finance: '<rect x="2.75" y="6.25" width="18.5" height="11.5" rx="1.75"/><circle cx="12" cy="12" r="2.4"/>',
    chats: '<path d="M4.75 5.25h14.5a1.1 1.1 0 0 1 1.1 1.1v8.6a1.1 1.1 0 0 1-1.1 1.1H9.4l-5.75 3.7V6.35a1.1 1.1 0 0 1 1.1-1.1z"/>',
    admin: '<path d="M3.75 7.5h16.5M3.75 12h16.5M3.75 16.5h16.5"/><circle cx="9" cy="7.5" r="1.9"/><circle cx="15" cy="12" r="1.9"/><circle cx="8" cy="16.5" r="1.9"/>',
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function currentRole() {
    return state.data.roles.filter(function (item) { return item.id === state.role; })[0];
  }

  function isOwner() {
    return state.role === 'owner';
  }

  /* ─── Шапка и нижнее меню ─── */

  function header() {
    var role = currentRole();
    var nav = NAV[state.role]
      .map(function (item) {
        var unread = item.key === 'chats' ? unreadTotal() : 0;
        return (
          '<button type="button" data-go="' + item.key + '"' +
          (state.screen === item.key ? ' class="is-active"' : '') + '>' + esc(item.label) +
          (unread ? '<span class="cab-nav__count">' + unread + '</span>' : '') +
          '</button>'
        );
      })
      .join('');

    var switcher = isOwner()
      ? '<div class="cab-project-switch">' +
        '<label class="sr-only" for="cab-project-switch">Текущий проект</label>' +
        '<select class="cab-project-switch__select" id="cab-project-switch" aria-label="Текущий проект">' +
        state.data.projects
          .map(function (item, index) {
            return '<option' + (index === 0 ? ' selected' : '') + '>' + esc(item.title) + '</option>';
          })
          .join('') +
        '</select></div>'
      : '';

    return (
      '<header class="cab-header">' +
      '<div class="cab-header__left">' +
      '<button class="script cab-header__logo brand-lettering" type="button" data-go="project" aria-label="ershdesign">ershdesign</button>' +
      '<nav class="cab-nav">' + nav + '</nav>' +
      '</div>' + switcher +
      '<div class="cab-header__right">' +
      '<span class="label">' + esc(role.member) + '<span class="cab-header__role"> · ' + esc(role.roleLabel) + '</span></span>' +
      '<button class="btn btn--outline btn--xs cab-header__exit" type="button" data-go="login">Выход</button>' +
      '</div></header>'
    );
  }

  function tabbar() {
    return (
      '<nav class="cab-tabbar" aria-label="Разделы кабинета">' +
      NAV[state.role]
        .map(function (item) {
          var unread = item.key === 'chats' ? unreadTotal() : 0;
          return (
            '<button class="cab-tabbar__item' + (state.screen === item.key ? ' is-active' : '') +
            '" type="button" data-go="' + item.key + '" title="' + esc(item.label) + '">' +
            '<svg class="cab-tabbar__icon" viewBox="0 0 24 24" aria-hidden="true">' + TAB_ICONS[item.key] + '</svg>' +
            '<span class="cab-tabbar__label sr-only">' + esc(item.label) + '</span>' +
            (unread ? '<span class="cab-tabbar__count">' + unread + '</span>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</nav>'
    );
  }

  /* ─── Экран входа по коду проекта ─── */

  function loginScreen() {
    var cells = state.code
      .map(function (value, index) {
        return (
          '<input class="pin-cell' + (value ? ' is-filled' : '') + '" type="text" inputmode="numeric" ' +
          'pattern="[0-9]" maxlength="1" value="' + esc(value) + '" autocomplete="off" ' +
          'aria-label="Цифра ' + (index + 1) + '" data-code-cell="' + index + '">'
        );
      })
      .join('');

    return (
      '<section class="login">' +
      '<span class="script login__logo brand-lettering" role="img" aria-label="ershdesign">ershdesign</span>' +
      '<div class="display login__title">Кабинет проекта</div>' +
      '<div class="label login__hint">Шестизначный код проекта</div>' +
      '<div class="login__demo" role="note"><span>Демо-код проекта:</span><strong>486210</strong></div>' +
      '<form class="login__access" data-login>' +
      '<div class="field-group"><span class="field-label" id="project-code-label">Код проекта</span>' +
      '<div class="login__pin" role="group" aria-labelledby="project-code-label">' + cells + '</div></div>' +
      '<div class="field-group"><label class="field-label" for="client-full-name">ФИО ' +
      '<span class="field-optional">необязательно</span></label>' +
      '<input class="field" id="client-full-name" type="text" placeholder="Как к вам обращаться"></div>' +
      (state.loginError ? '<span class="error-text" role="alert">' + esc(state.loginError) + '</span>' : '') +
      '<button type="submit" class="btn btn--gold btn--lg btn--block login__submit">Войти в проект</button>' +
      '</form>' +
      '<p class="demo-note">В демо принимается только код 486210. Переключатель ролей сверху меняет ' +
      'набор доступных разделов так же, как это делают роли owner / member / client в исходнике.</p>' +
      '</section>'
    );
  }

  /* ─── Кабинет проекта ─── */

  function projectScreen() {
    var d = state.data;
    var files = d.files[state.fileSection] || [];

    return (
      '<div class="cab">' +
      '<section class="cab__block">' +
      '<div class="dash__head"><div><div class="eyebrow">' + esc(d.project.code) + '</div>' +
      '<div class="display dash__title">' + esc(d.project.title) + '</div></div>' +
      '<span class="badge badge--stage">Стадия ' + esc(d.current.num) + ' — ' + esc(d.current.name) + '</span></div>' +
      '<div class="dash__status"><span class="badge badge--stage">Стадия ' + esc(d.current.num) + '</span>' +
      '<span class="label">' + d.project.overall + '% готово</span></div>' +
      '<div class="progress dash__progress"><div class="progress__bar progress__bar--p' + d.project.overall + '"></div></div>' +
      '<div class="metrics">' +
      '<div class="metric metric--desktop"><span class="metric__label">Прогресс</span>' +
      '<span class="metric__value">' + d.project.overall + '%</span>' +
      '<div class="progress metric__progress"><div class="progress__bar progress__bar--p' + d.project.overall + '"></div></div></div>' +
      '<div class="metric"><span class="metric__label">Ближайший срок</span>' +
      '<span class="metric__value">' + esc(d.summary.deadline) + '</span>' +
      '<span class="metric__extra metric__extra--gold">' + esc(d.summary.deadlineNote) + '</span></div>' +
      '<div class="metric"><span class="metric__label">Открытых задач</span>' +
      '<span class="metric__value">' + esc(d.summary.openTasks) + '</span>' +
      '<span class="metric__extra metric__extra--muted">' + esc(d.summary.openTasksNote) + '</span></div>' +
      '<div class="metric metric--team"><span class="metric__label">Команда</span><div class="metric__team">' +
      d.team.map(function (p) { return '<span>' + esc(p.name) + ' — ' + esc(p.role) + '</span>'; }).join('') +
      '</div></div></div></section>' +

      '<section class="cab__block"><div class="cab__block-head">' +
      '<div class="eyebrow">05 — Стадии проектирования</div>' +
      '<span class="label">Этап ' + esc(d.current.num) + ' из ' + esc(d.current.total) + '</span></div>' +
      '<div class="stage-scale">' +
      d.stages
        .map(function (stage) {
          return (
            '<div class="stage is-' + stage.state + '">' +
            '<div class="progress progress--thick stage__bar"><div class="progress__bar progress__bar--' +
            stage.state + '"></div></div>' +
            '<div class="stage__num">' + esc(stage.num) + ' —</div>' +
            '<div class="stage__name">' + esc(stage.name) + '</div>' +
            '<div class="label stage__state">' + esc(stage.stateLabel) + '</div></div>'
          );
        })
        .join('') +
      '</div></section>' +

      '<section class="cab__block"><div class="eyebrow">06 — Задачи</div><div class="rows">' +
      d.tasks
        .map(function (task) {
          return (
            '<div class="row task"><span class="task__n">' + esc(task.n) + '</span>' +
            '<div class="task__top"><span class="task__title">' + esc(task.title) + '</span>' +
            '<span class="badge badge--lg badge--' + task.statusKey + ' task__badge">' + esc(task.status) + '</span></div>' +
            '<div class="label task__meta"><span class="task__owner">' + esc(task.owner) + '</span>' +
            '<span class="task__due">' + esc(task.due) + '</span></div></div>'
          );
        })
        .join('') +
      '</div></section>' +

      '<section class="cab__block"><div class="cab__block-head">' +
      '<div class="eyebrow">07 — Файлы проекта</div><div class="chips">' +
      d.fileTabs
        .map(function (tab) {
          return (
            '<button type="button" class="chip' + (tab.section === state.fileSection ? ' is-active' : '') +
            '" data-file-section="' + tab.section + '">' + esc(tab.label) + ' · ' + tab.count + '</button>'
          );
        })
        .join('') +
      '</div></div><div class="rows">' +
      files
        .map(function (file) {
          return (
            '<div class="row file"><span class="badge badge--kind">' + esc(file.kind) + '</span>' +
            '<div class="file__body"><div class="file__name">' + esc(file.name) + '</div>' +
            '<div class="label file__meta">' + esc(file.meta) + '</div></div>' +
            '<div class="file__actions"><span class="badge badge--' + file.statusKey + ' file__badge">' +
            esc(file.status) + '</span><span class="file__action">' + esc(file.action) + '</span></div></div>'
          );
        })
        .join('') +
      '</div></section>' +

      '<section class="cab__block"><div class="eyebrow">08 — Рабочая документация</div><div class="sheets">' +
      '<div class="sheets__head"><span class="sheets__head-mobile">Листы</span>' +
      '<span class="sheets__head-mobile">' + String(d.sheets.length).padStart(2, '0') + ' из ' + esc(d.sheetsTotal) + '</span>' +
      '<span class="sheets__head-cell">Лист</span><span class="sheets__head-cell">Наименование</span>' +
      '<span class="sheets__head-cell">Автор</span><span class="sheets__head-cell">Версия</span>' +
      '<span class="sheets__head-cell">Статус</span></div>' +
      d.sheets
        .map(function (sheet) {
          return (
            '<div class="sheet"><div class="sheet__top"><span class="sheet__no">' + esc(sheet.no) + '</span>' +
            '<span class="sheet__name">' + esc(sheet.name) + '</span></div>' +
            '<div class="sheet__status"><span class="badge badge--' + sheet.statusKey + '">' + esc(sheet.status) + '</span></div>' +
            '<div class="label sheet__meta"><span class="sheet__author">' + esc(sheet.author) + '</span>' +
            '<span class="sheet__ver">' + esc(sheet.ver) + '</span></div></div>'
          );
        })
        .join('') +
      '</div></section></div>'
    );
  }

  /* ─── Финансы проекта ─── */

  function financeScreen() {
    var f = state.data.finance;
    return (
      '<div class="cab"><section class="cab__block"><div class="cab__block-head">' +
      '<div><div class="eyebrow">' + esc(state.data.project.code) + '</div>' +
      '<h1 class="display dash__title">Финансы проекта</h1></div>' +
      '<span class="label">' + f.payments.length + ' платежей</span></div>' +
      '<div class="metrics">' +
      '<div class="metric"><span class="metric__label">Общая стоимость</span><span class="metric__value">' + esc(f.total) + '</span></div>' +
      '<div class="metric"><span class="metric__label">Оплачено</span><span class="metric__value">' + esc(f.paid) + '</span></div>' +
      '<div class="metric"><span class="metric__label">Остаток</span><span class="metric__value">' + esc(f.remaining) + '</span></div>' +
      '</div><div class="rows">' +
      f.payments
        .map(function (payment) {
          return (
            '<div class="row file"><span class="badge badge--' + (payment.status === 'paid' ? 'done' : 'wait') + '">' +
            esc(payment.statusLabel) + '</span><div class="file__body">' +
            '<div class="file__name">' + esc(payment.purpose) + '</div>' +
            '<div class="label file__meta">' + esc(payment.due) + '</div></div>' +
            '<div class="file__actions"><strong>' + esc(payment.amount) + '</strong></div></div>'
          );
        })
        .join('') +
      '</div></section></div>'
    );
  }

  /* ─── Чаты ─── */

  function visibleChats() {
    if (state.role === 'client') {
      return state.data.chats.filter(function (chat) { return chat.kind === 'client'; });
    }
    return state.data.chats;
  }

  function unreadTotal() {
    return visibleChats().reduce(function (sum, chat) { return sum + (chat.unread || 0); }, 0);
  }

  function messagesOf(chat) {
    return chat.messages.concat(state.sent[chat.id] || []);
  }

  function chatsScreen() {
    var chats = visibleChats();
    var single = state.role === 'client';
    var selected = chats.filter(function (chat) { return chat.id === state.chatId; })[0] || null;
    if (single) selected = chats[0];

    var list = single
      ? ''
      : '<aside class="chat-list" aria-label="Список чатов">' +
        '<div class="chat-list__head"><div><div class="eyebrow">Общение</div>' +
        '<h1 class="display chat-list__title">Чаты</h1></div>' +
        '<span class="badge badge--work">' + chats.length + '</span></div>' +
        '<nav class="chat-list__items">' +
        chats
          .map(function (chat) {
            var kind = chat.kind === 'client' ? 'Клиентский' : chat.kind === 'team' ? 'Командный' : 'Личный';
            return (
              '<button type="button" class="chat-list__item' + (selected && selected.id === chat.id ? ' is-active' : '') +
              '" data-chat="' + esc(chat.id) + '">' +
              '<span class="chat-list__kind">' + kind + '</span><strong>' + esc(chat.label) + '</strong>' +
              '<span class="chat-list__meta">' + esc(chat.meta) + '</span>' +
              (chat.unread ? '<span class="chat-list__unread">' + chat.unread + '</span>' : '') +
              '</button>'
            );
          })
          .join('') +
        '</nav></aside>';

    var thread;
    if (selected) {
      var previous = null;
      var kindLabel = single
        ? 'Общение'
        : selected.kind === 'client' ? 'Клиентский чат' : selected.kind === 'team' ? 'Командный чат' : 'Личный чат';

      thread =
        '<header class="chat-thread__head">' +
        '<button class="chat-thread__back" type="button" data-go="' + (single ? 'project' : 'chats') +
        '" data-chat-close="1" aria-label="Назад">←</button>' +
        '<div><div class="eyebrow">' + kindLabel + '</div>' +
        '<h2 class="chat-thread__title">' + esc(selected.label) + '</h2></div></header>' +
        '<div class="chat-messages" data-chat-feed>' +
        messagesOf(selected)
          .map(function (message) {
            var grouped = previous === message.author;
            previous = message.author;
            return (
              '<article class="chat-message' + (message.own ? ' is-own' : '') + (grouped ? ' is-grouped' : '') + '">' +
              '<div class="chat-message__meta"><strong>' + esc(message.author) + '</strong>' +
              '<time>' + esc(message.time) + '</time></div>' +
              '<p class="chat-message__body">' + esc(message.body) + '</p></article>'
            );
          })
          .join('') +
        '</div>' +
        '<form class="chat-composer" data-send="' + esc(selected.id) + '"><div class="chat-composer__row">' +
        '<label class="sr-only" for="chat-body">Сообщение</label>' +
        '<textarea id="chat-body" name="body" rows="1" placeholder="Написать сообщение"></textarea>' +
        '<button class="chat-send" type="submit" aria-label="Отправить">' +
        '<svg class="chat-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5V5"/><path d="M6 11l6-6 6 6"/></svg>' +
        '</button></div></form>';
    } else {
      thread =
        '<div class="chat-thread__placeholder"><div class="eyebrow">Чаты проектов</div>' +
        '<p>Выберите переписку слева.</p></div>';
    }

    return (
      '<div class="chat-shell' + (selected ? ' has-selected' : '') + (single ? ' is-client-single' : '') + '">' +
      list + '<section class="chat-thread" aria-label="Переписка">' + thread + '</section></div>'
    );
  }

  /* ─── Админ-панель ─── */

  function adminTabs() {
    var d = state.data;
    var tabs = [{ id: 'overview', label: 'Обзор', count: '' }];
    if (isOwner()) {
      tabs.push({ id: 'projects', label: 'Проекты', count: d.projects.length });
      tabs.push({ id: 'finance', label: 'Финансы', count: d.finance.payments.length });
      tabs.push({ id: 'members', label: 'Команда', count: d.teamUsers.length });
    }
    tabs.push({ id: 'stages', label: 'Этапы', count: d.stages.length });
    tabs.push({ id: 'tasks', label: 'Задачи', count: d.tasks.length });
    tabs.push({ id: 'files', label: 'Файлы', count: 6 });
    if (isOwner()) tabs.push({ id: 'leads', label: 'Заявки', count: d.leads.length });
    return tabs;
  }

  function adminPanelBody() {
    var d = state.data;
    var tab = state.adminTab;

    if (tab === 'overview') {
      var openTasks = d.tasks.filter(function (t) { return t.statusKey !== 'done'; }).length;
      var doneStages = d.stages.filter(function (s) { return s.state === 'done'; }).length;
      var newLeads = d.leads.filter(function (l) { return l.status === 'new'; }).length;
      return (
        '<div class="admin-kpis">' +
        '<button class="admin-kpi" type="button" data-admin-tab="stages"><span class="admin-kpi__value">' +
        doneStages + '/' + d.stages.length + '</span><span class="admin-kpi__label">этапов завершено</span></button>' +
        '<button class="admin-kpi" type="button" data-admin-tab="tasks"><span class="admin-kpi__value">' +
        openTasks + '</span><span class="admin-kpi__label">открытых задач</span></button>' +
        '<button class="admin-kpi" type="button" data-admin-tab="files"><span class="admin-kpi__value">6</span>' +
        '<span class="admin-kpi__label">файлов и ссылок</span></button>' +
        (isOwner()
          ? '<button class="admin-kpi has-alert" type="button" data-admin-tab="leads"><span class="admin-kpi__value">' +
            newLeads + '</span><span class="admin-kpi__label">новых заявок</span></button>'
          : '') +
        '</div><div class="admin-overview-grid"><div class="admin-card"><div class="admin-card__head">' +
        '<div><div class="eyebrow">Текущий план</div><h3 class="admin-card__title">Этапы проекта</h3></div></div>' +
        '<div class="admin-stage-summary">' +
        d.stages
          .slice(0, 5)
          .map(function (stage, index) {
            return (
              '<div class="admin-stage-summary__item"><span class="admin-stage-summary__index">' +
              String(index + 1).padStart(2, '0') + '</span>' +
              '<span class="admin-stage-summary__title">' + esc(stage.name) + '</span>' +
              '<span class="badge badge--' + (stage.state === 'active' ? 'work' : stage.state) + '">' +
              esc(stage.stateLabel) + '</span></div>'
            );
          })
          .join('') +
        '</div></div>' +
        (isOwner()
          ? '<div class="admin-card"><div class="admin-card__head"><div><div class="eyebrow">Входящие</div>' +
            '<h3 class="admin-card__title">Последние заявки</h3></div></div><div class="admin-lead-summary">' +
            d.leads
              .map(function (lead) {
                var badge = lead.status === 'new' ? 'review' : lead.status === 'in_progress' ? 'work' : 'wait';
                return (
                  '<div class="admin-lead-summary__item"><div>' +
                  '<div class="admin-lead-summary__name">' + esc(lead.name) + '</div>' +
                  '<div class="label">' + esc(lead.contact) + '</div></div>' +
                  '<span class="badge badge--' + badge + '">' + esc(lead.statusLabel) + '</span></div>'
                );
              })
              .join('') +
            '</div></div>'
          : '') +
        '</div>'
      );
    }

    if (tab === 'projects') {
      return records(
        d.projects.map(function (item) {
          return {
            title: item.title,
            meta: item.code + ' · ' + item.client + ' · ' + item.stage,
            badge: item.status,
            badgeLabel: item.statusLabel,
          };
        })
      );
    }

    if (tab === 'finance') {
      return records(
        d.finance.payments.map(function (item) {
          return {
            title: item.purpose + ' — ' + item.amount,
            meta: item.due,
            badge: item.status === 'paid' ? 'done' : 'wait',
            badgeLabel: item.statusLabel,
          };
        })
      );
    }

    if (tab === 'members') {
      return records(
        d.teamUsers.map(function (item) {
          return { title: item.name, meta: item.login + ' · ' + item.role, badge: 'done', badgeLabel: item.state };
        })
      );
    }

    if (tab === 'stages') {
      return records(
        d.stages.map(function (item) {
          return {
            title: item.num + ' — ' + item.name,
            meta: 'Стадия проектирования',
            badge: item.state === 'active' ? 'work' : item.state,
            badgeLabel: item.stateLabel,
          };
        })
      );
    }

    if (tab === 'tasks') {
      return records(
        d.tasks.map(function (item) {
          return { title: item.title, meta: item.owner + ' · ' + item.due, badge: item.statusKey, badgeLabel: item.status };
        })
      );
    }

    if (tab === 'files') {
      var all = [];
      Object.keys(d.files).forEach(function (key) {
        d.files[key].forEach(function (file) {
          all.push({ title: file.name, meta: file.kind + ' · ' + file.meta, badge: file.statusKey, badgeLabel: file.status });
        });
      });
      return records(all);
    }

    return records(
      d.leads.map(function (item) {
        var badge = item.status === 'new' ? 'review' : item.status === 'in_progress' ? 'work' : 'wait';
        return { title: item.name, meta: item.contact, badge: badge, badgeLabel: item.statusLabel };
      })
    );
  }

  function records(items) {
    return (
      '<div class="admin-records">' +
      items
        .map(function (item) {
          return (
            '<div class="admin-record"><div class="admin-record__head">' +
            '<div class="admin-record__identity"><strong>' + esc(item.title) + '</strong>' +
            '<span>' + esc(item.meta) + '</span></div>' +
            '<span class="badge badge--' + item.badge + '">' + esc(item.badgeLabel) + '</span></div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function adminScreen() {
    var d = state.data;
    var tabs = adminTabs();
    if (!tabs.some(function (t) { return t.id === state.adminTab; })) state.adminTab = 'overview';
    var active = tabs.filter(function (t) { return t.id === state.adminTab; })[0];

    return (
      '<div class="admin-workspace"><header class="admin-hero"><div>' +
      '<div class="eyebrow">Управление проектом</div>' +
      '<h1 class="display admin-hero__title">' + esc(d.project.title) + '</h1>' +
      '<div class="admin-hero__meta"><span>' + esc(d.project.client) + '</span>' +
      '<span>' + esc(d.current.name) + '</span><span>до ' + esc(d.project.deadline) + '</span></div></div>' +
      '<div class="admin-hero__actions"><span class="badge badge--stage">' + esc(d.project.code) + '</span>' +
      '<button class="btn btn--outline btn--sm" type="button" data-go="project">Открыть кабинет</button></div></header>' +
      '<div class="admin-layout"><aside class="admin-sidebar" aria-label="Разделы админ-панели">' +
      '<div class="admin-sidebar__label">Рабочее пространство</div><div class="admin-tabs" role="tablist">' +
      tabs
        .map(function (tab, index) {
          return (
            '<button class="admin-tab' + (tab.id === state.adminTab ? ' is-active' : '') +
            '" type="button" role="tab" aria-selected="' + (tab.id === state.adminTab) +
            '" data-admin-tab="' + tab.id + '">' +
            '<span class="admin-tab__index">' + String(index + 1).padStart(2, '0') + '</span>' +
            '<span class="admin-tab__label">' + esc(tab.label) + '</span>' +
            (tab.count !== '' ? '<span class="admin-tab__count">' + tab.count + '</span>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</div></aside><div class="admin-content">' +
      '<div class="admin-demo" role="status"><span class="admin-demo__mark">DEMO</span>' +
      '<span>Демо-режим: данные вымышлены, формы работают как песочница и ничего не сохраняют.' +
      (isOwner() ? '' : ' Роль «Сотрудник» не видит проекты студии, финансы, команду и заявки.') +
      '</span></div>' +
      '<section class="admin-panel is-active" role="tabpanel"><div class="admin-panel__head"><div>' +
      '<div class="eyebrow">' + esc(active.label) + '</div>' +
      '<h2 class="display admin-panel__title">' + esc(active.id === 'overview' ? 'Состояние проекта' : active.label) + '</h2>' +
      '</div><span class="badge badge--work">' + esc(d.project.statusLabel) + '</span></div>' +
      adminPanelBody() +
      '</section></div></div></div>'
    );
  }

  /* ─── Сборка страницы ─── */

  function render() {
    if (state.screen === 'login') {
      app.innerHTML = loginScreen();
      document.body.classList.remove('has-tabbar');
    } else {
      var body =
        state.screen === 'project' ? projectScreen()
        : state.screen === 'finance' ? financeScreen()
        : state.screen === 'chats' ? chatsScreen()
        : adminScreen();
      app.innerHTML = header() + '<main>' + body + '</main>' + tabbar();
      document.body.classList.add('has-tabbar');
    }
    renderRoles();
    var feed = app.querySelector('[data-chat-feed]');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }

  function renderRoles() {
    var buttons = state.data.roles
      .map(function (role) {
        return (
          '<button type="button" class="demo-bar__role' + (role.id === state.role ? ' is-active' : '') +
          '" data-role="' + role.id + '">' + esc(role.label) + '</button>'
        );
      })
      .join('');
    roleSwitch.innerHTML = '<span class="demo-bar__roles-label">Смотреть как:</span>' + buttons;
  }

  /* ─── События ─── */

  document.addEventListener('click', function (event) {
    var role = event.target.closest('[data-role]');
    if (role) {
      state.role = role.getAttribute('data-role');
      state.chatId = null;
      if (state.screen !== 'login' && !NAV[state.role].some(function (i) { return i.key === state.screen; })) {
        state.screen = 'project';
      }
      render();
      return;
    }

    var go = event.target.closest('[data-go]');
    if (go) {
      var target = go.getAttribute('data-go');
      if (go.hasAttribute('data-chat-close')) state.chatId = null;
      state.screen = target;
      if (target === 'login') state.code = ['', '', '', '', '', ''];
      render();
      return;
    }

    var section = event.target.closest('[data-file-section]');
    if (section) {
      state.fileSection = section.getAttribute('data-file-section');
      render();
      return;
    }

    var chat = event.target.closest('[data-chat]');
    if (chat) {
      state.chatId = chat.getAttribute('data-chat');
      var opened = state.data.chats.filter(function (c) { return c.id === state.chatId; })[0];
      if (opened) opened.unread = 0;
      render();
      return;
    }

    var adminTab = event.target.closest('[data-admin-tab]');
    if (adminTab) {
      state.adminTab = adminTab.getAttribute('data-admin-tab');
      render();
    }
  });

  document.addEventListener('input', function (event) {
    var cell = event.target.closest('[data-code-cell]');
    if (!cell) return;
    var index = Number(cell.getAttribute('data-code-cell'));
    var digit = cell.value.replace(/\D/g, '').slice(0, 1);
    cell.value = digit;
    state.code[index] = digit;
    cell.classList.toggle('is-filled', Boolean(digit));
    if (digit) {
      var next = app.querySelector('[data-code-cell="' + (index + 1) + '"]');
      if (next) next.focus();
    }
  });

  document.addEventListener('submit', function (event) {
    if (event.target.matches('[data-login]')) {
      event.preventDefault();
      if (state.code.join('') === '486210') {
        state.loginError = '';
        state.screen = 'project';
      } else {
        state.loginError = 'Неверный код проекта. В демо подходит 486210.';
      }
      render();
      return;
    }

    var form = event.target.closest('[data-send]');
    if (!form) return;
    event.preventDefault();
    var field = form.querySelector('textarea');
    var text = field.value.trim();
    if (!text) return;
    var id = form.getAttribute('data-send');
    if (!state.sent[id]) state.sent[id] = [];
    state.sent[id].push({ author: currentRole().member, time: 'только что', body: text, own: true });
    field.value = '';
    render();
  });

  fetch('./data/mock.json')
    .then(function (response) { return response.json(); })
    .then(function (data) {
      state.data = data;
      render();
    })
    .catch(function () {
      app.innerHTML = '<section class="login"><div class="display login__title">Не удалось загрузить демо-данные</div></section>';
    });
})();
