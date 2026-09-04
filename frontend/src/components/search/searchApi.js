// Сетевой слой. Компоненты не должны знать ни про fetch, ни про URL, ни про
// формат ошибок сервера — только про ApiError и результат.

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Базовый URL API.
 * CRA:  REACT_APP_API_URL=http://localhost:8000  в файле .env
 * Vite: VITE_API_URL=http://localhost:8000       в файле .env
 * Прод: пустая строка -> запрос уходит на тот же домен через reverse proxy.
 */
export const API_BASE_URL = readEnv("REACT_APP_API_URL") ?? "http://localhost:8000";

function readEnv(name) {
    // CRA / webpack: process.env подставляется на этапе сборки.
    // Vite: замените тело на import.meta.env.VITE_API_URL (см. README).
    if (typeof process !== "undefined" && process.env && process.env[name] !== undefined) {
        return process.env[name];
    }
    return undefined;
}

export class ApiError extends Error {
    constructor(message, { status = 0, code = "UNKNOWN", details = [] } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.details = details; // [{ path: "itinerary.0.origin", message: "..." }]
    }

    /** Ошибки валидации в виде { "itinerary.0.origin": "текст" }. */
    get fieldErrors() {
        return Object.fromEntries(this.details.map((d) => [d.path, d.message]));
    }
}

async function request(path, { method = "POST", body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(new Error("timeout")), timeoutMs);

    // Внешняя отмена (смена параметров поиска) + внутренний таймаут.
    const onExternalAbort = () => timeoutController.abort(signal.reason);
    if (signal) {
        if (signal.aborted) timeoutController.abort(signal.reason);
        else signal.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: timeoutController.signal,
        });

        const text = await response.text();
        let payload = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                throw new ApiError("Сервер вернул не JSON", { status: response.status, code: "BAD_RESPONSE" });
            }
        }

        if (!response.ok) {
            const err = payload?.error || {};
            throw new ApiError(err.message || `Ошибка сервера (${response.status})`, {
                status: response.status,
                code: err.code || "HTTP_ERROR",
                details: err.details || [],
            });
        }

        return payload;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error?.name === "AbortError") throw error; // отмену обрабатывает вызывающий код
        throw new ApiError("Не удалось связаться с сервером", { code: "NETWORK_ERROR" });
    } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onExternalAbort);
    }
}

/**
 * POST /api/search
 * @param {object} payload  результат buildSearchPayload + filters
 * @param {{signal?: AbortSignal}} options
 * @returns {Promise<{searchId: string, flights: Array, meta: object}>}
 */
export function searchFlights(payload, { signal } = {}) {
    return request("/api/search", { method: "POST", body: payload, signal });
}

/**
 * POST /api/reprice — подтверждение цены выбранного предложения.
 *
 * Наружу уходят только два идентификатора. Подробности предложения (рейсы,
 * ключи сегментов, тарифы) сервер берёт из собственного хранилища выдачи:
 * если бы их присылал браузер, маршрут и тариф в запросе к перевозчику
 * задавал бы клиент.
 *
 * @param {{searchId: string, offerId: string}} body
 * @returns {Promise<{reprice: object, meta: object}>}
 */
export function repriceOffer(body, { signal } = {}) {
    // Пересчёт идёт к внешнему шлюзу и бывает дольше поиска: 15 секунд здесь
    // мало, а обрыв по таймауту выглядит как отказ перевозчика.
    return request("/api/reprice", { method: "POST", body, signal, timeoutMs: 30000 });
}

export function checkHealth({ signal } = {}) {
    return request("/api/health", { method: "GET", signal, timeoutMs: 4000 });
}
