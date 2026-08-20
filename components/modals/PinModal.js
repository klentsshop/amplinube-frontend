'use client';
import React, { useState } from 'react';

export default function PinModal({ isOpen, onClose, onConfirm, titulo = "Ingresar PIN" }) {
  const [pin, setPin] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pin.trim()) return;
    onConfirm(pin.trim());
    setPin('');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000
    }}>
      <div style={{
        backgroundColor: 'white', padding: '24px', borderRadius: '12px',
        width: '100%', maxWidth: '320px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1f2937' }}>{titulo}</h3>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            style={{
              width: '100%', padding: '12px', fontSize: '1.5rem', textAlign: 'center',
              letterSpacing: '8px', borderRadius: '8px', border: '2px solid #d1d5db',
              marginBottom: '16px', outline: 'none'
            }}
          />
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => { setPin(''); onClose(); }}
              style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#e5e7eb', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}