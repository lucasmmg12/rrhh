import React, { useState, useRef, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Smartphone, Download, Image as ImageIcon, X, Filter,
  Layers, CheckCircle2, ChevronRight, Users, Sparkles, AlertCircle
} from 'lucide-react';

// Color map according to level
const LEVEL_CONFIG = {
  0: { label: 'Socios / Directorio', color: '#0F172A', bg: '#F8FAFC', border: '#0F172A', badgeBg: '#E2E8F0', badgeText: '#0F172A' },
  1: { label: 'Dirección / Gerencia', color: '#1E5FA6', bg: '#FFFFFF', border: '#1E5FA6', badgeBg: '#EBF2FA', badgeText: '#1E5FA6' },
  2: { label: 'Staff / Asesoría', color: '#7C3AED', bg: '#FFFFFF', border: '#7C3AED', badgeBg: '#EDE9FE', badgeText: '#7C3AED' },
  3: { label: 'Jefatura / Depto.', color: '#0284C7', bg: '#FFFFFF', border: '#0284C7', badgeBg: '#E0F2FE', badgeText: '#0284C7' },
  4: { label: 'Supervisión / Operativo', color: '#0EA5E9', bg: '#FFFFFF', border: '#0EA5E9', badgeBg: '#F0F9FF', badgeText: '#0369A1' },
  5: { label: 'Colaborador / Auxiliar', color: '#475569', bg: '#FFFFFF', border: '#94A3B8', badgeBg: '#F1F5F9', badgeText: '#475569' },
};

const getLevelInfo = (level) => {
  return LEVEL_CONFIG[level] || {
    label: `Nivel ${level}`,
    color: '#0891B2',
    bg: '#FFFFFF',
    border: '#0891B2',
    badgeBg: '#ECFEFF',
    badgeText: '#0E7490'
  };
};

// Helper: Count all descendants recursively
const countDescendants = (node) => {
  if (!node?.children || node.children.length === 0) return 0;
  let count = node.children.length;
  node.children.forEach(child => {
    count += countDescendants(child);
  });
  return count;
};

// Helper: Extract Initials from person or role
const getInitials = (name, role) => {
  const text = (name && name.trim()) ? name : (role || 'SA');
  const words = text.replace(/^(Dr\.|Dra\.|Lic\.|Ing\.|Cr\.|Cra\.)\s+/i, '').trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return text.substring(0, 2).toUpperCase();
};

