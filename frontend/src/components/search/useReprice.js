import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, repriceOffer } from "./searchApi";

/**
 * Подтверждение цены выбранного предложения.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ШАГ. Цена в выдаче поиска — не обязательство. Между
 * поиском и оплатой места продаются, тарифы пересчитываются, сборы меняются:
 * в примере из тестового окружения S7 поиск отдал 15 678 ₽, а пересчёт того
 * же маршрута — 15 478 ₽. Показать одну цену и списать другую нельзя,
 * поэтому цена подтверждается до того, как человек начнёт вводить данные
 * пассажиров.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ХУК, А НЕ ЧАСТЬ useFlightSearch. У этих запросов разное
 * время жизни: выдача перезапрашивается при каждом движении фильтра,
 * подтверждение цены относится к одному конкретному предложению и не должно
 * ни исчезать при перерисовке списка, ни тянуться за фильтрами.
 */
export function useReprice() {
    const [state, setState] = useState({ status: "idle", reprice: null, offerId: null, error: null });
    const requestRef = useRef(null);

    const reset = useCallback(() => {
        requestRef.current?.abort();
        requestRef.current = null;
        setState({ status: "idle", reprice: null, offerId: null, error: null });
    }, []);

    const confirm = useCallback((searchId, offer) => {
        if (!searchId || !offer) return;

        // Предыдущий пересчёт отменяем: человек мог передумать и нажать
        // «Выбрать» на другой строке, и ответ на брошенный запрос не должен
        // перезаписать актуальный.
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;

        setState({ status: "loading", reprice: null, offerId: offer.id, error: null });

        repriceOffer({ searchId, offerId: offer.id }, { signal: controller.signal })
            .then((data) => {
                if (controller.signal.aborted) return;
                setState({ status: "success", reprice: data.reprice, offerId: offer.id, error: null });
            })
            .catch((error) => {
                if (error?.name === "AbortError") return; // запрос вытеснен новым — это не ошибка
                setState({
                    status: "error",
                    reprice: null,
                    offerId: offer.id,
                    error: error instanceof ApiError ? error : new ApiError("Неизвестная ошибка"),
                });
            });
    }, []);

    // Незавершённый запрос при уходе со страницы отменяем.
    useEffect(() => () => requestRef.current?.abort(), []);

    return {
        ...state,
        /* Выдача устарела — состояние, а не поломка: с момента поиска прошло
           больше отведённого времени либо сервер перезапускался. Страница
           должна предложить повторить поиск, а не показывать текст ошибки. */
        isExpired: state.error?.code === "SEARCH_EXPIRED",
        confirm,
        reset,
    };
}
