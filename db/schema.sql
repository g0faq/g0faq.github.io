-- Схема аналитики портфолио.
--
-- Принципы:
--   * никакой привязки к личности: visitor_id и session_id — случайные UUID,
--     сгенерированные в браузере после согласия;
--   * IP не хранится вообще: страна и город определяются на границе Vercel
--     из заголовков запроса, дальше IP отбрасывается;
--   * свободный текст форм не сохраняется — только факт заполнения и длина;
--   * подробные события удаляются по истечении retention-периода, агрегаты
--     по сессиям остаются.

CREATE TABLE IF NOT EXISTS visitors (
  id            UUID PRIMARY KEY,
  short_id      TEXT NOT NULL,                    -- #A82F для Telegram
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sessions_count INTEGER NOT NULL DEFAULT 0,
  -- Первый источник: по нему видно, откуда человек пришёл впервые.
  first_referrer TEXT,
  first_utm_source TEXT,
  first_landing  TEXT,
  country       TEXT,
  city          TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY,
  visitor_id    UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  short_id      TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  -- Сессию закрывает либо браузер (pagehide), либо cron по таймауту.
  end_reason    TEXT,
  duration_sec  INTEGER,

  is_new_visitor BOOLEAN NOT NULL DEFAULT false,

  landing_page  TEXT,
  exit_page     TEXT,
  referrer      TEXT,
  referrer_name TEXT,                             -- «Google», «Telegram», «прямой заход»

  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  utm_term      TEXT,

  device_type   TEXT,                             -- desktop | mobile | tablet
  device_model  TEXT,                             -- «iPhone», «Mac», по user-agent
  os            TEXT,
  browser       TEXT,
  screen_w      INTEGER,
  screen_h      INTEGER,
  language      TEXT,
  timezone      TEXT,

  country       TEXT,
  city          TEXT,

  pages_count   INTEGER NOT NULL DEFAULT 0,
  events_count  INTEGER NOT NULL DEFAULT 0,
  max_scroll    INTEGER NOT NULL DEFAULT 0,       -- 25 / 50 / 75 / 90 / 100
  path          JSONB NOT NULL DEFAULT '[]'::jsonb, -- маршрут: список страниц и секций

  is_bot        BOOLEAN NOT NULL DEFAULT false,
  summary_sent  BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions (visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_open ON sessions (last_event_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  visitor_id  UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Смещение от начала сессии в миллисекундах — считается в браузере.
  offset_ms   INTEGER,
  type        TEXT NOT NULL,
  -- Полезная нагрузка события: только структурированные значения.
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at);

-- Текущее состояние калькулятора: одна строка на сессию, переписывается на
-- каждое изменение. Именно она даёт ответ «что человек выбрал, даже если ушёл».
CREATE TABLE IF NOT EXISTS calculator_states (
  session_id   UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  visitor_id   UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  step         INTEGER,
  max_step     INTEGER,
  reached_result BOOLEAN NOT NULL DEFAULT false,
  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {product, scale, features[], design, timeline}
  labels       JSONB NOT NULL DEFAULT '{}'::jsonb,   -- человекочитаемые названия тех же ответов
  price_min    INTEGER,
  price_max    INTEGER,
  form_started BOOLEAN NOT NULL DEFAULT false,
  form_submitted BOOLEAN NOT NULL DEFAULT false,
  -- О свободных полях храним только метаданные, без текста.
  form_fields  JSONB NOT NULL DEFAULT '{}'::jsonb    -- {name:{filled:true,len:5}, ...}
);

-- Исходящие уведомления в Telegram. Отдельная таблица, чтобы буферизовать,
-- дедуплицировать и переживать падения Telegram API.
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                    -- visit | activity | important | summary
  dedupe_key  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  send_after  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ,
  attempts    INTEGER NOT NULL DEFAULT 0,
  text        TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_pending
  ON notifications (send_after) WHERE sent_at IS NULL;

-- Отметка последнего прогона обслуживания. Нужна, чтобы фоновые задачи можно
-- было запускать попутно с приёмом событий, а не только по cron: на тарифе
-- Hobby у Vercel расписание срабатывает раз в сутки, чего мало для буфера
-- уведомлений и закрытия сессий по таймауту.
CREATE TABLE IF NOT EXISTS maintenance_log (
  id       SMALLINT PRIMARY KEY DEFAULT 1,
  last_run TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
  CONSTRAINT maintenance_singleton CHECK (id = 1)
);

INSERT INTO maintenance_log (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Имена посетителей, которые владелец сайта задаёт вручную через бота
-- («#ECB7 — это Ольга»). Автоматически ничего не определяется: имя появляется
-- только если владелец сам узнал человека и подписал его.
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS named_at TIMESTAMPTZ;

-- Ожидание ответа в боте: после нажатия «Назвать» следующее сообщение
-- владельца считается именем для этого посетителя.
CREATE TABLE IF NOT EXISTS bot_pending (
  chat_id    BIGINT PRIMARY KEY,
  visitor_id UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Помощь с ТЗ ─────────────────────────────────────────────────────────────
-- Опрос, по которому собирается бриф. Два режима:
--   owner  — владелец сам описал проект в боте, ИИ заранее собрал вопросы,
--            клиент получает уникальную ссылку;
--   public — посетитель открыл «Помощь с ТЗ», вопросы генерируются по ходу.
-- Черновик ТЗ хранится только здесь и уходит только владельцу — клиенту
-- API его никогда не возвращает.
CREATE TABLE IF NOT EXISTS briefs (
  id            UUID PRIMARY KEY,
  token         TEXT NOT NULL UNIQUE,             -- секрет ссылки / возобновления
  mode          TEXT NOT NULL CHECK (mode IN ('owner', 'public')),
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'deleted')),
  title         TEXT,
  client_intro  TEXT,
  owner_context TEXT,                             -- заметки владельца, клиенту не показываются
  plan          JSONB,                            -- вопросы заранее (режим owner)
  steps         JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{question, answer}]
  ai_calls      INTEGER NOT NULL DEFAULT 0,
  client_name   TEXT,
  client_contact_channel TEXT,
  client_contact TEXT,
  cases         JSONB,                            -- показанные клиенту похожие кейсы
  draft         JSONB,                            -- черновик ТЗ для владельца
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at     TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  report_sent   BOOLEAN NOT NULL DEFAULT false,
  report_attempts INTEGER NOT NULL DEFAULT 0,
  abandon_notified BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_briefs_pending_report
  ON briefs (completed_at) WHERE status = 'completed' AND report_sent = false;
CREATE INDEX IF NOT EXISTS idx_briefs_activity ON briefs (last_activity_at) WHERE status = 'active';

-- Защита от выжигания бюджета OpenAI: счётчики стартов на хэш адреса за сутки.
-- Сам адрес не хранится, хэш солится секретом и датой, строки живут двое суток.
CREATE TABLE IF NOT EXISTS brief_rate (
  bucket     TEXT NOT NULL,                       -- 'ip:<hash>' или 'global'
  day        DATE NOT NULL DEFAULT CURRENT_DATE,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, day)
);

-- Ожидание ответа в боте теперь бывает двух видов: имя посетителя и описание
-- проекта для нового опроса.
ALTER TABLE bot_pending ALTER COLUMN visitor_id DROP NOT NULL;
ALTER TABLE bot_pending ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'name';

-- Все вопросы отвечены, осталось оставить контакты.
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS awaiting_contact BOOLEAN NOT NULL DEFAULT false;

-- Примерная стоимость, показанная клиенту после опроса.
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS estimate JSONB;

-- Свои устройства владельца: визиты пишутся в статистику, но в бота о них
-- ничего не приходит. Переключается командами /mute и /unmute.
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false;
