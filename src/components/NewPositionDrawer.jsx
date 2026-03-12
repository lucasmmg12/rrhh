
import React, { useState } from 'react';

export const NewPositionDrawer = ({ isOpen, onClose, onAddNode }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!role) return;

        const newNode = {
            id: crypto.randomUUID(),
            role,
            name,
            status: 'active', // Default to active for now
            type: 'employee',
            children: []
        };

        onAddNode(newNode);
        setName('');
        setRole('');
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '2rem',
            right: isOpen ? '2rem' : '-400px',
            width: '320px',
            background: 'white',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            transition: 'right 0.3s ease-in-out',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>Nuevo Puesto</h3>
                <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.5rem', color: '#94a3b8', lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                    <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                        Cargo / Rol <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="Ej. Analista Sr."
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                </div>

                <div>
                    <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                        Nombre del Colaborador
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', cursor: 'pointer' }}>
                        Cancelar
                    </button>
                    <button type="submit" style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none', background: '#0ea5e9', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                        Crear
                    </button>
                </div>
            </form>
        </div>
    );
};

const templateStyle = (bg, border = false) => ({
    padding: '1rem',
    background: bg,
    border: border ? '1px solid #e2e8f0' : 'none',
    color: border ? '#333' : 'white',
    borderRadius: '8px',
    cursor: 'grab',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center',
    fontWeight: 'bold'
});
