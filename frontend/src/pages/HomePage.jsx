import React from "react";

/* Порядок импортов стилей значим: tokens.css объявляет переменные, которыми
   пользуются все остальные файлы, поэтому идёт первым. */
import "../components/styles/tokens.css";
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
    <div className="gtd-page">
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
