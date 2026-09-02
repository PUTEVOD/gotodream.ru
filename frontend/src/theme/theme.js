/* frontend/src/theme/theme.js
   Состояние темы: хранение, применение, подписка.

   ЧТО ЭТО ТАКОЕ. Тема — это одно значение ("dark" | "light"), которое
   попадает в атрибут data-theme на <html>. Дальше всё делает CSS:
   theme/tokens.css объявляет два набора значений для одних и тех же
   переменных, и браузер сам пересчитывает страницу. Ни один компонент про
   тему не знает и знать не должен.

   ПОЧЕМУ АТРИБУТ НА <html>, А НЕ КЛАСС НА ОБЁРТКЕ СТРАНИЦЫ.
   В theme/base.css есть правило `html { background: var(--gtd-bg) }` — оно
   нужно для «резинового» отскока прокрутки в Safari и Chrome. Если тему
   переключать классом на .gtd-page, элемент <html> останется со старым
   фоном, и при оттягивании страницы будет видна полоса чужого цвета.

   ПОЧЕМУ ЗНАЧЕНИЕ ПРИМЕНЯЕТСЯ ДО ОТРИСОВКИ REACT (см. index.js).
   Если ставить атрибут в useEffect, первый кадр отрисуется в теме по
   умолчанию, и человек с выбранной светлой темой увидит вспышку тёмного
   экрана. applyTheme вызывается на уровне модуля в index.js — то есть
   раньше, чем React смонтирует дерево.

   ТРИ ИСТОЧНИКА ЗНАЧЕНИЯ, в порядке убывания приоритета:
     1. явный выбор человека — localStorage;
     2. системная настройка — prefers-color-scheme;
     3. тёмная тема как значение по умолчанию (основное оформление проекта).

   Пока выбор не сделан, сайт следует за системой и реагирует на её смену
   на лету. Как только кнопка нажата, выбор фиксируется и системные
   изменения игнорируются — иначе кнопка «не работает» после того, как
   у человека в полночь сработало автопереключение в ОС.
*/

import { useCallback, useEffect, useState } from "react";

export const THEMES = { DARK: "dark", LIGHT: "light" };

const STORAGE_KEY = "gtd-theme";

/* Цвет строки состояния мобильного браузера. Значения совпадают с
   --gtd-bg из tokens.css: <meta> читает браузер, а не CSS, и подставить
   туда переменную нельзя. При правке палитры править и здесь. */
const THEME_COLOR = {
    [THEMES.DARK]: "#0A0C0E",
    [THEMES.LIGHT]: "#F4F6F8",
};

const isTheme = (value) => value === THEMES.DARK || value === THEMES.LIGHT;

/* localStorage бросает исключение в приватном режиме Safari и при
   запрещённых сайтовых данных. Отсутствие сохранения — не повод уронить
   страницу, поэтому оба обращения обёрнуты. */
export const readStoredTheme = () => {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return isTheme(value) ? value : null;
    } catch (ignored) {
        return null;
    }
};

const storeTheme = (theme) => {
    try {
        window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (ignored) {
        /* приватный режим — выбор проживёт до конца сессии */
    }
};

const systemQuery = () =>
    typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: light)")
        : null;

export const getSystemTheme = () =>
    systemQuery()?.matches ? THEMES.LIGHT : THEMES.DARK;

export const resolveInitialTheme = () => readStoredTheme() || getSystemTheme();

/** Единственное место, где значение темы попадает в DOM. */
export const applyTheme = (theme) => {
    const value = isTheme(theme) ? theme : THEMES.DARK;
    document.documentElement.setAttribute("data-theme", value);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[value]);

    return value;
};

/**
 * Хук для кнопки-переключателя.
 *
 * Возвращает { theme, toggle, setTheme }. Состояние здесь локальное, и это
 * сознательно: переключатель на странице ровно один (он внутри SiteHeader,
 * а шапка не дублируется). Контекст ради одного потребителя — лишний слой.
 * Если переключателей станет два, состояние поднимается в контекст, а
 * applyTheme/readStoredTheme остаются теми же.
 */
export const useTheme = () => {
    const [theme, setThemeState] = useState(() =>
        typeof document === "undefined"
            ? THEMES.DARK
            : document.documentElement.getAttribute("data-theme") || resolveInitialTheme(),
    );

    const setTheme = useCallback((next) => {
        const value = applyTheme(next);
        storeTheme(value);
        setThemeState(value);
    }, []);

    const toggle = useCallback(() => {
        setTheme(theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK);
    }, [theme, setTheme]);

    /* Слежение за системной настройкой — только пока выбор не сделан. */
    useEffect(() => {
        const query = systemQuery();
        if (!query) return undefined;

        const onChange = () => {
            if (readStoredTheme()) return;
            const next = applyTheme(query.matches ? THEMES.LIGHT : THEMES.DARK);
            setThemeState(next);
        };

        /* addListener — устаревший путь для Safari < 14. */
        if (query.addEventListener) query.addEventListener("change", onChange);
        else query.addListener(onChange);

        return () => {
            if (query.removeEventListener) query.removeEventListener("change", onChange);
            else query.removeListener(onChange);
        };
    }, []);

    return { theme, setTheme, toggle };
};
