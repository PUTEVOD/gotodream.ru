// Единый источник правды по контракту поиска рейсов.
// Всё, что знают обе стороны (фронт и Deno-бэкенд), описано здесь.
// Бэкенд повторяет эти же правила в backend/main.ts — фронтовая валидация
// нужна для UX, серверная — для корректности. Одна без другой недопустима.

import { resolveAirportCode } from "./airports";

export const TRIP_TYPES = {
    ONE_WAY: "oneWay",
    ROUND_TRIP: "roundTrip",
    COMPLEX: "complex",
};

export const CABIN_CLASSES = {
    ECONOMY: "economy",
    COMFORT: "comfort",
    BUSINESS: "business",
};

export const CABIN_CLASS_LABELS = {
    [CABIN_CLASSES.ECONOMY]: "Эконом",
    [CABIN_CLASSES.COMFORT]: "Комфорт",
    [CABIN_CLASSES.BUSINESS]: "Бизнес",
};

/** Обратное соответствие: русская подпись из фильтров -> значение контракта. */
export const CABIN_CLASS_BY_LABEL = Object.fromEntries(
    Object.entries(CABIN_CLASS_LABELS).map(([value, label]) => [label.toLowerCase(), value])
);

export const TRIP_TYPE_LABELS = {
    [TRIP_TYPES.ONE_WAY]: "В одну сторону",
    [TRIP_TYPES.ROUND_TRIP]: "Туда и обратно",
    [TRIP_TYPES.COMPLEX]: "Сложный маршрут",
};

export const SORT_TYPES = ["cheapest", "fastest", "convenient"];

export const SORT_LABELS = {
    cheapest: "Самый дешёвый",
    fastest: "Самый быстрый",
    convenient: "Самый удобный",
};

export const STOPS_OPTIONS = [
    { value: 0, label: "Без пересадок" },
    { value: 1, label: "1 пересадка" },
    { value: 2, label: "2 пересадки" },
];

/* Списка авиакомпаний здесь больше нет. Он приходит с ответом сервера
   (поле facets.airlines) и содержит только те компании, которые реально
   есть в текущей выдаче, со счётчиком рейсов. Константа на фронте не может
   знать, кто летает по конкретному маршруту в конкретный день, и приводила
   к фильтру, который гарантированно ничего не находит. */

export const PASSENGER_TYPES = [
    {
        key: "adults",
        label: "Взрослые",
        subLabel: "старше 18 лет на момент перелёта",
        min: 1,
        occupiesSeat: true,
    },
    {
        key: "teens",
        label: "Подростки",
        subLabel: "от 12 до 18 лет на момент перелёта",
        min: 0,
        occupiesSeat: true,
    },
    {
        key: "children",
        label: "Дети",
        subLabel: "от 2 до 12 лет на момент перелёта",
        min: 0,
        occupiesSeat: true,
    },
    {
        key: "infants",
        label: "Младенцы",
        subLabel: "до 2 лет, без места, на руках у взрослого",
        min: 0,
        occupiesSeat: false,
    },
];

export const LIMITS = {
    MAX_SEGMENTS: 6,      // максимум перелётов в сложном маршруте
    MAX_SEATS: 9,         // максимум пассажиров с местом в одном бронировании
    MAX_DAYS_AHEAD: 361,  // глубина продажи
};

export const EMPTY_PASSENGERS = { adults: 1, teens: 0, children: 0, infants: 0 };

/* ------------------------------------------------------------------ */
/* Работа с датами. Везде используется формат YYYY-MM-DD (значение     */
/* <input type="date">). Date-объекты не хранятся в состоянии, чтобы    */
/* исключить сдвиги часового пояса.                                     */
/* ------------------------------------------------------------------ */

export function todayISO() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

