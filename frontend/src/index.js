import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme, resolveInitialTheme } from './theme/theme';
import reportWebVitals from './reportWebVitals';

/* Тема ставится ДО первой отрисовки React. Основную работу делает
   синхронный скрипт в public/index.html — он отрабатывает раньше, чем
   загрузится этот бандл, и именно он убирает вспышку чужой темы. Строка
   ниже — подстраховка на случай, если разметку заменят на серверную или
   скрипт из <head> уберут: повторное применение того же значения ничего
   не стоит и ничего не ломает. Подробности в theme/theme.js. */
applyTheme(resolveInitialTheme());

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
