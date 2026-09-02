import React, { useEffect, useRef } from "react";
import { PASSENGER_TYPES, LIMITS, countSeats } from "../search/contract";

/**
 * Одна категория пассажиров. Вынесена на верхний уровень модуля намеренно:
 * компонент, объявленный внутри тела другого компонента, получает новый тип
 * при каждом рендере, из-за чего React размонтирует и монтирует поддерево
 * заново (потеря фокуса, состояния, лишние DOM-операции).
 */
const PassengerCategory = ({ label, subLabel, value, min, max, onChange }) => (
    <div className="passenger-category">
        <div className="passenger-label">
            <div className="category-title">{label}</div>
            <div className="category-description">{subLabel}</div>
        </div>
        <div className="passenger-controls">
            <button
                type="button"
                className="control-btn"
                aria-label={`Убрать: ${label}`}
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={value <= min}
            >
                −
            </button>
            <span className="passenger-value" aria-live="polite">{value}</span>
            <button
                type="button"
                className="control-btn"
                aria-label={`Добавить: ${label}`}
                onClick={() => onChange(value + 1)}
                disabled={value >= max}
            >
                +
            </button>
        </div>
    </div>
);

/**
 * Выпадающий список пассажиров.
 *
 * КЛАССА ОБСЛУЖИВАНИЯ ЗДЕСЬ НЕТ. Он выбирается в колонке фильтров на /s7
 * («Класс обслуживания»), и это единственное место во всём интерфейсе, где
 * он задаётся. Дублировать выбор в форме означало бы два органа управления
 * одним значением на одном экране: человек меняет класс в одном месте, а
 * второе продолжает показывать прежнее — и непонятно, какое из двух
 * действует.
 *
 * @param {object}   passengers  { adults, teens, children, infants }
 * @param {Function} onChange    (nextPassengers) => void
 * @param {Function} onClose     закрытие по клику вне и по Escape
 * @param {string}   error       текст ошибки валидации, если есть
 */
const PassengerSelector = ({
                               passengers,
                               onChange,
                               onClose,
                               error,
                               triggerRef,
                           }) => {
    const rootRef = useRef(null);

    useEffect(() => {
        const handlePointerDown = (event) => {
            const insideDropdown = rootRef.current?.contains(event.target);
            // Клик по самому триггеру не должен закрывать список здесь:
            // иначе close + toggle сработают подряд и список останется открытым.
            const insideTrigger = triggerRef?.current?.contains(event.target);
            if (!insideDropdown && !insideTrigger) onClose();
        };
        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose, triggerRef]);

    const seats = countSeats(passengers);

    const limitFor = (type) => {
        if (!type.occupiesSeat) return passengers.adults; // младенцев не больше, чем взрослых
        return Math.max(passengers[type.key], passengers[type.key] + (LIMITS.MAX_SEATS - seats));
    };

    return (
        <div
            className="passenger-dropdown"
            ref={rootRef}
            role="dialog"
            aria-label="Выбор пассажиров"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="passenger-content">
                {PASSENGER_TYPES.map((type) => (
                    <PassengerCategory
                        key={type.key}
                        label={type.label}
                        subLabel={type.subLabel}
                        value={passengers[type.key]}
                        min={type.min}
                        max={limitFor(type)}
                        onChange={(next) => onChange({ ...passengers, [type.key]: next })}
                    />
                ))}

                {error && <div className="field-error">{error}</div>}

                <div className="tariff-section">
                    <div className="tariff-title">Льготные тарифы</div>
                    <div className="tariff-description">для некоторых групп пассажиров</div>
                    <a href="/tariffs" className="tariff-link">Подробнее о тарифе</a>
                </div>
            </div>
        </div>
    );
};

export default PassengerSelector;
