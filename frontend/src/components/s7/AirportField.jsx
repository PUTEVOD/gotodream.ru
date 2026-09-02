import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    airportLabel,
    airportShortLabel,
    normalizeAirportInput,
    suggestAirports,
} from "../search/airports";
import { isFieldSurface } from "./fieldSurface";

/**
 * Плавная прокрутка содержимого поля по горизонтали.
 * Возвращает функцию отмены, чтобы предыдущая анимация не дралась с новой.
 */
function animateScrollTo(element, target, pxPerSecond = 60) {
    let frame = 0;
    let previous = performance.now();

    const step = (now) => {
        const delta = ((now - previous) / 1000) * pxPerSecond;
        previous = now;
        const current = element.scrollLeft;
        const direction = Math.sign(target - current);
        const next = current + direction * delta;

        if (direction === 0 || (direction > 0 ? next >= target : next <= target)) {
            element.scrollLeft = target;
            return;
        }
        element.scrollLeft = next;
        frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
}

/**
 * Поле выбора аэропорта с собственным выпадающим списком.
 *
 * Почему не нативный <datalist>: им нельзя управлять из кода — список
 * невозможно открыть по клику на иконку, нельзя подсветить пункт клавишами,
 * нельзя показать пояснение. Всё это здесь нужно, поэтому список свой.
 *
 * Список раскрывается при нажатии в ЛЮБОЕ место плашки — по подписи, по
 * значению, по пустому месту рядом, — а не только по полю ввода и иконке.
 *
 * Длинный текст в поле решается тремя способами сразу:
 *   1) выбранный аэропорт хранится в короткой форме «Москва (SVO)»;
 *   2) хвост, который всё же не поместился, обрезается многоточием (CSS);
 *   3) при наведении мышью содержимое прокручивается до конца и обратно.
 *
 * @param {string}   value    текущее значение поля
 * @param {Function} onChange (nextValue) => void
 * @param {string}   error    текст ошибки под полем
 * @param {string}   variant  "from" | "to" — определяет иконку в CSS
 */
const AirportField = ({
                          id,
                          label,
                          value,
                          onChange,
                          placeholder = "Город или аэропорт",
                          error,
                          variant = "from",
                          style,
                      }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(0);

    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const cancelScrollRef = useRef(null);

    // Список фильтруется по тому, что человек набрал. Исключение — уже выбранный
    // аэропорт в короткой форме «Москва (SVO)»: тогда показываем весь список,
    // иначе выбрать другой можно будет только стерев текст.
    const isPicked = /\([A-Za-z]{3}\)\s*$/.test(value || "");
    const query = isPicked ? "" : value;
    const items = useMemo(() => suggestAirports(query, 8), [query]);

    const stopScroll = () => {
        cancelScrollRef.current?.();
        cancelScrollRef.current = null;
    };

    const resetScroll = () => {
        stopScroll();
        if (inputRef.current) inputRef.current.scrollLeft = 0;
    };

    const close = () => {
        setIsOpen(false);
        // Приводим ввод к короткой форме и возвращаем текст к началу строки:
        // после набора длинного названия поле остаётся прокрученным вправо.
        const normalized = normalizeAirportInput(value);
        if (normalized !== value) onChange(normalized);
        resetScroll();
    };

    const open = () => {
        stopScroll();
        setHighlighted(0);
        setIsOpen(true);
    };

    const select = (airport) => {
        onChange(airportShortLabel(airport));
        setIsOpen(false);
        resetScroll();
    };

    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) close();
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, value]);

    useEffect(() => stopScroll, []);

    /* --------------------- прокрутка длинного значения --------------------- */

    const handleMouseEnter = () => {
        const element = inputRef.current;
        // Пока поле в фокусе, прокруткой управляет каретка — не мешаем.
        if (!element || document.activeElement === element) return;

        const overflow = element.scrollWidth - element.clientWidth;
        if (overflow <= 1) return;

        stopScroll();
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            element.scrollLeft = overflow; // без анимации, сразу показываем хвост
            return;
        }
        cancelScrollRef.current = animateScrollTo(element, overflow, 55);
    };

    const handleMouseLeave = () => {
        const element = inputRef.current;
        if (!element || document.activeElement === element) return;
        stopScroll();
        cancelScrollRef.current = animateScrollTo(element, 0, 220);
    };

    const handleKeyDown = (event) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!isOpen) open();
            else setHighlighted((i) => Math.min(i + 1, items.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((i) => Math.max(i - 1, 0));
        } else if (event.key === "Enter" && isOpen && items[highlighted]) {
            event.preventDefault(); // не отправляем форму, а выбираем пункт
            select(items[highlighted]);
        } else if (event.key === "Escape" || event.key === "Tab") {
            close();
        }
    };

    /* Нажатие по «фону» плашки: подпись, отступы, сама плашка.
     *
     * mousedown с preventDefault, а не click: иначе браузер сначала уводит
     * фокус из поля на контейнер, срабатывает onBlur и список закрывается —
     * а обработчик открыл бы его снова, и это выглядело бы как мигание.
     * Интерактивные потомки и содержимое самого списка сюда не попадают,
     * см. fieldSurface.js. */
    const handleSurfaceMouseDown = (event) => {
        if (!isFieldSurface(event.target)) return;
        event.preventDefault();
        inputRef.current?.focus();
        open();
    };

    return (
        <div
            className={`form-group ${variant}`}
            ref={rootRef}
            style={style}
            onMouseDown={handleSurfaceMouseDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <label htmlFor={id}>{label}</label>

            <input
                id={id}
                ref={inputRef}
                type="text"
                role="combobox"
                autoComplete="off"
                aria-expanded={isOpen}
                aria-autocomplete="list"
                aria-controls={`${id}-listbox`}
                aria-invalid={Boolean(error)}
                title={value}
                placeholder={placeholder}
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    if (!isOpen) open();
                }}
                onClick={open}
                onFocus={stopScroll}
                onKeyDown={handleKeyDown}
                onBlur={(e) => {
                    // Клик по пункту списка или по иконке блюр не должен обрывать.
                    if (rootRef.current?.contains(e.relatedTarget)) return;
                    close();
                }}
            />

            {/* Прозрачная кнопка поверх иконки из CSS (.form-group::after).
                Сама иконка — псевдоэлемент, кликов не получает. */}
            <button
                type="button"
                className="field-icon"
                tabIndex={-1}
                aria-label={`${label}: показать список`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    inputRef.current?.focus();
                    if (isOpen) close();
                    else open();
                }}
            />

            {isOpen && items.length > 0 && (
                <ul className="airport-suggestions" id={`${id}-listbox`} role="listbox">
                    {items.map((airport, index) => (
                        <li key={airport.code} role="option" aria-selected={index === highlighted}>
                            <button
                                type="button"
                                className={`airport-option ${index === highlighted ? "is-highlighted" : ""}`}
                                onMouseEnter={() => setHighlighted(index)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => select(airport)}
                            >
                                <span className="airport-option__code">{airport.code}</span>
                                <span className="airport-option__name">{airportLabel(airport)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {isOpen && items.length === 0 && (
                <div className="airport-suggestions airport-suggestions--empty">
                    Ничего не найдено. Проверьте написание или добавьте аэропорт в справочник.
                </div>
            )}

            {error && <div className="field-error">{error}</div>}
        </div>
    );
};

export default AirportField;
