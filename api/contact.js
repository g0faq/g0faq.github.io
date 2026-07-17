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
  const contact = typeof body?.contact === 'string' ? body.contact.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!name || !contact || !message) {
    return res.status(400).json({ ok: false, error: 'All fields are required' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ ok: false, error: 'Message is too long' });
  }

  const telegramMessage = [
    'Новая заявка с сайта',
    '',
    `Имя: ${name}`,
    `Контакт: ${contact}`,
    '',
    'Задача:',
    message
  ].join('\n');

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: telegramMessage })
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
