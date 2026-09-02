import React from "react";
import { PREFERENCES, useTheme } from "../../theme/theme";

/* Подписи и значки для трёх состояний.

   ЗНАЧОК ПОКАЗЫВАЕТ ТЕКУЩЕЕ СОСТОЯНИЕ, а не будущее. Это отличается от
   двухпозиционных переключателей, где принято рисовать «то, что получится».
   С тремя состояниями такое соглашение не работает: по одному значку
   невозможно понять, из какого положения оно получится, и кнопка
   превращается в загадку. Поэтому значок отвечает на вопрос «что сейчас», а
   что будет дальше — сказано словами в подсказке и в aria-label.

   Монитор — «как на устройстве», солнце — светлая, месяц — тёмная. */
const STATES = {
    [PREFERENCES.SYSTEM]: {
        title: "Тема: как на устройстве",
        icon: (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                 stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                 strokeLinejoin="round" aria-hidden="true" focusable="false">
                <rect x="2.8" y="4" width="18.4" height="12.4" rx="2" />
                <path d="M9 20h6M12 16.4V20" />
            </svg>
        ),
    },
    [PREFERENCES.LIGHT]: {
        title: "Тема: светлая",
        icon: (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                 stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                 aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2
                         M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
            </svg>
        ),
    },
    [PREFERENCES.DARK]: {
        title: "Тема: тёмная",
        icon: (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                 stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
                 aria-hidden="true" focusable="false">
                <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" />
            </svg>
        ),
    },
};

/** Что произойдёт по следующему нажатию — для подсказки. */
const NEXT_ACTION = {
    [PREFERENCES.SYSTEM]: "нажмите, чтобы закрепить светлую",
    [PREFERENCES.LIGHT]: "нажмите, чтобы закрепить тёмную",
    [PREFERENCES.DARK]: "нажмите, чтобы вернуть тему устройства",
};

/**
 * Переключатель темы в шапке: «как на устройстве» → светлая → тёмная → снова
 * «как на устройстве».
 *
 * ПОЧЕМУ КНОПКА, А НЕ СПИСОК ИЗ ТРЁХ ПУНКТОВ. Три состояния — предел, при
 * котором обход по кругу ещё дешевле выпадающего списка: до нужного значения
 * не больше двух нажатий, а на экране остаётся один элемент вместо кнопки со
 * списком. Появится четвёртое (например, «высокий контраст») — обход надо
 * будет заменить списком.
 *
 * ДОСТУПНОСТЬ. aria-pressed не используется: кнопка не включает режим, а
 * перебирает три равноправных состояния, и «нажата / не нажата» здесь
 * ничего не значит. Текущее состояние и следующее действие сообщаются
 * целиком в aria-label.
 */
const ThemeToggle = () => {
    const { preference, cycle } = useTheme();
    const state = STATES[preference] || STATES[PREFERENCES.SYSTEM];
    const label = `${state.title}; ${NEXT_ACTION[preference]}`;

    return (
        <button
            type="button"
            className="gtd-theme-toggle"
            onClick={cycle}
            aria-label={label}
            title={label}
        >
            {state.icon}
        </button>
    );
};

export default ThemeToggle;
