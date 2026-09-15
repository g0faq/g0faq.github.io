(function defineCalculatorConfig() {
  const deepFreeze = (value) => {
    Object.values(value).forEach((item) => {
      if (item && typeof item === 'object' && !Object.isFrozen(item)) deepFreeze(item);
    });
    return Object.freeze(value);
  };

  window.CALCULATOR_CONFIG = deepFreeze({
    storageKey: 'portfolio-project-calculator-v1',
    products: [
      {
        id: 'landing',
        title: 'Лендинг',
        description: 'Одностраничный сайт для презентации услуги, продукта или компании.',
        min: 13000,
        max: 40000,
        icon: 'layout'
      },
      {
        id: 'corporate',
        title: 'Корпоративный сайт',
        description: 'Многостраничный сайт компании, услуг или проекта.',
        min: 25000,
        max: 90000,
        icon: 'building'
      },
      {
        id: 'store',
        title: 'Интернет-магазин',
        description: 'Каталог товаров, корзина, оформление заказа и необходимые интеграции.',
        min: 40000,
        max: 160000,
        icon: 'cart'
      },
      {
        id: 'telegram-bot',
        title: 'Telegram-бот',
        description: 'Бот для заявок, уведомлений, записи, оплаты или автоматизации.',
        min: 8000,
        max: 45000,
        icon: 'bot'
      },
      {
        id: 'mini-app',
        title: 'Telegram Mini App',
        description: 'Полноценный веб-интерфейс внутри Telegram: каталог, кабинет, магазин или сервис.',
        min: 20000,
        max: 100000,
        icon: 'mini-app'
      },
      {
        id: 'crm',
        title: 'CRM или личный кабинет',
        description: 'Внутренняя система для клиентов, сотрудников, учеников или бизнес-процессов.',
        min: 35000,
        max: 120000,
        icon: 'dashboard'
      },
      {
        id: 'ai',
        title: 'AI-автоматизация',
        description: 'AI-ассистент, генерация документов, обработка анкет или автоматизация процессов.',
        min: 20000,
        max: 90000,
        icon: 'spark'
      },
      {
        id: 'custom',
        title: 'Индивидуальная разработка',
        description: 'Нестандартный цифровой продукт с индивидуальной архитектурой и логикой.',
        min: 50000,
        max: 180000,
        icon: 'custom'
      }
    ],
    scales: [
      {
        id: 'small',
        title: 'Небольшой',
        description: 'Основной функционал без большого количества сценариев и экранов.',
        minMultiplier: 1,
        maxMultiplier: 1
      },
      {
        id: 'medium',
        title: 'Средний',
        description: 'Несколько разделов, сценариев использования и дополнительная логика.',
        minMultiplier: 1.25,
        maxMultiplier: 1.4
      },
      {
        id: 'large',
        title: 'Большой',
        description: 'Много экранов, ролей, интеграций или сложных бизнес-процессов.',
        minMultiplier: 1.6,
        maxMultiplier: 2
      },
      {
        id: 'unknown',
        title: 'Пока не знаю',
        description: 'Масштаб будет определён после обсуждения задачи.',
        minMultiplier: 1.1,
        maxMultiplier: 1.5
      }
    ],
    features: [
      { id: 'auth', title: 'Авторизация и регистрация', min: 6000, max: 20000 },
      { id: 'database', title: 'База данных', min: 8000, max: 30000 },
      { id: 'admin', title: 'Административная панель', min: 13000, max: 45000 },
      { id: 'roles', title: 'Несколько ролей пользователей', min: 10000, max: 35000 },
      { id: 'payment', title: 'Онлайн-оплата', min: 8000, max: 30000 },
      { id: 'subscriptions', title: 'Подписки и рекуррентные платежи', min: 13000, max: 50000 },
      { id: 'catalog', title: 'Каталог товаров или услуг', min: 8000, max: 35000 },
      { id: 'cart', title: 'Корзина и оформление заказа', min: 8000, max: 30000 },
      { id: 'delivery', title: 'Интеграция доставки', min: 13000, max: 45000 },
      { id: 'sheets', title: 'Интеграция с Google Таблицами', min: 6000, max: 20000 },
      { id: 'telegram', title: 'Telegram-уведомления', min: 4000, max: 15000 },
      { id: 'api', title: 'Интеграция с внешним API или CRM', min: 10000, max: 60000 },
      { id: 'ai', title: 'AI-функции', min: 17000, max: 80000 },
      { id: 'documents', title: 'Генерация Word или PDF', min: 8000, max: 40000 },
      { id: 'analytics', title: 'Аналитика, статистика и графики', min: 8000, max: 35000 },
      { id: 'files', title: 'Загрузка и хранение файлов', min: 7000, max: 25000 },
      { id: 'email', title: 'Email-уведомления', min: 4000, max: 15000 },
      {
        id: 'consultation',
        title: 'Необходима консультация',
        description: 'Помогу определить оптимальный набор функций после обсуждения.',
        min: 0,
        max: 20000
      },
      { id: 'none', title: 'Ничего из перечисленного', min: 0, max: 0, exclusive: true }
    ],
    designs: [
      {
        id: 'ready',
        title: 'Есть готовый дизайн',
        description: 'Предоставлю готовый макет или дизайн-систему.',
        min: 0,
        max: 0
      },
      {
        id: 'base',
        title: 'Базовый дизайн',
        description: 'Аккуратный современный интерфейс на основе структуры проекта.',
        min: 7000,
        max: 20000
      },
      {
        id: 'individual',
        title: 'Индивидуальный UI/UX',
        description: 'Уникальный дизайн, продуманная структура и пользовательские сценарии.',
        min: 13000,
        max: 45000
      },
      {
        id: 'complex',
        title: 'Сложный визуал и анимации',
        description: 'Нестандартная графика, сложные анимации или интерактивные элементы.',
        min: 25000,
        max: 90000
      },
      {
        id: 'unknown',
        title: 'Пока не знаю',
        description: 'Подберём подходящий уровень дизайна после обсуждения.',
        min: 7000,
        max: 40000
      }
    ],
    timelines: [
      {
        id: 'standard',
        title: 'Стандартные сроки',
        description: 'Срок определяется после оценки объёма проекта.',
        minMultiplier: 1,
        maxMultiplier: 1
      },
      {
        id: 'faster',
        title: 'Желательно быстрее',
        description: 'Проект получает повышенный приоритет.',
        minMultiplier: 1.15,
        maxMultiplier: 1.3
      },
      {
        id: 'urgent',
        title: 'Срочная разработка',
        description: 'Максимально быстрый запуск при наличии свободного окна.',
        minMultiplier: 1.4,
        maxMultiplier: 1.7
      },
      {
        id: 'unknown',
        title: 'Сроки не определены',
        description: 'Определим реалистичный срок после обсуждения задачи.',
        minMultiplier: 1,
        maxMultiplier: 1
      }
    ]
  });
})();
