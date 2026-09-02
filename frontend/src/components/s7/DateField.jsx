import React, { useRef, useState } from "react";
import Calendar from "./Calendar";
import { isFieldSurface } from "./fieldSurface";

/**
 * Поле даты с собственным календарём.
 *
 * Поле остаётся <input type="date">: ручной ввод, локальный формат и
 * системная проверка min/max работают как прежде.
 *
 * ОТКРЫТИЕ КАЛЕНДАРЯ. Нажатие в ЛЮБОЕ место плашки — по подписи, по
 * значению, по пустому месту рядом — открывает календарь. Раньше он
 * открывался только по иконке в правом углу: цель шириной 36px в поле
 * шириной 350px, и по самому полю человек кликал впустую. Иконка
 * сохраняет роль переключателя (открыть/закрыть), поэтому её нажатие
 * дальше по дереву не идёт.
 */
const DateField = ({ id, label, value, onChange, min, max, error, style, children }) => {
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const [isCalendarOpen, setCalendarOpen] = useState(false);

    const prefersNativePicker = () =>
        typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

    const openCalendar = () => setCalendarOpen(true);
    const toggleCalendar = () => setCalendarOpen((open) => !open);

    const closeCalendar = () => {
        setCalendarOpen(false);
        inputRef.current?.focus(); // фокус возвращается в поле, а не улетает в начало страницы
    };

    /* Нажатие по «фону» плашки: подпись, отступы, сама плашка.
     *
     * mousedown, а не click: preventDefault на этой фазе не даёт браузеру
     * перевести фокус на контейнер, поэтому поле не успевает получить blur
     * и снова focus — иначе календарь мигал бы при каждом нажатии.
     * Интерактивные потомки (сам input, иконка, кнопки календаря) с этой
     * ветки отсеиваются: у них своё поведение. */
    const handleSurfaceMouseDown = (event) => {
        if (!isFieldSurface(event.target)) return;
        event.preventDefault();
        inputRef.current?.focus();
        openCalendar();
    };

    return (
        <div
            className={`form-group date${isCalendarOpen ? " is-open" : ""}`}
            ref={rootRef}
            style={style}
            onMouseDown={handleSurfaceMouseDown}
        >
            <label htmlFor={id} id={`${id}-label`}>{label}</label>

            <input
                id={id}
                ref={inputRef}
                type="date"
                value={value}
                min={min}
                max={max}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(event.target.value)}
                /* Нажатие по самому полю тоже открывает календарь: это самая
                   большая и самая очевидная цель в плашке. Ручной ввод при
                   этом не страдает — календарь раскрывается ПОД полем и
                   ввод не перехватывает. */
                onClick={openCalendar}
                onKeyDown={(event) => {
                    // Alt+стрелка вниз — привычный способ открыть календарь с клавиатуры.
                    if (event.key === "ArrowDown" && event.altKey && !prefersNativePicker()) {
                        event.preventDefault();
                        setCalendarOpen(true);
                    }
                }}
            />

            {/* Прозрачная кнопка поверх иконки: сама иконка нарисована
                псевдоэлементом .form-group::after и кликов не получает.
                Обработчик плашки её пропускает (кнопка — интерактивный
                элемент, см. fieldSurface.js), поэтому переключение
                работает: нажатие при открытом календаре закрывает его и
                тут же снова не открывает. */}
            <button
                type="button"
                className="field-icon"
                tabIndex={-1}
                aria-haspopup="dialog"
                aria-expanded={isCalendarOpen}
                aria-label={`${label}: открыть календарь`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={toggleCalendar}
            />

            {isCalendarOpen && (
                <Calendar
                    value={value}
                    min={min}
                    max={max}
                    labelledBy={`${id}-label`}
                    onSelect={onChange}
                    onClose={closeCalendar}
                    triggerRef={rootRef}
                />
            )}

            {children}

            {error && <div className="field-error">{error}</div>}
        </div>
    );
};

export default DateField;
