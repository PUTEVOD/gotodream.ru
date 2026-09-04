import React from "react";
import { CABIN_CLASS_LABELS } from "../search/contract";
import "../styles/PriceConfirmation.css";

/**
 * Подтверждённая цена выбранного предложения.
 *
 * Показывается после нажатия «Выбрать» и до ввода данных пассажиров: это
 * последний момент, когда изменение цены можно показать честно и бесплатно
 * для человека.
 *
 * Три состояния различаются намеренно, а не сводятся к одному «готово»:
 *   цена не изменилась  — спокойное подтверждение;
 *   цена изменилась     — заметное сообщение с обеими суммами;
 *   выдача устарела     — предложение повторить поиск, а не текст ошибки.
 */

const PTC_LABELS = {
    ADT: "Взрослый",
    YTH: "Подросток",
    CHD: "Ребёнок",
    INF: "Младенец",
};

const formatPrice = (value, currency) =>
    new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: currency || "RUB",
        maximumFractionDigits: 0,
    }).format(value);

const routeOf = (flight) =>
    flight.legs.map((leg) => `${leg.from} → ${leg.to}`).join(", ");

const PriceConfirmation = ({ status, reprice, error, isExpired, flight, onRetry, onNewSearch }) => {
    if (status === "idle" || !flight) return null;

    if (status === "loading") {
        return (
            <section className="price-confirmation" aria-live="polite">
                <p className="price-confirmation__state">Подтверждаем цену у перевозчика…</p>
            </section>
        );
    }

    if (status === "error") {
        return (
            <section className="price-confirmation price-confirmation--error" role="alert">
                <p className="price-confirmation__state">
                    {isExpired
                        ? "Результаты поиска устарели. Повторите поиск, чтобы подтвердить цену."
                        : error?.message || "Не удалось подтвердить цену"}
                </p>
                <button type="button" className="price-confirmation__action" onClick={isExpired ? onNewSearch : onRetry}>
                    {isExpired ? "Искать заново" : "Повторить"}
                </button>
            </section>
        );
    }

    const changed = reprice.difference !== 0;
    const grew = reprice.difference > 0;

    return (
        <section className={`price-confirmation${changed ? " price-confirmation--changed" : ""}`} aria-live="polite">
            <header className="price-confirmation__head">
                <div>
                    <h3 className="price-confirmation__title">
                        {changed ? "Цена изменилась" : "Цена подтверждена"}
                    </h3>
                    <p className="price-confirmation__route">
                        {routeOf(flight)} · {flight.fareBrand || CABIN_CLASS_LABELS[flight.cabinClass]}
                    </p>
                </div>

                <div className="price-confirmation__amount">
                    {changed && (
                        <span className="price-confirmation__was">
                            {formatPrice(reprice.previousPrice, reprice.currency)}
                        </span>
                    )}
                    <span className="price-confirmation__now">
                        {formatPrice(reprice.price, reprice.currency)}
                    </span>
                    {changed && (
                        <span className={`price-confirmation__delta${grew ? " is-up" : " is-down"}`}>
                            {grew ? "+" : "−"}
                            {formatPrice(Math.abs(reprice.difference), reprice.currency)}
                        </span>
                    )}
                </div>
            </header>

            {/* Раскладка по пассажирам: именно из этих сумм складывается счёт,
                и «почему за троих столько» должно читаться здесь, а не
                выясняться после оплаты. */}
            {reprice.passengers?.length > 1 && (
                <ul className="price-confirmation__passengers">
                    {reprice.passengers.map((passenger) => (
                        <li key={passenger.objectKey}>
                            <span>{PTC_LABELS[passenger.ptc] || passenger.ptc}</span>
                            <span>{formatPrice(passenger.price, reprice.currency)}</span>
                        </li>
                    ))}
                </ul>
            )}

            <p className="price-confirmation__breakdown">
                Тариф {formatPrice(reprice.breakdown.base, reprice.currency)}
                {" + сборы "}
                {formatPrice(reprice.breakdown.taxes, reprice.currency)}
                {reprice.breakdown.fees ? ` + платы ${formatPrice(reprice.breakdown.fees, reprice.currency)}` : ""}
            </p>

            <p className="price-confirmation__next">
                Следующий шаг — данные пассажиров и бронирование. Он ещё не сделан.
            </p>
        </section>
    );
};

export default PriceConfirmation;
