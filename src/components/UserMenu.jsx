/**
 * UserMenu — Avatar dropdown con opción de cerrar sesión
 * Usa el AuthContext expuesto por AuthGate.
 * Se coloca en el header de cada módulo.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthGate';

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  const initials = (user.email || '??')
    .split('@')[0]
    .substring(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Avatar Button */}
      <button
        id="user-menu-btn"
        onClick={() => setOpen(prev => !prev)}
        title={user.email}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '0.8rem',
          border: open ? '2px solid #38bdf8' : '2px solid transparent',
          cursor: 'pointer', transition: 'all 0.2s',
          boxShadow: open ? '0 0 0 3px rgba(56,189,248,0.3)' : 'none',
        }}
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          background: 'white', borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          minWidth: 220, overflow: 'hidden',
          animation: 'userMenuFadeIn 0.15s ease-out',
          zIndex: 9999,
        }}>
          {/* User Info */}
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #f1f5f9',
          }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
              Mi Cuenta
            </p>
            <p style={{
              margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user.email}
            </p>
          </div>

          {/* Sign Out */}
          <button
            id="sign-out-btn"
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem',
              padding: '0.85rem 1.25rem',
              background: 'white', border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600, color: '#dc2626',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <span style={{ fontSize: '1.1rem' }}>🚪</span>
            Cerrar sesión
          </button>
        </div>
      )}

      <style>{`
        @keyframes userMenuFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
