
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export const UnassignedNode = ({ node }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `unassigned-${node.id}`, // Unique ID prefix
        data: {
            type: 'unassigned',
            node: node
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 9999 : 100,
        opacity: isDragging ? 0.6 : 1,
        borderLeft: `4px solid #0ea5e9`, // Blue accent
        cursor: 'grab',
        touchAction: 'none',
        background: 'white',
        padding: '0.75rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        minWidth: '240px'
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#e0f2fe',
                color: '#0369a1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold'
            }}>
                ?
            </div>
            <div>
                <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.85rem' }}>{node.role}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{node.name || 'Sin asignar'}</div>
            </div>
        </div>
    );
};
