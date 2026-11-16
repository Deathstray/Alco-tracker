-- ============================================================
--  АлкоТрекер — трекер алкоголя (аналог АлкоСтат)
--  Схема базы данных MySQL 5.7+ / MySQL 8 / MariaDB 10.4+
--  Задание 1 ДЭ (КИМ 09.02.07-2-2027): проектирование и разработка БД
--  Кодировка: utf8mb4 (полная поддержка кириллицы и символов ₽)
-- ============================================================

CREATE DATABASE IF NOT EXISTS alkotracker
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE alkotracker;

-- ------------------------------------------------------------
-- Таблица: users — учётные записи и профили пользователей.
-- Логин уникален; пароль хранится ТОЛЬКО в виде хэша bcrypt
-- (пакет bcryptjs: bcrypt.hashSync при регистрации, bcrypt.compareSync при входе).
-- Параметры (пол, вес) нужны для расчёта промилле по формуле Видмарка
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id       INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    login         VARCHAR(30)      NOT NULL,
    password_hash VARCHAR(255)     NOT NULL,
    name          VARCHAR(100)     NOT NULL,
    gender        ENUM('male','female') NOT NULL DEFAULT 'male',
    birth_year    SMALLINT UNSIGNED NULL,
    weight_kg     DECIMAL(5,1)     NOT NULL DEFAULT 70.0,
    height_cm     SMALLINT UNSIGNED NULL,
    created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_user_login (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Таблица: drink_types — типы напитков (справочник)
-- is_alcoholic = 1 — алкогольный тип (учитывается в дозах)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drink_types (
    type_id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    type_name        VARCHAR(50)   NOT NULL,
    is_alcoholic     TINYINT(1)    NOT NULL DEFAULT 0,
    default_strength DECIMAL(5,2)  NOT NULL DEFAULT 0.00 COMMENT 'Крепость по умолчанию, % об.',
    PRIMARY KEY (type_id),
    UNIQUE KEY uq_type_name (type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Таблица: drinks — напитки (справочник)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drinks (
    drink_id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    type_id            INT UNSIGNED  NOT NULL,
    drink_name         VARCHAR(100)  NOT NULL,
    strength           DECIMAL(5,2)  NOT NULL COMMENT 'Крепость, % об.',
    package_volume_ml  INT UNSIGNED  NOT NULL DEFAULT 500 COMMENT 'Объём стандартной тары, мл',
    default_price      DECIMAL(8,2)  NOT NULL DEFAULT 0.00 COMMENT 'Цена тары по умолчанию, руб.',
    PRIMARY KEY (drink_id),
    UNIQUE KEY uq_drink_name (drink_name),
    KEY idx_drinks_type (type_id),
    CONSTRAINT fk_drinks_type FOREIGN KEY (type_id)
        REFERENCES drink_types (type_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Таблица: places — места употребления (справочник)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS places (
    place_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    place_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (place_id),
    UNIQUE KEY uq_place_name (place_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Таблица: reasons — поводы (справочник)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reasons (
    reason_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reason_name VARCHAR(50)  NOT NULL,
    PRIMARY KEY (reason_id),
    UNIQUE KEY uq_reason_name (reason_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Таблица: companies — компания употребления (справочник)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    company_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_name VARCHAR(50)  NOT NULL,
    PRIMARY KEY (company_id),
    UNIQUE KEY uq_company_name (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Таблица: entries — записи дневника употребления (основная)
-- Крепость и цена сохраняются на момент записи (историчность данных)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entries (
    entry_id   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id    INT UNSIGNED  NOT NULL,
    drink_id   INT UNSIGNED  NOT NULL,
    entry_date DATE          NOT NULL,
    entry_time TIME          NOT NULL DEFAULT '18:00:00',
    volume_ml  INT UNSIGNED  NOT NULL COMMENT 'Объём порции, мл',
    strength   DECIMAL(5,2)  NOT NULL DEFAULT 0.00 COMMENT 'Фактическая крепость, % об.',
    price      DECIMAL(8,2)  NOT NULL DEFAULT 0.00 COMMENT 'Цена порции, руб.',
    place_id   INT UNSIGNED  NULL,
    reason_id  INT UNSIGNED  NULL,
    company_id INT UNSIGNED  NULL,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entry_id),
    -- запись уникальна: пользователь + дата + время + напиток
    -- (два разных напитка в одну минуту записать можно)
    UNIQUE KEY uq_user_date_time_drink (user_id, entry_date, entry_time, drink_id),
    KEY idx_entries_user_date (user_id, entry_date),
    CONSTRAINT fk_entries_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)      ON DELETE CASCADE,
    CONSTRAINT fk_entries_drink   FOREIGN KEY (drink_id)   REFERENCES drinks (drink_id)    ON DELETE RESTRICT,
    CONSTRAINT fk_entries_place   FOREIGN KEY (place_id)   REFERENCES places (place_id)   ON DELETE SET NULL,
    CONSTRAINT fk_entries_reason  FOREIGN KEY (reason_id)  REFERENCES reasons (reason_id) ON DELETE SET NULL,
    CONSTRAINT fk_entries_company FOREIGN KEY (company_id) REFERENCES companies (company_id) ON DELETE SET NULL,
    CONSTRAINT chk_volume  CHECK (volume_ml > 0 AND volume_ml <= 10000),
    CONSTRAINT chk_strength CHECK (strength >= 0 AND strength <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Таблица: daily_records — ежедневные показатели (1 запись на день)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_records (
    record_id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id           INT UNSIGNED NOT NULL,
    record_date       DATE         NOT NULL,
    sleep_quality     TINYINT UNSIGNED NULL COMMENT 'Качество сна, 1..5',
    morning_condition TINYINT UNSIGNED NULL COMMENT 'Утреннее состояние, 1..5',
    note              VARCHAR(255) NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (record_id),
    UNIQUE KEY uq_user_record_date (user_id, record_date),
    CONSTRAINT fk_daily_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT chk_sleep CHECK (sleep_quality BETWEEN 1 AND 5),
    CONSTRAINT chk_morning CHECK (morning_condition BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ПРЕДСТАВЛЕНИЯ (VIEW) — серверная агрегация бизнес-логики
-- ============================================================

-- Детали записи с русскими названиями справочников + расчёт доз
CREATE OR REPLACE VIEW vw_entry_details AS
SELECT
    e.entry_id,
    e.user_id,
    e.entry_date,
    e.entry_time,
    e.volume_ml,
    e.strength,
    e.price,
    d.drink_name,
    t.type_name,
    t.is_alcoholic,
    p.place_name,
    r.reason_name,
    c.company_name,
    ROUND(e.volume_ml * e.strength / 100 * 0.789, 1)          AS pure_grams,
    ROUND(e.volume_ml * e.strength / 100 * 0.789 / 10, 2)    AS doses
FROM entries e
JOIN drinks d      ON d.drink_id  = e.drink_id
JOIN drink_types t ON t.type_id   = d.type_id
LEFT JOIN places p   ON p.place_id   = e.place_id
LEFT JOIN reasons r  ON r.reason_id  = e.reason_id
LEFT JOIN companies c ON c.company_id = e.company_id;

-- Сводка по дням: дозы, граммы, деньги — только алкогольные напитки
CREATE OR REPLACE VIEW vw_daily_stats AS
SELECT
    e.user_id,
    e.entry_date,
    SUM(e.volume_ml)                                              AS total_ml,
    ROUND(SUM(e.volume_ml * e.strength / 100 * 0.789), 1)        AS pure_grams,
    ROUND(SUM(e.volume_ml * e.strength / 100 * 0.789) / 10, 1)   AS doses,
    COUNT(*)                                                     AS entry_count
FROM entries e
JOIN drinks d      ON d.drink_id = e.drink_id
JOIN drink_types t ON t.type_id  = d.type_id
WHERE t.is_alcoholic = 1
GROUP BY e.user_id, e.entry_date;

-- Сводка по дням недели
CREATE OR REPLACE VIEW vw_weekday_stats AS
SELECT
    user_id,
    WEEKDAY(entry_date) AS weekday,   -- 0 = понедельник
    SUM(doses)          AS doses,
    COUNT(*)            AS days
FROM vw_daily_stats
GROUP BY user_id, WEEKDAY(entry_date);
