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
    const navigate = useNavigate();
    const [tripType, setTripType] = useState("roundTrip");

    const [departureRange, setDepartureRange] = useState({ lower: 360, upper: 1080 });
    const [arrivalRange, setArrivalRange] = useState({ lower: 480, upper: 1200 });
    const [durationRange, setDurationRange] = useState({ lower: 60, upper: 600 });

    const [stops, setStops] = useState([]);
    const [sortType, setSortType] = useState('cheapest');
    const [selectedClasses, setSelectedClasses] = useState([]);
    const [selectedAirlines, setSelectedAirlines] = useState([]);

    const handleStopsChange = (e) => {
        const value = parseInt(e.target.value);
        setStops(e.target.checked ? [...stops, value] : stops.filter(s => s !== value));
    };

    const handleClassChange = (e) => {
        const value = e.target.value.toLowerCase();
        setSelectedClasses(e.target.checked ? [...selectedClasses, value] : selectedClasses.filter(c => c !== value));
    };

    const handleAirlineChange = (e) => {
        const value = e.target.value;
        setSelectedAirlines(e.target.checked ? [...selectedAirlines, value] : selectedAirlines.filter(a => a !== value));
    };

    const handleSearch = async (searchParams) => {
        console.log("Отправляемые данные с формы:", searchParams);

        if (!searchParams || !searchParams.itinerary) {
            console.warn("Некорректные searchParams — проверь логику SearchForm");
            return;
        }

        try {
            // Добавляем фильтры к параметрам поиска
            const requestData = {
                ...searchParams,
                filters: {
                    departureRange,
                    arrivalRange,
                    durationRange,
                    stops,
                    sortType,
                    selectedClasses,
                    selectedAirlines
                }
            };

            console.log("Полные данные для отправки:", requestData);

            const response = await fetch('http://localhost:8000/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) throw new Error('Search failed');

            const data = await response.json();
            console.log("Ответ от сервера:", data);
            sets7(data.flights || []);
        } catch (error) {
            console.error('Ошибка при запросе:', error);
        }
    };

    const handleFlightClick = (flightId) => navigate(`/s7/${flightId}`);

    const handleDepartureChange = (newLower, newUpper) => {
        if (newUpper - newLower < 60) {
            if (newLower !== departureRange.lower) newUpper = newLower + 60;
            else newLower = newUpper - 60;
        }
        setDepartureRange({ lower: newLower, upper: newUpper });
    };

    return (
        <>
            <Header />
            <div className="main-container">
                <div className="filters-left">
                    <div className="filters-column">
                        <div className="filter-group">
                            <h3 className="filter-title">Пересадки</h3>
                            {[0, 1, 2].map(st => (
                                <label key={st} className="filter-item">
                                    <input type="checkbox" value={st} onChange={handleStopsChange} />
                                    <span className="checkmark"></span>
                                    {st === 0 ? 'Без пересадок' : `${st} пересадок`}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider"></div>

                        <div className="filter-group">
                            <h3 className="filter-title">Сортировка</h3>
                            {[
                                { value: 'cheapest', label: 'Самый дешевый' },
                                { value: 'fastest', label: 'Самый быстрый' },
                                { value: 'convenient', label: 'Самый удобный' }
                            ].map(type => (
                                <label key={type.value} className="filter-item">
                                    <input
                                        type="radio"
                                        name="sort"
                                        value={type.value}
                                        checked={sortType === type.value}
                                        onChange={(e) => setSortType(e.target.value)}
                                    />
                                    <span className="radiomark"></span>
                                    {type.label}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider"></div>

                        <div className="filter-group">
                            <DoubleTimeSlider
                                label="Время вылета"
                                min={0} max={1440} step={5}
                                lowerValue={departureRange.lower}
                                upperValue={departureRange.upper}
                                onChangeLower={(val) => handleDepartureChange(val, departureRange.upper)}
                                onChangeUpper={(val) => handleDepartureChange(departureRange.lower, val)}
                            />

                            <DoubleTimeSlider
                                label="Время прилета"
                                min={0} max={1440} step={5}
                                lowerValue={arrivalRange.lower}
                                upperValue={arrivalRange.upper}
                                onChangeLower={(val) => setArrivalRange(p => ({ ...p, lower: val }))}
                                onChangeUpper={(val) => setArrivalRange(p => ({ ...p, upper: val }))}
                            />

                            <DoubleTimeSlider
                                label="Время в пути"
                                min={30} max={720} step={5}
                                lowerValue={durationRange.lower}
                                upperValue={durationRange.upper}
                                onChangeLower={(val) => setDurationRange(p => ({ ...p, lower: val }))}
                                onChangeUpper={(val) => setDurationRange(p => ({ ...p, upper: val }))}
                            />
                        </div>
                    </div>
                </div>

                <div className="trip-type-selector">
                    {[
                        { value: "oneWay", label: "В одну сторону" },
                        { value: "roundTrip", label: "Туда и обратно" },
                        { value: "complex", label: "Сложный маршрут" },
                    ].map(opt => (
                        <label key={opt.value} className="filter-item">
                            <input
                                type="radio"
                                name="tripType"
                                value={opt.value}
                                checked={tripType === opt.value}
                                onChange={() => setTripType(opt.value)}
                            />
                            <span className="radiomark"></span>
                            <span className="trip-type-text">{opt.label}</span>
                        </label>
                    ))}
                </div>

                <SearchForm
                    onSearch={handleSearch}
                    tripType={tripType}
                    filters={{
                        departureRange, arrivalRange, durationRange,
                        stops, sortType, selectedClasses, selectedAirlines
                    }}
                />

                <div className="flight-list-wrapper">
                    <FlightList s7={s7} onFlightClick={handleFlightClick} />
                </div>

                <div className="filters-right">
                    <div className="filters-column">
                        <div className="filter-group">
                            <h3 className="filter-title">Класс обслуживания</h3>
                            {['Эконом', 'Комфорт', 'Бизнес'].map(cls => (
                                <label key={cls} className="filter-item">
                                    <input type="checkbox" value={cls} onChange={handleClassChange} />
                                    <span className="checkmark"></span>{cls}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider"></div>

                        <div className="filter-group">
                            <h3 className="filter-title">Авиакомпании</h3>
                            {['S7 Airlines', 'Аэрофлот', 'Уральские Авиалинии'].map(company => (
                                <label key={company} className="filter-item">
                                    <input type="checkbox" value={company} onChange={handleAirlineChange} />
                                    <span className="checkmark"></span>{company}
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
