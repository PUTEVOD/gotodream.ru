import React from "react";

const Button = ({ children, variant = "default", onClick }) => {
    const baseStyles =
        "px-4 py-2 rounded-lg font-semibold transition-all duration-200";
    const variants = {
        default: "bg-blue-500 text-white hover:bg-blue-600",
        outline: "border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white",
    };

    return (
        <button className={`${baseStyles} ${variants[variant]}`} onClick={onClick}>
            {children}
        </button>
    );
};

export default Button;
