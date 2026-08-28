import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    airportLabel,
    airportShortLabel,
    normalizeAirportInput,
    suggestAirports,
} from "../search/airports";

/**
 * Поле выбора аэропорта с собственным выпадающим списком.
 *
 * Почему не нативный <datalist>: им нельзя управлять из кода — список
 * невозможно открыть по клику на иконку, нельзя подсветить пункт клавишами,
 * нельзя показать пояснение. Всё это здесь нужно, поэтому список свой.
 *
 * В поле хранится короткая подпись «Москва (SVO)»: она гарантированно
 * помещается в поле, а IATA-код из скобок разбирает resolveAirportCode.
 *
 * @param {string}   value         текущее значение поля
 * @param {Function} onChange      (nextValue) => void
 * @param {string}   error         текст ошибки под полем
 * @param {string}   variant       "from" | "to" — определяет иконку в CSS
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

    // Список фильтруется по тому, что человек набрал. Исключение — уже выбранный
    // аэропорт в короткой форме «Москва (SVO)»: тогда показываем весь список,
    // иначе выбрать другой можно будет только стерев текст.
    const isPicked = /\([A-Za-z]{3}\)\s*$/.test(value || "");
    const query = isPicked ? "" : value;
    const items = useMemo(() => suggestAirports(query, 8), [query]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) close();
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, value]);

    const close = () => {
        setIsOpen(false);
        // Приводим ввод к короткой форме и возвращаем текст к началу строки:
        // после набора длинного названия поле остаётся прокрученным вправо.
        const normalized = normalizeAirportInput(value);
        if (normalized !== value) onChange(normalized);
        if (inputRef.current) inputRef.current.scrollLeft = 0;
    };

    const open = () => {
        setHighlighted(0);
        setIsOpen(true);
    };

    const select = (airport) => {
        onChange(airportShortLabel(airport));
        setIsOpen(false);
        if (inputRef.current) inputRef.current.scrollLeft = 0;
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
        } else if (event.key === "Escape") {
            close();
        } else if (event.key === "Tab") {
            close();
        }
    };

    return (
        <div className={`form-group ${variant}`} ref={rootRef} style={style}>
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
                    isOpen ? close() : open();
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