export default function MobileOrganigramaModal({ isOpen, onClose, rootData }) {
  const canvasRef = useRef(null);
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [maxLevel, setMaxLevel] = useState(99); // 99 = todos los niveles
  const [includeVacants, setIncludeVacants] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');

  // Extract Level 1 branches for filtering
  const branches = useMemo(() => {
    if (!rootData || !rootData.children) return [];
    return rootData.children;
  }, [rootData]);

  // Filter tree according to selection
  const filteredData = useMemo(() => {
    if (!rootData) return null;

    // Filter helper
    const filterNode = (node, currentLvl = 0) => {
      if (currentLvl > maxLevel) return null;
      if (!includeVacants && (!node.name || node.name.trim() === '')) return null;

      const children = (node.children || [])
        .map(child => filterNode(child, currentLvl + 1))
        .filter(Boolean);

      return {
        ...node,
        children
      };
    };

    if (selectedBranchId === 'all') {
      return filterNode(rootData, 0);
    }

    const branch = branches.find(b => b.id === selectedBranchId);
    if (!branch) return filterNode(rootData, 0);

    return filterNode(branch, 1);
  }, [rootData, selectedBranchId, maxLevel, includeVacants, branches]);

  // Total nodes in current filtered view
  const totalNodesCount = useMemo(() => {
    if (!filteredData) return 0;
    return 1 + countDescendants(filteredData);
  }, [filteredData]);

  // Current formatted date
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  // PDF Export
  const handleDownloadPdf = async () => {
    if (!canvasRef.current) return;
    try {
      setGenerating(true);
      setGenerationProgress('Preparando lienzo móvil en alta definición...');
      await new Promise(r => setTimeout(r, 200));

      setGenerationProgress('Capturando estructura visual (2x Retina)...');
      const canvas = await html2canvas(canvasRef.current, {
        scale: 2.2, // Retina sharpness for mobile screens
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        windowWidth: 440,
      });

      setGenerationProgress('Compilando PDF continuo para celular...');
      await new Promise(r => setTimeout(r, 150));

      // PDF width: 420 pt (mobile screen portrait proportion)
      const pdfWidth = 420;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [pdfWidth, pdfHeight],
        compress: true,
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      const branchName = selectedBranchId === 'all'
        ? 'Completo'
        : (branches.find(b => b.id === selectedBranchId)?.role || 'Sector').replace(/[^a-zA-Z0-9]/g, '_');

      pdf.save(`Organigrama_Sanatorio_Argentino_${branchName}_Móvil.pdf`);
      setGenerationProgress('¡PDF descargado con éxito!');
      setTimeout(() => {
        setGenerating(false);
        setGenerationProgress('');
      }, 1200);
    } catch (err) {
      console.error('Error generating mobile PDF:', err);
      alert('Hubo un error al generar el PDF: ' + err.message);
      setGenerating(false);
      setGenerationProgress('');
    }
  };

  // PNG Image Export (Quick share on WhatsApp)
  const handleDownloadImage = async () => {
    if (!canvasRef.current) return;
    try {
      setGenerating(true);
      setGenerationProgress('Generando imagen de alta resolución...');
      await new Promise(r => setTimeout(r, 200));

      const canvas = await html2canvas(canvasRef.current, {
        scale: 2.2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        windowWidth: 440,
      });

      const link = document.createElement('a');
      const branchName = selectedBranchId === 'all'
        ? 'Completo'
        : (branches.find(b => b.id === selectedBranchId)?.role || 'Sector').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Organigrama_Sanatorio_Argentino_${branchName}_Móvil.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setGenerationProgress('¡Imagen descargada!');
      setTimeout(() => {
        setGenerating(false);
        setGenerationProgress('');
      }, 1000);
    } catch (err) {
      console.error('Error generating image:', err);
      alert('Hubo un error al exportar la imagen: ' + err.message);
      setGenerating(false);
      setGenerationProgress('');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Modal Dialog */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '1.25rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '1080px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #FFFFFF, #F8FAFC)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#EBF2FA',
              color: '#1E5FA6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 5px rgba(30, 95, 166, 0.15)',
            }}>
              <Smartphone size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Organigrama para Celular (PDF Continuo)
                </h2>
                <span style={{
                  background: '#E0F2FE',
                  color: '#0369A1',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                }}>
                  Mobile-First 9:16
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Formato vertical de scroll continuo, optimizado para lectura nítida en pantallas móviles sin zoom.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: '#F1F5F9',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body: Sidebar Controls + Mobile Simulator */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          flex: 1,
          overflow: 'hidden',
          background: '#F8FAFC',
        }}>
          {/* Controls Sidebar */}
          <div style={{
            padding: '1.5rem',
            borderRight: '1px solid #E2E8F0',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            overflowY: 'auto',
          }}>
            <div>
              <label style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginBottom: '0.5rem',
              }}>
                <Filter size={14} /> Alcance del Organigrama
              </label>
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#1E293B',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">🏢 Todo el Sanatorio (Completo)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    ↳ {b.role} {b.name ? `(${b.name})` : ''}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.35rem', marginInline: '0.1rem' }}>
                Podés exportar toda la institución o una gerencia en particular para enviar por WhatsApp.
              </p>
            </div>

            <div>
              <label style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginBottom: '0.5rem',
              }}>
                <Layers size={14} /> Profundidad de Jerarquía
              </label>
              <select
                value={maxLevel}
                onChange={e => setMaxLevel(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#1E293B',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={99}>Todos los niveles (Detallado operativo)</option>
                <option value={3}>Hasta Nivel 3 (Jefaturas y Coordinaciones)</option>
                <option value={2}>Hasta Nivel 2 (Direcciones y Staff)</option>
                <option value={1}>Solo Nivel 1 (Directorio y Gerencias)</option>
              </select>
            </div>

            {/* Checkbox Options */}
            <div style={{
              background: '#F8FAFC',
              padding: '0.85rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeVacants}
                  onChange={e => setIncludeVacants(e.target.checked)}
                  style={{ accentColor: '#1E5FA6', cursor: 'pointer' }}
                />
                Incluir puestos a cubrir / vacantes
              </label>
            </div>

            {/* Metrics Snapshot */}
            <div style={{
              padding: '0.85rem',
              borderRadius: '8px',
              background: '#EBF2FA',
              border: '1px solid #D0E1F3',
              fontSize: '0.78rem',
              color: '#123B68',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}>
              <div style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                <span>Puestos en este PDF:</span>
                <span style={{ fontSize: '0.9rem', color: '#1E5FA6' }}>{totalNodesCount}</span>
              </div>
              <div style={{ color: '#475569', fontSize: '0.72rem' }}>
                Formato continuo de scroll vertical. El receptor no necesita ampliar ni rotar la pantalla.
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                onClick={handleDownloadPdf}
                disabled={generating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1E5FA6, #123B68)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(30, 95, 166, 0.3)',
                  transition: 'all 0.15s',
                  opacity: generating ? 0.7 : 1,
                }}
              >
                <Download size={18} />
                {generating ? 'Generando archivo...' : 'Descargar PDF Celular'}
              </button>

              <button
                onClick={handleDownloadImage}
                disabled={generating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <ImageIcon size={16} color="#0284C7" />
                Guardar como Imagen PNG
              </button>

              {generating && (
                <div style={{
                  padding: '0.5rem',
                  borderRadius: '6px',
                  background: '#FEF3C7',
                  color: '#92400E',
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  fontWeight: 600,
                  animation: 'pulse 1.5s infinite',
                }}>
                  ⏳ {generationProgress}
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Phone Simulator Preview */}
          <div style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: 'radial-gradient(circle at 50% 50%, #F1F5F9 0%, #E2E8F0 100%)',
          }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#64748B',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <Smartphone size={14} /> Vista previa interactiva de celular (Hacé scroll hacia abajo)
            </div>

            {/* Phone Mockup Frame */}
            <div style={{
              width: '390px',
              height: '620px',
              borderRadius: '40px',
              border: '9px solid #1E293B',
              background: '#FFFFFF',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}>
              {/* Dynamic Island / Speaker */}
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100px',
                height: '20px',
                background: '#1E293B',
                borderRadius: '14px',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0F172A', marginRight: '6px' }} />
                <div style={{ width: '40px', height: '4px', borderRadius: '3px', background: '#334155' }} />
              </div>

              {/* Scrollable Screen Content */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                paddingTop: '32px',
                background: '#FFFFFF',
                scrollBehavior: 'smooth',
              }}>
                {/* Visual Canvas that will be captured by html2canvas */}
                <div
                  ref={canvasRef}
                  style={{
                    width: '372px',
                    margin: '0 auto',
                    padding: '1rem 0.75rem 2rem 0.75rem',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Institutional Header */}
                  <div style={{
                    textAlign: 'center',
                    paddingBottom: '1rem',
                    borderBottom: '2px solid #E2E8F0',
                    marginBottom: '1.25rem',
                  }}>
                    <img
                      src="/logosanatorio.png"
                      alt="Sanatorio Argentino"
                      style={{
                        height: '42px',
                        objectFit: 'contain',
                        margin: '0 auto 0.4rem auto',
                        display: 'block',
                      }}
                    />
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      color: '#1E5FA6',
                      textTransform: 'uppercase',
                    }}>
                      Sanatorio Argentino
                    </div>
                    <h1 style={{
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: '#0F172A',
                      margin: '0.2rem 0',
                      lineHeight: 1.2,
                    }}>
                      Estructura Organizacional
                    </h1>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: '#F1F5F9',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.68rem',
                      color: '#475569',
                      fontWeight: 600,
                      marginTop: '0.35rem',
                    }}>
                      <span>📅 {formattedDate}</span>
                      <span>•</span>
                      <span>👥 {totalNodesCount} Puestos</span>
                    </div>
                  </div>

                  {/* Organigram Nodes Render */}
                  {filteredData ? (
                    <MobileTreeBranch node={filteredData} level={filteredData.hierarchy_level ?? 0} />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                      No se encontraron puestos para el criterio seleccionado.
                    </div>
                  )}

                  {/* Institutional Footer */}
                  <div style={{
                    marginTop: '2rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #E2E8F0',
                    textAlign: 'center',
                    fontSize: '0.65rem',
                    color: '#94A3B8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                  }}>
                    <div style={{ fontWeight: 700, color: '#64748B' }}>
                      Sanatorio Argentino • Dirección de Recursos Humanos
                    </div>
                    <div>Documento oficial confidencial • Optimizado para visualización móvil</div>
                  </div>
                </div>
              </div>

              {/* Home indicator bar at bottom */}
              <div style={{
                height: '16px',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{ width: '110px', height: '4px', background: '#94A3B8', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RECURSIVE NODE COMPONENT FOR MOBILE VERTICAL INFOGRAPHIC ──────────────────
function MobileTreeBranch({ node, level = 0 }) {
  if (!node) return null;

  const lvlInfo = getLevelInfo(node.hierarchy_level ?? level);
  const totalTeam = countDescendants(node);
  const isVacant = !node.name || node.name.trim() === '';
  const initials = getInitials(node.name, node.role);
  const isRootSocios = (node.hierarchy_level ?? level) === 0;
  const isStaff = node.relationship === 'staff';

  // Responsive padding left for depth indentation
  const indentPx = Math.min(level * 10, 36);

  return (
    <div style={{
      position: 'relative',
      marginLeft: `${indentPx}px`,
      marginBottom: '0.65rem',
    }}>
      {/* Vertical Spine Line */}
      {level > 0 && (
        <div style={{
          position: 'absolute',
          left: '-8px',
          top: '0',
          bottom: node.children && node.children.length > 0 ? '0' : '50%',
          width: '2px',
          background: '#CBD5E1',
        }} />
      )}

      {/* Horizontal connector tick */}
      {level > 0 && (
        <div style={{
          position: 'absolute',
          left: '-8px',
          top: '20px',
          width: '7px',
          height: '2px',
          background: '#CBD5E1',
        }} />
      )}

      {/* The Node Card */}
      <div style={{
        background: isRootSocios ? 'linear-gradient(135deg, #0F172A, #1E3A8A)' : '#FFFFFF',
        borderRadius: '10px',
        border: isRootSocios ? 'none' : '1px solid #E2E8F0',
        borderLeft: isRootSocios ? 'none' : `5px solid ${lvlInfo.border}`,
        boxShadow: isRootSocios
          ? '0 4px 12px rgba(15, 23, 42, 0.25)'
          : '0 1px 3px rgba(0,0,0,0.05)',
        padding: '0.65rem 0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        position: 'relative',
      }}>
        {/* Avatar */}
        <div style={{
          width: isRootSocios ? '38px' : '34px',
          height: isRootSocios ? '38px' : '34px',
          borderRadius: '50%',
          flexShrink: 0,
          background: isRootSocios
            ? '#334155'
            : (node.photoUrl ? `url(${node.photoUrl}) center/cover` : lvlInfo.badgeBg),
          color: isRootSocios ? '#FFFFFF' : lvlInfo.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 800,
          border: isRootSocios ? '2px solid rgba(255,255,255,0.2)' : `1px solid ${lvlInfo.border}30`,
        }}>
          {!node.photoUrl && initials}
        </div>

        {/* Content Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top badges bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '2px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              background: isRootSocios ? 'rgba(255,255,255,0.15)' : lvlInfo.badgeBg,
              color: isRootSocios ? '#93C5FD' : lvlInfo.badgeText,
              textTransform: 'uppercase',
            }}>
              {lvlInfo.label}
            </span>

            {isStaff && (
              <span style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '0.1rem 0.35rem',
                borderRadius: '4px',
                background: isRootSocios ? 'rgba(255,255,255,0.15)' : '#F3E8FF',
                color: isRootSocios ? '#E9D5FF' : '#7E22CE',
              }}>
                Staff
              </span>
            )}

            {totalTeam > 0 && (
              <span style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '0.1rem 0.35rem',
                borderRadius: '4px',
                background: isRootSocios ? 'rgba(255,255,255,0.15)' : '#E0F2FE',
                color: isRootSocios ? '#BAE6FD' : '#0284C7',
                marginLeft: 'auto',
              }}>
                👥 {totalTeam}
              </span>
            )}
          </div>

          {/* Role / Position */}
          <div style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: isRootSocios ? '#FFFFFF' : '#0F172A',
            lineHeight: 1.25,
            wordBreak: 'break-word',
          }}>
            {node.role}
          </div>

          {/* Person Name or Vacant */}
          <div style={{
            fontSize: '0.74rem',
            color: isRootSocios ? '#CBD5E1' : (isVacant ? '#D97706' : '#475569'),
            fontWeight: isVacant ? 600 : 500,
            marginTop: '2px',
          }}>
            {isVacant ? (
              <span style={{ fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B' }} />
                Puesto a designar
              </span>
            ) : (
              node.name
            )}
          </div>
        </div>
      </div>

      {/* Children Nodes (Recursive) */}
      {node.children && node.children.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          {node.children.map(child => (
            <MobileTreeBranch
              key={child.id}
              node={child}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
