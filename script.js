$(document).ready(function () {
    // Подключение автозаполнения для регионов
    $.get('http://localhost:3000/regions', function (regions) {
        const regionNames = regions.map(region => region.stop_area);

        $('#region').autocomplete({
            source: regionNames
        });
    });

    // Обработка подтверждения выбора региона
    $('#confirm-region').on('click', function () {
        const region = $('#region').val();

        if (!region) {
            alert('Пожалуйста, выберите регион.');
            return;
        }

        $.get(`http://localhost:3000/stops/${region}`, function (stops) {
            const stopNames = stops.map(stop => stop.stop_name);

            $('#stop').autocomplete({
                source: stopNames
            });

            $('#bus-buttons').empty();
            $('#arrival-times').empty();
        });
    });

    // Обработка подтверждения выбора остановки
    $('#confirm-stop').on('click', function () {
        const stopName = $('#stop').val();
        const region = $('#region').val();

        if (stopName) {
            console.log("Выбранная остановка:", stopName);
            $.get(`http://localhost:3000/buses-by-stopname/${stopName}`, function (buses) {
                $('#bus-buttons').empty();

                if (buses.length > 0) {
                    buses.forEach(bus => {
                        const button = $('<button>')
                            .addClass('btn btn-outline-primary m-1 bus-button')
                            .text(`Автобус ${bus.bus_number}`)
                            .on('click', function () {
                                showArrivalTimes(bus.bus_number, region, stopName);
                            });

                        $('#bus-buttons').append(button);
                    });
                } else {
                    $('#bus-buttons').append('<p>Нет доступных автобусов для этой остановки.</p>');
                }
            }).fail(function (err) {
                console.error("Ошибка получения автобусов:", err);
            });
        } else {
            alert("Введите название остановки!");
        }
    });

    // Кнопка очистки всех полей
    $('#clear-button').on('click', function () {
        $('#region').val('');
        $('#stop').val('');
        $('#bus-buttons').empty();
        $('#arrival-times').empty();
    });
});


// Функция для отображения времени прибытия ближайших автобусов
function showArrivalTimes(busNumber, region, stop_name) {
    $.get(`http://localhost:3000/arrivals/${busNumber}/${region}/${stop_name}`, function (arrivals) {
        $('#arrival-times').empty();

        if (arrivals.length > 0) {
            // Получаем текущее время пользователя
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes(); // Время в минутах с начала дня

            // Фильтруем автобусы по текущему времени
            const upcomingArrivals = arrivals.filter(arrival => {
                const [hours, minutes] = arrival.arrival_time.split(':').map(Number);
                const arrivalTime = hours * 60 + minutes; // Конвертируем в минуты с начала дня
                return arrivalTime >= currentTime;
            });

            // Сортируем по времени прибытия
            upcomingArrivals.sort((a, b) => {
                const [hoursA, minutesA] = a.arrival_time.split(':').map(Number);
                const [hoursB, minutesB] = b.arrival_time.split(':').map(Number);
                return (hoursA * 60 + minutesA) - (hoursB * 60 + minutesB);
            });

            // Отображаем ближайшие автобусы с информацией о пути
            if (upcomingArrivals.length > 0) {
                upcomingArrivals.forEach(arrival => {
                    $('#arrival-times').append(`
                        <p>
                            Автобус ${arrival.route_short_name} 
                            (${arrival.trip_long_name}) 
                            прибудет в ${arrival.arrival_time}
                        </p>
                    `);
                });
            } else {
                $('#arrival-times').append('<p>Нет автобусов после текущего времени.</p>');
            }
        } else {
            $('#arrival-times').append('<p>Нет данных о времени прибытия.</p>');
        }
    }).fail(function (err) {
        console.error("Ошибка получения времени прибытия:", err);
        alert("Ошибка получения данных о времени прибытия.");
    });
}


// Получение координат пользователя и поиск ближайших остановок
navigator.geolocation.getCurrentPosition(function (position) {
    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;

    $.get(`http://localhost:3000/nearest-stops?lat=${userLat}&lon=${userLon}`, function (stops) {
        console.log("Nearest stops: ", stops);

        // Сортируем остановки по расстоянию (по возрастанию)
        stops.sort((a, b) => a.distance - b.distance);

        // Отображаем только самую ближайшую остановку как кнопку
        $('#nearest-stops').empty();
        if (stops.length > 0) {
            const closestStop = stops[0];

            // Создаем кнопку для самой ближайшей остановки
            const stopButton = $('<button>')
                .addClass('btn btn-outline-primary m-1')
                .text(`Ближайшая остановка: ${closestStop.stop_area},${closestStop.stop_name}, Расстояние: ${closestStop.distance.toFixed(2)} км`)
                .on('click', function () {
                    // Когда нажимается кнопка, ищем автобусы для этой остановки
                    $('#region').val(closestStop.stop_area);
                    $('#stop').val(closestStop.stop_name);
                    $.get(`http://localhost:3000/buses-by-stopname/${closestStop.stop_name}`, function (buses) {
                        $('#bus-buttons').empty();

                        if (buses.length > 0) {
                            buses.forEach(bus => {
                                const button = $('<button>')
                                    .addClass('btn btn-outline-primary m-1 bus-button')
                                    .text(`Автобус ${bus.bus_number}`)
                                    .on('click', function () {
                                        showArrivalTimes(bus.bus_number, closestStop.stop_area, closestStop.stop_name);
                                    });

                                $('#bus-buttons').append(button);
                            });
                        } else {
                            $('#bus-buttons').append('<p>Нет доступных автобусов для этой остановки.</p>');
                        }
                    }).fail(function (err) {
                        console.error("Ошибка получения автобусов:", err);
                    });
                });

            $('#nearest-stops').append(stopButton);
        } else {
            $('#nearest-stops').append('<p>Ближайшая остановка не найдена.</p>');
        }
    }).fail(function (err) {
        console.error("Ошибка получения ближайших остановок:", err);
    });
});