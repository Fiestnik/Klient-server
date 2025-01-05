const mysql = require('mysql2');
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

// Middleware
app.use(cors());
app.use(express.json());

// Подключение к базе данных
const db = mysql.createConnection({
    host: "d26893.mysql.zonevs.eu",
    user: "d26893_busstops",
    password: "3w7PYquFJhver0!KdOfF",
    database: "d26893_busstops"
});

db.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err.message);
    } else {
        console.log('Подключение к базе данных успешно!');
    }
});

// 1. Получение всех регионов
app.get('/regions', (req, res) => {
    const query = 'SELECT DISTINCT stop_area FROM maksim_stops';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// 2. Получение остановок по региону
app.get('/stops/:region/', (req, res) => {
    const { region } = req.params;
    const query = 'SELECT DISTINCT stop_name FROM maksim_stops WHERE stop_area = ?';
    db.query(query, [region], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// 3. Получение маршрутов по остановке
app.get('/buses-by-stopname/:stop_name', (req, res) => {
    const { stop_name } = req.params;
    const query = `
        SELECT DISTINCT r.route_short_name AS bus_number
        FROM maksim_routes r
        JOIN maksim_trips t ON r.route_id = t.route_id
        JOIN maksim_stop_times st ON t.trip_id = st.trip_id
        JOIN maksim_stops s ON st.stop_id = s.stop_id
        WHERE s.stop_name = ?
        ORDER BY LENGTH(r.route_short_name), r.route_short_name;
    `;
    db.query(query, [stop_name], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});


// 4. Получение времени прибытия автобуса
app.get('/arrivals/:bus_number/:region/:stop_name', (req, res) => {
    const { bus_number, region, stop_name } = req.params;
    const queryToday = `
        SELECT DISTINCT t.trip_long_name, t.service_id, st.arrival_time, r.route_short_name, r.route_long_name
        FROM maksim_routes r
        JOIN maksim_trips t ON r.route_id = t.route_id
        JOIN maksim_stop_times st ON t.trip_id = st.trip_id
        JOIN maksim_stops s ON st.stop_id = s.stop_id
        WHERE r.route_short_name = ?
        AND s.stop_area = ?
        AND s.stop_name = ?
        AND TIME_TO_SEC(st.arrival_time) >= TIME_TO_SEC(CURRENT_TIME)
        ORDER BY st.arrival_time
        LIMIT 5;
    `;

    const queryNextDay = `
        SELECT DISTINCT t.trip_long_name, t.service_id, st.arrival_time, r.route_short_name, r.route_long_name
        FROM maksim_routes r
        JOIN maksim_trips t ON r.route_id = t.route_id
        JOIN maksim_stop_times st ON t.trip_id = st.trip_id
        JOIN maksim_stops s ON st.stop_id = s.stop_id
        WHERE r.route_short_name = ?
        AND s.stop_area = ?
        AND s.stop_name = ?
        ORDER BY st.arrival_time
        LIMIT 5;
    `;

    const params = [bus_number, region, stop_name];

    // Выполняем первый запрос
    db.query(queryToday, params, (err, resultsToday) => {
        if (err) {
            return res.status(500).json({ error: 'Database query failed', details: err });
        }

        // Если результаты найдены, возвращаем их
        if (resultsToday.length > 0) {
            return res.json(resultsToday);
        }

        // Если результатов нет, выполняем второй запрос
        db.query(queryNextDay, params, (err, resultsNextDay) => {
            if (err) {
                return res.status(500).json({ error: 'Database query failed', details: err });
            }

            // Возвращаем результаты второго запроса
            res.json(resultsNextDay);
        });
    });
});

// 5. Получение ближайших остановок по координатам пользователя
app.get('/nearest-stops', (req, res) => {
    const { lat, lon } = req.query; // получаем координаты из запроса
    const query = `
        SELECT stop_name, stop_lat, stop_lon, stop_area,
               (6371 * acos(cos(radians(?)) * cos(radians(stop_lat)) * cos(radians(stop_lon) - radians(?)) + sin(radians(?)) * sin(radians(stop_lat)))) AS distance
        FROM maksim_stops
        ORDER BY distance
        LIMIT 5;
    `;

    db.query(query, [lat, lon, lat], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});
// Запуск сервера
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
