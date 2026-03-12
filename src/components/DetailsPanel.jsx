
import React, { useState, useEffect, useRef } from 'react';
import { orgService } from '../services/orgService';

// Helper: count all descendants recursively
const countAllDescendants = (node) => {
    if (!node.children || node.children.length === 0) return 0;
    let count = node.children.length;
    node.children.forEach(child => {
        count += countAllDescendants(child);
    });
    return count;
};

// Helper: collect all descendant names
const collectDescendants = (node, list = []) => {
    if (!node.children) return list;
    node.children.forEach(child => {
        list.push({ id: child.id, name: child.name, role: child.role, status: child.status });
        collectDescendants(child, list);
    });
    return list;
};

export const DetailsPanel = ({ node, parentNode, onClose, onUpdateNode, onDeleteNode }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [showAllTeam, setShowAllTeam] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ open: false, attachment: null });
    const fileInputRef = useRef(null);
    const avatarInputRef = useRef(null);

    // Sync local form state when node changes
    useEffect(() => {
        if (node) {
            setEditForm({
                ...node,
                tasks: node.tasks ? node.tasks.join('\n') : ''
            });
            setIsEditing(false);
            setShowAllTeam(false);
            loadAttachments(node.id);
        }
    }, [node]);

    const loadAttachments = async (nodeId) => {
        try {
            const files = await orgService.getAttachments(nodeId);
            setAttachments(files);
        } catch (e) {
            console.error('Failed to load attachments:', e);
            setAttachments([]);
        }
    };

    if (!node) return null;

    const displayName = node.name || "Puesto Vacante / Sin Asignar";
    const directReports = node.children || [];
    const totalTeam = countAllDescendants(node);
    const allDescendants = collectDescendants(node);

    const hierarchyLabels = {
        0: 'Socios',
        1: 'Dirección',
        2: 'Staff / Soporte',
        3: 'Jefatura',
        4: 'Operativo',
        5: 'Colaborador'
    };
    const getHierarchyLabel = (lvl) => hierarchyLabels[lvl] || `Subnivel ${lvl}`;

    // Calculate max level needed for the select options
    const currentNodeLevel = node.hierarchy_level ?? 3;
    const maxLevel = Math.max(9, currentNodeLevel + 2);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Avatar upload to Supabase Storage
    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploadingAvatar(true);
        try {
            const publicUrl = await orgService.uploadAvatar(node.id, file);
            setEditForm(prev => ({ ...prev, photoUrl: publicUrl }));
            // Also update the node immediately for visual feedback
            onUpdateNode({ ...node, photoUrl: publicUrl, photo_url: publicUrl });
        } catch (err) {
            console.error('Avatar upload failed:', err);
            // Fallback: use base64
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditForm(prev => ({ ...prev, photoUrl: reader.result }));
            };
            reader.readAsDataURL(file);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    // Document attachment upload
    const handleAttachmentUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];

        if (!allowedTypes.includes(file.type)) {
            alert('Solo se permiten archivos PDF o Word (.docx, .doc)');
            return;
        }

        setIsUploading(true);
        try {
            const attachment = await orgService.uploadAttachment(node.id, file);
            setAttachments(prev => [attachment, ...prev]);
        } catch (err) {
            console.error('Attachment upload failed:', err);
            alert('Error al subir el archivo. Intente nuevamente.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = (attachment) => {
        setConfirmModal({ open: true, attachment });
    };

    const confirmDeleteAttachment = async () => {
        const attachment = confirmModal.attachment;
        if (!attachment) return;
        setConfirmModal({ open: false, attachment: null });
        try {
            await orgService.deleteAttachment(attachment.id, attachment.storage_path);
            setAttachments(prev => prev.filter(a => a.id !== attachment.id));
        } catch (err) {
            console.error('Delete attachment failed:', err);
            alert('Error al eliminar el archivo.');
        }
    };

    const handleSave = () => {
        const tasksArray = editForm.tasks.split('\n').filter(t => t.trim() !== '');
        const updatedNode = {
            ...editForm,
            tasks: tasksArray
        };
        onUpdateNode(updatedNode);
        setIsEditing(false);
    };

    const getFileIcon = (fileType) => {
        if (fileType === 'application/pdf') return '📄';
        if (fileType?.includes('word') || fileType?.includes('document')) return '📝';
        return '📎';
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <aside
            className={`details-panel ${node ? 'open' : ''}`}
            aria-hidden={!node}
            id="manpower-details"
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
        >
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', flexShrink: 0 }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary, #1e293b)' }}>
                    {isEditing ? '✏️ Editar Posición' : '📋 Ficha de Posición'}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            style={{ background: 'var(--color-primary-light, #eff6ff)', border: '1px solid var(--color-primary, #005eb8)', color: 'var(--color-primary, #005eb8)', cursor: 'pointer', fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem' }}
                        >
                            ✏️ Editar
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem' }}
                        aria-label="Cerrar detalles"
                    >
                        &times;
                    </button>
                </div>
            </div>

            {/* Panel Body — Scroll */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

                {isEditing ? (
                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                        <div className="form-group">
                            <label style={labelStyle}>Nombre del Colaborador</label>
                            <input
                                type="text"
                                name="name"
                                value={editForm.name}
                                onChange={handleInputChange}
                                style={inputStyle}
                                placeholder="Nombre completo"
                            />
                        </div>

                        <div className="form-group">
                            <label style={labelStyle}>Rol / Cargo</label>
                            <input
                                type="text"
                                name="role"
                                value={editForm.role}
                                onChange={handleInputChange}
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label style={labelStyle}>Estado</label>
                                <select
                                    name="status"
                                    value={editForm.status}
                                    onChange={handleInputChange}
                                    style={inputStyle}
                                >
                                    <option value="occupied">Ocupado</option>
                                    <option value="vacancy">Vacante</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label style={labelStyle}>Relación Jerárquica</label>
                                <select
                                    name="relationship"
                                    value={editForm.relationship || 'line'}
                                    onChange={handleInputChange}
                                    style={inputStyle}
                                >
                                    <option value="line">Línea (directa)</option>
                                    <option value="staff">Staff (soporte)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={labelStyle}>Nivel Jerárquico</label>
                            <select
                                name="hierarchy_level"
                                value={editForm.hierarchy_level ?? 3}
                                onChange={(e) => setEditForm(prev => ({ ...prev, hierarchy_level: parseInt(e.target.value) }))}
                                style={inputStyle}
                            >
                                {Array.from({ length: maxLevel + 1 }, (_, i) => (
                                    <option key={i} value={i}>
                                        Nivel {i} — {getHierarchyLabel(i)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={labelStyle}>Foto de Perfil</label>
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                style={{ display: 'none' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {editForm.photoUrl && (
                                    <img
                                        src={editForm.photoUrl}
                                        alt="Preview"
                                        style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }}
                                    />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => avatarInputRef.current?.click()}
                                        disabled={isUploadingAvatar}
                                        style={{ ...btnStyle, background: '#f1f5f9', color: '#334155', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                                    >
                                        {isUploadingAvatar ? '⏳ Subiendo...' : '📷 Cambiar Foto'}
                                    </button>
                                    {editForm.photoUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setEditForm(prev => ({ ...prev, photoUrl: '' }))}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left' }}
                                        >
                                            Quitar foto
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={labelStyle}>Perfil del Puesto (descripción)</label>
                            <textarea
                                name="profile"
                                value={editForm.profile || ''}
                                onChange={handleInputChange}
                                style={{ ...inputStyle, minHeight: '80px' }}
                                placeholder="Descripción estratégica del rol..."
                            />
                        </div>

                        <div className="form-group">
                            <label style={labelStyle}>Tareas (una por línea)</label>
                            <textarea
                                name="tasks"
                                value={editForm.tasks}
                                onChange={handleInputChange}
                                style={{ ...inputStyle, minHeight: '80px' }}
                                placeholder="- Tarea 1&#10;- Tarea 2"
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button onClick={handleSave} className="btn-primary" style={{ ...btnStyle, background: 'var(--color-primary)', color: 'white' }}>
                                    💾 Guardar Cambios
                                </button>
                                <button onClick={() => setIsEditing(false)} style={{ ...btnStyle, background: '#f1f5f9', color: '#64748b' }}>
                                    Cancelar
                                </button>
                            </div>

                            <hr style={{ width: '100%', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                            <button
                                onClick={() => onDeleteNode(node.id)}
                                style={{
                                    ...btnStyle,
                                    background: '#fee2e2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                }}>
                                🗑 Eliminar Puesto
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ========= READ ONLY MODE ========= */}

                        {/* Header with photo */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', textAlign: 'center' }}>
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <img
                                    src={node.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(node.role)}&background=e2e8f0&color=64748b&size=128`}
                                    alt={displayName}
                                    style={{
                                        width: 96,
                                        height: 96,
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        border: '4px solid white'
                                    }}
                                />
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    background: node.status === 'vacancy' ? '#cbd5e1' : '#22c55e',
                                    border: '2px solid white'
                                }} />
                            </div>

                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--color-text-primary, #1e293b)' }}>{displayName}</h3>
                            <p style={{ margin: 0, color: 'var(--color-primary)', fontWeight: 600 }}>{node.role}</p>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {node.status === 'vacancy' && (
                                    <span style={badgeStyle('#f1f5f9', '#64748b')}>VACANTE</span>
                                )}
                                {node.relationship === 'staff' && (
                                    <span style={badgeStyle('#ede9fe', '#7c3aed')}>STAFF</span>
                                )}
                                <span style={badgeStyle('#e0f2fe', '#0284c7')}>
                                    {getHierarchyLabel(node.hierarchy_level)}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1.5rem' }}>

                            {/* Profile Description */}
                            {node.profile && (
                                <Section title="Perfil del Puesto">
                                    <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>{node.profile}</p>
                                </Section>
                            )}

                            {/* Tasks */}
                            {node.tasks && node.tasks.length > 0 && (
                                <Section title="Responsabilidades y Tareas">
                                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569' }}>
                                        {node.tasks.map((task, index) => (
                                            <li key={index} style={{ marginBottom: '0.5rem' }}>{task}</li>
                                        ))}
                                    </ul>
                                </Section>
                            )}

                            {/* Organizational Structure */}
                            <Section title="Estructura Organizacional">
                                <Field label="Nivel Jerárquico" value={
                                    <span style={badgeStyle('#e0f2fe', '#0284c7')}>
                                        N{node.hierarchy_level} — {getHierarchyLabel(node.hierarchy_level)}
                                    </span>
                                } />
                                <Field label="Tipo de Relación" value={
                                    node.relationship === 'staff'
                                        ? <span style={badgeStyle('#ede9fe', '#7c3aed')}>Staff / Soporte (línea punteada)</span>
                                        : <span style={badgeStyle('#dcfce7', '#16a34a')}>Línea directa</span>
                                } />
                                <Field
                                    label="Reporta a"
                                    value={parentNode ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                                {parentNode.role.charAt(0)}
                                            </div>
                                            <span>{parentNode.role}</span>
                                        </div>
                                    ) : 'N/A (Máximo nivel)'}
                                />
                                <Field label="Reportes directos" value={`${directReports.length} puestos directos`} />
                                {totalTeam > 0 && (
                                    <Field label="Equipo total" value={
                                        <span style={{ fontWeight: 700, color: '#0284c7' }}>
                                            👥 {totalTeam} personas en la cadena
                                        </span>
                                    } />
                                )}
                            </Section>

                            {/* Team Members List */}
                            {directReports.length > 0 && (
                                <Section title={`Colaboradores a Cargo (${directReports.length} directos)`}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {directReports.map(member => (
                                            <div key={member.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.6rem 0.75rem',
                                                borderRadius: '10px',
                                                background: '#f8fafc',
                                                border: '1px solid #f1f5f9',
                                                transition: 'border-color 0.2s'
                                            }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    background: member.status === 'vacancy' ? '#f1f5f9' : '#e0f2fe',
                                                    color: member.status === 'vacancy' ? '#94a3b8' : '#0369a1',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 'bold', fontSize: '0.75rem', flexShrink: 0
                                                }}>
                                                    {member.name ? member.name.charAt(0) : '?'}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {member.role}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        {member.name || 'Sin asignar'}
                                                    </div>
                                                </div>
                                                {member.status === 'vacancy' && (
                                                    <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#f1f5f9', color: '#94a3b8', fontWeight: 700 }}>
                                                        VAC
                                                    </span>
                                                )}
                                                {member.children && member.children.length > 0 && (
                                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                                        +{countAllDescendants(member)}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Show all team toggle */}
                                    {totalTeam > directReports.length && (
                                        <button
                                            onClick={() => setShowAllTeam(!showAllTeam)}
                                            style={{ marginTop: '0.75rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem', width: '100%', cursor: 'pointer', fontSize: '0.8rem', color: '#0284c7', fontWeight: 600 }}
                                        >
                                            {showAllTeam ? 'Ocultar equipo completo' : `Ver todos (${totalTeam} personas)`}
                                        </button>
                                    )}

                                    {showAllTeam && (
                                        <div style={{ marginTop: '0.75rem', maxHeight: '200px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.5rem' }}>
                                            {allDescendants.map(person => (
                                                <div key={person.id} style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{person.role}</span>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{person.name || 'Sin asignar'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Section>
                            )}

                            {/* Administrative Data */}
                            <Section title="Datos Administrativos">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <Field label="ID Puesto" value={node.id.substring(0, 8)} />
                                    <Field label="Estado" value={node.status === 'occupied' ? '🟢 Ocupado' : '⚪ Vacante'} />
                                </div>
                            </Section>

                            {/* ========= DOCUMENT ATTACHMENTS ========= */}
                            <Section title="📎 Documentos del Puesto (Perfil)">
                                {/* Upload button */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={handleAttachmentUpload}
                                    style={{ display: 'none' }}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '10px',
                                        border: '2px dashed #cbd5e1',
                                        background: '#f8fafc',
                                        cursor: isUploading ? 'wait' : 'pointer',
                                        color: '#64748b',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s',
                                        marginBottom: '0.75rem'
                                    }}
                                >
                                    {isUploading ? '⏳ Subiendo archivo...' : '📤 Subir PDF o Word'}
                                </button>

                                {/* Attachment list */}
                                {attachments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {attachments.map(att => (
                                            <div key={att.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.65rem 0.75rem',
                                                borderRadius: '10px',
                                                background: '#fff',
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                <span style={{ fontSize: '1.25rem' }}>{getFileIcon(att.file_type)}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {att.file_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                        {formatFileSize(att.file_size)} • {new Date(att.uploaded_at).toLocaleDateString('es-AR')}
                                                    </div>
                                                </div>
                                                <a
                                                    href={orgService.getAttachmentUrl(att.storage_path)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ fontSize: '0.75rem', color: '#0284c7', textDecoration: 'none', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: '6px', background: '#e0f2fe', whiteSpace: 'nowrap' }}
                                                >
                                                    Ver
                                                </a>
                                                <button
                                                    onClick={() => handleDeleteAttachment(att)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', padding: '0.25rem' }}
                                                    title="Eliminar archivo"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                                        Sin documentos adjuntos. Sube el perfil de puesto en PDF o Word.
                                    </p>
                                )}
                            </Section>

                            {/* Action Button */}
                            <div style={{ marginTop: '0.5rem' }}>
                                <button className="btn-primary" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', background: 'var(--color-primary)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                                    {node.status === 'vacancy' ? '📋 Gestionar Solicitud' : '📁 Ver Legajo Completo'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ========= CONFIRM DELETE MODAL ========= */}
            {confirmModal.open && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.5)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '2rem',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'slideUp 0.25s ease'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: 56, height: 56,
                                borderRadius: '50%',
                                background: '#fef2f2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem',
                                fontSize: '1.5rem'
                            }}>
                                🗑️
                            </div>
                            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#1e293b', fontWeight: 700 }}>
                                Eliminar documento
                            </h3>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                ¿Estás seguro de eliminar <strong style={{ color: '#1e293b' }}>"{confirmModal.attachment?.file_name}"</strong>?
                                <br /><span style={{ fontSize: '0.8rem' }}>Esta acción no se puede deshacer.</span>
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => setConfirmModal({ open: false, attachment: null })}
                                style={{
                                    flex: 1,
                                    padding: '0.7rem',
                                    borderRadius: '10px',
                                    border: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    color: '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontFamily: 'inherit',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteAttachment}
                                style={{
                                    flex: 1,
                                    padding: '0.7rem',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: '#ef4444',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontFamily: 'inherit',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(10px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </aside>
    );
};

// Styles
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' };
const inputStyle = { width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: '0.9rem', transition: 'border-color 0.2s', outline: 'none' };
const btnStyle = { padding: '0.65rem 1.25rem', borderRadius: '10px', border: 'none', fontWeight: 600, cursor: 'pointer', flex: 1, fontSize: '0.9rem' };

const badgeStyle = (bg, color) => ({
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: 999,
    background: bg,
    color: color,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.02em'
});

const Section = ({ title, children }) => (
    <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{title}</h4>
        <div>
            {children}
        </div>
    </div>
);

const Field = ({ label, value }) => (
    <div style={{ marginBottom: '0.65rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 500 }}>{value}</div>
    </div>
);
