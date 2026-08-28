// Минимальный справочник аэропортов.
// Назначение: превратить свободный текст в поле "Откуда/Куда" в IATA-код,
// который бэкенд может однозначно интерпретировать.
// В продакшене этот файл заменяется запросом к /api/airports?q=...

export const AIRPORTS = [
    { code: "MOW", city: "Москва", name: "Все аэропорты", country: "RU" },
    { code: "SVO", city: "Москва", name: "Шереметьево", country: "RU" },
    { code: "DME", city: "Москва", name: "Домодедово", country: "RU" },
    { code: "VKO", city: "Москва", name: "Внуково", country: "RU" },
    { code: "LED", city: "Санкт-Петербург", name: "Пулково", country: "RU" },
    { code: "AER", city: "Сочи", name: "Сочи", country: "RU" },
    { code: "KZN", city: "Казань", name: "Казань", country: "RU" },
    { code: "SVX", city: "Екатеринбург", name: "Кольцово", country: "RU" },
    { code: "OVB", city: "Новосибирск", name: "Толмачёво", country: "RU" },
    { code: "KJA", city: "Красноярск", name: "Емельяново", country: "RU" },
    { code: "VVO", city: "Владивосток", name: "Кневичи", country: "RU" },
    { code: "KGD", city: "Калининград", name: "Храброво", country: "RU" },
    { code: "MRV", city: "Минеральные Воды", name: "Минеральные Воды", country: "RU" },
    { code: "UFA", city: "Уфа", name: "Уфа", country: "RU" },
    { code: "GOJ", city: "Нижний Новгород", name: "Стригино", country: "RU" },
    { code: "TSE", city: "Астана", name: "Нурсултан Назарбаев", country: "KZ" },
    { code: "ALA", city: "Алматы", name: "Алматы", country: "KZ" },
    { code: "TAS", city: "Ташкент", name: "Ислам Каримов", country: "UZ" },
    { code: "EVN", city: "Ереван", name: "Звартноц", country: "AM" },
    { code: "IST", city: "Стамбул", name: "Стамбул", country: "TR" },
    { code: "DXB", city: "Дубай", name: "Дубай", country: "AE" },
];

const CODE_RE = /^[A-Za-z]{3}$/;

/** Человекочитаемая подпись для datalist: "Москва, Шереметьево (SVO)" */
export const airportLabel = (a) => `${a.city}, ${a.name} (${a.code})`;

/**
 * Приводит произвольный ввод к IATA-коду.
 * Принимает: "SVO", "svo", "Москва", "Москва, Шереметьево (SVO)".
 * Возвращает код в верхнем регистре или null, если распознать не удалось.
 */
export function resolveAirportCode(input) {
    if (!input) return null;
    const raw = String(input).trim();
    if (!raw) return null;

    const inBrackets = raw.match(/\(([A-Za-z]{3})\)\s*$/);
    if (inBrackets) return inBrackets[1].toUpperCase();

    if (CODE_RE.test(raw)) {
        const code = raw.toUpperCase();
        return AIRPORTS.some((a) => a.code === code) ? code : code;
    }

    const lower = raw.toLowerCase();
    const exactCity = AIRPORTS.find((a) => a.city.toLowerCase() === lower);
    if (exactCity) return exactCity.code;

    const byLabel = AIRPORTS.find((a) => airportLabel(a).toLowerCase() === lower);
    if (byLabel) return byLabel.code;

    return null;
}

/** Подсказки для datalist по подстроке. */
export function suggestAirports(query, limit = 8) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return AIRPORTS.slice(0, limit);
    return AIRPORTS.filter(
        (a) =>
            a.code.toLowerCase().startsWith(q) ||
            a.city.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q)
    ).slice(0, limit);
}

/** Короткая подпись для поля ввода: "Москва (SVO)". Всегда помещается в поле. */
export const airportShortLabel = (a) => `${a.city} (${a.code})`;

/** Аэропорт по IATA-коду или null. */
export const findAirportByCode = (code) =>
    AIRPORTS.find((a) => a.code === String(code || "").toUpperCase()) || null;

/**
 * Приводит содержимое поля к короткой подписи, если ввод распознан.
 * Возвращает исходную строку, если распознать не удалось, — чтобы не терять ввод.
 */
export function normalizeAirportInput(input) {
    const code = resolveAirportCode(input);
    if (!code) return input;
    const airport = findAirportByCode(code);
    return airport ? airportShortLabel(airport) : code;
}
