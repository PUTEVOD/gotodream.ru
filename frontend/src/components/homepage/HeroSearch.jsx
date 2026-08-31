import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchForm from "../s7/SearchForm";
import Globe from "../ui/Globe";
import { TRIP_TYPES, TRIP_TYPE_LABELS } from "../search/contract";
import "../styles/SearchForm.gtd.css";

/* Первый экран: заголовок, форма поиска, дуга глобуса.
 *
 * РЕШЕНИЕ, КОТОРОЕ СТОИТ ПОНЯТЬ ПЕРЕД ПРАВКАМИ.
 *
 * Здесь работает тот же компонент SearchForm, что и на /s7 — не копия.
 * В нём живут валидация, справочник аэропортов, разбор ошибок сервера и
 * сборка payload; вторая форма означала бы вторую реализацию всего этого.
 * Разница между страницами только в оформлении и вынесена в один файл
 * стилей (SearchForm.gtd.css).
 *
 * Сложный маршрут на главной сознательно недоступен: в макете два
 * переключателя, а форма сложного маршрута растёт вниз на произвольное
 * число рядов и в первый экран не помещается. Для него есть ссылка
 * «Расширенный поиск», которая открывает /s7 сразу в нужном режиме.
 */

const HERO_TRIP_TYPES = [TRIP_TYPES.ROUND_TRIP, TRIP_TYPES.ONE_WAY];

const HeroSearch = () => {
    const navigate = useNavigate();
    const [tripType, setTripType] = useState(TRIP_TYPES.ROUND_TRIP);

    /* Главная не ищет сама — она передаёт запрос на страницу выдачи.
     *
     * Передаётся ДВА объекта. payload — готовое тело запроса, его /s7
     * отправляет на сервер немедленно. values — состояние формы, из
     * которого /s7 заполняет свою форму. Почему не выводить второе из
     * первого: в payload лежат коды аэропортов (SVO), а в поле формы —
     * то, что человек напечатал («Москва Шереметьево»). Обратное
     * преобразование дало бы другой текст, и пользователь увидел бы,
     * что его ввод «поправили».
     *
     * Данные едут в state роутера, а не в query-строке. Плата за это —
     * ссылку на результаты нельзя переслать; такая ссылка потребует
     * отдельной работы: разбор параметров URL и восстановление формы из
     * них на /s7. Выигрыш — здесь и сейчас не нужно придумывать формат
     * сериализации сложного маршрута. State роутера переживает F5
     * (react-router кладёт его в history.state), так что перезагрузка
     * страницы выдачи ничего не теряет.
     */
    const handleSearch = (payload, values) => {
        navigate("/s7", { state: { search: { payload, values } } });
    };

    const openAdvanced = (event) => {
        event.preventDefault();
        navigate("/s7", { state: { search: { values: { tripType: TRIP_TYPES.COMPLEX } } } });
    };

    return (
        <section className="gtd-hero">
            <div className="gtd-hero__backdrop">
                <div className="gtd-hero__globe">
                    {/* Видна только верхняя дуга, поэтому подписи запрещены
                        везде, кроме узкой полосы под формой — как в макете. */}
                    <Globe
                        hide={["Париж", "Лондон"]}
                        labelBand={{ x: [0.126, 0.816], y: [0.063, 0.195] }}
                    />
                </div>
            </div>

            <div className="gtd-hero__content">
                <h1 className="gtd-hero__title">Билеты, отели и туры — в одном месте</h1>

                <div className="gtd-hero__form">
                    <div className="trip-type-selector">
                        {HERO_TRIP_TYPES.map((value) => (
                            <label key={value} className="filter-item">
                                <input
                                    type="radio"
                                    name="hero-trip-type"
                                    value={value}
                                    checked={tripType === value}
                                    onChange={() => setTripType(value)}
                                />
                                <span className="radiomark" />
                                <span className="trip-type-text">{TRIP_TYPE_LABELS[value]}</span>
                            </label>
                        ))}
                    </div>

                    <div className="gtd-panel">
                        <SearchForm onSearch={handleSearch} tripType={tripType} />
                    </div>

                    <div className="gtd-hero__advanced">
                        <a href="/s7" onClick={openAdvanced}>Расширенный поиск →</a>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HeroSearch;
