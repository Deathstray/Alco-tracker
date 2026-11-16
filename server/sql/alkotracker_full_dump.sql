-- ============================================================
--  АлкоТрекер — ПОЛНЫЙ дамп базы данных (схема + демо-данные)
--  Файл самодостаточен: импортируйте его в phpMyAdmin
--  и база будет сразу со всеми справочниками и дневником.
--  Демо-учётная запись: логин demo, пароль demo123
--  (хэш в users.password_hash, алгоритм bcrypt).
--  Альтернатива без этого файла: sql/alkotracker_schema.sql
--  + команда  npm run import  в каталоге server  (см. INSTALL.md)
--
--  MySQL 5.7+ / MySQL 8 / MariaDB 10.4+, кодировка utf8mb4
--  Содержимое: 1 пользователь (demo), 6 типов напитков, 20 напитков,
--  6 мест, 7 поводов, 5 компаний, 111 записей дневника,
--  92 дня ежemeсячных показателей, 3 представления (vw_*)
-- ============================================================

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

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Таблица: users — учётные записи и профили пользователей.
-- Логин уникален; пароль хранится ТОЛЬКО в виде хэша bcrypt
-- (пакет bcryptjs: bcrypt.hashSync при регистрации, bcrypt.compareSync при входе).
-- Параметры (пол, вес) нужны для расчёта промилле по формуле Видмарка
-- ------------------------------------------------------------
DROP TABLE IF EXISTS users;
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
DROP TABLE IF EXISTS drink_types;
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
DROP TABLE IF EXISTS drinks;
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
DROP TABLE IF EXISTS places;
CREATE TABLE IF NOT EXISTS places (
    place_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    place_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (place_id),
    UNIQUE KEY uq_place_name (place_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Таблица: reasons — поводы (справочник)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS reasons;
CREATE TABLE IF NOT EXISTS reasons (
    reason_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reason_name VARCHAR(50)  NOT NULL,
    PRIMARY KEY (reason_id),
    UNIQUE KEY uq_reason_name (reason_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Таблица: companies — компания употребления (справочник)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS companies;
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
DROP TABLE IF EXISTS entries;
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
DROP TABLE IF EXISTS daily_records;
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


-- ============================================================
-- ДАННЫЕ (перенос из Excel -> CSV -> MySQL, этап ДЭ)
-- ============================================================

INSERT INTO users (user_id, login, password_hash, name, gender, birth_year, weight_kg, height_cm) VALUES
  (1, 'demo', '$2y$10$kDOoob5niTZvA1D3jZkLHeUe.ZJL.zKb5uIZc8lzq4UcyGK1Km3HK', 'Демо-пользователь', 'male', 1998, 85.0, 180);
INSERT INTO drink_types (type_id, type_name, is_alcoholic, default_strength) VALUES
  (1, 'Пиво', 1, 5.0),
  (2, 'Вино', 1, 12.0),
  (3, 'Крепкий алкоголь', 1, 40.0),
  (4, 'Коктейли', 1, 15.0),
  (5, 'Кофе', 0, 0.0),
  (6, 'Энергетики', 0, 0.0);
INSERT INTO drinks (drink_id, type_id, drink_name, strength, package_volume_ml, default_price) VALUES
  (1, 1, 'Пиво светлое', 4.9, 500, 75),
  (2, 1, 'Пиво тёмное', 5.4, 500, 90),
  (3, 1, 'Пиво безалкогольное', 0.5, 500, 70),
  (4, 1, 'Сидр', 4.7, 330, 95),
  (5, 2, 'Вино красное сухое', 12.5, 750, 450),
  (6, 2, 'Вино белое сухое', 12.0, 750, 420),
  (7, 2, 'Вино красное полусладкое', 12.0, 750, 380),
  (8, 2, 'Шампанское', 11.0, 750, 500),
  (9, 3, 'Водка', 40.0, 500, 700),
  (10, 3, 'Коньяк', 40.0, 500, 900),
  (11, 3, 'Виски', 40.0, 500, 1200),
  (12, 3, 'Джин', 40.0, 500, 850),
  (13, 3, 'Текила', 38.0, 500, 950),
  (14, 3, 'Ликёр', 24.0, 500, 750),
  (15, 4, 'Коктейль барный', 15.0, 250, 400),
  (16, 5, 'Кофе американо', 0.0, 250, 150),
  (17, 5, 'Эспрессо', 0.0, 30, 100),
  (18, 5, 'Латте', 0.0, 300, 200),
  (19, 6, 'Энергетик классический', 0.0, 450, 120),
  (20, 6, 'Энергетик без сахара', 0.0, 450, 130);
INSERT INTO places (place_id, place_name) VALUES
  (1, 'Дома'),
  (2, 'В гостях'),
  (3, 'Бар'),
  (4, 'Ресторан'),
  (5, 'На природе'),
  (6, 'На работе');
INSERT INTO reasons (reason_id, reason_name) VALUES
  (1, 'Без особого повода'),
  (2, 'Встреча с друзьями'),
  (3, 'Праздник'),
  (4, 'Снятие стресса'),
  (5, 'За компанию'),
  (6, 'Выходной день'),
  (7, 'Событие/мероприятие');
INSERT INTO companies (company_id, company_name) VALUES
  (1, 'Один(одна)'),
  (2, 'С партнёром'),
  (3, 'С друзьями'),
  (4, 'С коллегами'),
  (5, 'С семьёй');
INSERT INTO entries (user_id, drink_id, entry_date, entry_time, volume_ml, strength, price, place_id, reason_id, company_id) VALUES
  (1, 20, '2026-08-05', '10:40:00', 450, 0.0, 132, 6, 1, 5),
  (1, 6, '2026-08-05', '18:40:00', 250, 12.0, 135, 1, 1, 3),
  (1, 5, '2026-08-05', '22:20:00', 750, 12.5, 482, 1, 4, 3),
  (1, 18, '2026-08-08', '09:15:00', 300, 0.0, 211, 6, 1, 1),
  (1, 1, '2026-08-08', '20:10:00', 500, 4.9, 75, 4, 2, 2),
  (1, 4, '2026-08-08', '20:40:00', 500, 4.7, 143, 2, 2, 1),
  (1, 2, '2026-08-08', '21:20:00', 330, 5.4, 65, 1, 1, 2),
  (1, 18, '2026-08-09', '11:45:00', 300, 0.0, 194, 6, 1, 1),
  (1, 8, '2026-08-09', '18:00:00', 750, 11.0, 540, 1, 1, 4),
  (1, 16, '2026-08-10', '11:45:00', 250, 0.0, 154, 6, 1, 1),
  (1, 18, '2026-08-11', '08:30:00', 300, 0.0, 203, 6, 1, 3),
  (1, 16, '2026-08-13', '11:15:00', 250, 0.0, 155, 6, 1, 2),
  (1, 17, '2026-08-14', '09:30:00', 30, 0.0, 99, 6, 1, 5),
  (1, 9, '2026-08-14', '20:50:00', 50, 40.0, 76, 4, 7, 3),
  (1, 10, '2026-08-14', '22:45:00', 50, 40.0, 87, 1, 4, 1),
  (1, 11, '2026-08-14', '23:00:00', 50, 40.0, 118, 1, 2, 1),
  (1, 16, '2026-08-16', '09:45:00', 250, 0.0, 148, 6, 1, 5),
  (1, 16, '2026-08-17', '08:00:00', 250, 0.0, 144, 6, 1, 5),
  (1, 16, '2026-08-18', '08:45:00', 250, 0.0, 148, 6, 1, 1),
  (1, 9, '2026-08-19', '18:10:00', 50, 40.0, 70, 4, 3, 4),
  (1, 4, '2026-08-22', '18:15:00', 500, 4.7, 145, 1, 3, 2),
  (1, 2, '2026-08-22', '20:00:00', 500, 5.4, 86, 5, 5, 1),
  (1, 19, '2026-08-24', '14:00:00', 450, 0.0, 119, 1, 1, 3),
  (1, 1, '2026-08-24', '19:50:00', 330, 4.9, 49, 1, 7, 2),
  (1, 16, '2026-08-26', '09:00:00', 250, 0.0, 158, 6, 1, 5),
  (1, 16, '2026-08-27', '09:15:00', 250, 0.0, 159, 6, 1, 3),
  (1, 17, '2026-08-28', '09:30:00', 30, 0.0, 96, 6, 1, 1),
  (1, 2, '2026-08-28', '23:10:00', 1000, 5.4, 186, 5, 1, 1),
  (1, 2, '2026-08-29', '19:05:00', 500, 5.4, 90, 2, 6, 1),
  (1, 15, '2026-08-29', '20:10:00', 300, 15.0, 513, 3, 6, 3),
  (1, 2, '2026-08-29', '21:00:00', 1000, 5.4, 176, 2, 6, 5),
  (1, 16, '2026-08-30', '09:15:00', 250, 0.0, 148, 6, 1, 3),
  (1, 17, '2026-08-31', '08:30:00', 30, 0.0, 109, 6, 1, 5),
  (1, 20, '2026-08-31', '18:20:00', 450, 0.0, 130, 1, 1, 1),
  (1, 18, '2026-09-01', '08:45:00', 300, 0.0, 190, 6, 1, 1),
  (1, 16, '2026-09-03', '11:30:00', 250, 0.0, 154, 6, 1, 5),
  (1, 6, '2026-09-03', '22:20:00', 250, 12.0, 142, 4, 4, 3),
  (1, 7, '2026-09-04', '19:10:00', 150, 12.0, 72, 2, 4, 1),
  (1, 7, '2026-09-04', '23:10:00', 250, 12.0, 133, 1, 4, 5),
  (1, 17, '2026-09-05', '10:45:00', 30, 0.0, 102, 6, 1, 5),
  (1, 1, '2026-09-05', '22:15:00', 500, 4.9, 82, 1, 5, 4),
  (1, 1, '2026-09-05', '22:50:00', 500, 4.9, 76, 5, 4, 5),
  (1, 17, '2026-09-07', '09:45:00', 30, 0.0, 104, 6, 1, 5),
  (1, 2, '2026-09-07', '19:15:00', 1000, 5.4, 173, 1, 1, 1),
  (1, 4, '2026-09-07', '22:00:00', 500, 4.7, 155, 1, 1, 1),
  (1, 12, '2026-09-08', '23:40:00', 50, 40.0, 90, 1, 3, 1),
  (1, 20, '2026-09-11', '14:00:00', 450, 0.0, 132, 6, 1, 1),
  (1, 2, '2026-09-11', '18:30:00', 500, 5.4, 89, 4, 1, 2),
  (1, 18, '2026-09-12', '08:15:00', 300, 0.0, 197, 6, 1, 1),
  (1, 15, '2026-09-12', '19:05:00', 300, 15.0, 512, 3, 2, 4),
  (1, 15, '2026-09-12', '22:40:00', 200, 15.0, 323, 3, 3, 4),
  (1, 5, '2026-09-12', '23:05:00', 750, 12.5, 481, 5, 2, 3),
  (1, 9, '2026-09-13', '21:30:00', 50, 40.0, 73, 4, 5, 3),
  (1, 18, '2026-09-17', '10:45:00', 300, 0.0, 197, 6, 1, 2),
  (1, 16, '2026-09-18', '09:30:00', 250, 0.0, 150, 6, 1, 1),
  (1, 16, '2026-09-19', '10:15:00', 250, 0.0, 158, 6, 1, 1),
  (1, 9, '2026-09-19', '20:45:00', 50, 40.0, 72, 3, 2, 2),
  (1, 14, '2026-09-19', '23:15:00', 50, 24.0, 75, 1, 2, 1),
  (1, 18, '2026-09-22', '10:30:00', 300, 0.0, 195, 6, 1, 3),
  (1, 19, '2026-09-22', '16:00:00', 450, 0.0, 130, 1, 1, 2),
  (1, 6, '2026-09-23', '18:50:00', 150, 12.0, 89, 4, 1, 3),
  (1, 15, '2026-09-23', '21:05:00', 200, 15.0, 332, 3, 5, 4),
  (1, 2, '2026-09-24', '18:05:00', 500, 5.4, 98, 4, 2, 2),
  (1, 16, '2026-09-25', '09:45:00', 250, 0.0, 153, 6, 1, 2),
  (1, 4, '2026-09-25', '20:20:00', 500, 4.7, 146, 2, 1, 1),
  (1, 2, '2026-09-25', '22:00:00', 500, 5.4, 98, 5, 3, 1),
  (1, 14, '2026-09-25', '22:15:00', 100, 24.0, 152, 3, 6, 2),
  (1, 2, '2026-09-26', '20:40:00', 330, 5.4, 64, 4, 2, 4),
  (1, 4, '2026-09-26', '21:05:00', 500, 4.7, 147, 2, 7, 1),
  (1, 4, '2026-09-26', '22:00:00', 1000, 4.7, 306, 1, 1, 5),
  (1, 17, '2026-09-28', '08:45:00', 30, 0.0, 101, 6, 1, 2),
  (1, 18, '2026-09-30', '08:15:00', 300, 0.0, 211, 6, 1, 2),
  (1, 1, '2026-09-30', '22:20:00', 500, 4.9, 76, 5, 5, 5),
  (1, 16, '2026-10-02', '10:45:00', 250, 0.0, 150, 6, 1, 3),
  (1, 12, '2026-10-02', '21:05:00', 50, 40.0, 87, 1, 3, 5),
  (1, 13, '2026-10-02', '22:40:00', 100, 38.0, 193, 1, 3, 1),
  (1, 10, '2026-10-02', '23:45:00', 50, 40.0, 95, 1, 5, 1),
  (1, 18, '2026-10-04', '08:45:00', 300, 0.0, 209, 6, 1, 1),
  (1, 18, '2026-10-06', '09:30:00', 300, 0.0, 220, 6, 1, 1),
  (1, 18, '2026-10-07', '11:00:00', 300, 0.0, 191, 6, 1, 1),
  (1, 16, '2026-10-08', '08:00:00', 250, 0.0, 156, 6, 1, 2),
  (1, 15, '2026-10-09', '20:45:00', 300, 15.0, 517, 3, 7, 2),
  (1, 4, '2026-10-09', '22:10:00', 330, 4.7, 91, 4, 6, 2),
  (1, 17, '2026-10-10', '09:30:00', 30, 0.0, 110, 6, 1, 1),
  (1, 7, '2026-10-10', '22:45:00', 150, 12.0, 82, 1, 4, 2),
  (1, 17, '2026-10-12', '08:15:00', 30, 0.0, 104, 6, 1, 5),
  (1, 17, '2026-10-13', '08:30:00', 30, 0.0, 100, 6, 1, 1),
  (1, 15, '2026-10-15', '21:05:00', 300, 15.0, 466, 3, 6, 3),
  (1, 4, '2026-10-18', '23:30:00', 330, 4.7, 92, 1, 4, 5),
  (1, 16, '2026-10-19', '10:45:00', 250, 0.0, 163, 6, 1, 5),
  (1, 16, '2026-10-20', '09:45:00', 250, 0.0, 151, 6, 1, 2),
  (1, 1, '2026-10-23', '18:30:00', 500, 4.9, 74, 1, 1, 5),
  (1, 2, '2026-10-23', '23:30:00', 500, 5.4, 86, 2, 7, 1),
  (1, 18, '2026-10-24', '08:15:00', 300, 0.0, 214, 6, 1, 1),
  (1, 10, '2026-10-24', '18:10:00', 50, 40.0, 96, 5, 2, 1),
  (1, 13, '2026-10-24', '20:10:00', 50, 38.0, 92, 3, 7, 2),
  (1, 18, '2026-10-27', '08:30:00', 300, 0.0, 204, 6, 1, 5),
  (1, 4, '2026-10-27', '18:30:00', 330, 4.7, 99, 1, 6, 1),
  (1, 17, '2026-10-28', '10:30:00', 30, 0.0, 102, 6, 1, 1),
  (1, 14, '2026-10-28', '21:40:00', 50, 24.0, 79, 4, 2, 4);
INSERT INTO entries (user_id, drink_id, entry_date, entry_time, volume_ml, strength, price, place_id, reason_id, company_id) VALUES
  (1, 17, '2026-10-29', '11:00:00', 30, 0.0, 107, 6, 1, 4),
  (1, 19, '2026-10-29', '14:40:00', 450, 0.0, 116, 6, 1, 5),
  (1, 14, '2026-10-29', '23:45:00', 50, 24.0, 74, 1, 2, 3),
  (1, 18, '2026-10-30', '09:45:00', 300, 0.0, 215, 6, 1, 1),
  (1, 15, '2026-10-31', '19:00:00', 300, 15.0, 463, 3, 4, 3),
  (1, 2, '2026-10-31', '20:05:00', 500, 5.4, 97, 1, 1, 1),
  (1, 15, '2026-10-31', '20:30:00', 200, 15.0, 321, 3, 1, 2),
  (1, 18, '2026-11-01', '08:45:00', 300, 0.0, 202, 6, 1, 1),
  (1, 1, '2026-11-01', '21:00:00', 500, 4.9, 71, 5, 3, 2),
  (1, 16, '2026-11-02', '08:45:00', 250, 0.0, 146, 6, 1, 1),
  (1, 18, '2026-11-04', '08:30:00', 300, 0.0, 207, 6, 1, 1);
INSERT INTO daily_records (user_id, record_date, sleep_quality, morning_condition, note) VALUES
  (1, '2026-08-05', 4, 5, NULL),
  (1, '2026-08-06', 1, 2, NULL),
  (1, '2026-08-07', 3, 5, NULL),
  (1, '2026-08-08', 3, 5, NULL),
  (1, '2026-08-09', 4, 3, NULL),
  (1, '2026-08-10', 1, 2, NULL),
  (1, '2026-08-11', 3, 4, NULL),
  (1, '2026-08-12', 4, 5, NULL),
  (1, '2026-08-13', 5, 4, NULL),
  (1, '2026-08-14', 4, 5, NULL),
  (1, '2026-08-15', 4, 3, 'Застолье у брата, день рождения'),
  (1, '2026-08-16', 3, 5, NULL),
  (1, '2026-08-17', 3, 4, NULL),
  (1, '2026-08-18', 5, 4, NULL),
  (1, '2026-08-19', 5, 4, NULL),
  (1, '2026-08-20', 4, 4, NULL),
  (1, '2026-08-21', 5, 4, NULL),
  (1, '2026-08-22', 3, 4, NULL),
  (1, '2026-08-23', 2, 3, NULL),
  (1, '2026-08-24', 3, 4, NULL),
  (1, '2026-08-25', 5, 3, NULL),
  (1, '2026-08-26', 5, 4, NULL),
  (1, '2026-08-27', 3, 5, NULL),
  (1, '2026-08-28', 4, 5, NULL),
  (1, '2026-08-29', 4, 4, 'Отпуск, выезд на природу'),
  (1, '2026-08-30', 3, 3, NULL),
  (1, '2026-08-31', 5, 5, NULL),
  (1, '2026-09-01', 5, 5, NULL),
  (1, '2026-09-02', 3, 5, NULL),
  (1, '2026-09-03', 3, 5, NULL),
  (1, '2026-09-04', 4, 5, NULL),
  (1, '2026-09-05', 3, 3, NULL),
  (1, '2026-09-06', 4, 2, NULL),
  (1, '2026-09-07', 4, 4, NULL),
  (1, '2026-09-08', 2, 2, NULL),
  (1, '2026-09-09', 4, 3, NULL),
  (1, '2026-09-10', 3, 5, NULL),
  (1, '2026-09-11', 4, 4, NULL),
  (1, '2026-09-12', 5, 3, 'Свадьба у однокурсника'),
  (1, '2026-09-13', 3, 3, NULL),
  (1, '2026-09-14', 5, 4, NULL),
  (1, '2026-09-15', 4, 4, NULL),
  (1, '2026-09-16', 4, 4, NULL),
  (1, '2026-09-17', 4, 5, NULL),
  (1, '2026-09-18', 5, 4, NULL),
  (1, '2026-09-19', 3, 5, NULL),
  (1, '2026-09-20', 3, 4, NULL),
  (1, '2026-09-21', 5, 4, NULL),
  (1, '2026-09-22', 5, 4, NULL),
  (1, '2026-09-23', 3, 4, NULL),
  (1, '2026-09-24', 4, 3, NULL),
  (1, '2026-09-25', 4, 5, 'Сдача долгостроя по проекту — отметили'),
  (1, '2026-09-26', 4, 4, NULL),
  (1, '2026-09-27', 1, 2, NULL),
  (1, '2026-09-28', 4, 5, NULL),
  (1, '2026-09-29', 4, 5, NULL),
  (1, '2026-09-30', 4, 4, NULL),
  (1, '2026-10-01', 5, 5, NULL),
  (1, '2026-10-02', 4, 4, NULL),
  (1, '2026-10-03', 2, 1, 'Вечеринка у друзей'),
  (1, '2026-10-04', 5, 5, NULL),
  (1, '2026-10-05', 4, 5, NULL),
  (1, '2026-10-06', 5, 4, NULL),
  (1, '2026-10-07', 4, 4, NULL),
  (1, '2026-10-08', 5, 4, NULL),
  (1, '2026-10-09', 4, 5, NULL),
  (1, '2026-10-10', 4, 4, NULL),
  (1, '2026-10-11', 5, 4, NULL),
  (1, '2026-10-12', 3, 4, NULL),
  (1, '2026-10-13', 4, 5, NULL),
  (1, '2026-10-14', 5, 5, NULL),
  (1, '2026-10-15', 3, 4, NULL),
  (1, '2026-10-16', 4, 4, NULL),
  (1, '2026-10-17', 4, 5, 'Корпоративный тимбилдинг'),
  (1, '2026-10-18', 3, 5, NULL),
  (1, '2026-10-19', 4, 3, NULL),
  (1, '2026-10-20', 3, 5, NULL),
  (1, '2026-10-21', 4, 4, NULL),
  (1, '2026-10-22', 3, 4, NULL),
  (1, '2026-10-23', 3, 4, NULL),
  (1, '2026-10-24', 3, 2, NULL),
  (1, '2026-10-25', 4, 4, NULL),
  (1, '2026-10-26', 5, 4, NULL),
  (1, '2026-10-27', 5, 5, NULL),
  (1, '2026-10-28', 5, 3, NULL),
  (1, '2026-10-29', 5, 4, NULL),
  (1, '2026-10-30', 3, 3, NULL),
  (1, '2026-10-31', 3, 4, 'Хэллоуин в баре'),
  (1, '2026-11-01', 3, 2, NULL),
  (1, '2026-11-02', 3, 4, NULL),
  (1, '2026-11-03', 4, 4, NULL),
  (1, '2026-11-04', 4, 5, NULL);

SET FOREIGN_KEY_CHECKS = 1;
