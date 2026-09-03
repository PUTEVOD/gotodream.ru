import { useEffect, useState } from "react";

/* frontend/src/components/s7/useNativeDatePicker.js

   ЗАЧЕМ. На сенсорном экране собственный календарь не нужен и вреден:
   браузер открывает системный выбор даты сразу по касанию поля, и рядом с
   ним всплывает наш — виден кадр системного календаря, потом он закрывается,
   потом появляется кастомный. Мигание на каждом касании.

   Системный календарь на телефоне лучше нашего по существу, а не только
   технически: он крупнее, знает про жесты, озвучивается скринридером и
   выглядит так, как человек привык в остальных приложениях. Поэтому на
   сенсорном экране мы не пытаемся его заменить.

   ПОЧЕМУ (pointer: coarse), А НЕ ШИРИНА ЭКРАНА. Вопрос не в размере окна:
   узкое окно на десктопе — это по-прежнему мышь, и там кастомный календарь
   уместен. Признак, который нам нужен, — «основное указательное устройство
   неточное», то есть палец. Ровно это и означает pointer: coarse.

   ПОЧЕМУ ХУК, А НЕ ПРОВЕРКА В ОБРАБОТЧИКЕ. Значение влияет на РАЗМЕТКУ
   (рисовать календарь или нет), а не только на реакцию по нажатию. Разовая
   проверка внутри обработчика не заставит компонент перерисоваться, когда
   условие изменится — например, при подключении мыши к планшету или при
   включении эмуляции устройства в инструментах разработчика. */

const QUERY = "(pointer: coarse)";

const readMatch = () => {
    // SSR и старые браузеры без matchMedia: считаем, что указатель точный.
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
};

/** @returns {boolean} true — показывать системный выбор даты вместо своего. */
export function useNativeDatePicker() {
    const [isCoarse, setCoarse] = useState(readMatch);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return undefined;

        const media = window.matchMedia(QUERY);
        const update = (event) => setCoarse(event.matches);

        // Состояние могло измениться между первым рендером и подпиской.
        setCoarse(media.matches);

        // Safari до 14 не знает addEventListener у MediaQueryList.
        if (media.addEventListener) {
            media.addEventListener("change", update);
            return () => media.removeEventListener("change", update);
        }
        media.addListener(update);
        return () => media.removeListener(update);
    }, []);

    return isCoarse;
}
