# Go To Dream — фронтенд

Одностраничное приложение на React: главная страница и страница поиска
авиабилетов `/s7`.

## Запуск

```bash
npm install
npm start          # http://localhost:3000
```

Бэкенд поднимается отдельно, из `../backend/deno`:

```bash
cd ../backend/deno
deno task start    # http://localhost:8000
```

Адрес API задаётся переменной `REACT_APP_API_URL`; без неё используется
`http://localhost:8000` (см. `src/components/search/searchApi.js`).
Для продакшена удобно положить пустое значение — тогда запросы уходят на
тот же домен через reverse proxy.

## Сборка

```bash
npm run build      # результат в build/
```

Настройки сборки — в `.env.production`: карты исходников не генерируются,
рантайм-чанк не встраивается в HTML.

## Устройство

```
public/            index.html, иконки, manifest
src/
  index.js         точка входа: применяет тему и монтирует App
  App.js           маршруты: / и /s7
  theme/           сквозные слои оформления
    tokens.css     ВСЕ цвета проекта: тёмная и светлая темы
    theme.js       состояние темы (system | light | dark)
    base.css       каркас страницы, общий для всех страниц
    form.css       оформление формы поиска
    s7.css         оформление страницы выдачи
  pages/           страницы
  components/
    layout/        шапка, подвал, переключатель темы
    homepage/      секции главной
    s7/            форма поиска, фильтры, выдача
    search/        контракт, валидация, сеть, справочник аэропортов
    ui/            переиспользуемые элементы (глобус, слайдер)
    styles/        оформление конкретных компонентов
    fonts/         Inter, Manrope, Prospec
```

### Оформление

Цвет в проекте задаётся только через переменные из `theme/tokens.css`.
Литеральных цветов в остальных файлах быть не должно: там объявлены две
темы, и хардкод ломает одну из них. Тема выбирается атрибутом
`data-theme` на `<html>`, его ставит `theme/theme.js`.

## Тесты

Тестов пока нет, и заготовка create-react-app удалена вместе с ними
(она проверяла ссылку «learn react» и падала). Чтобы вернуть:

```bash
npm i -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

затем добавить обратно в `package.json` скрипт `"test": "react-scripts test"`
и `"react-app/jest"` в `eslintConfig.extends`, а рядом с проверяемым
компонентом положить `*.test.js`.
