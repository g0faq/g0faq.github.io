module.exports = async function contactHandler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ ok: false, error: 'ENV not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    }
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const channel = typeof body?.channel === 'string' ? body.channel.trim() : '';
  const contact = typeof body?.contact === 'string' ? body.contact.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const allowedChannels = new Set(['Telegram', 'VK', 'MAX', 'Телефон']);

  if (!name || !allowedChannels.has(channel) || !contact || !message) {
    return res.status(400).json({ ok: false, error: 'All fields are required' });
  }

  if (name.length > 100 || contact.length > 200 || message.length > 2000) {
    return res.status(400).json({ ok: false, error: 'Message is too long' });
  }

  const escapeHtml = (value) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const receivedAt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date());

  const telegramMessage = [
    '🚀 <b>НОВАЯ ЗАЯВКА С ПОРТФОЛИО</b>',
    '━━━━━━━━━━━━━━━━━━',
    `👤 <b>Имя:</b> ${escapeHtml(name)}`,
    `💬 <b>Связаться через:</b> ${escapeHtml(channel)}`,
    `🔗 <b>Контакт:</b> ${escapeHtml(contact)}`,
    '━━━━━━━━━━━━━━━━━━',
    '🧩 <b>ЗАДАЧА</b>',
    escapeHtml(message),
    '━━━━━━━━━━━━━━━━━━',
    `🕒 <b>Получено:</b> ${escapeHtml(receivedAt)} · МСК`,
    '🌐 <b>Источник:</b> portfolio-site'
  ].join('\n');

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramMessage,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      }
    );
    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      return res.status(502).json({ ok: false, error: 'Telegram delivery failed' });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: 'Telegram delivery failed' });
  }
};
