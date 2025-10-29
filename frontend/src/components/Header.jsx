import { Link } from 'react-router-dom';
import React, { useState } from 'react';
import '../components/styles/Header.css';

const Header = () => {
    const [menuOpen, setMenuOpen] = useState(false);

    const toggleMenu = () => {
        setMenuOpen(prev => !prev);
    };

    return (
        <>
            <header className="header">
                <div className="header__left">
                    <svg
                        className={`ham hamRotate ham4 ${menuOpen ? 'active' : ''}`}
                        viewBox="0 0 100 100"
                        width="80"
                        onClick={toggleMenu}
                    >
                        <path
                            className="line top"
                            d="m 70,33 h -40 c 0,0 -8.5,-0.149796 -8.5,8.5 0,8.649796 8.5,8.5 8.5,8.5 h 20 v -20"
                        />
                        <path className="line middle" d="m 70,50 h -40" />
                        <path
                            className="line bottom"
                            d="m 30,67 h 40 c 0,0 8.5,0.149796 8.5,-8.5 0,-8.649796 -8.5,-8.5 -8.5,-8.5 h -20 v 20"
                        />
                    </svg>
                </div>
                <div className="header__center">
                    <Link to="/" className="logo">go to dream</Link>
                </div>
                <div className="header__right">
                    <ul className="language-options">
                        <li>РУ</li>
                        <li>EN</li>
                        <li>中文</li>
                    </ul>
                </div>
            </header>

            <div className={`side-menu ${menuOpen ? 'open' : ''}`}>
                <ul>
                    <li>пункт_1</li>
                    <li>пункт_2</li>
                    <li>пункт_3</li>
                    <li>пункт_4</li>
                    <li>пункт_5</li>
                </ul>
            </div>
        </>
    );
};

export default Header;
