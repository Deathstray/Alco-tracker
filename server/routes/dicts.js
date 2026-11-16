/**
 * routes/dicts.js — справочники: типы напитков, напитки, места, поводы, компании.
 * Справочники общие для всех пользователей, поэтому фильтр по user_id не нужен.
 */
const express = require('express');
const db = require('../db');
const { sendSuccess, asyncRoute } = require('../helpers');

const router = express.Router();

/* Типы напитков (алкогольные и безалкогольные) */
router.get('/types', asyncRoute(async (req, res) => {
    sendSuccess(res, await db.query('SELECT * FROM drink_types ORDER BY type_id'));
}));

/* Напитки; опциональный фильтр — ?type_id=N */
router.get('/drinks', asyncRoute(async (req, res) => {
    let sql = 'SELECT d.*, t.type_name, t.is_alcoholic' +
              ' FROM drinks d JOIN drink_types t ON t.type_id = d.type_id';
    const params = [];
    if (req.query.type_id) {
        sql += ' WHERE d.type_id = ?';
        params.push(Number(req.query.type_id));
    }
    sql += ' ORDER BY t.type_id, d.drink_name';
    sendSuccess(res, await db.query(sql, params));
}));

/* Места употребления (унифицированные поля id + name) */
router.get('/places', asyncRoute(async (req, res) => {
    sendSuccess(res, await db.query('SELECT place_id AS id, place_name AS name FROM places ORDER BY place_id'));
}));

/* Поводы */
router.get('/reasons', asyncRoute(async (req, res) => {
    sendSuccess(res, await db.query('SELECT reason_id AS id, reason_name AS name FROM reasons ORDER BY reason_id'));
}));

/* Компании */
router.get('/companies', asyncRoute(async (req, res) => {
    sendSuccess(res, await db.query('SELECT company_id AS id, company_name AS name FROM companies ORDER BY company_id'));
}));

module.exports = router;
