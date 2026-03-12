
import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Helper: count all descendants recursively
const countDescendants = (node) => {
    if (!node.children || node.children.length === 0) return 0;
    let count = node.children.length;
    node.children.forEach(child => {
        count += countDescendants(child);
    });
    return count;
};

export const OrgNode = ({ node, onSelect, selectedId, level = 0, expandedIds, onToggle }) => {
    if (!node) return null;
    const isExpanded = expandedIds ? expandedIds.has(node.id) : false;
    const isSelected = selectedId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isStaff = node.relationship === 'staff';
    const totalTeam = countDescendants(node);

    // --- DRAG & DROP HOOKS ---
    const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
        id: node.id,
        data: { node }
    });

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: node.id,
        data: { node }
    });

    const setNodeRef = (el) => {
        setDraggableRef(el);
        setDroppableRef(el);
    };

    const levelColor = getLevelColor(node.hierarchy_level ?? level);

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        borderLeft: `6px solid ${isOver ? '#22c55e' : levelColor}`,
        zIndex: isDragging ? 999 : 10,
        boxShadow: isOver ? '0 0 0 4px rgba(34, 197, 94, 0.4)' : undefined,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none'
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            onSelect(node);
            e.preventDefault();
        }
    };

    const toggleExpand = (e) => {
        e.stopPropagation();
        if (onToggle) {
            onToggle(node.id);
        }
    };

    const displayName = node.name || "Aca va el nombre";

    // Hierarchy level label — supports dynamic sub-levels
    const levelLabels = {
        0: 'Socios',
        1: 'Dirección',
        2: 'Staff',
        3: 'Jefatura',
        4: 'Operativo',
        5: 'Colaborador'
    };
    const currentLevel = node.hierarchy_level ?? level;
    const levelLabel = levelLabels[currentLevel] || `Subnivel ${currentLevel}`;

    return (
        <li className={isStaff ? 'staff-node' : ''}>
            <article
                ref={setNodeRef}
                className={`org-card ${isSelected ? 'active' : ''} ${isStaff ? 'staff-card' : ''}`}
                style={style}
                {...listeners}
                {...attributes}
                data-type={node.type}
                data-status={node.status}
                data-relationship={node.relationship || 'line'}
                onClick={() => onSelect(node)}
            >
                <div className="card-header">
                    {/* Level + Relationship Badge */}
                    <div style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        display: 'flex',
                        gap: '0.25rem',
                        alignItems: 'center'
                    }}>
                        {isStaff && (
                            <span style={{
                                fontSize: '0.55rem',
                                fontWeight: 700,
                                color: '#8b5cf6',
                                background: '#ede9fe',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>
                                STAFF
                            </span>
                        )}
                        <span style={{
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            color: levelColor,
                            textTransform: 'uppercase',
                            opacity: 0.7
                        }}>
                            {levelLabel}
                        </span>
                    </div>

                    {node.status === 'vacancy' ? (
                        <div className="vacancy-avatar">?</div>
                    ) : (
                        <img
                            src={node.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(node.role)}&background=e2e8f0&color=64748b`}
                            alt={`Avatar ${node.role}`}
                            className="avatar"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(node.role)}&background=e2e8f0&color=64748b`;
                            }}
                        />
                    )}
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left', paddingLeft: '0.5rem' }}>
                        <h3 className="role-title" style={{ color: levelColor }}>{node.role}</h3>
                        <p className="employee-name" style={{ fontStyle: node.name ? 'normal' : 'italic', opacity: node.name ? 1 : 0.6 }}>
                            {displayName}
                        </p>
                    </div>

                    {/* Team count badge */}
                    {hasChildren && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}>
                            {totalTeam > 0 && (
                                <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    color: '#0284c7',
                                    background: '#e0f2fe',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '8px',
                                    lineHeight: 1
                                }}>
                                    👥 {totalTeam}
                                </span>
                            )}
                            <button
                                className="node-toggle"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={toggleExpand}
                                aria-label={isExpanded ? "Colapsar" : "Expandir"}
                                style={{ borderColor: levelColor, color: levelColor, position: 'static', transform: 'none' }}
                            >
                                {isExpanded ? '−' : '+'}
                            </button>
                        </div>
                    )}
                </div>
            </article>

            {hasChildren && isExpanded && (
                <ul className={isStaff ? 'staff-children' : ''}>
                    {node.children.map((child) => (
                        <OrgNode
                            key={child.id}
                            node={child}
                            onSelect={onSelect}
                            selectedId={selectedId}
                            level={level + 1}
                            expandedIds={expandedIds}
                            onToggle={onToggle}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
};

// Helper for colors — supports dynamic sub-levels
const getLevelColor = (lvl) => {
    const colors = {
        0: '#0f172a', // Socios - Dark slate
        1: '#1e3a8a', // Dirección - Navy
        2: '#7c3aed', // Staff - Purple
        3: '#0284c7', // Jefatura - Sky blue
        4: '#0ea5e9', // Operativo - Light blue
        5: '#38bdf8', // Colaborador - Lighter blue
    };
    if (colors[lvl]) return colors[lvl];
    // Dynamic sub-levels: generate colors in a teal-to-emerald gradient
    const dynamicColors = ['#06b6d4', '#14b8a6', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];
    return dynamicColors[(lvl - 6) % dynamicColors.length] || '#64748b';
};
