/**
 * Modal.jsx — модальное окно: затемнение + карточка с формой.
 * Клик по затемнению закрывает окно.
 */
import React from 'react';

export default function Modal({ title, onClose, children }) {
    return (
        <div className="overlay" onClick={onClose}>
            <div className="modal" role="dialog" aria-modal="true"
                 onClick={e => e.stopPropagation()}>
                <h3 className="modal__title">{title}</h3>
                {children}
            </div>
        </div>
    );
}
