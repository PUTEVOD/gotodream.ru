import React from "react";
import { THEMES, useTheme } from "../../theme/theme";

/**
 * Переключатель темы в шапке.
 *
 * ПОЧЕМУ КНОПКА, А НЕ ПЕРЕКЛЮЧАТЕЛЬ-«ТУМБЛЕР». Состояний два и они
 * равноправны, третьего («как в системе») в интерфейсе нет — оно работает
 * молча, до первого нажатия. Кнопка с одним значком короче объясняет
 * происходящее, чем тумблер, у которого надо ещё понять, какое положение
 * что означает.
 *
 * ЧТО НАРИСОВАНО. Значок показывает тему, В КОТОРУЮ переключит нажатие, —
 * это соглашение большинства сайтов: в тёмной теме видно солнце («включить
 * светлую»), в светлой — луну. Того же смысла держится aria-label, поэтому
 * скринридер и глаз сообщают одно и то же.
 *
 * ДОСТУПНОСТЬ. aria-pressed не используется намеренно: кнопка не «включает
 * режим», а переключает между двумя равными состояниями, и «нажата/не
 * нажата» здесь ничего не значит. Текущее состояние сообщается в title и
 * aria-label целиком.
 */
const ThemeToggle = () => {
    const { theme, toggle } = useTheme();
    const isDark = theme === THEMES.DARK;
    const label = isDark ? "Включить светлую тему" : "Включить тёмную тему";

    return (
        <button
            type="button"
            className="gtd-theme-toggle"
            onClick={toggle}
            aria-label={label}
            title={label}
        >
            {isDark ? (
                /* Солнце */
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                     stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                     aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="4.2" />
                    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2
                             M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
                </svg>
            ) : (
                /* Месяц */
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                     stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
                     aria-hidden="true" focusable="false">
                    <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" />
                </svg>
            )}
        </button>
    );
};

export default ThemeToggle;
