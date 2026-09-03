import React, { useCallback, useRef, useState } from "react";
import Calendar from "./Calendar";
import { isFieldSurface } from "./fieldSurface";
import { useNativeDatePicker } from "./useNativeDatePicker";

/**
 * Поле даты.
 *
 * Поле остаётся <input type="date">: ручной ввод, локальный формат и
 * системная проверка min/max работают как прежде.
 *
 * ДВА РЕЖИМА. На мыши раскрывается собственный календарь под полем. На
 * сенсорном экране собственного календаря нет вовсе — открывается системный
 * (см. useNativeDatePicker.js). Признак выбирается один раз и на всё
 * поведение сразу: и на разметку, и на реакцию по нажатию. Половинчатое
 * решение — «свой календарь, но поменьше» — как раз и давало мигание.
 *
 * ОТКРЫТИЕ. Нажатие в ЛЮБОЕ место плашки — по подписи, по значению, по
 * пустому месту рядом — открывает календарь. Раньше он открывался только по
 * иконке в правом углу: цель шириной 36px в поле шириной 350px, и по самому
 * полю человек кликал впустую. Иконка сохраняет роль переключателя
 * (открыть/закрыть), поэтому её нажатие дальше по дереву не идёт.
 *
 * СОСТОЯНИЕ «ОТКРЫТ». По умолчанию хранится внутри. Если передан проп `open`,
 * поле становится управляемым, и решение принимает форма — это нужно, чтобы
 * после выбора даты вылета сам собой раскрылся календарь возвращения
 * (см. SearchForm). Гибрид, а не только управляемый режим: полям сложного
 * маршрута такое согласование не нужно, и заставлять форму держать состояние
 * каждого из шести — лишняя связанность.
 */
const DateField = ({
                       id,
                       label,
                       value,
                       onChange,
                       min,
                       max,
                       error,
                       style,
                       open,
                       onOpenChange,
                       children,
                   }) => {
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = open !== undefined;
    const isCalendarOpen = isControlled ? open : internalOpen;

    const useNative = useNativeDatePicker();
    /* На сенсорном экране свой календарь не рисуется никогда — даже если
       форма попросила его открыть. Иначе автооткрытие календаря возвращения
       вернуло бы ровно то мигание, ради устранения которого всё это и есть. */
    const showCalendar = isCalendarOpen && !useNative;

    const setOpen = useCallback((next) => {
        if (!isControlled) setInternalOpen(next);
        onOpenChange?.(next);
    }, [isControlled, onOpenChange]);

    /** Системный выбор даты. showPicker есть не везде — тогда достаточно
        фокуса: на телефонах он и так раскрывает системный календарь. */
    const openNativePicker = () => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        try {
            input.showPicker?.();
        } catch {
            // Вызов без жеста пользователя или неподдерживаемый тип поля.
            // Поле уже в фокусе — этого достаточно.
        }
    };

    const closeCalendar = () => {
        setOpen(false);
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
        if (useNative) {
            openNativePicker();
            return;
        }
        inputRef.current?.focus();
        setOpen(true);
    };

    return (
        <div
            className={`form-group date${showCalendar ? " is-open" : ""}`}
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
                   ввод не перехватывает.

                   На сенсорном экране обработчика нет: системный календарь
                   браузер открывает сам, и вмешиваться незачем. */
                onClick={useNative ? undefined : () => setOpen(true)}
                onKeyDown={(event) => {
                    // Alt+стрелка вниз — привычный способ открыть календарь с клавиатуры.
                    if (event.key === "ArrowDown" && event.altKey && !useNative) {
                        event.preventDefault();
                        setOpen(true);
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
                aria-haspopup={useNative ? undefined : "dialog"}
                aria-expanded={useNative ? undefined : showCalendar}
                aria-label={`${label}: открыть календарь`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => (useNative ? openNativePicker() : setOpen(!isCalendarOpen))}
            />

            {showCalendar && (
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
