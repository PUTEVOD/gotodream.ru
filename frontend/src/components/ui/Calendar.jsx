import React, { useState } from 'react';
import '../styles/Calendar.css';

const Calendar = ({ date, onSelect, onClose, position }) => {
    const [currentDate, setCurrentDate] = useState(new Date(date));

    const prevMonth = () => {
        setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const renderDays = () => {
        return [...Array(31).keys()].map(day => (
            <div
                key={day+1}
                className="calendar-day"
                onClick={() => onSelect(day+1)}
            >
                {day+1}
            </div>
        ));
    };

    return (
        <div className="calendar-overlay" onClick={onClose}>
            <div
                className="calendar-container"
                style={{
                    position: 'fixed',
                    left: `${position.x}px`,
                    top: `${position.y}px`
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="calendar-header">
                    <button onClick={prevMonth}>←</button>
                    <span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={nextMonth}>→</button>
                </div>
                <div className="calendar-grid">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                        <div key={day} className="calendar-weekday">{day}</div>
                    ))}
                    {renderDays()}
                </div>
            </div>
        </div>
    );
};

export default Calendar;
