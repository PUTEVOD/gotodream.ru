import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/SearchForm.css";
import PassengerSelector from "./PassengerSelector";
import AirportField from "./AirportField";
import DateField from "./DateField";
import {
    TRIP_TYPES,
    CABIN_CLASSES,
    CABIN_CLASS_LABELS,
    LIMITS,
    EMPTY_PASSENGERS,
    todayISO,
    addDaysISO,
    validateSearchForm,
    buildSearchPayload,
    countPassengers,
} from "../search/contract";

const emptySegment = () => ({ origin: "", destination: "", date: "" });

/** Склонение: 1 пассажир / 2 пассажира / 5 пассажиров */
function pluralPassengers(n) {
    const mod100 = n % 100;
    const mod10 = n % 10;
    if (mod100 >= 11 && mod100 <= 14) return `${n} пассажиров`;
    if (mod10 === 1) return `${n} пассажир`;
    if (mod10 >= 2 && mod10 <= 4) return `${n} пассажира`;
    return `${n} пассажиров`;
}

/**
 * Форма поиска рейсов.
 *
 * Собирает данные, валидирует их и отдаёт наверх готовый payload.
 * Сетью не занимается — это ответственность страницы (S7.jsx).
 *
 * @param {Function} onSearch          (payload) => void | Promise<void>
 * @param {string}   tripType          oneWay | roundTrip | complex
 * @param {boolean}  isSubmitting      запрос выполняется, кнопка блокируется
 * @param {object}   serverFieldErrors ошибки валидации от бэкенда: { "itinerary.0.origin": "..." }
 */
