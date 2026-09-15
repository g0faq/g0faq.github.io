'use strict';

/* География берётся из заголовков, которые проставляет граница Vercel.
   Сам IP при этом не читается и никуда не сохраняется — по требованию
   privacy-first: определили страну и город, IP забыли. */

const COUNTRIES = {
  RU: 'Россия', UA: 'Украина', BY: 'Беларусь', KZ: 'Казахстан', AM: 'Армения',
  GE: 'Грузия', AZ: 'Азербайджан', UZ: 'Узбекистан', KG: 'Киргизия', MD: 'Молдова',
  DE: 'Германия', NL: 'Нидерланды', PL: 'Польша', FR: 'Франция', ES: 'Испания',
  IT: 'Италия', GB: 'Великобритания', IE: 'Ирландия', PT: 'Португалия',
  CZ: 'Чехия', AT: 'Австрия', CH: 'Швейцария', SE: 'Швеция', NO: 'Норвегия',
  FI: 'Финляндия', DK: 'Дания', EE: 'Эстония', LV: 'Латвия', LT: 'Литва',
  RS: 'Сербия', TR: 'Турция', CY: 'Кипр', IL: 'Израиль', AE: 'ОАЭ',
  US: 'США', CA: 'Канада', BR: 'Бразилия', AR: 'Аргентина', MX: 'Мексика',
  CN: 'Китай', JP: 'Япония', KR: 'Южная Корея', IN: 'Индия', TH: 'Таиланд',
  VN: 'Вьетнам', ID: 'Индонезия', AU: 'Австралия', NZ: 'Новая Зеландия',
};

function decode(value) {
  if (!value) return null;
  try {
    // Города Vercel отдаёт percent-encoded: Amsterdam, S%C3%A3o%20Paulo.
    return decodeURIComponent(value) || null;
  } catch {
    return value || null;
  }
}

function fromHeaders(headers) {
  const get = (name) => headers[name] || headers[name.toLowerCase()] || null;
  const code = (get('x-vercel-ip-country') || '').toUpperCase() || null;
  const city = decode(get('x-vercel-ip-city'));
  return {
    country: code ? (COUNTRIES[code] || code) : null,
    city: city && city !== 'null' ? city : null,
  };
}

module.exports = { fromHeaders };
