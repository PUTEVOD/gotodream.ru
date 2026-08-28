import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchForm from "./SearchForm";
import FlightList from "./FlightList";
import "../styles/S7.css";
import "../styles/FiltersSearchAir.css";
import Header from "../Header";
import DoubleTimeSlider from "../ui/DoubleTimeSlider";
import { searchFlights, ApiError } from "../search/searchApi";
import { buildFilters, CABIN_CLASS_LABELS, TRIP_TYPES } from "../search/contract";

const DEFAULT_RANGES = {
    departureRange: { lower: 0, upper: 1440 },
    arrivalRange: { lower: 0, upper: 1440 },
    durationRange: { lower: 30, upper: 720 },
};

const S7 = () => {
    const navigate = useNavigate();

    const [tripType, setTripType] = useState(TRIP_TYPES.ROUND_TRIP);

    // Результаты и состояние запроса
    const [flights, setFlights] = useState([]);
    const [status, setStatus] = useState("idle"); // idle | loading | success | error
    const [error, setError] = useState(null);     // ApiError | null

    // Фильтры
    const [departureRange, setDepartureRange] = useState(DEFAULT_RANGES.departureRange);
    const [arrivalRange, setArrivalRange] = useState(DEFAULT_RANGES.arrivalRange);
    const [durationRange, setDurationRange] = useState(DEFAULT_RANGES.durationRange);
    const [stops, setStops] = useState([]);
    const [sortType, setSortType] = useState("cheapest");
    const [selectedClasses, setSelectedClasses] = useState([]);
    const [selectedAirlines, setSelectedAirlines] = useState([]);

    // Какие диапазоны пользователь реально трогал. Без этого дефолтные значения
    // слайдеров молча отрезают часть выдачи и поиск «ничего не находит».
    const [touched, setTouched] = useState({});
    const markTouched = (key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

    // Последний отправленный payload формы — чтобы повторить поиск при смене фильтров.
    const lastPayloadRef = useRef(null);
    // Контроллер текущего запроса — чтобы отменять устаревшие и не ловить гонку ответов.
    const requestRef = useRef(null);

    const runSearch = useCallback(
        async (formPayload, filtersState) => {
            requestRef.current?.abort();
            const controller = new AbortController();
            requestRef.current = controller;

            const requestData = { ...formPayload, filters: buildFilters(filtersState) };

            setStatus("loading");
            setError(null);

            try {
                const data = await searchFlights(requestData, { signal: controller.signal });
                if (controller.signal.aborted) return;
                setFlights(Array.isArray(data.flights) ? data.flights : []);
                setStatus("success");
            } catch (err) {
                if (err?.name === "AbortError") return; // запрос вытеснен новым — это не ошибка
                setError(err instanceof ApiError ? err : new ApiError("Неизвестная ошибка"));
                setFlights([]);
                setStatus("error");
            }
        },
        []
    );

    const handleSearch = useCallback(
        (formPayload) => {
            lastPayloadRef.current = formPayload;
            runSearch(formPayload, {
                departureRange, arrivalRange, durationRange,
                stops, sortType, selectedClasses, selectedAirlines, touched,
            });
        },
        [runSearch, departureRange, arrivalRange, durationRange, stops, sortType, selectedClasses, selectedAirlines, touched]
    );

    // Смена фильтров после выполненного поиска перезапрашивает выдачу.
    useEffect(() => {
        if (!lastPayloadRef.current) return;
        const timer = setTimeout(() => {
            runSearch(lastPayloadRef.current, {
                departureRange, arrivalRange, durationRange,
                stops, sortType, selectedClasses, selectedAirlines, touched,
            });
        }, 300); // debounce: слайдеры генерируют десятки событий подряд
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [departureRange, arrivalRange, durationRange, stops, sortType, selectedClasses, selectedAirlines]);

    useEffect(() => () => requestRef.current?.abort(), []);

    const handleStopsChange = (e) => {
        const value = Number(e.target.value);
        setStops((prev) => (e.target.checked ? [...prev, value] : prev.filter((s) => s !== value)));
    };

    const handleClassChange = (e) => {
        const value = e.target.value;
        setSelectedClasses((prev) => (e.target.checked ? [...prev, value] : prev.filter((c) => c !== value)));
    };

    const handleAirlineChange = (e) => {
        const value = e.target.value;
        setSelectedAirlines((prev) => (e.target.checked ? [...prev, value] : prev.filter((a) => a !== value)));
    };

    const handleRangeChange = (key, setter) => (next) => {
        markTouched(key);
        setter(next);
    };

    const handleDepartureChange = (newLower, newUpper) => {
        const MIN_WINDOW = 60;
        let lower = newLower;
        let upper = newUpper;
        if (upper - lower < MIN_WINDOW) {
            if (lower !== departureRange.lower) upper = lower + MIN_WINDOW;
            else lower = upper - MIN_WINDOW;
        }
        markTouched("departureRange");
        setDepartureRange({ lower, upper });
    };

    const serverFieldErrors = error?.code === "VALIDATION_ERROR" ? error.fieldErrors : null;

    return (
        <>
            <Header />
            <div className="main-container">
                <div className="filters-left">
                    <div className="filters-column">
                        <div className="filter-group">
                            <h3 className="filter-title">Пересадки</h3>
                            {[0, 1, 2].map((st) => (
                                <label key={st} className="filter-item">
                                    <input type="checkbox" value={st} checked={stops.includes(st)} onChange={handleStopsChange} />
                                    <span className="checkmark" />
                                    {st === 0 ? "Без пересадок" : `${st} пересадк${st === 1 ? "а" : "и"}`}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider" />

                        <div className="filter-group">
                            <h3 className="filter-title">Сортировка</h3>
                            {[
                                { value: "cheapest", label: "Самый дешёвый" },
                                { value: "fastest", label: "Самый быстрый" },
                                { value: "convenient", label: "Самый удобный" },
                            ].map((type) => (
                                <label key={type.value} className="filter-item">
                                    <input
                                        type="radio"
                                        name="sort"
                                        value={type.value}
                                        checked={sortType === type.value}
                                        onChange={(e) => setSortType(e.target.value)}
                                    />
                                    <span className="radiomark" />
                                    {type.label}
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
                                onChangeLower={(val) => handleDepartureChange(val, departureRange.upper)}
                                onChangeUpper={(val) => handleDepartureChange(departureRange.lower, val)}
                            />

                            <DoubleTimeSlider
                                label="Время прилёта"
                                min={0} max={1440} step={5}
                                lowerValue={arrivalRange.lower}
                                upperValue={arrivalRange.upper}
                                onChangeLower={handleRangeChange("arrivalRange", (val) => setArrivalRange((p) => ({ ...p, lower: val })))}
                                onChangeUpper={handleRangeChange("arrivalRange", (val) => setArrivalRange((p) => ({ ...p, upper: val })))}
                            />

                            <DoubleTimeSlider
                                label="Время в пути"
                                min={30} max={720} step={5}
                                lowerValue={durationRange.lower}
                                upperValue={durationRange.upper}
                                onChangeLower={handleRangeChange("durationRange", (val) => setDurationRange((p) => ({ ...p, lower: val })))}
                                onChangeUpper={handleRangeChange("durationRange", (val) => setDurationRange((p) => ({ ...p, upper: val })))}
                            />
                        </div>
                    </div>
                </div>

                <div className="trip-type-selector">
                    {[
                        { value: TRIP_TYPES.ONE_WAY, label: "В одну сторону" },
                        { value: TRIP_TYPES.ROUND_TRIP, label: "Туда и обратно" },
                        { value: TRIP_TYPES.COMPLEX, label: "Сложный маршрут" },
                    ].map((opt) => (
                        <label key={opt.value} className="filter-item">
                            <input
                                type="radio"
                                name="tripType"
                                value={opt.value}
                                checked={tripType === opt.value}
                                onChange={() => setTripType(opt.value)}
                            />
                            <span className="radiomark" />
                            <span className="trip-type-text">{opt.label}</span>
                        </label>
                    ))}
                </div>

                <SearchForm
                    onSearch={handleSearch}
                    tripType={tripType}
                    isSubmitting={status === "loading"}
                    serverFieldErrors={serverFieldErrors}
                />

                <div className="flight-list-wrapper">
                    {status === "loading" && <div className="search-state">Ищем рейсы…</div>}

                    {status === "error" && (
                        <div className="search-state search-state--error" role="alert">
                            {error?.message || "Не удалось выполнить поиск"}
                            {lastPayloadRef.current && (
                                <button
                                    type="button"
                                    className="retry-button"
                                    onClick={() => handleSearch(lastPayloadRef.current)}
                                >
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
                        <FlightList s7={flights} onFlightClick={(flightId) => navigate(`/s7/${flightId}`)} />
                    )}
                </div>

                <div className="filters-right">
                    <div className="filters-column">
                        <div className="filter-group">
                            <h3 className="filter-title">Класс обслуживания</h3>
                            {Object.values(CABIN_CLASS_LABELS).map((cls) => (
                                <label key={cls} className="filter-item">
                                    <input
                                        type="checkbox"
                                        value={cls}
                                        checked={selectedClasses.includes(cls)}
                                        onChange={handleClassChange}
                                    />
                                    <span className="checkmark" />{cls}
                                </label>
                            ))}
                        </div>

                        <div className="filter-divider" />

                        <div className="filter-group">
                            <h3 className="filter-title">Авиакомпании</h3>
                            {["S7 Airlines", "Аэрофлот", "Уральские авиалинии"].map((company) => (
                                <label key={company} className="filter-item">
                                    <input
                                        type="checkbox"
                                        value={company}
                                        checked={selectedAirlines.includes(company)}
                                        onChange={handleAirlineChange}
                                    />
                                    <span className="checkmark" />{company}
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
