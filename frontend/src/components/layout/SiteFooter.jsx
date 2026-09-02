import React from "react";
import "../styles/SiteFooter.css";

/**
 * Подвал сайта. Контакты в макете стоят заглушками (XXX) — оставлены как
 * есть: подставить сюда выдуманный номер значит однажды выкатить его в
 * продакшн, потому что заглушка перестанет бросаться в глаза.
 */
const SiteFooter = () => (
    <footer className="gtd-footer">
        <div className="gtd-container gtd-footer__quote">
            <p>
                «Я — не дерево, рожденное, чтобы всегда стоять на одном месте
                и не знать о том, что находится за ближайшей горой.»
            </p>
            <div className="gtd-footer__author">Джек Лондон</div>
        </div>

        <div className="gtd-footer__rule" />

        <div className="gtd-container">
            <div className="gtd-footer__cols">
                <div>
                    <div className="gtd-footer__brand">ООО "ПУТЕВОД" ВТК"</div>
                    <p>Генеральный директор Ковалев Ю. В.</p>
                </div>

                <div className="gtd-footer__col">
                    <span className="gtd-eyebrow">Сервисы</span>
                    <a href="/s7">Билеты на самолёт</a>
                    <span>Билеты на поезд</span>
                    <span>Гостиницы</span>
                    <span>Трансферы</span>
                </div>

                <div className="gtd-footer__col">
                    <span className="gtd-eyebrow">Поддержка</span>
                    <span>Помощь и вопросы</span>
                    <span>+7(902)763-22-06</span>
                    <span>boss@putevod.net</span>
                    <span>master@putevod.net</span>
                </div>
            </div>

            <div className="gtd-footer__bottom">
                <span>© {new Date().getFullYear()} Go To Dream</span>
                <div className="gtd-header__lang">
                    <span className="is-active">RU</span>
                    <span>EN</span>
                    <span>中文</span>
                </div>
            </div>
        </div>
    </footer>
);

export default SiteFooter;
