import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../Header";
import DoubleTimeSlider from "../ui/DoubleTimeSlider";
import SearchForm from "./SearchForm";
import FlightList from "./FlightList";
import { useFlightSearch } from "../search/useFlightSearch";
import { CABIN_CLASS_LABELS, SORT_LABELS, STOPS_OPTIONS, AIRLINES, TRIP_TYPE_LABELS } from "../search/contract";
import "../styles/S7.css";
import "../styles/FiltersSearchAir.css";

/**
 * Страница поиска рейсов: фильтры слева и справа, форма сверху, выдача в центре.
 *
 * Сети здесь нет — она вся в useFlightSearch. Валидации здесь нет — она в
 * SearchForm и contract.js. Этот файл отвечает только за раскладку и за то,
 * какие фильтры существуют.
 */

/* Полный диапазон = «без ограничения». Пока пользователь не трогал слайдер,
   соответствующий фильтр в запрос не попадает вовсе: иначе значения по
   умолчанию молча отрезают часть выдачи, и поиск «ничего не находит». */
const DEFAULT_RANGES = {
    departureRange: { lower: 0, upper: 1440 },
    arrivalRange: { lower: 0, upper: 1440 },
    durationRange: { lower: 30, upper: 720 },
};

const MIN_TIME_WINDOW = 60; // минимальная ширина окна времени вылета, минут

