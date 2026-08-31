import React from "react";

/**
 * Реестр разделов сайта — единственный источник правды.
 *
 * Им пользуются и плитки на главной, и боковое меню в шапке. Раньше список
 * жил внутри RadialMenu.jsx: пока список один, дублирование незаметно, но
 * добавление девятого раздела требовало бы правки в двух местах, и рано или
 * поздно они разошлись бы.
 *
 * `path: null` означает «маршрута ещё нет». Такой раздел показывается, но не
 * притворяется ссылкой: в App.js нет ни маршрута, ни страницы-заглушки для
 * несуществующих адресов, поэтому переход по /hotels дал бы пустой экран без
 * единого сообщения. Когда страница появится — достаточно вписать сюда путь.
 */

const icon = (children) => (
    <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        {children}
    </svg>
);

export const SECTIONS = [
    {
        id: "plane-tickets",
        title: ["Билеты на", "самолёт"],
        path: "/s7",
        icon: icon(
            <path d="M24 6c1.5 2.5 2.4 5.6 2.4 8.9v6.4L42 28.4v3.4l-15.6-4.1v8.2l4.8 3.2V41L24 39.2 16.8 41v-1.9l4.8-3.2v-8.2L6 31.8v-3.4l15.6-7.1v-6.4c0-3.3.9-6.4 2.4-8.9z" />,
        ),
    },
    {
        id: "train-tickets",
        title: ["Билеты на", "поезд"],
        path: null,
        icon: icon(
            <>
                <rect x="13" y="7" width="22" height="27" rx="6" />
                <path d="M13 19h22M16.5 44L23 34M31.5 44L25 34" />
                <circle cx="19.5" cy="26.5" r="1.4" />
                <circle cx="28.5" cy="26.5" r="1.4" />
            </>,
        ),
    },
    {
        id: "russia-tours",
        title: ["Туры по", "России"],
        path: null,
        icon: icon(
            <>
                <path d="M24 6c-4.4 0-7.6 3.3-7.6 7.4 0 2.2 1 4.1 2.5 5.4-4 2.2-6.7 6.9-6.7 12.3C12.2 38 17.5 42 24 42s11.8-4 11.8-10.9c0-5.4-2.7-10.1-6.7-12.3a7.2 7.2 0 0 0 2.5-5.4C31.6 9.3 28.4 6 24 6z" />
                <path d="M18.6 15.6c1.4-2.2 3.2-3.3 5.4-3.3s4 1.1 5.4 3.3" />
                <path d="M19.4 30.4c0-3.4 2.1-5.8 4.6-5.8s4.6 2.4 4.6 5.8" />
            </>,
        ),
    },
    {
        id: "abroad-tours",
        title: ["Туры за", "рубеж"],
        path: null,
        icon: icon(
            <>
                <circle cx="24" cy="24" r="17" />
                <ellipse cx="24" cy="24" rx="7.5" ry="17" />
                <path d="M7 24h34" />
            </>,
        ),
    },
    {
        id: "hotels",
        title: ["Гостиницы"],
        path: null,
        icon: icon(
            <>
                <path d="M11 41V9h26v32M6 41h36" />
                <path d="M17 17h4M27 17h4M17 25h4M27 25h4M21 41v-8h6v8" />
            </>,
        ),
    },
    {
        id: "transfers",
        title: ["Трансферы"],
        path: null,
        icon: icon(
            <>
                <circle cx="10" cy="35" r="3.5" />
                <circle cx="38" cy="14" r="3.5" />
                <path d="M12.5 32C19 22 26 15.5 34 14.2" />
                <path d="M30 11l4.5 3.2L31 18" />
            </>,
        ),
    },
    {
        id: "insurance",
        title: ["Страхование"],
        path: null,
        icon: icon(
            <>
                <path d="M24 7l15 5.5V25c0 9-15 16-15 16S9 34 9 25V12.5z" />
                <path d="M17.5 23.5l5 5 8.5-9" />
            </>,
        ),
    },
    {
        id: "carrent",
        title: ["Аренда", "авто"],
        path: null,
        icon: icon(
            <>
                <path d="M10 27l4.4-9.8A3 3 0 0 1 17.2 15h13.6a3 3 0 0 1 2.8 2.2L38 27" />
                <path d="M8 27h32v8H8z" />
                <circle cx="15" cy="37" r="3" />
                <circle cx="33" cy="37" r="3" />
            </>,
        ),
    },
];

/** Заголовок раздела одной строкой — для меню, alt-текстов и заголовков. */
export const sectionLabel = (section) => section.title.join(" ");
