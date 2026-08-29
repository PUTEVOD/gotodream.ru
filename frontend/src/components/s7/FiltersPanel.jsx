import React, { useCallback, useEffect, useRef, useState } from "react";
import "../styles/FiltersPanel.css";

/**
 * Обёртка для двух блоков фильтров страницы /s7.
 *
 * Идея решения: разметка ОДНА для всех экранов, режим переключает только CSS.
 *
 *   * ширина >= 1024px — у обёртки `display: contents`. Она не создаёт своего
 *     бокса, и оба <aside> остаются прямыми элементами грида .main-container,
 *     то есть встают в левую и правую колонки ровно как раньше;
 *   * ширина < 1024px — обёртка становится обычным блоком с
 *     `position: fixed` и превращается в шторку, выезжающую снизу.
 *
 * Почему так, а не через matchMedia в JS: точку перелома тогда пришлось бы
 * дублировать в CSS и в JSX, и рано или поздно они разъедутся. Здесь
 * значение 1024px записано только в FiltersPanel.css и S7.responsive.css,
 * а React про ширину экрана вообще ничего не знает — он хранит два
 * логических флага, которые на десктопе просто ни на что не влияют.
 *
 * Кнопок-триггеров две, и это осознанно:
 *   1. .filters-fab  — строка над списком рейсов, стоит в потоке страницы;
 *   2. .filters-dock — панель, приросшая к нижнему краю экрана.
 * Вторая показывается ровно тогда, когда первая ушла из поля зрения, и
 * прячется, когда та вернулась. Отслеживает это IntersectionObserver, а не
 * обработчик scroll: он не дёргает layout на каждый пиксель прокрутки.
 *
 * Props:
 *   children    — содержимое фильтров (два <aside>);
 *   title       — подпись на кнопках и в шапке шторки;
 *   activeCount — сколько фильтров сейчас применено (рисуется бейджем).
 *                 Необязательный: без него кнопки выглядят как обычно.
 */
