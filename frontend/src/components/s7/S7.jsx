import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchForm from "./SearchForm";
import FlightList from "./FlightList";
import "../styles/S7.css";
import "../styles/FiltersSearchAir.css";
import Header from '../Header';
import DoubleTimeSlider from "../ui/DoubleTimeSlider";
const S7 = () => {
    const [s7, sets7] = useState([]);
    const navigate = useNavigate(); // Хук для навигации
    const [tripType, setTripType] = useState("roundTrip"); // Объявляем состояние для типа поездки

    const [departureRange, setDepartureRange] = useState({
        lower: 360,   // 06:00
        upper: 1080   // 18:00
    });
    const [arrivalRange, setArrivalRange] = useState({
        lower: 480,   // 08:00
        upper: 1200   // 20:00
    });
    const [durationRange, setDurationRange] = useState({
        lower: 60,    // 1 час
        upper: 600    // 10 часов
    });



    const handleSearch = (searchParams) => {
        // Здесь можно сделать запрос к API для поиска рейсов
        const mocks7 = [
            {
                id: 1,
                from: "Москва",
                to: "Нью-Йорк",
                date: "2023-12-01",
                price: 500,
                departureTime: "08:30",
                arrivalTime: "14:45",
                departureAirport: "SVO (Шереметьево)",
                arrivalAirport: "JFK (Кеннеди)",
                duration: "8ч 15м",
                airline: "S7 Airlines"
            },
            // ... остальные элементы с аналогичной структурой
        ];
        sets7(mocks7);
    };

    // Функция для перехода на страницу деталей конкретного рейса
    const handleFlightClick = (flightId) => {
        navigate(`/s7/${flightId}`); // Перенаправление по маршруту с ID рейса
    };

    // Обработчики изменений
    const handleDepartureChange = (newLower, newUpper) => {
        if (newUpper - newLower < 60) {
            if (newLower !== departureRange.lower) {
                newUpper = newLower + 60;
            } else {
                newLower = newUpper - 60;
            }
        }
        setDepartureRange({ lower: newLower, upper: newUpper });
    };

    return (
        <>
            <Header/>
            <div className="main-container">
                <div className="filters-left">
                    {/* Левая колонка фильтров */}
                    <div className="filters-column">
                        <div className="filter-group">
                            <h3 className="filter-title">Пересадки</h3>
                            {[0, 1, 2].map(stops => (
                                <label key={stops} className="filter-item">
                                    <input type="checkbox"/>
                                    <span className="checkmark"></span>
                                    {stops === 0 ? 'Без пересадок' : `${stops} пересадок`}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider"></div>

                        <div className="filter-group">
                            <h3 className="filter-title">Сортировка</h3>
                            {['Самый дешевый', 'Самый быстрый', 'Самый удобный'].map(type => (
                                <label key={type} className="filter-item">
                                    <input type="radio" name="sort"/>
                                    <span className="radiomark"></span>
                                    {type}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider"></div>

                        <div className="filter-group">
                            <DoubleTimeSlider
                                label="Время вылета"
                                min={0}
                                max={1440}
                                step={5}
                                lowerValue={departureRange.lower}
                                upperValue={departureRange.upper}
                                onChangeLower={(val) => handleDepartureChange(val, departureRange.upper)}
                                onChangeUpper={(val) => handleDepartureChange(departureRange.lower, val)}
                            />

                            <DoubleTimeSlider
                                label="Время прилета"
                                min={0}
                                max={1440}
                                step={5}
                                lowerValue={arrivalRange.lower}
                                upperValue={arrivalRange.upper}
                                onChangeLower={(val) => setArrivalRange(prev => ({...prev, lower: val}))}
                                onChangeUpper={(val) => setArrivalRange(prev => ({...prev, upper: val}))}
                            />

                            <DoubleTimeSlider
                                label="Время в пути"
                                min={30}     // 30 минут
                                max={720}    // 12 часов
                                step={5}
                                lowerValue={durationRange.lower}
                                upperValue={durationRange.upper}
                                onChangeLower={(val) => setDurationRange(prev => ({...prev, lower: val}))}
                                onChangeUpper={(val) => setDurationRange(prev => ({...prev, upper: val}))}
                            />
                        </div>
                    </div>
                </div>
                <div className="trip-type-selector">
                    {[
                        {value: "oneWay", label: "В одну сторону"},
                        {value: "roundTrip", label: "Туда и обратно"},
                        {value: "complex", label: "Сложный маршрут"},
                    ].map((option) => (
                        <label key={option.value} className="filter-item">
                            <input
                                type="radio"
                                name="tripType"
                                value={option.value}
                                checked={tripType === option.value}
                                onChange={() => setTripType(option.value)}
                            />
                            <span className="radiomark"></span>
                            <span className="trip-type-text">{option.label}</span>
                        </label>
                    ))}
                </div>

                <SearchForm onSearch={handleSearch} tripType={tripType}/>

                <div className="flight-list-wrapper">
                    <FlightList s7={s7} onFlightClick={handleFlightClick}/>
                </div>
                {/* Правая колонка фильтров */}
                <div className="filters-right">
                    <div className="filters-column">
                        <div className="filter-group">
                            <h3 className="filter-title">Класс обслуживания</h3>
                            {['Эконом', 'Комфорт', 'Бизнес'].map(cls => (
                                <label key={cls} className="filter-item">
                                    <input type="checkbox"/>
                                    <span className="checkmark"></span>
                                    {cls}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider"></div>

                        <div className="filter-group">
                            <h3 className="filter-title">Авиакомпании</h3>
                            {['S7 Airlines', 'Аэрофлот', 'Уральские Авиалинии'].map(company => (
                                <label key={company} className="filter-item">
                                    <input type="checkbox"/>
                                    <span className="checkmark"></span>
                                    {company}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default S7;
