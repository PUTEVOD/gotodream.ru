import React, { useState } from "react";
import { CABIN_CLASS_LABELS } from "../search/contract";
import "../styles/FlightList.css";

/**
 * Список предложений.
 *
 * Одно предложение — это ЦЕНА ЗА ВЕСЬ МАРШРУТ, а не за рейс. У перелёта
 * «туда-обратно» внутри два направления (legs), и рисовать надо оба: карточка
 * с одним только вылетом «туда» превращает двенадцать разных предложений в
 * двенадцать визуально одинаковых строк с разными ценами.
 *
 * Сети и вычислений здесь нет — только показ того, что прислал сервер.
 * Поля, которых поставщик не прислал, просто не рисуются: интерфейс не должен
 * падать из-за того, что источник умеет меньше другого.
 */

/** 0 → «прямой», 1 → «1 пересадка», 5 → «5 пересадок» */
const stopsLabel = (stops) => {
    if (!stops) return "прямой";
    const mod10 = stops % 10;
    const mod100 = stops % 100;
    if (mod10 === 1 && mod100 !== 11) return `${stops} пересадка`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${stops} пересадки`;
    return `${stops} пересадок`;
};

/** Минуты → «7 ч 10 мин». Повторяет formatDuration бэкенда: у направлений
    внутри предложения приходит только durationMinutes. */
const formatDuration = (minutes) => {
    if (!Number.isFinite(minutes)) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m} мин`;
    return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
};

/** Цена в валюте ответа сервера. Знак валюты подставляет браузер по локали. */
const formatPrice = (value, currency) =>
    new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: currency || "RUB",
        maximumFractionDigits: 0,
    }).format(value);

/** «2026-10-03» → «3 окт, сб». Год не показываем: он есть в форме поиска. */
const formatDate = (iso) => {
    if (!iso) return "";
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", weekday: "short" })
        .format(date);
};

/** Города пересадок: всё, кроме аэропорта вылета первого и прилёта последнего. */
const connectionAirports = (leg) =>
    (leg.segments || []).slice(1).map((segment) => segment.departureAirport);

/** Одно направление: вылет — время в пути — прилёт. */
const LegRow = ({ leg }) => {
    const connections = connectionAirports(leg);

    return (
        <div className="flight-leg">
            <div className="flight-endpoint">
                <div className="flight-time">{leg.departureTime}</div>
                <div className="flight-date">{formatDate(leg.date)}</div>
                <div className="flight-city" title={leg.from}>{leg.from}</div>
                <div className="flight-airport" title={leg.departureAirport}>{leg.departureAirport}</div>
            </div>

            <div className="flight-middle">
                <div className="duration">{formatDuration(leg.durationMinutes)}</div>
                <div className="flight-line" aria-hidden="true">
                    {connections.map((code) => <span key={code} className="flight-dot" />)}
                </div>
                <div className="stops">
                    {stopsLabel(leg.stops)}
                    {connections.length > 0 && ` (${connections.join(", ")})`}
                </div>
                <div className="airline" title={`${leg.airline} · ${leg.flightNumber}`}>
                    {leg.airline} · {leg.flightNumber}
                </div>
            </div>

            <div className="flight-endpoint flight-endpoint--arrival">
                <div className="flight-time">{leg.arrivalTime}</div>
                <div className="flight-date">{formatDate(leg.date)}</div>
                <div className="flight-city" title={leg.to}>{leg.to}</div>
                <div className="flight-airport" title={leg.arrivalAirport}>{leg.arrivalAirport}</div>
            </div>
        </div>
    );
};

/**
 * Строка отличий тарифа.
 *
 * Именно она объясняет, почему два одинаковых с виду рейса стоят по-разному:
 * у S7 внутри эконома три бренда (BASIC / STANDARD / PLUS), и разница между
 * ними — багаж и возвратность, а не рейс.
 */
