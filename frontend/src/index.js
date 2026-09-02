import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyInitialTheme } from './theme/theme';

/* Тема ставится ДО первой отрисовки React. Основную работу делает
   синхронный скрипт в public/index.html — он отрабатывает раньше, чем
   загрузится этот бандл, и именно он убирает вспышку чужой темы. Строка
   ниже — подстраховка на случай, если разметку заменят на серверную или
   скрипт из <head> уберут: повторное применение того же значения ничего
   не стоит и ничего не ломает. Подробности в theme/theme.js. */
applyInitialTheme();

/* Глобальных стилей здесь нет намеренно. Раньше отсюда подключался
   index.css из заготовки create-react-app: он задавал body шрифт
   -apple-system и сбрасывал margin — то же самое, но другими значениями,
   делает theme/base.css, и два источника правды для одного и того же
   правила расходились. Весь каркас страницы теперь описан в theme/. */

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
