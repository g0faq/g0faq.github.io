/* Демо PROTA: картотека проектов, карточка проекта с вкладками, комплектация
   и мессенджер в выезжающей панели. Разметка и классы повторяют исходник,
   данные — ./data/mock.json, состояние живёт только в памяти вкладки. */

(function () {
  'use strict';

  var app = document.getElementById('app');

  var state = {
    data: null,
    screen: 'projects',
    view: 'stack',
    openFolder: null,
    projectId: 'p1',
    tab: '',
    drawer: false,
    chatId: 'c1',
    chatPane: false,
    sent: {},
    procurementQuery: '',
    reactions: {},
  };

  var SECTIONS = [
    { key: 'projects', label: 'проекты', icon: 'folders', mobile: true },
    { key: 'calendar', label: 'календарь', icon: 'calendar', mobile: true, locked: true },
    { key: 'finance', label: 'финансы', icon: 'wallet', locked: true },
    { key: 'analytics', label: 'аналитика', icon: 'chart', locked: true },
    { key: 'team', label: 'команда', icon: 'users', locked: true },
    { key: 'contractors', label: 'подрядчики', icon: 'store', mobile: true, locked: true },
    { key: 'knowledge', label: 'база знаний', icon: 'book', locked: true },
    { key: 'mail', label: 'почта', icon: 'mail', mobile: true, locked: true },
  ];

  var PROJECT_TABS = [
    { segment: '', label: 'Обзор', icon: 'layout' },
    { segment: 'concept', label: 'Концепция', icon: 'layers', locked: true },
    { segment: 'files', label: 'Файлы', icon: 'folder', locked: true },
    { segment: 'procurement', label: 'Комплектация', icon: 'cart' },
    { segment: 'tz', label: 'ТЗ подрядчикам', icon: 'ruler', locked: true },
    { segment: 'calendar', label: 'Календарь', icon: 'calendar', locked: true },
    { segment: 'finance', label: 'Финансы', icon: 'wallet', locked: true },
    { segment: 'analytics', label: 'Аналитика', icon: 'chart', locked: true },
  ];

  var LOCK_NOTE = 'в демо не открывается';

  var PATHS = {
    folders: '<path d="M3 7.5h6l1.6 2H21v9.5H3z"/><path d="M3 7.5V5h5l1.5 2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="1"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>',
    wallet: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M16 12h4"/>',
    chart: '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.4c2 .8 3.5 2.4 3.5 4.6"/>',
    store: '<path d="M4 9h16v11H4z"/><path d="M3 9l1.5-5h15L21 9"/><path d="M9 20v-5h6v5"/>',
    book: '<path d="M5 4h13v16H5z"/><path d="M8 4v16"/>',
    mail: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3.6 7l8.4 6 8.4-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    note: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h5"/>',
    bell: '<path d="M18 15V10a6 6 0 1 0-12 0v5l-2 3h16z"/><path d="M10 21h4"/>',
    message: '<path d="M4 5h16v11H9l-5 3z"/>',
    layout: '<rect x="3.5" y="4.5" width="17" height="15"/><path d="M9.5 4.5v15M9.5 11h11"/>',
    layers: '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',
    folder: '<path d="M3 6h6l2 2.5h10V19H3z"/>',
    cart: '<circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/><path d="M3 4h2.5l2.5 11h10l2-8H6"/>',
    ruler: '<rect x="2.5" y="8" width="19" height="8" rx="1"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    replace: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    send: '<path d="M12 19.5V5M6 11l6-6 6 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
  };

  function icon(name, size) {
    return (
      '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
      '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || PATHS.folder) + '</svg>'
    );
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function project() {
    return state.data.projects.filter(function (item) { return item.id === state.projectId; })[0];
  }

  function unreadChats() {
    return state.data.chats.reduce(function (sum, chat) { return sum + chat.unread; }, 0);
  }

  function avatars(team, size) {
    return (
      '<span class="ui-stack">' +
      team
        .map(function (person) {
          return (
            '<span class="ui-avatar" style="background:' + esc(person.color) +
            (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '">' +
            esc(person.initials) + '</span>'
          );
        })
        .join('') +
      '</span>'
    );
  }

  /* ─── Каркас ─── */

  function shell(content) {
    var d = state.data;

    var rail = SECTIONS.map(function (item) {
      return (
        '<button class="sh-railItem" type="button" data-section="' + item.key + '"' +
        (item.locked ? ' data-locked="true"' : '') +
        ' data-active="' + (!item.locked && state.screen === 'projects' && item.key === 'projects') + '">' +
        icon(item.icon, 19) +
        '<span class="sh-tip">' + esc(item.label) +
        (item.locked ? '<span class="sh-tipNote">' + LOCK_NOTE + '</span>' : '') +
        '</span></button>'
      );
    }).join('');

    var mobile = SECTIONS.filter(function (item) { return item.mobile; })
      .map(function (item) {
        return (
          '<button class="sh-mobileItem" type="button" data-section="' + item.key + '"' +
          (item.locked ? ' data-locked="true"' : '') +
          ' data-active="' + (!item.locked && item.key === 'projects' && state.screen === 'projects') + '">' +
          '<span class="sh-mobileMark"></span>' + icon(item.icon, 20) + esc(item.label) + '</button>'
        );
      })
      .join('') +
      '<button class="sh-mobileItem" type="button" data-drawer="1"><span class="sh-mobileMark"></span>' +
      icon('message', 20) + 'чаты</button>';

    return (
      '<div class="sh-app"><header class="sh-top">' +
      '<button class="sh-brand" type="button" data-section="projects">' +
      '<span class="hm-tab" style="height:22px"></span>' +
      '<span class="sh-brandText"><span class="sh-brandName">PROTA</span>' +
      '<span class="sh-brandSub">' + esc(d.studio) + '</span></span></button>' +

      '<div class="sh-topRight">' +
      '<span class="sh-calChip">' + icon('calendar', 15) + esc(d.nextEvent.day) + ' · ' + esc(d.nextEvent.title) + '</span>' +
      '<span class="sh-tnav sh-add" title="Создать">' + icon('plus', 20) + '</span>' +
      '<span class="sh-sep"></span>' +
      '<span class="sh-tnav" title="Почта">' + icon('mail', 20) + '</span>' +
      '<span class="sh-tnav" title="Заметки">' + icon('note', 20) + '</span>' +
      '<span class="sh-tnav" title="Уведомления">' + icon('bell', 20) + '<span class="sh-dot"></span></span>' +
      '<button class="sh-tnav" type="button" data-drawer="1" title="Мессенджер">' + icon('message', 20) +
      (unreadChats() ? '<span class="sh-dot"></span>' : '') + '</button>' +
      '<span class="sh-avatar" title="' + esc(d.user.name) + ' · ' + esc(d.user.roleLabel) + '">' +
      esc(d.user.initials) + '</span>' +
      '</div></header>' +

      '<div class="sh-body"><nav class="sh-rail" aria-label="Разделы">' + rail + '</nav>' +
      '<main class="sh-main">' + content + '</main></div>' +
      '<nav class="sh-mobileNav" aria-label="Разделы">' + mobile + '</nav>' +
      drawer() +
      '</div>'
    );
  }

  /* ─── Экран проектов ─── */

  function projectsScreen() {
    var d = state.data;

    var summary =
      '<div class="hm-summary">' +
      '<div class="hm-col"><div class="hm-accent"></div>' +
      '<div class="ov-cardTitle">Студия сегодня</div>' +
      '<div class="hm-kpi"><span class="hm-kpiValue">' + d.kpi.value + '</span>' +
      '<span class="hm-kpiNote">' + esc(d.kpi.note) + '</span></div>' +
      '<div class="hm-tiles">' +
      '<span class="hm-tile"><span>В работе</span><span class="hm-tileValue">' + esc(d.kpi.revenue) + '</span></span>' +
      '<span class="hm-tile"><span>Внимание</span><span class="hm-tileValue">' + esc(d.kpi.overdue) + '</span></span>' +
      '</div></div>' +

      '<div class="hm-col"><div class="ov-cardTitle">Сегодня</div>' +
      '<div class="hm-date">' + esc(d.today) + '</div>' +
      d.agenda
        .map(function (item) {
          return (
            '<div class="hm-row"><span class="hm-rowTime">' + esc(item.time) + '</span>' +
            '<span class="hm-rowText">' + esc(item.text) +
            '<span class="hm-rowMeta">' + esc(item.meta) + '</span></span>' +
            '<span class="hm-rowRight tertiary">' + esc(item.right) + '</span></div>'
          );
        })
        .join('') +
      '</div>' +

      '<div class="hm-col"><div class="ov-cardTitle">Загрузка команды</div>' +
      d.workload
        .map(function (item) {
          var warn = item.value >= 85;
          return (
            '<div class="hm-workRow"><span class="hm-workName">' + esc(item.name) + '</span>' +
            '<span class="hm-workBar"><span class="ui-bar" style="display:block">' +
            '<span class="ui-barFill' + (warn ? ' ui-barFill--warn' : '') +
            '" style="display:block;width:' + item.value + '%"></span></span></span>' +
            '<span class="mono tertiary">' + item.value + '%</span></div>'
          );
        })
        .join('') +
      '</div>' +

      '<div class="hm-col"><div class="ov-cardTitle">Ближайшее</div>' +
      '<div class="hm-tiles" style="margin-top:12px">' +
      '<span class="hm-tile"><span>Акты</span><span class="hm-tileValue">' + esc(d.kpi.acts) + '</span></span>' +
      '<span class="hm-tile"><span>Событие</span><span class="hm-tileValue">' + esc(d.nextEvent.day) + '</span></span>' +
      '</div></div></div>';

    var VIEWS = [
      { id: 'stack', label: 'Картотека', icon: 'folders', hint: 'Нажмите на папку, чтобы раскрыть проект; оранжевый ярлык — есть просрочка' },
      { id: 'list', label: 'Список', icon: 'layout', hint: 'Сортировка по дате создания' },
      { id: 'cards', label: 'Карточки', icon: 'layers', hint: 'Обзор проектов плитками' },
    ];
    var hint = VIEWS.filter(function (v) { return v.id === state.view; })[0].hint;

    var head =
      '<div class="hm-listHead"><h2>Проекты</h2><div class="ui-seg">' +
      VIEWS.map(function (item) {
        return (
          '<button class="ui-segBtn" type="button" data-view="' + item.id +
          '" data-on="' + (state.view === item.id) + '">' + icon(item.icon, 15) +
          '<span>' + esc(item.label) + '</span></button>'
        );
      }).join('') +
      '</div></div><div class="hm-hint">' + esc(hint) + '</div>';

    return '<div class="sh-page">' + summary + head + listBody() + '</div>';
  }

  function listBody() {
    var projects = state.data.projects;

    if (state.view === 'stack') {
      return (
        '<div class="hm-stack">' +
        projects
          .map(function (item) {
            var open = state.openFolder === item.id;
            var steps = '';
            for (var i = 1; i <= item.stagesTotal; i += 1) {
              steps +=
                '<span class="hm-step' +
                (i < item.stageIndex ? ' hm-step--done' : i === item.stageIndex ? ' hm-step--current' : '') +
                '"></span>';
            }
            return (
              '<div class="hm-folder"><button class="hm-folderStrip" type="button" data-folder="' + item.id +
              '" aria-expanded="' + open + '">' +
              '<span class="hm-tab' + (item.hasAlert ? ' hm-tab--alert' : '') + '"></span>' +
              '<span class="hm-folderTitle">' + esc(item.title) + '</span>' +
              '<span class="hm-folderNum">' + esc(item.code) + '</span>' +
              '<span class="hm-folderMeta">' + esc(item.objectType) + ' · ' + esc(item.area) + ' · ' + esc(item.city) + '</span>' +
              '<span class="hm-steps" title="' + esc(item.stageName) + ' · этап ' + item.stageIndex + ' из ' + item.stagesTotal + '">' +
              steps + '</span>' + icon(open ? 'up' : 'down', 16) + '</button>' +
              (open
                ? '<div class="hm-folderBody">' +
                  fact('Заказчик', item.client) +
                  fact('Этап', item.stageName + ' · ' + item.stageIndex + ' из ' + item.stagesTotal) +
                  fact('Бюджет', item.budget) +
                  fact('Сроки', item.start + ' → ' + item.end) +
                  fact('Осталось', item.daysLeft === null ? '—' : item.daysLeft + ' дн.', item.daysLeft !== null && item.daysLeft < 20) +
                  '<div class="hm-fact"><div class="hm-factLabel">Команда</div>' + avatars(item.team) + '</div>' +
                  '</div><div class="hm-folderFoot">' +
                  '<button class="ui-btn ui-btn--dark" type="button" data-project="' + item.id + '">' +
                  'Открыть проект' + icon('arrow', 15) + '</button></div>'
                : '') +
              '</div>'
            );
          })
          .join('') +
        '</div>'
      );
    }

    if (state.view === 'list') {
      return (
        '<div class="hm-table"><div class="hm-tableHead">' +
        '<span>№</span><span>Проект</span><span>Объект</span><span>Заказчик</span>' +
        '<span>Этап</span><span>Бюджет</span><span>Срок</span></div>' +
        projects
          .map(function (item) {
            return (
              '<button class="hm-tableRow" type="button" data-project="' + item.id + '">' +
              '<span class="mono tertiary">' + esc(item.code) + '</span>' +
              '<span class="hm-cellTitle">' + esc(item.title) + '</span>' +
              '<span class="muted">' + esc(item.objectType) + ' · ' + esc(item.area) + ' · ' + esc(item.city) + '</span>' +
              '<span class="muted">' + esc(item.client) + '</span>' +
              '<span>' + esc(item.stageName) + '</span>' +
              '<span class="mono">' + esc(item.budget) + '</span>' +
              '<span class="mono"' + (item.daysLeft !== null && item.daysLeft < 20 ? ' style="color:var(--orange)"' : '') + '>' +
              (item.daysLeft === null ? '—' : item.daysLeft + ' дн.') + '</span></button>'
            );
          })
          .join('') +
        '</div>'
      );
    }

    return (
      '<div class="hm-grid">' +
      projects
        .map(function (item) {
          return (
            '<button class="hm-pcard" type="button" data-project="' + item.id + '">' +
            '<span class="hm-pcardTop"><span><span class="hm-folderTitle">' + esc(item.title) + '</span>' +
            '<span class="tertiary mono" style="display:block;font-size:var(--fs-11)">' + esc(item.code) + '</span></span>' +
            '<span class="ui-badge ' + (item.status === 'done' ? 'ui-badge--muted' : 'ui-badge--accent') + '">' +
            esc(item.statusLabel) + '</span></span>' +
            '<span class="muted" style="font-size:var(--fs-12)">' + esc(item.objectType) + ' · ' + esc(item.area) +
            '<br>' + esc(item.city) + '</span>' +
            '<span style="font-size:var(--fs-12)">' + esc(item.stageName) + ' · этап ' + item.stageIndex +
            ' из ' + item.stagesTotal + '</span>' +
            '<span class="hm-pcardFoot">' + avatars(item.team, 22) +
            '<span class="mono" style="font-size:var(--fs-12);font-weight:600">' + esc(item.budget) + '</span></span>' +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function fact(label, value, warn) {
    return (
      '<div class="hm-fact"><div class="hm-factLabel">' + esc(label) + '</div>' +
      '<div class="hm-factValue' + (warn ? ' hm-factValue--warn' : '') + '">' + esc(value) + '</div></div>'
    );
  }

  /* ─── Карточка проекта ─── */

  function projectScreen() {
    var p = project();

    var tabs = PROJECT_TABS.map(function (tab) {
      if (tab.locked) {
        return (
          '<span class="ph-tab" data-locked="true">' + icon(tab.icon, 15) + esc(tab.label) +
          '<span class="ph-tabNote">' + LOCK_NOTE + '</span></span>'
        );
      }
      return (
        '<button class="ph-tab' + (state.tab === tab.segment ? ' ph-tab--on' : '') +
        '" type="button" data-tab="' + tab.segment + '">' + icon(tab.icon, 15) + esc(tab.label) + '</button>'
      );
    }).join('');

    var head =
      '<div class="ph-head"><div class="ph-crumbs">' +
      '<button type="button" data-section="projects">проекты</button><span>/</span>' +
      '<span>' + esc(p.title) + '</span></div>' +
      '<div class="ph-titleRow"><span class="ph-accent"></span><div>' +
      '<div class="ph-titleLine"><h1>' + esc(p.title) + '</h1>' +
      '<span class="ph-code">' + esc(p.code) + '</span>' +
      '<span class="ui-badge ui-badge--accent">' + esc(p.statusLabel) + '</span></div>' +
      '<div class="ph-sub">' + esc(p.objectType) + ' · ' + esc(p.area) + ' · ' + esc(p.city) +
      ' · этап ' + p.stageIndex + ' из ' + p.stagesTotal + ' — ' + esc(p.stageName) + '</div>' +
      '</div></div><nav class="ph-tabs" aria-label="Разделы проекта">' + tabs + '</nav></div>';

    return head + '<div class="sh-page">' + (state.tab === 'procurement' ? procurementTab() : overviewTab()) + '</div>';
  }

  function overviewTab() {
    var p = project();
    var o = state.data.overview;

    var client =
      '<section class="ov-card"><div class="ov-cardHead"><span class="ov-cardTitle">Заказчик</span></div>' +
      '<div class="ov-clientRow"><span class="ui-avatar" style="background:var(--ink);width:34px;height:34px;font-size:var(--fs-12)">' +
      esc(p.client.slice(0, 1)) + '</span><span><span class="ov-clientName">' + esc(p.client) + '</span>' +
      '<span class="ov-clientContact" style="display:block">' + esc(p.clientContact) + '</span></span></div>' +
      '<div class="ov-block"><div class="ov-blockLabel">Договор</div>' +
      '<div class="ov-note">Бюджет ' + esc(p.budget) + ' · сроки ' + esc(p.start) + ' → ' + esc(p.end) + '</div></div>' +
      '<div class="ov-block"><div class="ov-blockLabel">Команда</div>' + avatars(p.team) + '</div></section>';

    var stages =
      '<section class="ov-card ov-wide"><div class="ov-cardHead"><span class="ov-cardTitle">Этапы проекта</span>' +
      '<span class="ui-badge ui-badge--neutral">этап ' + p.stageIndex + ' из ' + p.stagesTotal + '</span></div>' +
      '<div class="ov-stages">' +
      o.stages
        .map(function (stage) {
          return (
            '<div class="ov-stage"><div class="ov-stageBar' +
            (stage.state === 'done' ? ' ov-stageBar--done' : stage.state === 'current' ? ' ov-stageBar--current' : '') +
            '"></div><div class="ov-stageName">' + esc(stage.name) + '</div>' +
            '<div class="ov-stageState">' + esc(stage.label) + '</div></div>'
          );
        })
        .join('') +
      '</div><div class="ov-facts">' +
      fact('Бюджет', p.budget) + fact('Начало', p.start) + fact('Сдача', p.end) +
      fact('Осталось', p.daysLeft === null ? '—' : p.daysLeft + ' дн.', p.daysLeft !== null && p.daysLeft < 20) +
      '</div></section>';

    var tasks =
      '<section class="ov-card"><div class="ov-cardHead"><span class="ov-cardTitle">Задачи</span>' +
      '<span class="ui-badge ui-badge--muted">' +
      o.tasks.filter(function (t) { return !t.done; }).length + ' открыто</span></div>' +
      o.tasks
        .map(function (task, index) {
          return (
            '<button class="ov-task' + (task.done ? ' ov-task--done' : '') + '" type="button" data-task="' + index + '">' +
            '<span class="ov-taskBox' + (task.done ? ' ov-taskBox--done' : '') + '">' + icon('check', 12) + '</span>' +
            '<span class="ov-taskText">' + esc(task.title) +
            '<span class="ov-taskMeta' + (task.overdue && !task.done ? ' ov-taskOverdue' : '') + '">' +
            esc(task.meta) + (task.overdue && !task.done ? ' · просрочено' : '') + '</span></span></button>'
          );
        })
        .join('') +
      '</section>';

    var inputs =
      '<section class="ov-card"><div class="ov-cardHead"><span class="ov-cardTitle">Исходные данные</span>' +
      '<span class="ui-badge ui-badge--warn">' +
      o.inputs.filter(function (i) { return i.missing; }).length + ' не хватает</span></div>' +
      '<div class="ov-tiles">' +
      o.inputs
        .map(function (item) {
          return (
            '<div class="ov-tile' + (item.missing ? ' ov-tile--missing' : '') + '">' +
            '<span class="ov-tileName">' + esc(item.name) + '</span>' +
            '<span class="ov-tileMeta">' + esc(item.meta) + '</span></div>'
          );
        })
        .join('') +
      '</div></section>';

    var activity =
      '<section class="ov-card"><div class="ov-cardHead"><span class="ov-cardTitle">Лента изменений</span></div>' +
      o.activity
        .map(function (item) {
          return (
            '<div class="ov-activity"><span class="ov-activityText">' + esc(item.text) +
            '<span class="ov-activityTime">' + esc(item.time) + '</span></span></div>'
          );
        })
        .join('') +
      '</section>';

    return '<div class="ov-grid">' + stages + client + tasks + inputs + activity + '</div>';
  }

  function procurementTab() {
    var pr = state.data.procurement;
    var query = state.procurementQuery.trim().toLowerCase();

    var summary =
      '<div class="pr-summary">' +
      pr.summary
        .map(function (cell) {
          return (
            '<div class="pr-sumCell"><div class="pr-sumLabel">' + esc(cell.label) + '</div>' +
            '<div class="pr-sumValue' + (cell.over ? ' pr-sumOver' : '') + '">' + esc(cell.value) + '</div></div>'
          );
        })
        .join('') +
      '</div>';

    var toolbar =
      '<div class="pr-toolbar"><div class="pr-toolGroup">' +
      '<label class="ui-field pr-search">' + icon('search', 15) +
      '<input class="ui-fieldInput" type="search" placeholder="Поиск по позициям" ' +
      'value="' + esc(state.procurementQuery) + '" data-procurement-search aria-label="Поиск по позициям"></label>' +
      '</div><div class="pr-toolGroup"><span class="ui-btn">' + icon('plus', 15) + 'Позиция</span>' +
      '<span class="ui-btn">Экспорт</span></div></div>';

    var totalCount = 0;
    var rooms = pr.rooms
      .map(function (room) {
        var items = room.items.filter(function (item) {
          return !query || (item.name + ' ' + item.article).toLowerCase().indexOf(query) !== -1;
        });
        if (!items.length) return '';
        totalCount += items.length;
        return (
          '<div class="pr-roomHead"><span>' + esc(room.name) + '</span>' +
          '<span class="pr-roomCount">' + items.length + ' позиций</span></div>' +
          items
            .map(function (item) {
              var key = room.name + '/' + item.name;
              var reaction = state.reactions[key] || item.reaction;
              return (
                '<div class="pr-row">' +
                '<span class="pr-cell">' + icon('cart', 16) + '</span>' +
                '<span class="pr-cell pr-itemName">' + esc(item.name) +
                '<span class="pr-itemArticle">' + esc(item.article) + '</span></span>' +
                '<span class="pr-cell muted" data-label="Поставщик">' + esc(item.supplier) + '</span>' +
                '<span class="pr-cell pr-price" data-label="Цена">' + esc(item.price) + '</span>' +
                '<span class="pr-cell pr-qty" data-label="Кол-во">' + item.qty + '</span>' +
                '<span class="pr-cell" data-label="Статус"><span class="ui-badge ' +
                (item.status === 'Согласовано' ? 'ui-badge--ok' : item.status === 'Заменить' ? 'ui-badge--warn' : 'ui-badge--muted') +
                '">' + esc(item.status) + '</span></span>' +
                '<span class="pr-cell pr-reaction">' +
                '<button class="pr-reactBtn' + (reaction === 'ok' ? ' pr-reactOk' : '') +
                '" type="button" data-react="ok" data-key="' + esc(key) + '" title="Согласовать">' + icon('check', 15) + '</button>' +
                '<button class="pr-reactBtn' + (reaction === 'replace' ? ' pr-reactReplace' : '') +
                '" type="button" data-react="replace" data-key="' + esc(key) + '" title="Заменить">' + icon('replace', 15) + '</button>' +
                '</span></div>'
              );
            })
            .join('')
        );
      })
      .join('');

    return (
      summary + toolbar +
      '<div class="pr-table"><div class="pr-head"><span></span><span>Позиция</span><span>Поставщик</span>' +
      '<span>Цена</span><span>Кол-во</span><span>Статус</span><span>Реакция</span></div>' +
      (rooms || '<div class="pr-row"><span></span><span class="muted">Ничего не найдено</span></div>') +
      '<div class="pr-total"><span>Позиций: ' + totalCount + '</span><span>Итого: 742 300 ₽</span></div></div>' +
      '<div class="pr-legend"><span>' + icon('check', 14) + ' согласовано заказчиком</span>' +
      '<span>' + icon('replace', 14) + ' просит заменить</span>' +
      '<span>реакции в демо переключаются и живут до перезагрузки страницы</span></div>'
    );
  }

  /* ─── Мессенджер ─── */

  function drawer() {
    var chats = state.data.chats;
    var selected = chats.filter(function (chat) { return chat.id === state.chatId; })[0];
    var messages = selected.messages.concat(state.sent[selected.id] || []);

    return (
      '<div class="dr-scrim' + (state.drawer ? ' dr-scrim--open' : '') + '" data-drawer-close="1"></div>' +
      '<aside class="dr-drawer' + (state.drawer ? ' dr-drawer--open' : '') + '" aria-hidden="' + !state.drawer + '">' +
      '<div class="dr-head">' + icon('message', 18) + '<span class="dr-title">Мессенджер</span>' +
      '<button class="dr-close" type="button" data-drawer-close="1" aria-label="Закрыть">' + icon('close', 18) + '</button></div>' +

      '<div class="ch-wrap">' +
      '<div class="ch-list' + (state.chatPane ? ' ch-list--hidden' : '') + '">' +
      '<div class="ch-search">' + icon('search', 14) +
      '<input class="ch-searchInput" type="search" placeholder="Поиск" aria-label="Поиск по чатам"></div>' +
      '<div class="ch-chats">' +
      chats
        .map(function (chat) {
          var last = (state.sent[chat.id] || []).slice(-1)[0] || chat.messages[chat.messages.length - 1];
          return (
            '<button class="ch-chat' + (chat.id === state.chatId ? ' ch-chat--on' : '') +
            '" type="button" data-chat="' + chat.id + '">' +
            '<span class="ch-ava" style="background:' + esc(chat.color) + '">' + esc(chat.initials) + '</span>' +
            '<span class="ch-text"><span class="ch-name">' + esc(chat.name) + '</span>' +
            '<span class="ch-last">' + esc(last.author + ': ' + last.body) + '</span></span>' +
            (chat.unread ? '<span class="ch-badge">' + chat.unread + '</span>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</div></div>' +

      '<div class="ch-pane' + (state.chatPane ? '' : ' ch-pane--hidden') + '" data-pane>' +
      '<div class="ch-paneHead">' +
      '<button class="dr-close" type="button" data-chat-back="1" aria-label="К списку">' + icon('back', 16) + '</button>' +
      '<span><span class="ch-paneName">' + esc(selected.name) + '</span>' +
      '<span class="ch-paneSub" style="display:block">' + esc(selected.sub) + '</span></span></div>' +
      '<div class="ch-feed" data-feed>' +
      messages
        .map(function (message) {
          return (
            '<div class="ch-msg' + (message.mine ? ' ch-msg--mine' : '') + '">' +
            '<span class="ch-msgAuthor">' + esc(message.author) + '</span>' +
            '<span class="ch-bubble' + (message.mine ? ' ch-bubble--mine' : '') + '">' + esc(message.body) + '</span>' +
            '<span class="ch-msgTime">' + esc(message.time) + '</span></div>'
          );
        })
        .join('') +
      '</div>' +
      '<form class="ch-composer" data-send>' +
      '<label class="sr-only" for="chat-field">Сообщение</label>' +
      '<textarea class="ch-field" id="chat-field" rows="1" placeholder="Написать сообщение"></textarea>' +
      '<button class="ch-send" type="submit" aria-label="Отправить">' + icon('send', 18) + '</button>' +
      '</form></div></div></aside>'
    );
  }

  /* ─── Отрисовка и события ─── */

  function render() {
    var body = state.screen === 'projects' ? projectsScreen() : projectScreen();
    app.innerHTML = shell(body);
    var feed = app.querySelector('[data-feed]');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }

  document.addEventListener('click', function (event) {
    var el;

    el = event.target.closest('[data-drawer]');
    if (el) {
      state.drawer = true;
      state.chatPane = window.innerWidth > 860;
      render();
      return;
    }

    el = event.target.closest('[data-drawer-close]');
    if (el) { state.drawer = false; render(); return; }

    el = event.target.closest('[data-chat-back]');
    if (el) { state.chatPane = false; render(); return; }

    el = event.target.closest('[data-chat]');
    if (el) {
      state.chatId = el.getAttribute('data-chat');
      state.chatPane = true;
      var chat = state.data.chats.filter(function (c) { return c.id === state.chatId; })[0];
      if (chat) chat.unread = 0;
      render();
      return;
    }

    el = event.target.closest('[data-section]');
    if (el) {
      if (el.getAttribute('data-locked') === 'true') return;
      state.screen = 'projects';
      render();
      return;
    }

    el = event.target.closest('[data-view]');
    if (el) { state.view = el.getAttribute('data-view'); render(); return; }

    el = event.target.closest('[data-folder]');
    if (el) {
      var id = el.getAttribute('data-folder');
      state.openFolder = state.openFolder === id ? null : id;
      render();
      return;
    }

    el = event.target.closest('[data-project]');
    if (el) {
      state.projectId = el.getAttribute('data-project');
      state.screen = 'project';
      state.tab = '';
      render();
      return;
    }

    el = event.target.closest('[data-tab]');
    if (el) { state.tab = el.getAttribute('data-tab'); render(); return; }

    el = event.target.closest('[data-task]');
    if (el) {
      var task = state.data.overview.tasks[Number(el.getAttribute('data-task'))];
      task.done = !task.done;
      render();
      return;
    }

    el = event.target.closest('[data-react]');
    if (el) {
      var key = el.getAttribute('data-key');
      var value = el.getAttribute('data-react');
      state.reactions[key] = state.reactions[key] === value ? 'none' : value;
      render();
    }
  });

  document.addEventListener('input', function (event) {
    if (!event.target.matches('[data-procurement-search]')) return;
    state.procurementQuery = event.target.value;
    render();
    var field = app.querySelector('[data-procurement-search]');
    if (field) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  });

  document.addEventListener('submit', function (event) {
    if (!event.target.closest('[data-send]')) return;
    event.preventDefault();
    var field = event.target.querySelector('textarea');
    var text = field.value.trim();
    if (!text) return;
    if (!state.sent[state.chatId]) state.sent[state.chatId] = [];
    state.sent[state.chatId].push({
      author: state.data.user.name,
      time: 'только что',
      body: text,
      mine: true,
    });
    render();
  });

  fetch('./data/mock.json')
    .then(function (response) { return response.json(); })
    .then(function (data) {
      state.data = data;
      render();
    })
    .catch(function () {
      app.innerHTML = '<div class="sh-page"><h1>Не удалось загрузить демо-данные</h1></div>';
    });
})();
