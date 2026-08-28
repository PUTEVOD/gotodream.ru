import React, { useRef, useState } from "react";
import Calendar from "./Calendar";

/**
 * Поле даты с кликабельной иконкой и собственным календарём.
 *
 * Поле остаётся <input type="date">: ручной ввод, локальный формат и
 * системная проверка min/max работают как прежде. Меняется только то, что
 * открывается по иконке.
 *
 * На телефоне и планшете (pointer: coarse) открывается системный календарь
 * через showPicker(): нативный выбор даты пальцем удобнее любого своего.
 */
const DateField = ({ id, label, value, onChange, min, max, error, style, children }) => {
    const inputRef = useRef(null);
    const [isCalendarOpen, setCalendarOpen] = useState(false);

    const prefersNativePicker = () =>
        typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

    const openNativePicker = () => {
        const element = inputRef.current;
        if (!element) return;
        element.focus();
        if (typeof element.showPicker === "function") {
            try {
                element.showPicker();
            } catch {
                /* браузер запретил вызов вне пользовательского жеста — остаётся фокус */
            }
        }
    };

    const toggleCalendar = () => {
        if (prefersNativePicker()) {
            openNativePicker();
            return;
        }
        setCalendarOpen((open) => !open);
    };

    const closeCalendar = () => {
        setCalendarOpen(false);
        inputRef.current?.focus(); // фокус возвращается в поле, а не улетает в начало страницы
    };

    return (
        <div className={`form-group date${isCalendarOpen ? " is-open" : ""}`} style={style}>
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
                onKeyDown={(event) => {
                    // Alt+стрелка вниз — привычный способ открыть календарь с клавиатуры.
                    if (event.key === "ArrowDown" && event.altKey && !prefersNativePicker()) {
                        event.preventDefault();
                        setCalendarOpen(true);
                    }
                }}
            />

            {/* Прозрачная кнопка поверх иконки: сама иконка нарисована
                псевдоэлементом .form-group::after и кликов не получает. */}
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
                />
            )}

            {children}

            {error && <div className="field-error">{error}</div>}
        </div>
    );
};

export default DateField;