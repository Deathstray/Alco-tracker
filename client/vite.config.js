/**
 * vite.config.js — настройка сборки клиента (Vite + React).
 *
 * dev-сервер Vite поднимается на порту 5173, а все запросы /api/*
 * через прокси уходят на Express-сервер (порт 3000). Благодаря этому
 * cookie сессии работают без настройки CORS.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3000',
        },
    },
});
