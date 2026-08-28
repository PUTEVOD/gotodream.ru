import React, { useRef } from "react";

/**
 * Поле даты с кликабельной иконкой.
 *
 * showPicker() — штатный способ открыть системный календарь из кода
 * (Chrome 99+, Edge 99+, Firefox 101+, Safari 16+). Где метода нет, поле
 * просто получает фокус, и календарь открывается обычным кликом.
 *
 * Собственный календарь здесь не нужен: нативный знает локаль, работает
 * с клавиатуры и на телефоне, и его не нужно поддерживать. Заводить свой
 * стоит только ради того, чего нативный не умеет, — например, показывать
 * цены по датам.
 *
 * @param {string}   value    дата в формате ГГГГ-ММ-ДД (значение input[type=date])
 * @param {Function} onChange (nextValue) => void
 * @param {string}   min      минимальная выбираемая дата
 * @param {string}   max      максимальная выбираемая дата
 * @param {string}   error    текст ошибки под полем
 * @param {node}     children дополнительный элемент внутри поля (кнопка удаления рейса)
 */
const DateField = ({ id, label, value, onChange, min, max, error, style, children }) => {
    const inputRef = useRef(null);

    const openPicker = () => {
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

    return (
        <div className="form-group date" style={style}>
            <label htmlFor={id}>{label}</label>

            <input
                id={id}
                ref={inputRef}
                type="date"
                value={value}
                min={min}
                max={max}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(event.target.value)}
            />

            {/* Прозрачная кнопка поверх иконки: сама иконка нарисована
                псевдоэлементом .form-group::after и кликов не получает. */}
            <button
                type="button"
                className="field-icon"
                tabIndex={-1}
                aria-label={`${label}: открыть календарь`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={openPicker}
            />

            {children}

            {error && <div className="field-error">{error}</div>}
        </div>
    );
};

export default DateField;
