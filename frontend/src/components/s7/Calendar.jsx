import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Календарь в стиле выпадающего списка аэропортов.
 *
 * Даты везде строки «ГГГГ-ММ-ДД» — то же, что хранит input[type=date].
 * Объекты Date используются только внутри вычислений и никогда не попадают
 * в состояние: перевод Date → строка зависит от часового пояса и регулярно
 * даёт сдвиг на день.
 */

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const MONTHS = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

/** «2026-09-10» → { year: 2026, month: 8, day: 10 }; месяц с нуля, как в Date. */
function parseISO(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function todayISO() {
    const now = new Date();
    return toISO(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Сдвиг даты на N дней с корректным переходом через границы месяцев и лет. */
function shiftDays(iso, days) {
    const parts = parseISO(iso);
    if (!parts) return iso;
    const date = new Date(parts.year, parts.month, parts.day + days);
    return toISO(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Сдвиг на N месяцев с прижатием дня к последнему числу короткого месяца. */
function shiftMonths(iso, months) {
    const parts = parseISO(iso);
    if (!parts) return iso;
    const target = new Date(parts.year, parts.month + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return toISO(target.getFullYear(), target.getMonth(), Math.min(parts.day, lastDay));
}

const clampISO = (iso, min, max) => {
    if (min && iso < min) return min;
    if (max && iso > max) return max;
    return iso;
};

/** Шесть недель по семь дней: сетка не меняет высоту при смене месяца. */
function buildGrid(year, month) {
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = понедельник
    const start = new Date(year, month, 1 - firstWeekday);

    return Array.from({ length: 6 }, (_, week) =>
        Array.from({ length: 7 }, (_, weekday) => {
            const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + weekday);
            return {
                iso: toISO(date.getFullYear(), date.getMonth(), date.getDate()),
                day: date.getDate(),
                isOtherMonth: date.getMonth() !== month,
            };
        }),
    );
}

const Calendar = ({ value, min, max, onSelect, onClose, labelledBy }) => {
    const rootRef = useRef(null);
    const gridRef = useRef(null);

    // Дата под курсором клавиатуры. Ею же определяется показанный месяц.
    const [cursor, setCursor] = useState(() => clampISO(value || todayISO(), min, max));
    const cursorParts = parseISO(cursor) || parseISO(todayISO());

    const weeks = useMemo(
        () => buildGrid(cursorParts.year, cursorParts.month),
        [cursorParts.year, cursorParts.month],
    );

    const isDisabled = (iso) => Boolean((min && iso < min) || (max && iso > max));

    /** Индекс дня недели, понедельник = 0. Считается по локальной дате,
     а не через Date.parse(iso): тот разбирает строку как UTC и в западных
     часовых поясах даёт предыдущий день. */
    const weekdayIndex = (iso) => {
        const parts = parseISO(iso);
        return (new Date(parts.year, parts.month, parts.day).getDay() + 6) % 7;
    };

    // Кнопка дня под курсором получает фокус: клавиатура и screen reader
    // должны «стоять» на том же дне, что подсвечен визуально.
    useEffect(() => {
        const cell = gridRef.current?.querySelector(`[data-iso="${cursor}"]`);
        cell?.focus({ preventScroll: true });
    }, [cursor]);

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) onClose();
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [onClose]);

    const moveCursor = (nextISO) => setCursor(clampISO(nextISO, min, max));

    const select = (iso) => {
        if (isDisabled(iso)) return;
        onSelect(iso);
        onClose();
    };

    const handleKeyDown = (event) => {
        const keys = {
            ArrowLeft: () => moveCursor(shiftDays(cursor, -1)),
            ArrowRight: () => moveCursor(shiftDays(cursor, 1)),
            ArrowUp: () => moveCursor(shiftDays(cursor, -7)),
            ArrowDown: () => moveCursor(shiftDays(cursor, 7)),
            PageUp: () => moveCursor(shiftMonths(cursor, -1)),
            PageDown: () => moveCursor(shiftMonths(cursor, 1)),
            Home: () => moveCursor(shiftDays(cursor, -weekdayIndex(cursor))),
            End: () => moveCursor(shiftDays(cursor, 6 - weekdayIndex(cursor))),
            Enter: () => select(cursor),
            " ": () => select(cursor),
            Escape: () => onClose(),
        };

        const action = keys[event.key];
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        action();
    };

    // Месяц недоступен, если в нём нет ни одного разрешённого дня.
    const firstOfMonth = toISO(cursorParts.year, cursorParts.month, 1);
    const daysInMonth = new Date(cursorParts.year, cursorParts.month + 1, 0).getDate();
    const prevMonthDisabled = Boolean(min) && shiftDays(firstOfMonth, -1) < min;
    const nextMonthDisabled = Boolean(max) &&
        shiftDays(toISO(cursorParts.year, cursorParts.month, daysInMonth), 1) > max;

    const today = todayISO();

    return (
        <div
            className="calendar-popup"
            ref={rootRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={labelledBy}
            onKeyDown={handleKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
        >
            <div className="calendar-header">
                <button
                    type="button"
                    className="calendar-nav"
                    aria-label="Предыдущий месяц"
                    disabled={prevMonthDisabled}
                    onClick={() => moveCursor(shiftMonths(cursor, -1))}
                >
                    ‹
                </button>

                <div className="calendar-title" aria-live="polite">
                    {MONTHS[cursorParts.month]} {cursorParts.year}
                </div>

                <button
                    type="button"
                    className="calendar-nav"
                    aria-label="Следующий месяц"
                    disabled={nextMonthDisabled}
                    onClick={() => moveCursor(shiftMonths(cursor, 1))}
                >
                    ›
                </button>
            </div>

            <div className="calendar-weekdays" aria-hidden="true">
                {WEEKDAYS.map((day) => (
                    <span key={day} className="calendar-weekday">{day}</span>
                ))}
            </div>

            <div className="calendar-grid" role="grid" ref={gridRef}>
                {weeks.map((week, index) => (
                    <div className="calendar-week" role="row" key={index}>
                        {week.map((cell) => {
                            const disabled = isDisabled(cell.iso);
                            const classes = [
                                "calendar-day",
                                cell.isOtherMonth ? "is-other-month" : "",
                                cell.iso === value ? "is-selected" : "",
                                cell.iso === today ? "is-today" : "",
                                disabled ? "is-disabled" : "",
                            ].filter(Boolean).join(" ");

                            return (
                                <button
                                    key={cell.iso}
                                    type="button"
                                    role="gridcell"
                                    className={classes}
                                    data-iso={cell.iso}
                                    // Фокус держит одна кнопка: Tab выводит из календаря,
                                    // а не проходит по тридцати дням подряд.
                                    tabIndex={cell.iso === cursor ? 0 : -1}
                                    aria-selected={cell.iso === value}
                                    aria-disabled={disabled}
                                    aria-label={`${cell.day} ${MONTHS[parseISO(cell.iso).month].toLowerCase()} ${parseISO(cell.iso).year}`}
                                    onFocus={() => setCursor(cell.iso)}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => select(cell.iso)}
                                >
                                    {cell.day}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            <div className="calendar-footer">
                <button
                    type="button"
                    className="calendar-action"
                    disabled={isDisabled(today)}
                    onClick={() => select(today)}
                >
                    Сегодня
                </button>
                <button type="button" className="calendar-action" onClick={onClose}>
                    Закрыть
                </button>
            </div>
        </div>
    );
};

export default Calendar;