import React from 'react';

export default function Toast({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container-custom">
      {toasts.map(t => {
        let icon = 'bi-info-circle';
        if (t.type === 'success') icon = 'bi-check-circle';
        if (t.type === 'danger') icon = 'bi-exclamation-triangle';
        if (t.type === 'warning') icon = 'bi-exclamation-circle';

        return (
          <div 
            key={t.id} 
            className={`toast-custom toast-custom-${t.type || 'success'}`}
            role="alert"
          >
            <div className="d-flex align-items-center gap-2">
              <i className={`bi ${icon} fs-5`}></i>
              <span>{t.message}</span>
            </div>
            <button 
              type="button" 
              className="toast-close-btn" 
              onClick={() => onRemove(t.id)}
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
