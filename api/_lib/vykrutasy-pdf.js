'use strict';

const path = require('node:path');
const PDFDocument = require('pdfkit');

/* PDF по брифу «Выкрутасы»: выжимка модели и все ответы по разделам.
 * Шрифты — те же Fira Sans, что у отчёта по брифу портфолио. */

const FONT_REGULAR = path.join(__dirname, '..', '_fonts', 'FiraSans-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '..', '_fonts', 'FiraSans-SemiBold.ttf');
const C = { ink: '#111418', muted: '#6c757f', accent: '#FF3EA5', violet: '#7C3AED', soft: '#f6f3fb' };

function buildVykrutasyPdf(p) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 64, left: 56, right: 56 }, bufferPages: true, info: { Title: 'Бриф «Выкрутасы»', Author: 'g0_faq' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('r', FONT_REGULAR);
    doc.registerFont('b', FONT_BOLD);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const space = (h) => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); };
    const h1 = (t) => {
      space(60); doc.moveDown(0.9);
      const y = doc.y;
      doc.rect(left, y + 3, 4, 14).fill(C.accent);
      doc.fillColor(C.ink).font('b').fontSize(14).text(t, left + 14, y, { width: width - 14 });
      doc.moveDown(0.4); doc.x = left;
    };
    const label = (t) => { space(40); doc.moveDown(0.45); doc.fillColor(C.muted).font('b').fontSize(9).text(t, left, doc.y, { width }); doc.moveDown(0.1); };
    const para = (t, color = C.ink) => doc.fillColor(color).font('r').fontSize(10.5).text(t, left, doc.y, { width, lineGap: 2.5 });
    const bullets = (items) => {
      for (const it of items) {
        space(24);
        const y = doc.y;
        doc.circle(left + 3, y + 6, 1.8).fill(C.violet);
        doc.fillColor(C.ink).font('r').fontSize(10.5).text(it, left + 14, y, { width: width - 14, lineGap: 2 });
        doc.moveDown(0.2);
      }
      doc.x = left;
    };

    const when = p.submittedAt
      ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(p.submittedAt))
      : 'не отправлен';
    doc.fillColor(C.accent).font('b').fontSize(9).text('ХОРЕОГРАФИЧЕСКИЙ КОЛЛЕКТИВ «ВЫКРУТАСЫ»', left, doc.y, { characterSpacing: 1 });
    doc.moveDown(0.3);
    doc.fillColor(C.ink).font('b').fontSize(24).text('Результаты брифа');
    doc.moveDown(0.3);
    para(`${p.respondent || 'Респондент не указан'} · ${when} · отвечено ${p.done} из ${p.total}`, C.muted);
    if (p.reportUrl) doc.fillColor(C.violet).font('r').fontSize(10).text(`Отчёт с комментариями: ${p.reportUrl}`, left, doc.y + 4, { width, link: p.reportUrl, underline: true });

    const a = p.analysis;
    h1('Выжимка');
    if (a) {
      space(60);
      const y = doc.y;
      const hgt = doc.font('r').fontSize(10.5).heightOfString(a.summary, { width: width - 24, lineGap: 2.5 }) + 20;
      doc.roundedRect(left, y, width, hgt, 8).fill(C.soft);
      doc.fillColor(C.ink).font('r').fontSize(10.5).text(a.summary, left + 12, y + 10, { width: width - 24, lineGap: 2.5 });
      doc.y = y + hgt; doc.x = left;
      const blocks = [['ЦЕЛИ', a.goals], ['ОБЯЗАТЕЛЬНО В ПЕРВОМ ЭТАПЕ', a.mustHave], ['ПОЗЖЕ / НЕ НУЖНО', a.later], ['ОГРАНИЧЕНИЯ', a.constraints], ['РИСКИ И ПРОТИВОРЕЧИЯ', a.risks], ['УТОЧНИТЬ У КЛИЕНТА', a.questions], ['СЛЕДУЮЩИЕ ШАГИ', a.nextSteps]];
      for (const [t, items] of blocks) if (items && items.length) { label(t); bullets(items); }
    } else {
      para(`Автоматический разбор не выполнился${p.aiError ? ` (${p.aiError})` : ''} — ниже полные ответы.`, C.muted);
    }

    doc.addPage();
    doc.fillColor(C.ink).font('b').fontSize(18).text('Ответы клиента', left, doc.y);
    p.sections.forEach((s, i) => {
      h1(`${i + 1}. ${s.title}`);
      for (const it of s.items) { label(it.q); para(it.a || 'Без ответа', it.a ? C.ink : C.muted); }
    });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor(C.muted).font('r').fontSize(8).text(`Бриф «Выкрутасы» · ${i + 1} / ${range.count}`, left, doc.page.height - 40, { width, align: 'right' });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}

module.exports = { buildVykrutasyPdf };
