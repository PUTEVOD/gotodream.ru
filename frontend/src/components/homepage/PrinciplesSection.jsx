import React from "react";

const PRINCIPLES = [
    {
        id: "route",
        title: "Один маршрут",
        text: "Перелёт, отель и трансфер собираются в одну поездку, а не в три отдельные покупки.",
        icon: <path d="M16 4l10 3.6V16c0 6.4-10 11.4-10 11.4S6 22.4 6 16V7.6z" />,
    },
    {
        id: "terms",
        title: "Прозрачные условия",
        text: "Правила тарифа, багаж и возврат показаны рядом с ценой, до перехода к оплате.",
        icon: <path d="M6 12h20M6 20h20M11 6l-2 20M23 6l-2 20" />,
    },
    {
        id: "support",
        title: "Поддержка на маршруте",
        text: "Связаться с оператором можно на любом этапе — до брони и во время поездки.",
        icon: (
            <>
                <circle cx="16" cy="16" r="11" />
                <path d="M16 9v7l5 3" />
            </>
        ),
    },
];

const PrinciplesSection = () => (
    <section className="gtd-container gtd-section gtd-principles">
        {PRINCIPLES.map((principle, index) => (
            <React.Fragment key={principle.id}>
                {/* Разделитель — самостоятельный элемент сетки, а не border
                    соседа: у него собственный градиент по вертикали, границей
                    такое не выразить. */}
                {index > 0 && <div className="gtd-divider" aria-hidden="true" />}

                <div className="gtd-principle">
                    <svg
                        width="32"
                        height="32"
                        viewBox="0 0 32 32"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                    >
                        {principle.icon}
                    </svg>
                    <div className="gtd-principle__title">{principle.title}</div>
                    <p>{principle.text}</p>
                </div>
            </React.Fragment>
        ))}
    </section>
);

export default PrinciplesSection;