const S7 = () => {
    const navigate = useNavigate();

    const [tripType, setTripType] = useState("roundTrip");

    const [departureRange, setDepartureRange] = useState(DEFAULT_RANGES.departureRange);
    const [arrivalRange, setArrivalRange] = useState(DEFAULT_RANGES.arrivalRange);
    const [durationRange, setDurationRange] = useState(DEFAULT_RANGES.durationRange);
    const [stops, setStops] = useState([]);
    const [sortType, setSortType] = useState("cheapest");
    const [selectedClasses, setSelectedClasses] = useState([]);
    const [selectedAirlines, setSelectedAirlines] = useState([]);
    const [touched, setTouched] = useState({});

    const filters = useMemo(
        () => ({
            departureRange, arrivalRange, durationRange,
            stops, sortType, selectedClasses, selectedAirlines, touched,
        }),
        [departureRange, arrivalRange, durationRange, stops, sortType, selectedClasses, selectedAirlines, touched],
    );

    const { status, flights, error, fieldErrors, hasSearched, search, retry } = useFlightSearch(filters);

    /* ------------------------------ фильтры ------------------------------ */

    const toggleIn = (setter) => (event) => {
        const { value, checked } = event.target;
        setter((prev) => (checked ? [...prev, value] : prev.filter((item) => item !== value)));
    };

    const handleStopsChange = (event) => {
        const value = Number(event.target.value);
        setStops((prev) => (event.target.checked ? [...prev, value] : prev.filter((s) => s !== value)));
    };

    const markTouched = (key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

    const changeRange = (key, setter) => (patch) => {
        markTouched(key);
        setter((prev) => ({ ...prev, ...patch }));
    };

    // У времени вылета есть дополнительное правило: окно не уже часа,
    // иначе ползунки схлопываются в точку и выдача всегда пуста.
    const changeDeparture = (next) => {
        markTouched("departureRange");
        setDepartureRange((prev) => {
            let { lower, upper } = { ...prev, ...next };
            if (upper - lower < MIN_TIME_WINDOW) {
                if (next.lower !== undefined) upper = lower + MIN_TIME_WINDOW;
                else lower = upper - MIN_TIME_WINDOW;
            }
            return { lower, upper };
        });
    };

    /* ------------------------------ разметка ------------------------------ */

    return (
        <>
            <Header />

            <div className="main-container">
                <aside className="filters-left">
                    <div className="filters-column">
                        <div className="filter-group">
                            <h3 className="filter-title">Пересадки</h3>
                            {STOPS_OPTIONS.map((option) => (
                                <label key={option.value} className="filter-item">
                                    <input
                                        type="checkbox"
                                        value={option.value}
                                        checked={stops.includes(option.value)}
                                        onChange={handleStopsChange}
                                    />
                                    <span className="checkmark" />
                                    {option.label}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider" />

                        <div className="filter-group">
                            <h3 className="filter-title">Сортировка</h3>
                            {Object.entries(SORT_LABELS).map(([value, label]) => (
                                <label key={value} className="filter-item">
                                    <input
                                        type="radio"
                                        name="sort"
                                        value={value}
                                        checked={sortType === value}
                                        onChange={(event) => setSortType(event.target.value)}
                                    />
                                    <span className="radiomark" />
                                    {label}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider" />

                        <div className="filter-group">
                            <DoubleTimeSlider
                                label="Время вылета"
                                min={0} max={1440} step={5}
                                lowerValue={departureRange.lower}
                                upperValue={departureRange.upper}
                                onChangeLower={(value) => changeDeparture({ lower: value })}
                                onChangeUpper={(value) => changeDeparture({ upper: value })}
                            />

                            <DoubleTimeSlider
                                label="Время прилёта"
                                min={0} max={1440} step={5}
                                lowerValue={arrivalRange.lower}
                                upperValue={arrivalRange.upper}
                                onChangeLower={(value) => changeRange("arrivalRange", setArrivalRange)({ lower: value })}
                                onChangeUpper={(value) => changeRange("arrivalRange", setArrivalRange)({ upper: value })}
                            />

                            <DoubleTimeSlider
                                label="Время в пути"
                                min={30} max={720} step={5}
                                lowerValue={durationRange.lower}
                                upperValue={durationRange.upper}
                                onChangeLower={(value) => changeRange("durationRange", setDurationRange)({ lower: value })}
                                onChangeUpper={(value) => changeRange("durationRange", setDurationRange)({ upper: value })}
                            />
                        </div>
                    </div>
                </aside>

                <div className="trip-type-selector">
                    {Object.entries(TRIP_TYPE_LABELS).map(([value, label]) => (
                        <label key={value} className="filter-item">
                            <input
                                type="radio"
                                name="tripType"
                                value={value}
                                checked={tripType === value}
                                onChange={() => setTripType(value)}
                            />
                            <span className="radiomark" />
                            <span className="trip-type-text">{label}</span>
                        </label>
                    ))}
                </div>

                <SearchForm
                    onSearch={search}
                    tripType={tripType}
                    isSubmitting={status === "loading"}
                    serverFieldErrors={fieldErrors}
                />

                <div className="flight-list-wrapper">
                    {status === "idle" && (
                        <div className="search-state">Заполните форму и нажмите «Поиск».</div>
                    )}

                    {status === "loading" && <div className="search-state">Ищем рейсы…</div>}

                    {status === "error" && (
                        <div className="search-state search-state--error" role="alert">
                            {error?.message || "Не удалось выполнить поиск"}
                            {hasSearched && (
                                <button type="button" className="retry-button" onClick={retry}>
                                    Повторить
                                </button>
                            )}
                        </div>
                    )}

                    {status === "success" && flights.length === 0 && (
                        <div className="search-state">
                            По заданным параметрам рейсов нет. Ослабьте фильтры или измените даты.
                        </div>
                    )}

                    {status === "success" && flights.length > 0 && (
                        <FlightList flights={flights} onFlightClick={(flightId) => navigate(`/s7/${flightId}`)} />
                    )}
                </div>

                <aside className="filters-right">
                    <div className="filters-column">
                        <div className="filter-group">
                            <h3 className="filter-title">Класс обслуживания</h3>
                            {Object.entries(CABIN_CLASS_LABELS).map(([value, label]) => (
                                <label key={value} className="filter-item">
                                    <input
                                        type="checkbox"
                                        value={value}
                                        checked={selectedClasses.includes(value)}
                                        onChange={toggleIn(setSelectedClasses)}
                                    />
                                    <span className="checkmark" />{label}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider" />

                        <div className="filter-group">
                            <h3 className="filter-title">Авиакомпании</h3>
                            {AIRLINES.map((airline) => (
                                <label key={airline} className="filter-item">
                                    <input
                                        type="checkbox"
                                        value={airline}
                                        checked={selectedAirlines.includes(airline)}
                                        onChange={toggleIn(setSelectedAirlines)}
                                    />
                                    <span className="checkmark" />{airline}
                                </label>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </>
    );
};

export default S7;
