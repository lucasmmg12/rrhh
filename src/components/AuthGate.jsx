/**
 * AuthGate — Componente de autenticación compartido
 * Requiere login con Supabase Auth antes de mostrar el contenido protegido.
 * Solo la Agenda Pública (/agenda.html) es accesible sin autenticación.
 * 
 * Exports: AuthGate (default), useAuth (named) — React Context hook
 */
import React, { useState, useEffect, useContext, createContext } from 'react';
import { supabase } from '../supabaseClient';
import { trackLogin, trackLogout } from '../lib/hubTracker';

// ─── AUTH CONTEXT ───────────────────────────────────────────────
const AuthContext = createContext({ user: null, signOut: async () => {} });

/**
 * Hook to access user & signOut from any child component:
 *   const { user, signOut } = useAuth();
 */
export function useAuth() {
  return useContext(AuthContext);
}

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

  const handleSignOut = async () => {
    if (user) trackLogout(supabase, user.id);
    await supabase.auth.signOut();
  };

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

  // Authenticated — provide context to all children
  const contextValue = { user, signOut: handleSignOut };

  return (
    <AuthContext.Provider value={contextValue}>
      {typeof children === 'function'
        ? children({ user, signOut: handleSignOut })
        : children}
    </AuthContext.Provider>
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
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      // Track in Hub Monitor
      if (data?.user) trackLogin(supabase, data.user.id);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
      background: '#eef4f9', // Light, clinical grey-blue background
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background elements imitating floating polaroids/papers */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%', width: '40vw', height: '50vh',
        background: 'rgba(255,255,255,0.4)', transform: 'rotate(-10deg)', borderRadius: '24px',
        boxShadow: '0 4px 30px rgba(0,0,0,0.02)', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-5%', width: '45vw', height: '60vh',
        background: 'rgba(255,255,255,0.4)', transform: 'rotate(8deg)', borderRadius: '24px',
        boxShadow: '0 4px 30px rgba(0,0,0,0.02)', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', left: '-5%', width: '30vw', height: '40vh',
        background: 'rgba(255,255,255,0.5)', transform: 'rotate(15deg)', borderRadius: '24px',
        boxShadow: '0 4px 30px rgba(0,0,0,0.02)', zIndex: 0
      }} />

      <form onSubmit={handleLogin} style={{
        position: 'relative', zIndex: 10,
        background: '#ffffff',
        borderRadius: '24px', // Highly rounded exactly like reference
        padding: '3rem 2.5rem',
        width: '90%', maxWidth: '440px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.02)', // Soft institutional shadow
        display: 'flex', flexDirection: 'column', gap: '2rem',
      }}>
        <div style={{ textAlign: 'center' }}>
          {/* Logo Container mimicking the reference image */}
          <div style={{
            width: '64px', height: '64px', background: 'white',
            borderRadius: '16px', border: '1px solid #f1f5f9',
            boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
            margin: '0 auto 1.5rem auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px'
          }}>
             <img src="/logosanatorio.png" alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', background: '#005bb5', borderRadius: '8px' }} />
          </div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: '#002855', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Acceso Administrativo
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
            {moduleName || 'Panel de Control de Calidad'}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '1rem', borderRadius: '12px', background: '#fef2f2',
            color: '#dc2626', fontSize: '0.85rem', border: '1px solid #fecaca',
            textAlign: 'center', fontWeight: 500
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Email Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Correo Electrónico
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                   style={{ position: 'absolute', left: '1rem', color: '#cbd5e1' }}>
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ejemplo@sanatorio.com" required autoFocus
                style={{
                  width: '100%', padding: '0.875rem 1rem 0.875rem 3rem',
                  borderRadius: '12px', border: '1px solid #e2e8f0',
                  fontSize: '0.95rem', color: '#334155',
                  outline: 'none', transition: 'border 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={e => { e.target.style.borderColor = '#005bb5'; e.target.style.boxShadow = '0 0 0 3px rgba(0, 91, 181, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                   style={{ position: 'absolute', left: '1rem', color: '#cbd5e1' }}>
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{
                  width: '100%', padding: '0.875rem 1rem 0.875rem 3rem',
                  borderRadius: '12px', border: '1px solid #e2e8f0',
                  fontSize: '0.95rem', color: '#334155', letterSpacing: '0.1em',
                  outline: 'none', transition: 'border 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={e => { e.target.style.borderColor = '#005bb5'; e.target.style.boxShadow = '0 0 0 3px rgba(0, 91, 181, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} style={{
          padding: '1rem', borderRadius: '12px', border: 'none',
          background: '#005bb5', color: 'white', fontWeight: 600,
          fontSize: '1rem', cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.8 : 1, transition: 'background-color 0.2s, opacity 0.2s',
          marginTop: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 91, 181, 0.2)'
        }}
        onMouseOver={e => !loading && (e.target.style.backgroundColor = '#004a99')}
        onMouseOut={e => !loading && (e.target.style.backgroundColor = '#005bb5')}
        >
          {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
        </button>
      </form>
    </div>
  );
}

