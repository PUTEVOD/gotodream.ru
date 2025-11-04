import React, { useState } from 'react';
import './PassengersModal.css';

const PassengersModal = ({ onClose, setPassengers, setClassType }) => {
    const [adultCount, setAdultCount] = useState(1);
    const [childCount, setChildCount] = useState(0);
    const [infantCount, setInfantCount] = useState(0);
    const [classType, setLocalClassType] = useState('economy');

    const handleSave = () => {
        setPassengers(adultCount + childCount + infantCount);
        setClassType(classType);
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h4>Выбор пассажиров</h4>
                <div className="modal-group">
                    <label>Взрослые</label>
                    <button onClick={() => setAdultCount(Math.max(1, adultCount - 1))}>-</button>
                    <span>{adultCount}</span>
                    <button onClick={() => setAdultCount(adultCount + 1)}>+</button>
                </div>
                <div className="modal-group">
                    <label>Дети</label>
                    <button onClick={() => setChildCount(Math.max(0, childCount - 1))}>-</button>
                    <span>{childCount}</span>
                    <button onClick={() => setChildCount(childCount + 1)}>+</button>
                </div>
                <div className="modal-group">
                    <label>Младенцы</label>
                    <button onClick={() => setInfantCount(Math.max(0, infantCount - 1))}>-</button>
                    <span>{infantCount}</span>
                    <button onClick={() => setInfantCount(infantCount + 1)}>+</button>
                </div>
                {/*<div className="modal-group">*/}
                {/*    <label>Класс</label>*/}
                {/*    <select value={classType} onChange={(e) => setLocalClassType(e.target.value)}>*/}
                {/*        <option value="economy">Эконом</option>*/}
                {/*        <option value="business">Бизнес</option>*/}
                {/*    </select>*/}
                {/*</div>*/}
                <div className="modal-actions">
                    <button onClick={onClose}>Отмена</button>
                    <button onClick={handleSave}>Сохранить</button>
                </div>
            </div>
        </div>
    );
};

export default PassengersModal;