const SearchForm = ({ onSearch,
                        tripType = TRIP_TYPES.ROUND_TRIP,
                        isSubmitting = false,
                        serverFieldErrors,
                        initialValues,
                    }) => {
    // Значения из initialValues попадают в состояние ТОЛЬКО при монтировании:
    // так работает аргумент useState. Это ровно то, что нужно — форма должна
    // подхватить перенос с главной один раз, а дальше жить своей жизнью.
    const [segments, setSegments] = useState(
        initialValues?.segments?.length ? initialValues.segments : [emptySegment()],
    );
    const [returnDate, setReturnDate] = useState(initialValues?.returnDate || "");
    const [passengers, setPassengers] = useState(initialValues?.passengers || EMPTY_PASSENGERS);
    const [cabinClass, setCabinClass] = useState(initialValues?.cabinClass || CABIN_CLASSES.ECONOMY);
    // const [segments, setSegments] = useState([emptySegment()]);
    // const [returnDate, setReturnDate] = useState("");
    // const [passengers, setPassengers] = useState(EMPTY_PASSENGERS);
    // const [cabinClass, setCabinClass] = useState(CABIN_CLASSES.ECONOMY);
    const [showPassengers, setShowPassengers] = useState(false);
    const [wasSubmitted, setWasSubmitted] = useState(false);
    const passengersTriggerRef = useRef(null);
    const minDate = useMemo(() => todayISO(), []);
    const maxDate = useMemo(() => addDaysISO(minDate, LIMITS.MAX_DAYS_AHEAD), [minDate]);
    const formState = useMemo(
        () => ({ tripType, segments, returnDate, passengers, cabinClass }),
        [tripType, segments, returnDate, passengers, cabinClass]
    );
    const { ok, errors } = useMemo(() => validateSearchForm(formState), [formState]);
    // Ошибки бэкенда приходят с ключами itinerary.N.field — приводим к ключам формы.
    const mappedServerErrors = useMemo(() => {
        if (!serverFieldErrors) return {};
        return Object.fromEntries(
            Object.entries(serverFieldErrors).map(([path, message]) => [
                path.replace(/^itinerary\.(\d+)\.departureDate$/, "segments.$1.date")
                    .replace(/^itinerary\.(\d+)\./, "segments.$1."),
                message,
            ])
        );
    }, [serverFieldErrors]);

    // Показываем ошибку только после попытки отправки — иначе пустая форма
    // сразу краснеет и обучает пользователя игнорировать подсветку.
    const errorFor = (key) => (wasSubmitted ? errors[key] : undefined) || mappedServerErrors[key];

    // Смена типа поездки не должна тащить за собой лишние сегменты и дату возврата.
    useEffect(() => {
        if (tripType !== TRIP_TYPES.COMPLEX) {
            setSegments((prev) => (prev.length > 1 ? prev.slice(0, 1) : prev));
        }
        if (tripType !== TRIP_TYPES.ROUND_TRIP) {
            setReturnDate("");
        }
    }, [tripType]);

    /* --------------------------- изменения полей --------------------------- */

    const updateSegment = useCallback((index, field, value) => {
        setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    }, []);

    const swapDirection = useCallback((index) => {
        setSegments((prev) =>
            prev.map((s, i) => (i === index ? { ...s, origin: s.destination, destination: s.origin } : s))
        );
    }, []);

    const addSegment = useCallback(() => {
        setSegments((prev) => {
            if (prev.length >= LIMITS.MAX_SEGMENTS) return prev;
            const last = prev[prev.length - 1];
            // Разумный дефолт: следующий перелёт начинается там, где закончился прошлый.
            return [...prev, { ...emptySegment(), origin: last.destination, date: last.date }];
        });
    }, []);

    const removeSegment = useCallback((index) => {
        setSegments((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
    }, []);

    const closePassengers = useCallback(() => setShowPassengers(false), []);

    /* ------------------------------ отправка ------------------------------ */

    const handleSubmit = (event) => {
        event.preventDefault();
        setWasSubmitted(true);
        if (!ok || isSubmitting) return;
        // Второй аргумент — состояние формы как есть. Существующий вызов на
        // /s7 выглядит как search(payload) и лишний аргумент просто
        // игнорирует, так что правка обратно совместима.
        onSearch(buildSearchPayload(formState), formState);
        // onSearch(buildSearchPayload(formState));
    };

    /* ------------------------------- разметка ------------------------------ */

    const totalPassengers = countPassengers(passengers);
    const isComplex = tripType === TRIP_TYPES.COMPLEX;
    const hasVisibleErrors =
        (wasSubmitted && !ok) || Object.keys(mappedServerErrors).length > 0;

    const renderRoute = (index, row) => {
        const segment = segments[index];
        return (
            <React.Fragment key={`segment-${index}`}>
                <AirportField
                    id={`origin-${index}`}
                    label="Откуда"
                    variant="from"
                    value={segment.origin}
                    onChange={(value) => updateSegment(index, "origin", value)}
                    error={errorFor(`segments.${index}.origin`)}
                    style={{ gridColumn: 1, gridRow: row }}
                />

                <button
                    type="button"
                    className="swap-direction"
                    style={{ gridColumn: 2, gridRow: row }}
                    aria-label="Поменять местами"
                    title="Поменять местами"
                    onClick={() => swapDirection(index)}
                >
                    ⇄
                </button>

                <AirportField
                    id={`destination-${index}`}
                    label="Куда"
                    variant="to"
                    value={segment.destination}
                    onChange={(value) => updateSegment(index, "destination", value)}
                    error={errorFor(`segments.${index}.destination`)}
                    style={{ gridColumn: 3, gridRow: row }}
                />
            </React.Fragment>
        );
    };

    const passengersRow = isComplex ? segments.length + 1 : 1;
    const submitRow = isComplex ? segments.length + 2 : 3;

    return (
        <div className={`search-form ${isComplex ? "complex-mode" : ""}`}>
            <form
                onSubmit={handleSubmit}
                className={`${isComplex ? "complex-form" : ""}${hasVisibleErrors ? " has-field-errors" : ""}`}
                noValidate
            >
                {isComplex ? (
                    <>
                        {segments.map((segment, index) => (
                            <React.Fragment key={`row-${index}`}>
                                {renderRoute(index, index + 1)}
                                <DateField
                                    id={`date-${index}`}
                                    label="Дата"
                                    value={segment.date}
                                    onChange={(value) => updateSegment(index, "date", value)}
                                    min={index === 0 ? minDate : segments[index - 1].date || minDate}
                                    max={maxDate}
                                    error={errorFor(`segments.${index}.date`)}
                                    style={{gridColumn: 5, gridRow: index + 1}}
                                >
                                    {segments.length > 1 && (
                                        <button
                                            type="button"
                                            className="remove-flight"
                                            aria-label={`Удалить перелёт ${index + 1}`}
                                            onClick={() => removeSegment(index)}
                                        >
                                            ×
                                        </button>
                                    )}
                                </DateField>
                            </React.Fragment>
                        ))}

                        <button
                            type="button"
                            className="add-flight"
                            style={{gridColumn: 1, gridRow: segments.length + 1}}
                            onClick={addSegment}
                            disabled={segments.length >= LIMITS.MAX_SEGMENTS}
                        >
                            + Добавить рейс
                        </button>
                    </>
                ) : (
                    <>
                        {renderRoute(0, 1)}

                        <DateField
                            id="date-departure"
                            label={tripType === TRIP_TYPES.ONE_WAY ? "Дата" : "Отправление"}
                            value={segments[0].date}
                            onChange={(value) => updateSegment(0, "date", value)}
                            min={minDate}
                            max={maxDate}
                            error={errorFor("segments.0.date")}
                            style={{gridColumn: 1, gridRow: 3}}
                        />

                        {tripType === TRIP_TYPES.ROUND_TRIP && (
                            <DateField
                                id="date-return"
                                label="Возвращение"
                                value={returnDate}
                                onChange={setReturnDate}
                                min={segments[0].date || minDate}
                                max={maxDate}
                                error={errorFor("returnDate")}
                                style={{gridColumn: 3, gridRow: 3}}
                            />
                        )}
                    </>
                )}

                {/* Пассажиры и класс */}
                <div
                    className="form-group passengers"
                    ref={passengersTriggerRef}
                    style={{gridColumn: 5, gridRow: passengersRow}}
                >
                    <label id="passengers-label">Пассажиры и класс</label>
                    <button
                        type="button"
                        className="passenger-input"
                        aria-haspopup="dialog"
                        aria-expanded={showPassengers}
                        aria-labelledby="passengers-label"
                        onClick={() => setShowPassengers((v) => !v)}
                    >
                        {pluralPassengers(totalPassengers)}, {CABIN_CLASS_LABELS[cabinClass].toLowerCase()}
                    </button>

                    <button
                        type="button"
                        className="field-icon"
                        tabIndex={-1}
                        aria-label="Пассажиры и класс: открыть"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowPassengers((v) => !v)}
                    />

                    {showPassengers && (
                        <PassengerSelector
                            passengers={passengers}
                            onChange={setPassengers}
                            cabinClass={cabinClass}
                            onCabinClassChange={setCabinClass}
                            onClose={closePassengers}
                            error={errorFor("passengers")}
                            triggerRef={passengersTriggerRef}
                        />
                    )}

                    {!showPassengers && errorFor("passengers") && (
                        <div className="field-error">{errorFor("passengers")}</div>
                    )}
                </div>

                <button
                    type="submit"
                    className="search-button"
                    style={{gridColumn: 5, gridRow: submitRow}}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "ИЩЕМ…" : "ПОИСК"}
                </button>

                {wasSubmitted && !ok && (
                    <div className="form-summary-error" role="alert"
                         style={{gridColumn: "1 / -1", gridRow: submitRow + 1}}>
                        Проверьте выделенные поля.
                    </div>
                )}
            </form>
        </div>
    );
};

export default SearchForm;
