/* frontend/src/theme/theme.js
   Состояние темы: хранение, применение, подписка.

   ДВА РАЗНЫХ ПОНЯТИЯ, которые легко перепутать:

     ПРЕДПОЧТЕНИЕ (preference) — что выбрал человек:
         "system" | "light" | "dark".
         Это то, что хранится и что показывает кнопка в шапке.

     ДЕЙСТВУЮЩАЯ ТЕМА (resolved) — что нарисовано на экране:
         "light" | "dark".
         Это то, что попадает в атрибут data-theme на <html> и читает CSS.

   При preference = "system" действующая тема вычисляется из системной
   настройки и МЕНЯЕТСЯ ВЖИВУЮ: человек переключил тему в macOS или Android —
   сайт перекрасился в ту же секунду, без перезагрузки. При "light" или
   "dark" выбор закреплён и системные изменения игнорируются.

   ПОЧЕМУ ТРИ СОСТОЯНИЯ, А НЕ ДВА. С двумя («светлая» / «тёмная») первое же
   нажатие кнопки навсегда отвязывает сайт от системы: вернуться к «как на
   устройстве» становится нечем, и человек, у которого система сама
   переключается по расписанию, остаётся с одной темой круглые сутки. Третье
   состояние стоит одного значка в шапке и возвращает эту возможность.

   ПОЧЕМУ АТРИБУТ НА <html>, А НЕ КЛАСС НА ОБЁРТКЕ СТРАНИЦЫ.
   В theme/base.css есть правило `html { background: var(--gtd-bg) }` — оно
   нужно для «резинового» отскока прокрутки в Safari и Chrome. Если тему
   переключать классом на .gtd-page, элемент <html> останется со старым
   фоном, и при оттягивании страницы будет видна полоса чужого цвета.

   ПОЧЕМУ ЗНАЧЕНИЕ ПРИМЕНЯЕТСЯ ДО ОТРИСОВКИ REACT.
   Иначе первый кадр придёт в теме по умолчанию, и человек со светлой темой
   увидит вспышку тёмного экрана. Основную работу делает синхронный скрипт в
   public/index.html — он отрабатывает раньше, чем загрузится бандл;
   index.js повторяет вызов на случай, если разметку заменят на серверную.
*/

import { useCallback, useEffect, useState } from "react";

/** Предпочтения — то, что выбирает человек и что хранится. */
export const PREFERENCES = { SYSTEM: "system", LIGHT: "light", DARK: "dark" };

/** Действующие темы — то, что попадает в data-theme и читает CSS. */
export const THEMES = { LIGHT: "light", DARK: "dark" };

/** Порядок обхода по нажатию кнопки. */
export const PREFERENCE_ORDER = [PREFERENCES.SYSTEM, PREFERENCES.LIGHT, PREFERENCES.DARK];

const STORAGE_KEY = "gtd-theme";

/* Цвет строки состояния мобильного браузера. Значения совпадают с --gtd-bg
   из tokens.css: <meta> читает браузер, а не CSS, и подставить туда
   переменную нельзя. При правке палитры править и здесь. */
const THEME_COLOR = {
    [THEMES.DARK]: "#0A0C0E",
    [THEMES.LIGHT]: "#F4F6F8",
};

const isTheme = (value) => value === THEMES.DARK || value === THEMES.LIGHT;
const isPreference = (value) => value === PREFERENCES.SYSTEM || isTheme(value);

/* localStorage бросает исключение в приватном режиме Safari и при
   запрещённых сайтовых данных. Отсутствие сохранения — не повод уронить
   страницу, поэтому оба обращения обёрнуты. */
export const readStoredPreference = () => {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return isPreference(value) ? value : null;
    } catch (ignored) {
        return null;
    }
};

const storePreference = (preference) => {
    try {
        window.localStorage.setItem(STORAGE_KEY, preference);
    } catch (ignored) {
        /* приватный режим — выбор проживёт до конца сессии */
    }
};

const systemQuery = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: light)")
        : null;

export const getSystemTheme = () => (systemQuery()?.matches ? THEMES.LIGHT : THEMES.DARK);

/** Значение по умолчанию — «как на устройстве». */
export const resolveInitialPreference = () => readStoredPreference() || PREFERENCES.SYSTEM;

/** preference -> действующая тема. */
export const resolveTheme = (preference) =>
    isTheme(preference) ? preference : getSystemTheme();

/** Единственное место, где действующая тема попадает в DOM. */
export const applyTheme = (theme) => {
    const value = isTheme(theme) ? theme : THEMES.DARK;
    document.documentElement.setAttribute("data-theme", value);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[value]);

    return value;
};

/** Удобная обёртка для index.js: посчитать и применить за один вызов. */
export const applyInitialTheme = () => applyTheme(resolveTheme(resolveInitialPreference()));

/**
 * Хук для кнопки-переключателя.
 *
 * Возвращает { preference, theme, cycle, setPreference }:
 *   preference — выбор человека ("system" | "light" | "dark");
 *   theme      — что действительно нарисовано ("light" | "dark");
 *   cycle      — перейти к следующему предпочтению по кругу;
 *   setPreference — задать конкретное.
 *
 * Состояние здесь локальное, и это сознательно: переключатель на странице
 * ровно один (он внутри SiteHeader, а шапка не дублируется). Контекст ради
 * одного потребителя — лишний слой. Если переключателей станет два,
 * состояние поднимается в контекст, а функции ниже остаются теми же.
 */
export const useTheme = () => {
    const [preference, setPreferenceState] = useState(resolveInitialPreference);
    const [theme, setThemeState] = useState(() => resolveTheme(resolveInitialPreference()));

    const setPreference = useCallback((next) => {
        const value = isPreference(next) ? next : PREFERENCES.SYSTEM;
        storePreference(value);
        setPreferenceState(value);
        setThemeState(applyTheme(resolveTheme(value)));
    }, []);

    const cycle = useCallback(() => {
        const index = PREFERENCE_ORDER.indexOf(preference);
        setPreference(PREFERENCE_ORDER[(index + 1) % PREFERENCE_ORDER.length]);
    }, [preference, setPreference]);

    /* Слежение за системной настройкой.
     *
     * Подписка живёт всегда, а не только в режиме "system": слушатель
     * дешёвый, а условие проверяется в момент события. Так исключён
     * классический дефект — человек переключился на «как на устройстве»,
     * а подписки на этот момент нет, потому что эффект не перезапустился. */
    useEffect(() => {
        const query = systemQuery();
        if (!query) return undefined;

        const onChange = () => {
            if (preference !== PREFERENCES.SYSTEM) return;
            setThemeState(applyTheme(query.matches ? THEMES.LIGHT : THEMES.DARK));
        };

        /* addListener — устаревший путь для Safari < 14. */
        if (query.addEventListener) query.addEventListener("change", onChange);
        else query.addListener(onChange);

        return () => {
            if (query.removeEventListener) query.removeEventListener("change", onChange);
            else query.removeListener(onChange);
        };
    }, [preference]);

    return { preference, theme, cycle, setPreference };
};
