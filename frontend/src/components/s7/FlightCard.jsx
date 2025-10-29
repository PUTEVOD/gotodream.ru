import React from 'react';

const FlightCard = ({ flight }) => {
    return (
        <div>
            <h3>{flight.from} → {flight.to}</h3>
            <p>Date: {flight.date}</p>
            <p>Price: ${flight.price}</p>
            <button>Buy</button>
        </div>
    );
};

export default FlightCard;