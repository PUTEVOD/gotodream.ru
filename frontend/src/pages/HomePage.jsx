import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import RadialMenu from "../components/homepage/RadialMenu";

const HomePage = () => {
    return (
        <div className="homepage-background">
            <RadialMenu />
        </div>
    );
};

export default HomePage;