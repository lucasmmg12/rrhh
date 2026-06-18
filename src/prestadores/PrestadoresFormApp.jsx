import { useState, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// ── Constants ──
const SEDES = [
  'Sede 1 (San Luis 432 oeste)',
  'Sede 2 (San Luis 433 oeste)',
  'Sede 3 (San Luis 436 oeste)',
  'Sede Santa Fe - Sector 1',
  'Sede Santa Fe - Sector 2',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Icons (inline SVG) ──
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function SuccessCheckIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}




// ── Main Component ──
export default function PrestadoresFormApp() {
  const [formData, setFormData] = useState({
    nombre: '',
    especialidad: '',
    matricula: '',
    sedes: [],
    comentarios: '',
  });
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  // ── Handlers ──
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error on change
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleSedeToggle = useCallback((sede) => {
    setFormData(prev => {
      const sedes = prev.sedes.includes(sede)
        ? prev.sedes.filter(s => s !== sede)
        : [...prev.sedes, sede];
      return { ...prev, sedes };
    });
    setErrors(prev => {
      const next = { ...prev };
      delete next.sedes;
      return next;
    });
  }, []);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors(prev => ({ ...prev, foto: 'Solo se permiten imágenes JPG, PNG o WebP.' }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors(prev => ({ ...prev, foto: 'La imagen no debe superar los 10 MB.' }));
      return;
    }

    setFoto(file);
    setErrors(prev => {
      const next = { ...prev };
      delete next.foto;
      return next;
    });

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => setFotoPreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // ── Validation ──
  const validate = () => {
    const errs = {};
    if (!formData.nombre.trim()) errs.nombre = 'Ingresá tu nombre completo.';
    if (!formData.especialidad.trim()) errs.especialidad = 'Ingresá tu servicio o especialidad.';
    if (!formData.matricula.trim()) errs.matricula = 'Ingresá tu número de matrícula.';
    if (formData.sedes.length === 0) errs.sedes = 'Seleccioná al menos una sede.';
    if (!foto) errs.foto = 'Cargá una imagen.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) return;

    setSubmitting(true);

    try {
      // 1. Upload photo to Storage
      const ext = foto.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const storagePath = `prestadores/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fotos-prestadores')
        .upload(storagePath, foto, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw new Error(`Error al subir la imagen: ${uploadError.message}`);

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('fotos-prestadores')
        .getPublicUrl(storagePath);

      const fotoUrl = urlData?.publicUrl || '';

      // 3. Insert record
      const { error: insertError } = await supabase
        .from('nuevos_prestadores')
        .insert({
          nombre_completo: formData.nombre.trim(),
          servicio_especialidad: formData.especialidad.trim(),
          matricula: formData.matricula.trim(),
          sedes: formData.sedes,
          foto_url: fotoUrl,
          comentarios: formData.comentarios.trim() || null,
        });

      if (insertError) throw new Error(`Error al guardar los datos: ${insertError.message}`);

      setSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError(err.message || 'Ocurrió un error. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset ──
  const handleReset = () => {
    setFormData({ nombre: '', especialidad: '', matricula: '', sedes: [], comentarios: '' });
    setFoto(null);
    setFotoPreview(null);
    setErrors({});
    setSubmitError('');
    setSubmitted(false);
  };

  // ── Wave letter animation (same as Sidebar) ──
  const WaveText = ({ text, offset = 0 }) => (
    <span style={{ display: 'flex' }}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            animation: 'title-wave 3s ease-in-out infinite',
            animationDelay: `${(i + offset) * 0.08}s`,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );

  // ── Render ──
  return (
    <div className="prestadores-page">
      {/* Animated video background — same as sidebar */}
      <div className="prestadores-page__video-bg">
        <video
          src="/anima_la_imagen_202606091409.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>

      <div className="prestadores-card">
        {/* ── Header ── */}
        <div className="prestadores-header">
          <div className="prestadores-header__video-bg">
            <video
              src="/anima_la_imagen_202606091409.mp4"
              autoPlay
              loop
              muted
              playsInline
            />
          </div>

          <div className="prestadores-header__brand">
            <img
              src="/logosanatorio.png"
              alt="Sanatorio Argentino"
              className="prestadores-header__logo"
            />
            <div className="prestadores-header__brand-text">
              <span className="prestadores-header__brand-name">
                <WaveText text="SANATORIO" offset={0} />
              </span>
              <span className="prestadores-header__brand-sub">
                <WaveText text="ARGENTINO" offset={9} />
              </span>
            </div>
          </div>

          <h1 className="prestadores-header__title">
            Difusión NUEVOS PRESTADORES
          </h1>
          <p className="prestadores-header__desc">
            Requerimos que conteste el Formulario para que el sector de Comunicación de
            Sanatorio Argentino realice la correcta difusión de su incorporación a la Institución.
          </p>

        </div>

        {/* ── Body ── */}
        {submitted ? (
          <div className="prestadores-success">
            <div className="prestadores-success__icon">
              <SuccessCheckIcon />
            </div>
            <h2 className="prestadores-success__title">¡Formulario enviado!</h2>
            <p className="prestadores-success__msg">
              Gracias por completar tus datos. El equipo de Comunicación se encargará de la difusión
              de tu incorporación al Sanatorio Argentino.
            </p>
            <button className="prestadores-success__btn" onClick={handleReset} type="button">
              Enviar otro formulario
            </button>
          </div>
        ) : (
          <form className="prestadores-body" onSubmit={handleSubmit} noValidate>
            {/* Nombre y Apellido */}
            <div className="prestadores-field" style={{ animationDelay: '0.1s' }}>
              <label className="prestadores-field__label" htmlFor="pf-nombre">
                Nombre y Apellido completo <span className="prestadores-field__required">*</span>
              </label>
              <input
                id="pf-nombre"
                type="text"
                className={`prestadores-field__input ${errors.nombre ? 'prestadores-field__input--error' : ''}`}
                placeholder="Ej: Dr. Juan Pérez"
                value={formData.nombre}
                onChange={e => handleInputChange('nombre', e.target.value)}
                autoComplete="name"
              />
              {errors.nombre && <span className="prestadores-field__error">{errors.nombre}</span>}
            </div>

            {/* Servicio / Especialidad */}
            <div className="prestadores-field" style={{ animationDelay: '0.2s' }}>
              <label className="prestadores-field__label" htmlFor="pf-especialidad">
                Servicio y/o especialidad <span className="prestadores-field__required">*</span>
              </label>
              <input
                id="pf-especialidad"
                type="text"
                className={`prestadores-field__input ${errors.especialidad ? 'prestadores-field__input--error' : ''}`}
                placeholder="Ej: Cardiología"
                value={formData.especialidad}
                onChange={e => handleInputChange('especialidad', e.target.value)}
              />
              {errors.especialidad && <span className="prestadores-field__error">{errors.especialidad}</span>}
            </div>

            {/* Matrícula */}
            <div className="prestadores-field" style={{ animationDelay: '0.3s' }}>
              <label className="prestadores-field__label" htmlFor="pf-matricula">
                Matrícula profesional <span className="prestadores-field__required">*</span>
              </label>
              <input
                id="pf-matricula"
                type="text"
                className={`prestadores-field__input ${errors.matricula ? 'prestadores-field__input--error' : ''}`}
                placeholder="Ej: MP 12345"
                value={formData.matricula}
                onChange={e => handleInputChange('matricula', e.target.value)}
              />
              {errors.matricula && <span className="prestadores-field__error">{errors.matricula}</span>}
            </div>

            {/* Sedes */}
            <div className="prestadores-field" style={{ animationDelay: '0.4s' }}>
              <label className="prestadores-field__label">
                Sede en la que atenderá <span className="prestadores-field__required">*</span>
              </label>
              <div className="prestadores-sedes">
                {SEDES.map(sede => {
                  const checked = formData.sedes.includes(sede);
                  return (
                    <label
                      key={sede}
                      className={`prestadores-sede-item ${checked ? 'prestadores-sede-item--checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleSedeToggle(sede)}
                      />
                      <div className="prestadores-sede-check">
                        <CheckIcon />
                      </div>
                      <span className="prestadores-sede-label">{sede}</span>
                    </label>
                  );
                })}
              </div>
              {errors.sedes && <span className="prestadores-field__error">{errors.sedes}</span>}
            </div>

            {/* Foto Upload */}
            <div className="prestadores-field" style={{ animationDelay: '0.4s' }}>
              <label className="prestadores-field__label">
                Cargar imagen <span className="prestadores-field__required">*</span>
              </label>

              <div
                className={`prestadores-upload ${dragging ? 'prestadores-upload--dragging' : ''} ${errors.foto ? 'prestadores-upload--error' : ''} ${foto ? 'prestadores-upload--has-file' : ''}`}
                onClick={() => !foto && fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(e.target.files?.[0])}
                />

                {foto && fotoPreview ? (
                  <div className="prestadores-upload__preview">
                    <img
                      src={fotoPreview}
                      alt="Preview"
                      className="prestadores-upload__preview-img"
                    />
                    <div className="prestadores-upload__preview-info">
                      <div className="prestadores-upload__preview-name">{foto.name}</div>
                      <div className="prestadores-upload__preview-size">{formatFileSize(foto.size)}</div>
                    </div>
                    <button
                      type="button"
                      className="prestadores-upload__preview-change"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="prestadores-upload__icon">
                      {dragging ? <UploadIcon /> : <CameraIcon />}
                    </div>
                    <p className="prestadores-upload__text">
                      {dragging ? 'Soltá la imagen aquí' : 'Hacé clic o arrastrá tu foto'}
                    </p>
                    <p className="prestadores-upload__hint">
                      JPG, PNG o WebP — Máximo 10 MB
                    </p>
                  </>
                )}
              </div>

              {/* Tips */}
              <div className="prestadores-upload__tips">
                <p className="prestadores-upload__tips-title">Recomendaciones:</p>
                <ul className="prestadores-upload__tips-list">
                  <li>Evitar la foto selfie</li>
                  <li>Elegir un fondo liso</li>
                  <li>Tomar de la cintura para arriba</li>
                  <li>Elegir un lugar bien iluminado</li>
                </ul>
              </div>

              {errors.foto && <span className="prestadores-field__error">{errors.foto}</span>}
            </div>

            {/* Comentarios */}
            <div className="prestadores-field" style={{ animationDelay: '0.5s' }}>
              <label className="prestadores-field__label" htmlFor="pf-comentarios">
                Preguntas y/o comentarios
              </label>
              <textarea
                id="pf-comentarios"
                className="prestadores-field__input prestadores-field__textarea"
                placeholder="Escribí tus consultas o comentarios (opcional)"
                value={formData.comentarios}
                onChange={e => handleInputChange('comentarios', e.target.value)}
                rows={4}
              />
            </div>

            {/* Submit error */}
            {submitError && (
              <div style={{
                padding: '0.75rem 1rem',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '12px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: '#DC2626',
                fontWeight: 500,
              }}>
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="prestadores-submit"
              disabled={submitting}
            >
              {submitting && <span className="prestadores-submit__spinner" />}
              {submitting ? 'Enviando...' : 'Enviar formulario'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="prestadores-footer">
          <p className="prestadores-footer__text">
            Sanatorio Argentino — Innovación y Transformación Digital © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
