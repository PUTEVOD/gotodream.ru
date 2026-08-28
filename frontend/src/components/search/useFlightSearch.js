import { useCallback, useEffect, useRef, useState } from "react";
import { searchFlights, ApiError } from "./searchApi";
import { buildFilters } from "./contract";

/**
 * Вся работа с сетью для страницы поиска: запрос, состояния, отмена гонок,
 * повтор при смене фильтров. Компонент страницы остаётся разметкой.
 *
 * @param {object} filters состояние фильтров страницы (см. buildFilters)
 * @returns {{
 *   status: "idle"|"loading"|"success"|"error",
 *   flights: Array,
 *   error: ApiError|null,
 *   fieldErrors: object|null,
 *   hasSearched: boolean,
 *   search: (payload) => void,
 *   retry: () => void
 * }}
 */
export function useFlightSearch(filters, { debounceMs = 300 } = {}) {
    const [state, setState] = useState({ status: "idle", flights: [], error: null });

    const payloadRef = useRef(null);    // последний payload формы
    const filtersRef = useRef(filters); // актуальные фильтры без пересоздания run
    const requestRef = useRef(null);    // контроллер текущего запроса

    filtersRef.current = filters;

    const run = useCallback(async (payload, filtersState) => {
        // Предыдущий запрос отменяем: иначе ответ на него может прийти позже
        // и перезаписать результат нового поиска.
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;

        setState((prev) => ({ ...prev, status: "loading", error: null }));

        try {
            const data = await searchFlights(
                { ...payload, filters: buildFilters(filtersState) },
                { signal: controller.signal },
            );
            if (controller.signal.aborted) return;
            setState({
                status: "success",
                flights: Array.isArray(data.flights) ? data.flights : [],
                error: null,
            });
        } catch (error) {
            if (error?.name === "AbortError") return; // запрос вытеснен новым — это не ошибка
            setState({
                status: "error",
                flights: [],
                error: error instanceof ApiError ? error : new ApiError("Неизвестная ошибка"),
            });
        }
    }, []);

    const search = useCallback((payload) => {
        payloadRef.current = payload;
        run(payload, filtersRef.current);
    }, [run]);

    const retry = useCallback(() => {
        if (payloadRef.current) run(payloadRef.current, filtersRef.current);
    }, [run]);

    // Смена фильтров после выполненного поиска перезапрашивает выдачу.
    // Ключом служит сериализованный объект: эффект не зависит от того,
    // пересоздаёт ли вызывающий компонент объект фильтров на каждом рендере.
    const filtersKey = JSON.stringify(filters);

    useEffect(() => {
        if (!payloadRef.current) return undefined;
        // debounce: слайдеры времени генерируют десятки событий подряд
        const timer = setTimeout(() => run(payloadRef.current, filtersRef.current), debounceMs);
        return () => clearTimeout(timer);
    }, [filtersKey, debounceMs, run]);

    // Незавершённый запрос при уходе со страницы отменяем.
    useEffect(() => () => requestRef.current?.abort(), []);

    return {
        ...state,
        fieldErrors: state.error?.code === "VALIDATION_ERROR" ? state.error.fieldErrors : null,
        hasSearched: payloadRef.current !== null,
        search,
        retry,
    };
}
