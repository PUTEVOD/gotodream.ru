import React, { useMemo } from "react";
import { LAND_PATH, CITIES } from "./globeGeometry";
import "../styles/Globe.css";

/**
 * Земля в ортографической проекции — декоративный элемент нового оформления.
 *
 * Размер задаётся снаружи через CSS (ширина родителя), высота считается сама:
 * у элемента aspect-ratio 1/1. Никаких зависимостей и никакой сети: контур
 * запечён в globeGeometry.js.
 *
 * @param {string[]} hide      города, которые не рисуются вовсе
 * @param {string[]} labels    белый список подписей; если не задан, работает
 *                             labelBand, а если нет и его — подписаны все
 * @param {{x?: number[], y?: number[]}} labelBand
 *        полоса, внутри которой разрешены подписи, в долях диаметра (0..1).
 *        Нужна там, где видна только часть глобуса: подпись за пределами
 *        видимой области — это невидимый текст, который всё равно попадает
 *        в поиск по странице и в озвучку.
 * @param {string} className   класс на корневом элементе
 */
const Globe = ({ hide = [], labels, labelBand, className = "" }) => {
    // Идентификаторы должны быть уникальны в пределах документа: на странице
    // два глобуса, и одинаковый id у clipPath заставил бы второй использовать
    // обрезку первого. useId из React 18 здесь не используется намеренно —
    // компонент не должен требовать конкретной версии React.
    const uid = useMemo(() => "gtd-globe-" + Math.random().toString(36).slice(2, 8), []);

    const marks = useMemo(() => {
        const inBand = (city) => {
            if (!labelBand) return true;
            const [x0, x1] = labelBand.x || [0, 1];
            const [y0, y1] = labelBand.y || [0, 1];
            return city.x >= x0 && city.x <= x1 && city.y >= y0 && city.y <= y1;
        };

        return CITIES
            .filter((city) => !hide.includes(city.name))
            .map((city) => ({
                ...city,
                labelled: Array.isArray(labels) ? labels.includes(city.name) : inBand(city),
            }));
        // hide и labels приходят литералами из JSX и пересоздаются на каждом
        // рендере — сравниваем по содержимому, иначе useMemo не экономит ничего.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hide.join(","), labels && labels.join(","), JSON.stringify(labelBand)]);

    return (
        <div className={`gtd-globe ${className}`.trim()} aria-hidden="true">
            <svg
                className="gtd-globe__sphere"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="xMidYMid meet"
                focusable="false"
            >
                <defs>
                    {/* Подсветка у самого края диска: отделяет шар от фона там,
                        где контура суши нет (океан у лимба). */}
                    <radialGradient id={`${uid}-rim`} cx="50%" cy="50%" r="50%">
                        <stop offset="93%" stopColor="#EEF3F7" stopOpacity="0" />
                        <stop offset="100%" stopColor="#EEF3F7" stopOpacity="0.04" />
                    </radialGradient>
                    <clipPath id={`${uid}-clip`}>
                        <circle cx="500" cy="500" r="500" />
                    </clipPath>
                </defs>

                <circle cx="500" cy="500" r="500" fill="var(--gtd-bg)" />
                <circle cx="500" cy="500" r="500" fill={`url(#${uid}-rim)`} />

                {/* Обрезка по диску нужна из-за clipAngle проекции: у самого
                    лимба d3 оставляет отрезки, чуть выходящие за окружность. */}
                <g clipPath={`url(#${uid}-clip)`}>
                    <path
                        className="gtd-globe__land"
                        d={LAND_PATH}
                        fill="none"
                        strokeWidth="0.75"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />
                </g>

                <circle
                    className="gtd-globe__limb"
                    cx="500"
                    cy="500"
                    r="499.5"
                    fill="none"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>

            <div className="gtd-globe__marks">
                {marks.map((city) => (
                    <div
                        key={city.name}
                        className="gtd-globe__mark"
                        style={{ left: `${city.x * 100}%`, top: `${city.y * 100}%` }}
                    >
                        <span className="gtd-globe__halo" />
                        <span className="gtd-globe__dot" />
                        {city.labelled && (
                            <span
                                /* Подпись у правого края разворачивается влево:
                                   иначе Пекин и Иркутск уводят текст за
                                   границу элемента. */
                                className={`gtd-globe__label${city.x > 0.88 ? " gtd-globe__label--flip" : ""}`}
                            >
                                {city.name}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Globe;
