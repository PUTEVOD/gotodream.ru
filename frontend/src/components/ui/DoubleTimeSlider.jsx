import React, { useState, useCallback, useEffect } from 'react';
import '../styles/DoubleTimeSlider.css';

const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const DoubleTimeSlider = ({
                              label,
                              min = 0,
                              max = 1440,
                              step = 5,
                              lowerValue,
                              upperValue,
                              onChangeLower,
                              onChangeUpper
                          }) => {
    const MIN_GAP = 60; // Минимальный интервал 1 час
    const [activeHandle, setActiveHandle] = useState(null);
    const [sliderRect, setSliderRect] = useState(null);
    const [dragOffset, setDragOffset] = useState(0);

    const updateSliderRect = useCallback(() => {
        const container = document.querySelector('.slider-container');
        if (container) setSliderRect(container.getBoundingClientRect());
    }, []);

    const handleMove = useCallback((e) => {
        if (!sliderRect || !activeHandle) return;

        const rawPixel = (e.clientX - sliderRect.left) - dragOffset;
        let rawValue = (rawPixel / sliderRect.width * (max - min)) + min;
        rawValue = Math.max(min, Math.min(rawValue, max));
        const roundedValue = Math.round(rawValue / step) * step;

        if (activeHandle === 'lower') {
            const newLower = Math.min(roundedValue, upperValue - MIN_GAP);
            if (newLower !== lowerValue) onChangeLower(newLower);
        } else {
            const newUpper = Math.max(roundedValue, lowerValue + MIN_GAP);
            if (newUpper !== upperValue) onChangeUpper(newUpper);
        }
    }, [activeHandle, dragOffset, lowerValue, upperValue, min, max, step, sliderRect, MIN_GAP]);

    useEffect(() => {
        if (activeHandle) {
            updateSliderRect();
            document.addEventListener('mousemove', handleMove);
            const handleUp = () => {
                setActiveHandle(null);
                document.body.classList.remove('no-select');
            };
            document.addEventListener('mouseup', handleUp);
            return () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleUp);
                document.body.classList.remove('no-select');
            };
        }
    }, [activeHandle, handleMove, updateSliderRect]);

    const startDrag = (handleType, value, e) => {
        const container = document.querySelector('.slider-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        setSliderRect(rect);
        const handleLeftPixel = ((value - min) / (max - min)) * rect.width;
        const offset = e.clientX - (rect.left + handleLeftPixel);
        setDragOffset(offset);
        setActiveHandle(handleType);
        document.body.classList.add('no-select'); // Disable text selection
    };

    return (
        <div className="time-filter">
            <div className="filter-header">
                <span className="filter-label">{label}</span>
                <span className="time-range">
          {formatTime(lowerValue)} - {formatTime(upperValue)}
        </span>
            </div>

            <div className="slider-container" style={{ padding: '20px 0' }}>
                <div className="slider-track">
                    <div
                        className="slider-range"
                        style={{
                            left: `${((lowerValue - min) / (max - min)) * 100}%`,
                            width: `${((upperValue - lowerValue) / (max - min)) * 100}%`,
                        }}
                    />

                    <div
                        className="slider-handle lower"
                        style={{ left: `${((lowerValue - min) / (max - min)) * 100}%` }}
                        onMouseDown={(e) => startDrag('lower', lowerValue, e)}
                    >
                        <div className="tooltip">{formatTime(lowerValue)}</div>
                    </div>

                    <div
                        className="slider-handle upper"
                        style={{ left: `${((upperValue - min) / (max - min)) * 100}%` }}
                        onMouseDown={(e) => startDrag('upper', upperValue, e)}
                    >
                        <div className="tooltip">{formatTime(upperValue)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoubleTimeSlider;