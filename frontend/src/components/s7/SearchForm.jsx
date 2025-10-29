import React, { useState, useRef, useEffect } from "react";
import "./SearchForm.css";
import DoubleTimeSlider from "../ui/DoubleTimeSlider";
import Calendar from "../ui/Calendar";

const SearchForm = ({ onSearch, tripType }) => {
    // Состояния для стандартного (roundTrip и oneWay)
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [departureDate, setDepartureDate] = useState("");
    const [returnDate, setReturnDate] = useState("");
    const [passengers, setPassengers] = useState({
        adults: 1,
        teens: 0,
        children: 0,
        infants: 0,
        youth: 0,
        seniors: 0,
        largeFamily: 0,
        disabled: 0,
        disabledChild: 0,
        companion: 0,
    });
    const [classType, setClassType] = useState("economy");
    const [showPassengerModal, setShowPassengerModal] = useState(false);
    const modalRef = useRef(null);

    // Рефы для полей ввода
    const fromInputRef = useRef(null);
    const toInputRef = useRef(null);
    const departureInputRef = useRef(null);
    const returnInputRef = useRef(null);

    // Состояние для сложного маршрута
    const [flights, setFlights] = useState([{ from: "", to: "", date: "" }]);

    // const [showCalendar, setShowCalendar] = useState({ isOpen: false, target: "", position: { x: 0, y: 0 } });
    const [selectedDate, setSelectedDate] = useState(null); // Добавляем selectedDate

    const addFlight = () => {
        setFlights([...flights, { from: "", to: "", date: "" }]);
    };

    const removeFlight = (index) => {
        if (flights.length === 1) return;
        const newFlights = flights.filter((_, i) => i !== index);
        setFlights(newFlights);

        // Если удалили первый элемент, обновляем состояние
        if (index === 0 && newFlights.length > 0) {
            setFlights([newFlights[0], ...newFlights.slice(1)]);
        }
    };

    const handleFlightChange = (index, field, value) => {
        const newFlights = [...flights];
        newFlights[index][field] = value;
        setFlights(newFlights);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Формируем данные поиска
        const searchData =
            tripType === "complex"
                ? { flights /*, ... остальные поля */ }
                : { /* данные для roundTrip / oneWay */ };
        onSearch(searchData);
    };

    const totalPassengers = Object.values(passengers).reduce(
        (sum, val) => sum + val,
        0
    );

    const [showCalendar, setShowCalendar] = useState({
        isOpen: false,
        target: null, // 'departure', 'return', 'complex-date-0' и т.д.
        position: { x: 0, y: 0 }
    });

    // Обработчик открытия календаря
    const handleDateClick = (event, fieldId) => {
        const rect = event.target.getBoundingClientRect();
        setShowCalendar({
            isOpen: true,
            target: fieldId,
            position: { x: rect.left, y: rect.bottom + 10 }
        });
    };

    const updateDate = (day) => {
        if (showCalendar.target === "departure") {
            setDepartureDate(day);
        } else if (showCalendar.target === "return") {
            setReturnDate(day);
        } else if (showCalendar.target.startsWith("complex-date-")) {
            const index = parseInt(showCalendar.target.split("-").pop(), 10);
            const newFlights = [...flights];
            newFlights[index].date = day;
            setFlights(newFlights);
        }
        setShowCalendar({ isOpen: false });
    };

    const selectDate = (date) => {
        setSelectedDate(date);

        if (showCalendar.target === "departure") {
            setDepartureDate(date);
        } else if (showCalendar.target === "return") {
            setReturnDate(date);
        } else if (showCalendar.target.startsWith("complex-date-")) {
            const index = parseInt(showCalendar.target.split("-").pop(), 10);
            const newFlights = [...flights];
            newFlights[index].date = date;
            setFlights(newFlights);
        }

        setShowCalendar({ isOpen: false });
    };

    const PassengerCategory = ({ label, subLabel, value, onChange }) => {
        return (
            <div className="passenger-category">
                <div className="passenger-label">
                    <div className="category-title">{label}</div>
                    <div className="category-description">{subLabel}</div>
                </div>
                <div className="passenger-controls">
                    <button
                        type="button"
                        className="control-btn"
                        onClick={() => onChange(Math.max(0, value - 1))}
                        disabled={value <= 0}
                    >
                        -
                    </button>
                    <span className="passenger-value">{value}</span>
                    <button
                        type="button"
                        className="control-btn"
                        onClick={() => onChange(value + 1)}
                    >
                        +
                    </button>
                </div>
            </div>
        );
    };

    // Создаем общий компонент для выбора пассажиров
    const PassengerSelector = () => (
        <div
            className="passenger-dropdown"
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="passenger-content">
                <PassengerCategory
                    label="Взрослые"
                    subLabel="старше 18 лет на момент перелета"
                    value={passengers.adults}
                    onChange={(newValue) => setPassengers({ ...passengers, adults: newValue })}
                />
                <PassengerCategory
                    label="Подростки"
                    subLabel="от 12 до 18 лет на момент перелета"
                    value={passengers.teens}
                    onChange={(newValue) => setPassengers({ ...passengers, teens: newValue })}
                />
                <PassengerCategory
                    label="Дети"
                    subLabel="от 0 до 12 лет на момент перелета"
                    value={passengers.children}
                    onChange={(newValue) => setPassengers({ ...passengers, children: newValue })}
                />
                <PassengerCategory
                    label="Младенцы"
                    subLabel="до 2 лет (без места, на руках у взрослого)"
                    value={passengers.infants}
                    onChange={(newValue) => setPassengers({ ...passengers, infants: newValue })}
                />

                <div className="tariff-section">
                    <div className="tariff-title">Льготные тарифы</div>
                    <div className="tariff-description">
                        для некоторых групп пассажиров
                    </div>
                    <a href="#" className="tariff-link">Подробнее о тарифе</a>
                </div>
            </div>
        </div>
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                setShowPassengerModal(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className={`search-form ${tripType === "complex" ? "complex-mode" : ""}`}>
            <form onSubmit={handleSubmit} className={tripType === "complex" ? "complex-form" : ""}>
                {tripType === "complex" ? (
                    <>
                        {flights.map((flight, index) => (
                            <React.Fragment key={index}>
                                <div className="form-group from" style={{gridColumn: 1, gridRow: index + 1}}>
                                    <label>Откуда</label>
                                    <input
                                        type="text"
                                        value={flight.from}
                                        onChange={(e) => handleFlightChange(index, "from", e.target.value)}
                                        placeholder="Город или аэропорт"
                                    />
                                </div>
                                <div
                                    className="form-group to"
                                    style={{gridColumn: 3, gridRow: index + 1}}
                                >
                                    <label>Куда</label>
                                    <input
                                        type="text"
                                        value={flight.to}
                                        onChange={(e) => handleFlightChange(index, "to", e.target.value)}
                                        placeholder="Город или аэропорт"
                                    />
                                </div>
                                <div
                                    className="form-group date"
                                    // onClick={(e) => handleDateClick(e, `departure-${index}`)} // Для сложного маршрута
                                    style={{
                                        gridColumn: 5,
                                        gridRow: index + 1,
                                        position: 'relative' /* Добавлено для позиционирования крестика */
                                    }}
                                >
                                    <label>Дата</label>
                                    <input
                                        type="date"
                                        value={flight.date}
                                        onChange={(e) => handleFlightChange(index, "date", e.target.value)}
                                    />

                                    {/* Крестик удаления (отображается для всех рейсов, кроме единственного) */}
                                    {flights.length > 1 && (
                                        <button
                                            type="button"
                                            className="remove-flight"
                                            onClick={() => removeFlight(index)}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            </React.Fragment>
                        ))}

                        {/* Кнопка добавления рейса можно разместить в первой колонке следующей строки */}
                        <button
                            type="button"
                            className="add-flight"
                            style={{gridColumn: 1, gridRow: flights.length + 1}}
                            onClick={addFlight}
                        >
                            + Добавить рейс
                        </button>

                        {/* Поле "Пассажиры" – в пятой колонке, строка = (число рейсов + 1) */}
                        <div
                            className="form-group passengers"
                            style={{gridColumn: 5, gridRow: flights.length + 1}}
                            onClick={() => setShowPassengerModal(!showPassengerModal)}
                        >
                            <label>Пассажиры</label>
                            <div className="passenger-input">{totalPassengers} персон</div>
                            {showPassengerModal && <PassengerSelector/>}
                        </div>

                        {/* Кнопка "ПОИСК" – в пятой колонке, следующая строка */}
                        <button
                            type="submit"
                            className="search-button"
                            style={{gridColumn: 5, gridRow: flights.length + 2}}
                        >
                            ПОИСК
                        </button>
                    </>
                ) : (
                    <>
                        {/* Разметка для roundTrip и oneWay (без изменений) */}
                        <div className="form-group from" onClick={() => fromInputRef.current?.focus()}>
                            <label>Откуда</label>
                            <input
                                ref={fromInputRef}
                                type="text"
                                placeholder="Город или аэропорт"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                            />
                        </div>

                        <div className="form-group to" onClick={() => toInputRef.current?.focus()}>
                            <label>Куда</label>
                            <input
                                ref={toInputRef}
                                type="text"
                                placeholder="Город или аэропорт"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                            />
                        </div>

                        {/* Поле "Дата отправления" (переименовывается для "В одну сторону") */}
                        <div className="form-group date">
                            <label>{tripType === "oneWay" ? "Дата" : "Отправление"}</label>
                            <input
                                ref={departureInputRef}
                                type="date"
                                value={departureDate}
                                onChange={(e) => setDepartureDate(e.target.value)}
                            />
                        </div>

                        {/* Поле "Возвращение" (только для "Туда и обратно") */}
                        {tripType === "roundTrip" && (
                            <div className="form-group date">
                                <label>Возвращение</label>
                                <input
                                    ref={returnInputRef}
                                    type="date"
                                    value={returnDate}
                                    onChange={(e) => setReturnDate(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Поле пассажиров в 5-й колонке */}
                        <div
                            className="form-group passengers"
                            style={{ gridColumn: 5, gridRow: 1 }}
                            onClick={() => setShowPassengerModal(!showPassengerModal)}
                        >
                            <label>Пассажиры</label>
                            <div className="passenger-input">{totalPassengers} персон</div>
                            {showPassengerModal && (
                                <div
                                    className="passenger-dropdown"
                                    ref={modalRef}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="passenger-content">
                                        <PassengerCategory
                                            label="Взрослые"
                                            subLabel="старше 18 лет на момент перелета"
                                            value={passengers.adults}
                                            onChange={(newValue) => setPassengers({ ...passengers, adults: newValue })}
                                        />
                                        <PassengerCategory
                                            label="Подростки"
                                            subLabel="от 12 до 18 лет на момент перелета"
                                            value={passengers.teens}
                                            onChange={(newValue) => setPassengers({ ...passengers, teens: newValue })}
                                        />
                                        <PassengerCategory
                                            label="Дети"
                                            subLabel="от 0 до 12 лет на момент перелета"
                                            value={passengers.children}
                                            onChange={(newValue) => setPassengers({ ...passengers, children: newValue })}
                                        />
                                        <PassengerCategory
                                            label="Младенцы"
                                            subLabel="до 2 лет (без места, на руках у взрослого)"
                                            value={passengers.infants}
                                            onChange={(newValue) => setPassengers({ ...passengers, infants: newValue })}
                                        />

                                        <div className="tariff-section">
                                            <div className="tariff-title">Льготные тарифы</div>
                                            <div className="tariff-description">
                                                для некоторых групп пассажиров
                                            </div>
                                            <a href="#" className="tariff-link">Подробнее о тарифе</a>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        <button type="submit" className="search-button">
                            ПОИСК
                        </button>
                    </>
                )}
                {showCalendar.isOpen && (
                    <Calendar
                        date={selectedDate}
                        onSelect={(day) => {
                            // Обновляем выбранную дату
                            updateDate(day); // Ваша функция для обновления состояния
                            setShowCalendar({ isOpen: false });
                        }}
                        onClose={() => setShowCalendar({ isOpen: false })}
                        position={showCalendar.position}
                    />
                )}
            </form>
        </div>
    );
};

// const PassengerCategory = ({ label, subLabel, value, onChange }) => {
//     return (
//         <div className="passenger-category">
//             <div className="passenger-label">
//                 <div>{label}</div>
//                 <div className="sub-label">{subLabel}</div>
//             </div>
//             <div className="passenger-controls">
//                 <button type="button" onClick={() => onChange(value - 1)}>
//                     -
//                 </button>
//                 <span className="passenger-value">{value}</span>
//                 <button type="button" onClick={() => onChange(value + 1)}>
//                     +
//                 </button>
//             </div>
//         </div>
//     );
// };

export default SearchForm;
