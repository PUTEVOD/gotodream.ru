import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import SiteHeader from "../layout/SiteHeader";
import DoubleTimeSlider from "../ui/DoubleTimeSlider";
import SearchForm from "./SearchForm";
import FlightList from "./FlightList";
import FiltersPanel from "./FiltersPanel";
import { useFlightSearch } from "../search/useFlightSearch";
import { CABIN_CLASS_LABELS, SORT_LABELS, STOPS_OPTIONS, TRIP_TYPE_LABELS } from "../search/contract";
import "../../theme/tokens.css";        // переменные — первыми
import "../styles/S7.css";
import "../styles/FiltersSearchAir.css";
import "../styles/S7.responsive.css";
import "../../theme/base.css";          // каркас страницы
import "../../theme/form.css";          // тема формы поиска
import "../../theme/s7.css";            // тема страницы выдачи

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


const S7 = () => {
    // Параметры, приехавшие с главной страницы. undefined, если на /s7
    // зашли напрямую.
    const location = useLocation();
    const handoff = location.state?.search;

    const [tripType, setTripType] = useState(handoff?.values?.tripType || "roundTrip");

    /* Выбранное предложение. Маршрута /s7/:id в приложении нет, и раньше
       кнопка «Выбрать» уводила на несуществующий адрес — пустая страница без
       единого сообщения. Пока следующий шаг (пересчёт цены и бронирование)
       не сделан, выбор остаётся на этой же странице: карточка отмечается,
       под списком появляется строка с тем, что выбрано. Это честно
       показывает границу готовности вместо тупика. */
    const [selectedFlight, setSelectedFlight] = useState(null);

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

    const { status, flights, facets, error, fieldErrors, hasSearched, search, retry } = useFlightSearch(filters);
    // Запрос с главной отправляется один раз при открытии страницы.
    // Пустой список зависимостей здесь не небрежность, а требование:
    // search пересоздаётся при смене фильтров, и с ним в зависимостях
    // эффект перезапускал бы исходный запрос поверх отфильтрованного.
    useEffect(() => {
        if (handoff?.payload) search(handoff.payload);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* Список авиакомпаний для фильтра: приходит с ответом сервера и описывает
       ТЕКУЩУЮ выдачу — компании со счётчиком рейсов.

       Отметки, потерявшие смысл после нового поиска, здесь НЕ снимаются
       автоматически, и это осознанно. Сервер оставляет отмеченную компанию
       в списке даже с нулевым счётчиком (см. buildFacets), поэтому человек
       видит строку «Аэрофлот 0» и понимает, почему выдача пуста, — вместо
       того чтобы фильтр молча резал результаты из строки, которой на экране
       уже нет. Снять отметку он может сам, в один щелчок.

       Ровно то же верно для классов обслуживания. */
    const airlineFacets = facets.airlines;
    const cabinFacets = facets.cabinClasses;

    const activeFilterCount =
        stops.length +
        selectedClasses.length +
        selectedAirlines.length +
        Object.keys(touched).length;

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

    /* Отдельного обработчика для времени вылета больше нет. Он повторял
       правило «окно не уже часа», которое слайдер уже применяет сам в
       commit() — то есть до страницы значения доходили уже приведёнными, и
       второй расчёт никогда не срабатывал. Правило и его число живут в
       одном месте: DoubleTimeSlider, MIN_TIME_WINDOW. */

    /* ------------------------------ разметка ------------------------------ */

    return (
        <>
            <div className="gtd-page gtd-theme">
                <SiteHeader />
                <div className="main-container">
                    <FiltersPanel activeCount={activeFilterCount}>
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
                                            <span className="checkmark"/>
                                            {option.label}
                                        </label>
                                    ))}
                                </div>

                                <div className="filter-divider"/>

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
                                            <span className="radiomark"/>
                                            {label}
                                        </label>
                                    ))}
                                </div>

                                <div className="filter-divider"/>

                                <div className="filter-group">
                                    <DoubleTimeSlider
                                        label="Время вылета"
                                        min={0} max={1440} step={5}
                                        lowerValue={departureRange.lower}
                                        upperValue={departureRange.upper}
                                        onChangeLower={(value) => changeRange("departureRange", setDepartureRange)({lower: value})}
                                        onChangeUpper={(value) => changeRange("departureRange", setDepartureRange)({upper: value})}
                                    />

                                    <DoubleTimeSlider
                                        label="Время прилёта"
                                        min={0} max={1440} step={5}
                                        lowerValue={arrivalRange.lower}
                                        upperValue={arrivalRange.upper}
                                        onChangeLower={(value) => changeRange("arrivalRange", setArrivalRange)({lower: value})}
                                        onChangeUpper={(value) => changeRange("arrivalRange", setArrivalRange)({upper: value})}
                                    />

                                    <DoubleTimeSlider
                                        label="Время в пути"
                                        min={30} max={720} step={5}
                                        lowerValue={durationRange.lower}
                                        upperValue={durationRange.upper}
                                        onChangeLower={(value) => changeRange("durationRange", setDurationRange)({lower: value})}
                                        onChangeUpper={(value) => changeRange("durationRange", setDurationRange)({upper: value})}
                                    />
                                </div>
                            </div>
                        </aside>
                        <aside className="filters-right">
                            <div className="filters-column">
                                {/* Обе группы строятся по фасетам из ответа
                                    сервера и описывают ТЕКУЩУЮ выдачу.
                                    Пока поиска не было, групп нет: предлагать
                                    фильтр, не зная маршрута, — значит обещать
                                    выбор, который ничего не найдёт.

                                    Русские подписи классов берутся из
                                    контракта: сервер присылает значения
                                    ("economy"), а не текст для показа. */}
                                {cabinFacets.length > 0 && (
                                    <div className="filter-group">
                                        <h3 className="filter-title">Класс обслуживания</h3>
                                        {cabinFacets.map(({ value, count }) => (
                                            <label
                                                key={value}
                                                className={`filter-item${count === 0 ? " is-empty" : ""}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    value={value}
                                                    checked={selectedClasses.includes(value)}
                                                    onChange={toggleIn(setSelectedClasses)}
                                                />
                                                <span className="checkmark"/>
                                                <span className="filter-item__text">
                                                    {CABIN_CLASS_LABELS[value] || value}
                                                </span>
                                                <span className="filter-item__count">{count}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {airlineFacets.length > 0 && (
                                    <>
                                        {cabinFacets.length > 0 && <div className="filter-divider"/>}

                                        <div className="filter-group">
                                            <h3 className="filter-title">Авиакомпании</h3>
                                            {airlineFacets.map(({ value, count }) => (
                                                <label
                                                    key={value}
                                                    className={`filter-item${count === 0 ? " is-empty" : ""}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        value={value}
                                                        checked={selectedAirlines.includes(value)}
                                                        onChange={toggleIn(setSelectedAirlines)}
                                                    />
                                                    <span className="checkmark"/>
                                                    <span className="filter-item__text">{value}</span>
                                                    <span className="filter-item__count">{count}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </aside>
                    </FiltersPanel>

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
                                    <span className="radiomark"/>
                                    <span className="trip-type-text">{label}</span>
                                </label>
                            ))}
                        </div>

                        <SearchForm
                            onSearch={search}
                            tripType={tripType}
                            isSubmitting={status === "loading"}
                            serverFieldErrors={fieldErrors}
                            initialValues={handoff?.values}
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
                                <>
                                    <FlightList
                                        flights={flights}
                                        selectedId={selectedFlight?.id}
                                        onFlightClick={setSelectedFlight}
                                    />
                                    {selectedFlight && (
                                        <div className="search-state search-state--selected" role="status">
                                            Выбрано: {selectedFlight.from} → {selectedFlight.to},{" "}
                                            {selectedFlight.fareBrand || selectedFlight.cabinClass}.
                                            Бронирование появится на следующем шаге.
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                </div>
            </div>
        </>
    );
};

export default S7;