const FiltersPanel = ({ children, title = "Фильтры", activeCount = 0 }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isBarOffscreen, setBarOffscreen] = useState(false);

    const barRef = useRef(null);
    const dockRef = useRef(null);
    const closeRef = useRef(null);
    const panelRef = useRef(null);
    const lastTriggerRef = useRef(null);
    const wasOpenRef = useRef(false);

    const close = useCallback(() => setIsOpen(false), []);

    const openFrom = useCallback((triggerRef) => () => {
        lastTriggerRef.current = triggerRef;
        setIsOpen(true);
    }, []);

    /* Видна ли строка «Фильтры» над списком рейсов.
       threshold: 0 — достаточно, чтобы из вида ушёл последний пиксель.
       На десктопе строка скрыта через display:none, и наблюдатель постоянно
       сообщает «не видно»; это безвредно, потому что нижняя панель там тоже
       скрыта стилями — режим по-прежнему определяет только CSS. */
    useEffect(() => {
        const element = barRef.current;
        if (!element || typeof IntersectionObserver === "undefined") return undefined;

        const observer = new IntersectionObserver(
            ([entry]) => setBarOffscreen(!entry.isIntersecting),
            { threshold: 0 },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    /* Пока шторка открыта, страница под ней не должна прокручиваться:
       иначе палец «проваливается» в список рейсов. Класс вешается на <body>,
       а само правило overflow:hidden лежит в CSS внутри медиазапроса — на
       десктопе оно не срабатывает, даже если флаг почему-то остался true. */
    useEffect(() => {
        if (!isOpen) return undefined;
        document.body.classList.add("filters-sheet-open");
        return () => document.body.classList.remove("filters-sheet-open");
    }, [isOpen]);

    /* Escape закрывает шторку, Tab не выпускает фокус наружу.
     *
     * Зачем ловушка фокуса. Шторка перекрывает страницу, но остальная
     * разметка никуда не делась: без перехвата Tab фокус уходит из шторки
     * в форму поиска и список рейсов, спрятанные за затемнением. Человек,
     * работающий с клавиатуры или со скринридером, теряет контекст —
     * подсветка фокуса едет по элементам, которых он не видит.
     *
     * Список фокусируемых элементов собирается заново на каждое нажатие:
     * содержимое шторки меняется (раскрытые группы фильтров, disabled-кнопки),
     * и кэшировать его нельзя. Слушатель повешен в фазе перехвата (capture),
     * чтобы сработать раньше обработчиков внутри самих фильтров. */
    useEffect(() => {
        if (!isOpen) return undefined;

        const FOCUSABLE = [
            "a[href]", "button:not([disabled])", "input:not([disabled])",
            "select:not([disabled])", "textarea:not([disabled])",
            '[tabindex]:not([tabindex="-1"])',
        ].join(", ");

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                close();
                return;
            }
            if (event.key !== "Tab") return;

            const panel = panelRef.current;
            if (!panel) return;

            // getClientRects() вместо offsetParent: у элементов внутри
            // position: fixed offsetParent всегда null, и проверка на
            // видимость дала бы пустой список.
            const items = Array.from(panel.querySelectorAll(FOCUSABLE))
                .filter((element) => element.getClientRects().length > 0);
            if (!items.length) return;

            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;

            if (!panel.contains(active)) {
                event.preventDefault();
                first.focus();
            } else if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [isOpen, close]);

    /* Фокус клавиатуры: при открытии уводим на крестик, при закрытии
       возвращаем на ту кнопку, с которой шторку открыли. Без этого
       пользователь клавиатуры после закрытия оказывается в начале страницы. */
    useEffect(() => {
        if (isOpen) {
            closeRef.current?.focus();
        } else if (wasOpenRef.current) {
            lastTriggerRef.current?.current?.focus();
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    const openClass = isOpen ? " is-open" : "";
    /* Нижняя панель не нужна, пока шторка и так раскрыта. */
    const dockClass = isBarOffscreen && !isOpen ? " is-visible" : "";

    const triggerContent = (
        <>
            <span className="filters-trigger__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                     stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
            </span>
            {title}
            {activeCount > 0 && (
                <span className="filters-trigger__badge">{activeCount}</span>
            )}
        </>
    );

    return (
        <>
            {/* Строка над списком рейсов. Стоит в потоке, ничего не перекрывает. */}
            <button
                type="button"
                ref={barRef}
                className="filters-fab"
                aria-expanded={isOpen}
                aria-controls="s7-filters-sheet"
                onClick={openFrom(barRef)}
            >
                {triggerContent}
            </button>

            {/* Панель, приросшая к нижнему краю экрана. Появляется, когда
                строка выше ушла из поля зрения. */}
            <div className={`filters-dock${dockClass}`}>
                <button
                    type="button"
                    ref={dockRef}
                    className="filters-dock__button"
                    aria-expanded={isOpen}
                    aria-controls="s7-filters-sheet"
                    onClick={openFrom(dockRef)}
                >
                    {triggerContent}
                </button>
            </div>

            {/* Затемнение. Клик по нему закрывает шторку. */}
            <div
                className={`filters-backdrop${openClass}`}
                onClick={close}
                aria-hidden="true"
            />

            {/* role и aria-modal выставляются ТОЛЬКО в открытом состоянии.
                На десктопе у обёртки display: contents — она не создаёт бокса,
                и постоянная роль «диалог» на элементе, который на самом деле
                является двумя колонками страницы, вводила бы скринридер в
                заблуждение. Открытым же элемент бывает только в мобильном
                режиме: кнопки-триггеры на десктопе скрыты через display: none. */}
            <div
                id="s7-filters-sheet"
                ref={panelRef}
                className={`filters-panel${openClass}`}
                {...(isOpen
                    ? { role: "dialog", "aria-modal": "true", "aria-label": title }
                    : {})}
            >
                <div className="filters-sheet__head">
                    <span className="filters-sheet__grabber" aria-hidden="true" />
                    <span className="filters-sheet__title">{title}</span>
                    <button
                        type="button"
                        ref={closeRef}
                        className="filters-sheet__close"
                        onClick={close}
                        aria-label="Закрыть фильтры"
                    >
                        &times;
                    </button>
                </div>

                <div className="filters-sheet__body">{children}</div>

                <div className="filters-sheet__foot">
                    <button type="button" className="filters-sheet__apply" onClick={close}>
                        Показать результаты
                    </button>
                </div>
            </div>
        </>
    );
};

export default FiltersPanel;