export function addDaysISO(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00`);
    d.setDate(d.getDate() + days);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

export const isValidISODate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(`${value}T00:00:00`));

/* ------------------------------------------------------------------ */
/* Валидация формы                                                     */
/* ------------------------------------------------------------------ */

export function countSeats(passengers) {
    return PASSENGER_TYPES.filter((t) => t.occupiesSeat).reduce(
        (sum, t) => sum + (passengers[t.key] || 0),
        0
    );
}

export function countPassengers(passengers) {
    return PASSENGER_TYPES.reduce((sum, t) => sum + (passengers[t.key] || 0), 0);
}

/**
 * @returns {{ ok: boolean, errors: Record<string,string> }}
 * Ключи ошибок: "segments.0.origin", "segments.1.date", "returnDate", "passengers", "cabinClass".
 */
export function validateSearchForm(state) {
    const { tripType, segments, returnDate, passengers, cabinClass } = state;
    const errors = {};
    const minDate = todayISO();
    const maxDate = addDaysISO(minDate, LIMITS.MAX_DAYS_AHEAD);

    const activeSegments = tripType === TRIP_TYPES.COMPLEX ? segments : segments.slice(0, 1);

    if (tripType === TRIP_TYPES.COMPLEX && activeSegments.length > LIMITS.MAX_SEGMENTS) {
        errors["segments"] = `Не более ${LIMITS.MAX_SEGMENTS} перелётов в одном маршруте`;
    }

    activeSegments.forEach((segment, index) => {
        const origin = resolveAirportCode(segment.origin);
        const destination = resolveAirportCode(segment.destination);

        if (!segment.origin?.trim()) errors[`segments.${index}.origin`] = "Укажите пункт вылета";
        else if (!origin) errors[`segments.${index}.origin`] = "Выберите город или аэропорт из списка";

        if (!segment.destination?.trim()) errors[`segments.${index}.destination`] = "Укажите пункт назначения";
        else if (!destination) errors[`segments.${index}.destination`] = "Выберите город или аэропорт из списка";

        if (origin && destination && origin === destination) {
            errors[`segments.${index}.destination`] = "Пункт назначения совпадает с пунктом вылета";
        }

        if (!segment.date) errors[`segments.${index}.date`] = "Укажите дату";
        else if (!isValidISODate(segment.date)) errors[`segments.${index}.date`] = "Некорректная дата";
        else if (segment.date < minDate) errors[`segments.${index}.date`] = "Дата в прошлом";
        else if (segment.date > maxDate) errors[`segments.${index}.date`] = "Слишком далёкая дата";

        // В сложном маршруте даты не должны идти назад.
        if (index > 0) {
            const prev = activeSegments[index - 1].date;
            if (prev && segment.date && segment.date < prev) {
                errors[`segments.${index}.date`] = "Дата раньше предыдущего перелёта";
            }
        }
    });

    if (tripType === TRIP_TYPES.ROUND_TRIP) {
        const departureDate = activeSegments[0]?.date;
        if (!returnDate) errors.returnDate = "Укажите дату возвращения";
        else if (!isValidISODate(returnDate)) errors.returnDate = "Некорректная дата";
        else if (departureDate && returnDate < departureDate) errors.returnDate = "Раньше даты вылета";
        else if (returnDate > maxDate) errors.returnDate = "Слишком далёкая дата";
    }

    const seats = countSeats(passengers);
    if (!passengers.adults || passengers.adults < 1) errors.passengers = "Нужен минимум один взрослый";
    else if (seats > LIMITS.MAX_SEATS) errors.passengers = `Не более ${LIMITS.MAX_SEATS} пассажиров с местом`;
    else if (passengers.infants > passengers.adults) errors.passengers = "Младенцев не может быть больше, чем взрослых";

    if (!Object.values(CABIN_CLASSES).includes(cabinClass)) errors.cabinClass = "Некорректный класс обслуживания";

    return { ok: Object.keys(errors).length === 0, errors };
}

/* ------------------------------------------------------------------ */
/* Сборка payload                                                      */
/* ------------------------------------------------------------------ */

/**
 * Превращает состояние формы в тело запроса POST /api/search.
 * Вызывать только после успешной validateSearchForm.
 */
export function buildSearchPayload(state) {
    const { tripType, segments, returnDate, passengers, cabinClass } = state;
    const activeSegments = tripType === TRIP_TYPES.COMPLEX ? segments : segments.slice(0, 1);

    const itinerary = activeSegments.map((segment) => ({
        origin: resolveAirportCode(segment.origin),
        destination: resolveAirportCode(segment.destination),
        departureDate: segment.date,
    }));

    if (tripType === TRIP_TYPES.ROUND_TRIP && returnDate) {
        itinerary.push({
            origin: itinerary[0].destination,
            destination: itinerary[0].origin,
            departureDate: returnDate,
        });
    }

    return {
        tripType,
        cabinClass,
        itinerary,
        passengers: {
            adults: passengers.adults || 0,
            teens: passengers.teens || 0,
            children: passengers.children || 0,
            infants: passengers.infants || 0,
        },
        currency: "RUB",
        locale: "ru-RU",
    };
}

/**
 * Приводит состояние фильтров страницы к части payload.filters.
 * `touched` отсекает диапазоны, которые пользователь не трогал: иначе дефолтные
 * значения слайдеров молча отрезают половину выдачи.
 */
export function buildFilters({
                                 departureRange,
                                 arrivalRange,
                                 durationRange,
                                 stops,
                                 sortType,
                                 selectedClasses,
                                 selectedAirlines,
                                 touched = {},
                             }) {
    const filters = { sortType: SORT_TYPES.includes(sortType) ? sortType : "cheapest" };

    if (touched.departureRange) filters.departureRange = departureRange;
    if (touched.arrivalRange) filters.arrivalRange = arrivalRange;
    if (touched.durationRange) filters.durationRange = durationRange;
    if (stops?.length) filters.stops = [...stops].sort((a, b) => a - b);
    if (selectedAirlines?.length) filters.airlines = selectedAirlines;

    if (selectedClasses?.length) {
        // Фильтр хранит значения контракта ("economy"). Русские подписи
        // принимаются тоже — на случай старого кода, который клал в состояние
        // текст из разметки: именно на этом расхождении запрос уходил
        // на сервер с cabinClass: "эконом" и отвергался валидацией.
        filters.cabinClasses = selectedClasses
            .map((item) => {
                const value = String(item);
                if (Object.values(CABIN_CLASSES).includes(value)) return value;
                return CABIN_CLASS_BY_LABEL[value.toLowerCase()] || null;
            })
            .filter(Boolean);
    }

    return filters;
}
