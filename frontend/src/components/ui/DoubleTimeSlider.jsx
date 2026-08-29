import React, { useCallback, useRef, useState } from 'react';
import '../styles/DoubleTimeSlider.css';

/**
 * Двухползунковый слайдер диапазона времени.
 *
 * ПОЛНАЯ ЗАМЕНА ФАЙЛА. Что исправлено по сравнению с прежней версией:
 *
 * 1. Не работал на сенсорных экранах. Обработчик был один — onMouseDown,
 *    а слушатели вешались на 'mousemove' / 'mouseup'. На телефоне таких
 *    событий нет: браузер шлёт touch/pointer. Фильтры по времени на
 *    мобильном не двигались вообще. Теперь используются Pointer Events —
 *    один набор событий для мыши, пальца и стилуса.
 *
 * 2. Геометрия бралась через document.querySelector('.slider-container').
 *    На странице /s7 таких слайдеров три, и querySelector всегда возвращал
 *    первый: любой слайдер считал координаты по чужому элементу. Пока все
 *    три стоят в одной колонке одинаковой ширины, это незаметно, но в
 *    шторке фильтров ширины разойдутся. Заменено на useRef — каждый
 *    экземпляр меряет собственный DOM-узел.
 *
 * 3. Координаты считались от .slider-container, а ползунки позиционируются
 *    внутри .slider-track, ширина которого 90% от контейнера. Из-за этого
 *    ползунок «прыгал» под курсор со сдвигом ~10% при захвате. Теперь всё
 *    меряется от трека.
 *
 * 4. Добавлено управление с клавиатуры и ARIA-роль слайдера: стрелки,
 *    PageUp/PageDown, Home/End. Раньше фильтр был недоступен без мыши.
 *
 * 5. Нажатие по треку подводит ближайший ползунок к точке нажатия —
 *    на телефоне попасть в кружок 16px пальцем почти невозможно.
 *
 * 6. Минимальный зазор между ползунками вынесен в prop `minGap`
 *    (было жёстко зашитое 60). Обратите внимание: такое же правило
 *    продублировано в S7.jsx (MIN_TIME_WINDOW) для времени вылета —
 *    два места, где живёт одно правило. Стоит оставить одно.
 */

const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);

