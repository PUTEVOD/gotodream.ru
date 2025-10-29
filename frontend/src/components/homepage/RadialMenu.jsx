import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Menu.css";
import Header from '../Header';
import { handleMouseMove, handleMouseLeave } from "../ui/MenuHover";

// Импорт локальных изображений (пути нужно заменить на ваши)
import planeIcon from "../assets/icons/plane.png";
import trainIcon from "../assets/icons/train.png";
import transferIcon from "../assets/icons/transfer.png";
import carRentIcon from "../assets/icons/carrent.png";
import hotelIcon from "../assets/icons/hotel.png";
import insuranceIcon from "../assets/icons/insurance.png";
import rusIcon from "../assets/icons/rus.png";
import worldIcon from "../assets/icons/world.png";

const Menu = () => {
    const navigate = useNavigate();

    const sections = [
        { id: "plane-tickets", title: "Билеты на\nсамолет", icon: planeIcon, path: "/s7" },
        { id: "train-tickets", title: "Билеты на\nпоезд", icon: trainIcon, path: "/trains" },
        { id: "russia-tours", title: "Туры по\nРоссии", icon: rusIcon, path: "/russia-tours" },
        { id: "transfers", title: "Трансферы", icon: transferIcon, path: "/transfers" },
        { id: "insurance", title: "Страхование", icon: insuranceIcon, path: "/insurance" },
        { id: "carrent", title: "Аренда\nАвто", icon: carRentIcon, path: "/car-rent" },
        { id: "abroad-tours", title: "Туры за\nрубеж", icon: worldIcon, path: "/abroad-tours" },
        { id: "hotels", title: "Гостиницы", icon: hotelIcon, path: "/hotels" },
    ];

    return (
        <>
            <Header />
            <div className="menu-container">
                <div className="menu-row">
                    {sections.slice(0, 4).map((section) => (
                        <div
                            key={section.id}
                            className="menu-item"
                            onClick={() => navigate(section.path)}
                            onMouseMove={(e) => handleMouseMove(e, section.id)}
                            onMouseLeave={handleMouseLeave}
                        >
                            <div className="text">{section.title}</div>
                            <div className="icon-container">
                                <img src={section.icon} alt={section.title} />
                            </div>
                            <div className="corner top-left"></div>
                            <div className="corner top-right"></div>
                            <div className="corner bottom-left"></div>
                            <div className="corner bottom-right"></div>
                            <div className="hover-effect" id={`hover-${section.id}`}></div>
                        </div>
                    ))}
                </div>
                <div className="menu-row">
                    {sections.slice(4, 8).map((section) => (
                        <div
                            key={section.id}
                            className="menu-item"
                            onClick={() => navigate(section.path)}
                            onMouseMove={(e) => handleMouseMove(e, section.id)}
                            onMouseLeave={handleMouseLeave}
                        >
                            <div className="text">{section.title}</div>
                            <div className="icon-container">
                                <img src={section.icon} alt={section.title} />
                            </div>
                            <div className="corner top-left"></div>
                            <div className="corner top-right"></div>
                            <div className="corner bottom-left"></div>
                            <div className="corner bottom-right"></div>
                            <div className="hover-effect" id={`hover-${section.id}`}></div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default Menu;