const FareLine = ({ flight }) => {
    const items = [];

    if (flight.fareBrand) items.push({ key: "brand", text: flight.fareBrand });
    if (flight.baggage?.carryOn) items.push({ key: "carry", text: `ручная кладь ${flight.baggage.carryOn}` });

    if (flight.baggage?.checkedIncluded === true) {
        items.push({ key: "bag", text: `багаж ${flight.baggage.checked || "включён"}` });
    } else if (flight.baggage?.checkedIncluded === false) {
        items.push({ key: "bag", text: "без багажа", muted: true });
    }

    if (flight.refundable === true) items.push({ key: "ref", text: "возвратный" });
    if (flight.refundable === false) items.push({ key: "ref", text: "невозвратный", muted: true });

    if (flight.seatsLeft > 0 && flight.seatsLeft <= 5) {
        items.push({ key: "seats", text: `мест: ${flight.seatsLeft}`, warn: true });
    }

    if (!items.length) return null;

    return (
        <ul className="fare-line">
            {items.map(({ key, text, muted, warn }) => (
                <li
                    key={key}
                    className={`fare-tag${muted ? " fare-tag--muted" : ""}${warn ? " fare-tag--warn" : ""}`}
                >
                    {text}
                </li>
            ))}
        </ul>
    );
};

/** Раскрытые подробности: сами рейсы и из чего сложилась цена. */
const FlightDetails = ({ flight }) => (
    <div className="flight-details">
        <div className="details-block">
            <h4 className="details-title">Рейсы</h4>
            <ul className="segment-list">
                {flight.legs.flatMap((leg, legIndex) =>
                    (leg.segments || []).map((segment) => (
                        <li key={`${legIndex}-${segment.flightNumber}-${segment.departureDate}`}>
                            <span className="segment-flight">{segment.flightNumber}</span>
                            <span className="segment-route">
                                {segment.departureAirport} {segment.departureTime}
                                {" → "}
                                {segment.arrivalAirport} {segment.arrivalTime}
                                {segment.arrivalDate !== segment.departureDate && " (+1)"}
                            </span>
                            <span className="segment-meta">
                                {formatDuration(segment.durationMinutes)}
                                {segment.aircraft && ` · ${segment.aircraft}`}
                            </span>
                        </li>
                    ))
                )}
            </ul>
        </div>

        {flight.priceBreakdown && (
            <div className="details-block">
                <h4 className="details-title">Цена</h4>
                <dl className="price-breakdown">
                    <div>
                        <dt>Тариф</dt>
                        <dd>{formatPrice(flight.priceBreakdown.base, flight.currency)}</dd>
                    </div>
                    <div>
                        <dt>Сборы</dt>
                        <dd>{formatPrice(flight.priceBreakdown.taxes, flight.currency)}</dd>
                    </div>
                    <div className="price-breakdown__total">
                        <dt>Итого за всех пассажиров</dt>
                        <dd>{formatPrice(flight.price, flight.currency)}</dd>
                    </div>
                </dl>
            </div>
        )}
    </div>
);

const FlightCard = ({ flight, isSelected, onSelect }) => {
    const [expanded, setExpanded] = useState(false);
    const detailsId = `details-${flight.id}`;

    return (
        <li className={`flight-card${isSelected ? " flight-card--selected" : ""}`}>
            <div className="flight-routes">
                {flight.legs.map((leg, index) => <LegRow key={`${leg.flightNumber}-${leg.date}-${index}`} leg={leg} />)}
                <FareLine flight={flight} />
            </div>

            <div className="flight-price-block">
                {/* Класс обязателен на карточке. Один рейс продаётся в
                    нескольких классах, и сервер возвращает их как отдельные
                    предложения: без подписи в списке стояли бы две-три внешне
                    одинаковые строки с разной ценой, и это читалось бы как
                    ошибка выдачи, а не как выбор. */}
                <div className="flight-cabin">
                    {CABIN_CLASS_LABELS[flight.cabinClass] || flight.cabinClass}
                </div>
                <div className="flight-price">{formatPrice(flight.price, flight.currency)}</div>
                <button type="button" className="select-button" onClick={() => onSelect(flight)}>
                    {isSelected ? "Выбрано" : "Выбрать"}
                </button>
                <button
                    type="button"
                    className="details-button"
                    aria-expanded={expanded}
                    aria-controls={detailsId}
                    onClick={() => setExpanded((value) => !value)}
                >
                    {expanded ? "Свернуть" : "Подробнее"}
                </button>
            </div>

            {expanded && (
                <div id={detailsId} className="flight-details-wrapper">
                    <FlightDetails flight={flight} />
                </div>
            )}
        </li>
    );
};

const FlightList = ({ flights, selectedId, onFlightClick }) => (
    <div className="flight-list">
        <ul>
            {flights.map((flight) => (
                <FlightCard
                    key={flight.id}
                    flight={flight}
                    isSelected={flight.id === selectedId}
                    onSelect={onFlightClick}
                />
            ))}
        </ul>
    </div>
);

export default FlightList;
