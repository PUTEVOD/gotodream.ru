import React from "react";
import "../styles/FlightList.css";

const FlightList = ({ s7, onFlightClick }) => {
    return (
        <div className="flight-list">
            <ul>
                {s7.map((flight) => (
                    <li key={flight.id} className="flight-card">
                        <div className="flight-main-info">
                            <div className="flight-departure">
                                <div className="flight-date">{flight.date}</div>
                                <div className="flight-time">{flight.departureTime}</div>
                                <div className="flight-city">{flight.from}</div>
                                <div className="flight-airport">{flight.departureAirport}</div>
                            </div>

                            <div className="flight-duration">
                                <div className="duration">{flight.duration}</div>
                                <div className="airline">{flight.airline}</div>
                            </div>

                            <div className="flight-arrival">
                                <div className="flight-date">{flight.date}</div>
                                <div className="flight-time">{flight.arrivalTime}</div>
                                <div className="flight-city">{flight.to}</div>
                                <div className="flight-airport">{flight.arrivalAirport}</div>
                            </div>
                        </div>

                        <div className="flight-price-block">
                            <div className="flight-price">${flight.price}</div>
                            <button
                                className="select-button"
                                onClick={() => onFlightClick(flight.id)}
                            >
                                Выбрать
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FlightList;