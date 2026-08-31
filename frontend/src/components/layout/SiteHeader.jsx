import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SECTIONS, sectionLabel } from "./sections";
import "../styles/SiteHeader.css";

/**
 * Шапка сайта: бургер, логотип, переключатель языков.
 *
 * Переключатель языков нарисован, но не подключён: интернационализации в
 * проекте нет. Поэтому RU/EN/中文 — это span, а не button. Кнопка, которая
 * ничего не делает, хуже надписи: пользователь нажимает и делает вывод, что
 * сайт сломан.
 */
const SiteHeader = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const burgerRef = useRef(null);
    const menuRef = useRef(null);

    // Escape закрывает меню, фокус возвращается на кнопку, которая его
    // открыла: иначе после закрытия фокус остаётся на удалённом элементе и
    // перескакивает в начало документа.
    useEffect(() => {
        if (!menuOpen) return undefined;

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                setMenuOpen(false);
                burgerRef.current?.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        menuRef.current?.querySelector("button, a")?.focus();

        return () => document.removeEventListener("keydown", onKeyDown);
    }, [menuOpen]);

    return (
        <>
            <header className="gtd-header">
                <div>
                    <button
                        type="button"
                        ref={burgerRef}
                        className="gtd-header__burger"
                        aria-label="Меню разделов"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen(true)}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                </div>

                <Link to="/" className="gtd-header__logo">GO TO DREAM</Link>

                <div className="gtd-header__lang">
                    <span className="is-active">RU</span>
                    <span>EN</span>
                    <span>中文</span>
                </div>
            </header>

            {menuOpen && (
                <div
                    className="gtd-menu__scrim"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                />
            )}

            <nav
                ref={menuRef}
                className={`gtd-menu ${menuOpen ? "is-open" : ""}`}
                aria-label="Разделы сайта"
                aria-hidden={!menuOpen}
                /* inert убирает содержимое закрытой шторки из порядка обхода
                   клавишей Tab. Шторка не размонтируется — она уезжает
                   трансформацией, чтобы работала анимация, — и без inert
                   фокус уходил бы на ссылки за левым краем экрана. */
                inert={menuOpen ? undefined : ""}
            >
                <button
                    type="button"
                    className="gtd-menu__close"
                    aria-label="Закрыть меню"
                    onClick={() => setMenuOpen(false)}
                >
                    ×
                </button>

                <ul>
                    {SECTIONS.map((section) => (
                        <li key={section.id}>
                            {section.path ? (
                                <Link to={section.path} onClick={() => setMenuOpen(false)}>
                                    {sectionLabel(section)}
                                </Link>
                            ) : (
                                <span title="Раздел в разработке">{sectionLabel(section)}</span>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>
        </>
    );
};

export default SiteHeader;
