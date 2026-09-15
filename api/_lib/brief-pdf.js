'use strict';

const path = require('node:path');
const PDFDocument = require('pdfkit');
const { answerText } = require('./brief-engine');

/* PDF-отчёт по опросу — только для владельца: черновик ТЗ, ответы клиента,
 * контакты и показанные клиенту кейсы. Шрифт Fira Sans (OFL) лежит рядом,
 * потому что встроенные шрифты PDF кириллицу не умеют. */

const FONT_REGULAR = path.join(__dirname, '..', '_fonts', 'FiraSans-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '..', '_fonts', 'FiraSans-SemiBold.ttf');

const COLOR = {
  ink: '#111418',
  muted: '#6c757f',
  line: '#d9dde2',
  accent: '#ff4105',
  soft: '#f4f5f7',
};

const MSK = { timeZone: 'Europe/Moscow' };
const dateTime = (value) => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', ...MSK,
}).format(value ? new Date(value) : new Date());

const COMPLEXITY = {
  S: 'S — небольшой проект, до 2 недель',
  M: 'M — средний, 2–6 недель',
  L: 'L — крупный, 1,5–3 месяца',
  XL: 'XL — большой, дольше 3 месяцев',
};

function buildReport(brief) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 64, left: 56, right: 56 },
      bufferPages: true,
      info: { Title: `Бриф: ${brief.title || 'проект'}`, Author: 'g0_faq', Creator: 'g0_faq brief' },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('regular', FONT_REGULAR);
    doc.registerFont('bold', FONT_BOLD);

    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    const ensureSpace = (height) => {
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };

    const heading = (text) => {
      ensureSpace(60);
      doc.moveDown(0.9);
      const y = doc.y;
      doc.rect(left, y + 3, 4, 14).fill(COLOR.accent);
      doc.fillColor(COLOR.ink).font('bold').fontSize(14).text(text, left + 14, y, { width: width - 14 });
      doc.moveDown(0.5);
      doc.x = left;
    };

    const label = (text) => {
      ensureSpace(34);
      doc.moveDown(0.35);
      doc.fillColor(COLOR.muted).font('bold').fontSize(8.5)
        .text(text.toUpperCase(), left, doc.y, { width, characterSpacing: 0.6 });
      doc.moveDown(0.15);
    };

    const paragraph = (text) => {
      if (!text) return;
      doc.fillColor(COLOR.ink).font('regular').fontSize(10.5)
        .text(text, left, doc.y, { width, lineGap: 2.5 });
    };

    const bullets = (items) => {
      const list = (items || []).filter(Boolean);
      if (!list.length) { paragraph('—'); return; }
      list.forEach((item) => {
        ensureSpace(18);
        const y = doc.y;
        doc.rect(left + 1, y + 5.5, 3.5, 3.5).fill(COLOR.accent);
        doc.fillColor(COLOR.ink).font('regular').fontSize(10.5)
          .text(item, left + 14, y, { width: width - 14, lineGap: 2 });
        doc.moveDown(0.15);
      });
      doc.x = left;
    };

    /* ── Шапка ── */
    doc.fillColor(COLOR.accent).font('bold').fontSize(9)
      .text('G0_FAQ · БРИФ ПРОЕКТА', left, doc.y, { characterSpacing: 1 });
    doc.moveDown(0.4);
    doc.fillColor(COLOR.ink).font('bold').fontSize(22)
      .text(brief.draft?.project_title || brief.title || 'Проект без названия', { width });
    doc.moveDown(0.6);

    const answered = (brief.steps || []).filter((step) => step.answer);
    const meta = [
      ['Источник', brief.mode === 'owner' ? `Персональная ссылка${brief.title ? ` · «${brief.title}»` : ''}` : 'Сайт · «Помощь с ТЗ»'],
      ['Заполнен', dateTime(brief.completed_at)],
      ['Клиент', brief.client_name || 'не указал'],
      ['Контакт', brief.client_contact ? `${brief.client_contact_channel ? `${brief.client_contact_channel}: ` : ''}${brief.client_contact}` : 'не указал'],
      ['Ответов', String(answered.length)],
    ];
    if (brief.draft?.complexity) meta.push(['Сложность', COMPLEXITY[brief.draft.complexity] || brief.draft.complexity]);
    if (brief.estimate?.min) {
      const money = (value) => new Intl.NumberFormat('ru-RU').format(value);
      meta.push(['Оценка', `${money(brief.estimate.min)}–${money(brief.estimate.max)} ₽ (примерно)`]);
    }

    const metaTop = doc.y;
    const rowHeight = 19;
    doc.rect(left, metaTop, width, meta.length * rowHeight + 14).fill(COLOR.soft);
    meta.forEach(([key, value], index) => {
      const y = metaTop + 8 + index * rowHeight;
      doc.fillColor(COLOR.muted).font('regular').fontSize(9.5).text(key, left + 12, y, { width: 90 });
      doc.fillColor(COLOR.ink).font('bold').fontSize(9.5).text(value, left + 104, y, { width: width - 116, height: rowHeight, ellipsis: true });
    });
    doc.y = metaTop + meta.length * rowHeight + 14;
    doc.x = left;

    /* ── Черновик ТЗ ── */
    const d = brief.draft;
    if (d) {
      heading('Черновик технического задания');
      doc.fillColor(COLOR.muted).font('regular').fontSize(9)
        .text('Собран ИИ по ответам клиента. Только для вас — перед отправкой клиенту проверьте и доработайте.', { width });
      label('Суть проекта'); paragraph(d.summary);
      label('Цели'); bullets(d.goals);
      label('Аудитория'); paragraph(d.audience);

      heading('Роли и права');
      (d.roles || []).forEach((role) => { label(role.name); bullets(role.permissions); });

      heading('Пользовательские сценарии');
      bullets(d.user_scenarios);

      heading('Функциональные требования');
      (d.modules || []).forEach((module) => { label(module.name); bullets(module.requirements); });

      heading('Страницы и экраны');
      bullets(d.pages_screens);

      heading('Интеграции и уведомления');
      label('Интеграции'); bullets(d.integrations);
      label('Уведомления'); bullets(d.notifications);

      heading('Контент и дизайн');
      label('Контент'); paragraph(d.content);
      label('Дизайн'); paragraph(d.design);

      heading('Нефункциональные требования');
      bullets(d.non_functional);

      heading('Этапы работ');
      bullets((d.stages || []).map((stage) => `${stage.name} — ${stage.result}`));

      heading('Критерии приёмки');
      bullets(d.acceptance_criteria);

      heading('Принятые решения');
      bullets(d.assumptions);

      heading('Сроки, бюджет, риски');
      label('Сроки'); paragraph(d.timeline);
      label('Бюджет'); paragraph(d.budget);
      label('Не входит в первую версию'); bullets(d.scope_later);
      label('Риски'); bullets(d.risks);
    } else {
      heading('Черновик технического задания');
      paragraph('Черновик не сформирован: ИИ был недоступен в момент завершения опроса. Ниже — все ответы клиента без обработки.');
    }

    /* ── Ответы ── */
    heading('Ответы клиента');
    answered.forEach((step, index) => {
      ensureSpace(46);
      doc.moveDown(0.3);
      doc.fillColor(COLOR.muted).font('bold').fontSize(8.5)
        .text(`${String(index + 1).padStart(2, '0')} · ${step.question.section.toUpperCase()}`, left, doc.y, { width, characterSpacing: 0.5 });
      doc.fillColor(COLOR.ink).font('bold').fontSize(10.5).text(step.question.title, { width });
      doc.moveDown(0.1);
      doc.fillColor(COLOR.ink).font('regular').fontSize(10.5).text(answerText(step.answer), { width, lineGap: 2 });
      doc.moveDown(0.25);
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.5).strokeColor(COLOR.line).stroke();
    });

    /* ── Основа оценки ── */
    if (brief.estimate?.basis) {
      const b = brief.estimate.basis;
      heading('Как посчитана оценка для клиента');
      doc.fillColor(COLOR.muted).font('regular').fontSize(9)
        .text('Посчитано по ценам калькулятора на сайте, показана нижняя часть вилки. Клиенту сказано, что финальная стоимость уточняется у вас.', { width });
      label('Разметка задачи');
      bullets([
        `Тип: ${b.product}`,
        `Масштаб: ${b.scale}`,
        `Функции: ${b.features && b.features.length ? b.features.join(', ') : 'без дополнительных'}`,
        `Дизайн: ${b.design}`,
        `Сроки: ${b.timeline}`,
      ]);
    }

    /* ── Кейсы ── */
    if (Array.isArray(brief.cases) && brief.cases.length) {
      heading('Какие кейсы увидел клиент');
      bullets(brief.cases.map((item) => `${item.title} (${item.category}) — ${item.reason}`));
    }

    /* ── Подвал на каждой странице ── */
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor(COLOR.muted).font('regular').fontSize(8)
        .text(
          `g0_faq · бриф сформирован ${dateTime(brief.completed_at)} · стр. ${i + 1} из ${range.count}`,
          left, doc.page.height - 36, { width, align: 'center', lineBreak: false },
        );
      doc.page.margins.bottom = bottom;
    }

    doc.end();
  });
}

module.exports = { buildReport };
