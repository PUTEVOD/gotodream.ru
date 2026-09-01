import React from "react";

/* Порядок импортов стилей значим: tokens.css объявляет переменные, которыми
   пользуются все остальные файлы, поэтому идёт первым, base.css — каркас,
   общий с /s7, следом. */
import "../theme/tokens.css";
import "../theme/base.css";
import "../components/styles/HomePage.css";

import SiteHeader from "../components/layout/SiteHeader";
import SiteFooter from "../components/layout/SiteFooter";
import HeroSearch from "../components/homepage/HeroSearch";
import SectionsGrid from "../components/homepage/SectionsGrid";
import AboutSection from "../components/homepage/AboutSection";
import PrinciplesSection from "../components/homepage/PrinciplesSection";

/**
 * Главная страница.
 *
 * Компонент намеренно состоит из одних вызовов: вся вёрстка разложена по
 * секциям, каждая из которых отвечает за один экран макета. Плоский список
 * здесь ценнее «умного» кода — по нему видно структуру страницы целиком.
 *
 * Фон и шрифт заданы на .gtd-page, а не на body. Это защита от глобальных
 * правил в S7.css (там body { background-color: #fff }): S7 импортируется в
 * App.js статически, значит его стили грузятся и на главной, а порядок
 * файлов в сборке зависит от графа импортов и может измениться.
 */
const HomePage = () => (
    /* gtd-theme — область действия темы формы поиска и переключателя типа
       поездки. Тот же класс стоит на корневом элементе /s7, поэтому обе
       страницы получают одно и то же оформление из одного файла. */
    <div className="gtd-page gtd-theme">
        <SiteHeader />

        <main>
            <HeroSearch />
            <SectionsGrid />
            <AboutSection />
            <PrinciplesSection />
        </main>

        <SiteFooter />
    </div>
);

export default HomePage;
