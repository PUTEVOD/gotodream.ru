import React from "react";
import { CABIN_CLASS_LABELS } from "../search/contract";
import "../styles/FlightList.css";

/** 0 → «без пересадок», 1 → «1 пересадка», 2 → «2 пересадки» */
const stopsLabel = (stops) => {
    if (!stops) return "без пересадок";
    const mod10 = stops % 10;
    const mod100 = stops % 100;
    if (mod10 === 1 && mod100 !== 11) return `${stops} пересадка`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${stops} пересадки`;
    return `${stops} пересадок`;
};

/** Цена в валюте ответа сервера. Знак валюты подставляет браузер по локали. */
const formatPrice = (value, currency) =>
    new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: currency || "RUB",
        maximumFractionDigits: 0,
    }).format(value);

const FlightList = ({ flights, onFlightClick }) => (
    <div className="flight-list">
        <ul>
            {flights.map((flight) => (
                <li key={flight.id} className="flight-card">
                    <div className="flight-main-info">
                        <div className="flight-departure">
                            <div className="flight-date">{flight.date}</div>
                            <div className="flight-time">{flight.departureTime}</div>
                            <div className="flight-city" title={flight.from}>{flight.from}</div>
                            <div className="flight-airport" title={flight.departureAirport}>
                                {flight.departureAirport}
                            </div>
                        </div>

                        <div className="flight-duration">
                            <div className="duration">{flight.duration}</div>
                            <div className="airline" title={flight.airline}>{flight.airline}</div>
                            <div className="stops">{stopsLabel(flight.stops)}</div>
                        </div>

                        <div className="flight-arrival">
                            <div className="flight-date">{flight.date}</div>
                            <div className="flight-time">{flight.arrivalTime}</div>
                            <div className="flight-city" title={flight.to}>{flight.to}</div>
                            <div className="flight-airport" title={flight.arrivalAirport}>
                                {flight.arrivalAirport}
                            </div>
                        </div>
                    </div>

                    <div className="flight-price-block">
                        {/* Класс обязателен на карточке. Один рейс продаётся в
                            нескольких классах, и сервер возвращает их как
                            отдельные предложения: без подписи в списке стояли
                            бы две-три внешне одинаковые строки с разной ценой,
                            и это читалось бы как ошибка выдачи, а не как
                            выбор. Подпись стоит над ценой, потому что
                            объясняет именно её. */}
                        <div className="flight-cabin">
                            {CABIN_CLASS_LABELS[flight.cabinClass] || flight.cabinClass}
                        </div>
                        <div className="flight-price">{formatPrice(flight.price, flight.currency)}</div>
                        <button className="select-button" onClick={() => onFlightClick(flight.id)}>
                            Выбрать
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    </div>
);

export default FlightList;
