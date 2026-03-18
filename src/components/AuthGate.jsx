/**
 * AuthGate — Componente de autenticación compartido
 * Requiere login con Supabase Auth antes de mostrar el contenido protegido.
 * Solo la Agenda Pública (/agenda.html) es accesible sin autenticación.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthGate({ children, moduleName = 'Módulo' }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
        background: '#f8fafc', fontFamily: "'Inter', sans-serif",
        flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{
          width: 40, height: 40, border: '4px solid #e2e8f0',
          borderTop: '4px solid #005eb8', borderRadius: '50%',
          animation: 'authSpin 1s linear infinite',
        }} />
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Verificando acceso...</p>
        <style>{`@keyframes authSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen moduleName={moduleName} />;
  }

  // Authenticated — render children and provide signOut
  return (
    <>
      {typeof children === 'function' ? children({ user, signOut: () => supabase.auth.signOut() }) : children}
    </>
  );
}

// ─── LOGIN SCREEN ──────────────────────────────────────────────
function LoginScreen({ moduleName }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f9ff 100%)',
      fontFamily: "'Inter', sans-serif",
    }}>
      <form onSubmit={handleLogin} style={{
        background: 'white', borderRadius: '16px', padding: '2.5rem',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', gap: '1.5rem',
      }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logosanatorio.png" alt="Sanatorio Argentino" style={{ height: '48px', marginBottom: '0.75rem' }} />
          <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', color: '#0c4a6e', fontWeight: 700 }}>
            {moduleName}
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Acceso restringido — Ingresá tus credenciales
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem', borderRadius: '8px', background: '#fef2f2',
            color: '#dc2626', fontSize: '0.85rem', border: '1px solid #fecaca',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="usuario@sanatorio.local" required autoFocus
            style={{
              padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0',
              fontSize: '0.9rem', outline: 'none', transition: 'border 0.2s',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Contraseña</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required
            style={{
              padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0',
              fontSize: '0.9rem', outline: 'none', transition: 'border 0.2s',
            }}
          />
        </div>

        <button type="submit" disabled={loading} style={{
          padding: '0.85rem', borderRadius: '8px', border: 'none',
          background: '#005eb8', color: 'white', fontWeight: 700,
          fontSize: '0.95rem', cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
        }}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
          <a href="/" style={{ color: '#005eb8', textDecoration: 'none' }}>
            ← Volver al inicio
          </a>
          <span style={{ margin: '0 0.5rem' }}>|</span>
          <a href="/agenda.html" style={{ color: '#005eb8', textDecoration: 'none' }}>
            Ver agenda pública →
          </a>
        </div>
      </form>
    </div>
  );
}