const DoubleTimeSlider = ({
                              label,
                              min = 0,
                              max = 1440,
                              step = 5,
                              minGap = 60,
                              lowerValue,
                              upperValue,
                              onChangeLower,
                              onChangeUpper,
                          }) => {
    const trackRef = useRef(null);
    /* Состояние перетаскивания живёт в ref, а не в useState: оно меняется
       на каждый пиксель движения и не должно вызывать перерисовку. */
    const dragRef = useRef({ handle: null, offsetPx: 0, pointerId: null });
    const [activeHandle, setActiveHandle] = useState(null);

    const ratio = (value) => ((value - min) / (max - min)) * 100;

    /* Экранная координата X -> значение, округлённое до шага. */
    const valueFromClientX = useCallback((clientX) => {
        const track = trackRef.current;
        if (!track) return null;
        const rect = track.getBoundingClientRect();
        if (!rect.width) return null;
        const position = clamp((clientX - rect.left) / rect.width, 0, 1);
        const raw = min + position * (max - min);
        return clamp(Math.round(raw / step) * step, min, max);
    }, [min, max, step]);

    /* Единственное место, где значения уезжают наружу. Здесь же держится
       минимальный зазор между ползунками. */
    const commit = useCallback((handle, value) => {
        if (handle === 'lower') {
            const next = clamp(Math.min(value, upperValue - minGap), min, max);
            if (next !== lowerValue) onChangeLower(next);
        } else {
            const next = clamp(Math.max(value, lowerValue + minGap), min, max);
            if (next !== upperValue) onChangeUpper(next);
        }
    }, [lowerValue, upperValue, minGap, min, max, onChangeLower, onChangeUpper]);

    const stopDrag = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag.handle) return;
        if (event && drag.pointerId !== null) {
            try {
                event.currentTarget.releasePointerCapture(drag.pointerId);
            } catch (ignored) {
                /* указатель уже отпущен браузером — это нормально */
            }
        }
        dragRef.current = { handle: null, offsetPx: 0, pointerId: null };
        setActiveHandle(null);
        document.body.classList.remove('no-select');
    }, []);

    const handlePointerDown = (handle, value) => (event) => {
        const track = trackRef.current;
        if (!track) return;

        event.stopPropagation();
        event.preventDefault();

        const rect = track.getBoundingClientRect();
        const handleCenter = rect.left + ((value - min) / (max - min)) * rect.width;

        dragRef.current = {
            handle,
            /* Сдвиг между точкой нажатия и центром кружка: без него ползунок
               прыгает под палец, теряя пару минут в значении. */
            offsetPx: event.clientX - handleCenter,
            pointerId: event.pointerId,
        };
        setActiveHandle(handle);

        /* Захват указателя: дальнейшие pointermove/pointerup приходят на этот
           же элемент, даже если палец ушёл за пределы слайдера или за окно.
           Это заменяет прежние слушатели на document. */
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch (ignored) {
            /* очень старый браузер без Pointer Events capture */
        }

        document.body.classList.add('no-select');
    };

    const handlePointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag.handle || event.pointerId !== drag.pointerId) return;
        const value = valueFromClientX(event.clientX - drag.offsetPx);
        if (value !== null) commit(drag.handle, value);
    };

    /* Нажатие по треку: подтягиваем тот ползунок, который ближе. */
    const handleTrackPointerDown = (event) => {
        if (dragRef.current.handle) return;
        const value = valueFromClientX(event.clientX);
        if (value === null) return;
        const handle =
            Math.abs(value - lowerValue) <= Math.abs(value - upperValue) ? 'lower' : 'upper';
        commit(handle, value);
    };

    const handleKeyDown = (handle, value) => (event) => {
        const bigStep = Math.max(step * 6, 60);
        let next;

        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                next = value - step;
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                next = value + step;
                break;
            case 'PageDown':
                next = value - bigStep;
                break;
            case 'PageUp':
                next = value + bigStep;
                break;
            case 'Home':
                next = handle === 'lower' ? min : lowerValue + minGap;
                break;
            case 'End':
                next = handle === 'lower' ? upperValue - minGap : max;
                break;
            default:
                return;
        }

        event.preventDefault();
        commit(handle, clamp(next, min, max));
    };

    const renderHandle = (handle, value, ariaLabel, valueMin, valueMax) => (
        <div
            className={`slider-handle ${handle}${activeHandle === handle ? ' is-active' : ''}`}
            style={{ left: `${ratio(value)}%` }}
            role="slider"
            tabIndex={0}
            aria-label={ariaLabel}
            aria-valuemin={valueMin}
            aria-valuemax={valueMax}
            aria-valuenow={value}
            aria-valuetext={formatTime(value)}
            onPointerDown={handlePointerDown(handle, value)}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            onLostPointerCapture={stopDrag}
            onKeyDown={handleKeyDown(handle, value)}
        >
            <div className="tooltip">{formatTime(value)}</div>
        </div>
    );

    return (
        <div className="time-filter">
            <div className="filter-header">
                <span className="filter-label">{label}</span>
                <span className="time-range">
                    {formatTime(lowerValue)} - {formatTime(upperValue)}
                </span>
            </div>

            <div className="slider-container" style={{ padding: '20px 0' }}>
                <div
                    className="slider-track"
                    ref={trackRef}
                    onPointerDown={handleTrackPointerDown}
                >
                    <div
                        className="slider-range"
                        style={{
                            left: `${ratio(lowerValue)}%`,
                            width: `${ratio(upperValue) - ratio(lowerValue)}%`,
                        }}
                    />

                    {renderHandle(
                        'lower',
                        lowerValue,
                        `${label}: начало диапазона`,
                        min,
                        upperValue - minGap,
                    )}

                    {renderHandle(
                        'upper',
                        upperValue,
                        `${label}: конец диапазона`,
                        lowerValue + minGap,
                        max,
                    )}
                </div>
            </div>
        </div>
    );
};

export default DoubleTimeSlider;
