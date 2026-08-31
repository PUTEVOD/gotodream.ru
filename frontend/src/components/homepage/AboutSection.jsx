import React from "react";
import Globe from "../ui/Globe";

const AboutSection = () => (
    <section className="gtd-container gtd-section gtd-about" aria-labelledby="about-title">
        <div className="gtd-about__text">
            <h2 className="gtd-h2" id="about-title">О компании</h2>
            <p>
                Go To Dream собирает перелёты, отели, туры и трансферы в одном
                интерфейсе. Мы исходим из простой мысли: поездка начинается не с
                оплаты, а с решения — куда и когда. Задача сервиса в том, чтобы
                довести это решение до маршрута, не заставляя открывать десяток
                вкладок и сверять условия вручную.
            </p>
            <p>
                Поиск устроен так, чтобы результат было видно сразу, а параметры
                можно было менять без потери контекста. Всё остальное — детали,
                которые мы дорабатываем вместе с теми, кто пользуется сервисом.
            </p>
        </div>

        <div className="gtd-about__globe">
            {/* Здесь глобус виден целиком, поэтому подписаны все города, кроме
                Парижа: его метка накладывается на метку Лондона. */}
            <Globe hide={["Париж"]} />
        </div>
    </section>
);

export default AboutSection;
