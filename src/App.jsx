

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { orgData as initialOrgData } from './data';
import { seedDatabase } from './seed_hierarchy';
import { OrgNode } from './components/OrgNode';
import { DetailsPanel } from './components/DetailsPanel';
import { NewPositionDrawer } from './components/NewPositionDrawer';
import { UnassignedNode } from './components/UnassignedNode';
import ConfirmationModal from './components/ConfirmationModal';
import { orgService } from './services/orgService';
import UserMenu from './components/UserMenu';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter
} from '@dnd-kit/core';

// Helper: Build Tree from Flat DB List
const buildHierarchy = (nodes) => {
  const nodeMap = {};
  const roots = [];
  const unassigned = [];

  // 1. Map ID -> Node & Normalize props
  nodes.forEach(node => {
    nodeMap[node.id] = {
      ...node,
      photoUrl: node.photo_url, // Map DB snake_case to Prop camelCase
      hierarchy_level: node.hierarchy_level ?? 3,
      relationship: node.relationship || 'line',
      children: [] // Init children array
    };
  });

  // 2. Link Children to Parents
  nodes.forEach(node => {
    const mappedNode = nodeMap[node.id];
    if (node.parent_id) {
      const parent = nodeMap[node.parent_id];
      if (parent) {
        parent.children.push(mappedNode);
      } else {
        // Orphaned with parent_id? Treat as unassigned for safety
        unassigned.push(mappedNode);
      }
    } else {
      // No parent — root candidates
      if (mappedNode.type === 'director' || mappedNode.type === 'owner') {
        roots.push(mappedNode);
      } else {
        unassigned.push(mappedNode);
      }
    }
  });

  // 3. Sort children by position/role
  // We can also sort roots if needed
  Object.values(nodeMap).forEach(node => {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => (a.position || 0) - (b.position || 0));
    }
  });

  return { roots, unassigned };
};

// Helper to find parent node
const findParent = (root, targetId) => {
  if (root.children) {
    for (let child of root.children) {
      if (child.id === targetId) return root; // direct parent
      const found = findParent(child, targetId);
      if (found) return found;
    }
  }
  return null;
};

// Helper: Deep Clone and Find Node to Update (Immutably)
const updateNodeInTree = (root, nodeId, newData) => {
  if (root.id === nodeId) {
    return { ...root, ...newData };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map(child => updateNodeInTree(child, nodeId, newData))
    };
  }
  return root;
};

// Helper: Move Node (Remove from old parent, add to new parent)
const moveNodeInTree = (root, nodeId, newParentId) => {
  // 1. Find the node to move
  let nodeToMove = null;
  const findAndRemove = (parent, id) => {
    if (!parent.children) return parent;
    const index = parent.children.findIndex(c => c.id === id);
    if (index > -1) {
      nodeToMove = parent.children[index];
      // Remove it
      const newChildren = [...parent.children];
      newChildren.splice(index, 1);
      return { ...parent, children: newChildren };
    }
    // Recurse
    return {
      ...parent,
      children: parent.children.map(child => findAndRemove(child, id))
    };
  };

  const rootWithoutNode = findAndRemove(root, nodeId);

  if (!nodeToMove) return root; // Node not found

  // 2. Add to new parent
  const addToParent = (parent, id, node) => {
    if (parent.id === id) {
      // Add node here
      return { ...parent, children: [...(parent.children || []), node] };
    }
    if (parent.children) {
      return {
        ...parent,
        children: parent.children.map(child => addToParent(child, id, node))
      };
    }
    return parent;
  };

  return addToParent(rootWithoutNode, newParentId, nodeToMove);
};

// Helper: Add Unassigned Node to Tree
const addNodeToTree = (root, parentId, newNode) => {
  if (root.id === parentId) {
    return { ...root, children: [...(root.children || []), newNode] };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map(child => addNodeToTree(child, parentId, newNode))
    };
  }
  return root;
};

// Helper to search tree
const searchTree = (node, term) => {
  if (!term) return null;
  const lowerTerm = term.toLowerCase();

  if ((node.name && node.name.toLowerCase().includes(lowerTerm)) ||
    (node.role && node.role.toLowerCase().includes(lowerTerm))) {
    return node;
  }

  if (node.children) {
    for (let child of node.children) {
      const found = searchTree(child, term);
      if (found) return found;
    }
  }
  return null;
};

// Internal Component for Department View (unchanged)
const DepartmentView = ({ root, onSelect }) => {
  const departments = root.children || [];
  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '4rem 2rem', alignItems: 'flex-start' }}>
      <div style={{ minWidth: '300px', maxWidth: '300px' }}>
        <div onClick={() => onSelect(root)} style={{ padding: '1.5rem', background: 'var(--bg-director)', color: 'white', borderRadius: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-md)', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{root.role}</h2>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.9 }}>{root.name}</p>
        </div>
      </div>
      {departments.map(dept => (
        <div key={dept.id} style={{ minWidth: '320px', maxWidth: '320px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div onClick={() => onSelect(dept)} style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '4px solid var(--color-accent)', cursor: 'pointer' }}>
            <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.1rem' }}>{dept.role}</h3>
            <div style={{ fontWeight: '500', marginTop: '0.5rem', color: '#334155' }}>{dept.name || 'Vacante'}</div>
          </div>
          <div style={{ padding: '1rem', overflowY: 'auto', maxHeight: '70vh' }}>
            <DeptListChildren node={dept} onSelect={onSelect} />
          </div>
        </div>
      ))}
    </div>
  )
};

const DeptListChildren = ({ node, onSelect }) => {
  if (!node.children) return null;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {node.children.map(child => (
        <li key={child.id} style={{ marginBottom: '0.75rem' }}>
          <div onClick={() => onSelect(child)} style={{ cursor: 'pointer', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.75rem' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>{child.name ? child.name.charAt(0) : '?'}</div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#1e293b' }}>{child.role}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{child.name || 'Vacante'}</div>
            </div>
          </div>
          <div style={{ paddingLeft: '1.5rem', marginTop: '0.75rem', borderLeft: '2px solid #f1f5f9' }}>
            <DeptListChildren node={child} onSelect={onSelect} />
          </div>
        </li>
      ))}
    </ul>
  )
};


function App() {
  // Use local state instead of hook for now
  const [data, setData] = useState(null); // Init as null, load from DB
  const [isLoading, setIsLoading] = useState(true);
  const [activeDragNode, setActiveDragNode] = useState(null); // For DragOverlay
  const [isOffline, setIsOffline] = useState(false); // New Offline State
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewMode, setViewMode] = useState('hierarchy');
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Unassigned Nodes & Drawer State
  const [unassignedNodes, setUnassignedNodes] = useState([]); // Temporary dock for new nodes
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDockOpen, setIsDockOpen] = useState(true); // Show/hide unassigned dock
  const [assigningNodeId, setAssigningNodeId] = useState(null); // Click-to-assign mode

  // Confirmation Modal State
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    isDestructive: false,
    onConfirm: () => { },
    onCancel: () => { }
  });

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Expansion State
  const [expandedIds, setExpandedIds] = useState(new Set()); // Will init after load

  // Viewport drag state
  const viewportRef = useRef(null);
  const [isViewDragging, setIsViewDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // --- DATA LOADING ---
  const loadOrgChart = async () => {
    try {
      setIsLoading(true);
      setIsOffline(false);
      console.log("Fetching org chart...");

      // Timeout to avoid hanging forever if DNS is weird
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      let nodes = await Promise.race([
        orgService.getOrgChart(),
        timeoutPromise
      ]);

      if (!nodes || nodes.length === 0) {
        console.log("Database empty. Seeding...");
        await orgService.seedFromData(initialOrgData);
        nodes = await orgService.getOrgChart();
      }

      console.log("Building hierarchy with roles:", nodes ? nodes.length : 0);
      const { roots, unassigned } = buildHierarchy(nodes);

      // Prefer 'owner' (Socios) as root, then 'director'
      const mainRoot = roots.find(r => r.type === 'owner') || roots.find(r => r.type === 'director') || roots[0];

      if (mainRoot) {
        setData(mainRoot);
        setExpandedIds(new Set([mainRoot.id])); // Expand root by default
      }
      setUnassignedNodes(unassigned);
    } catch (error) {
      console.error("Failed to load data (Switching to OFFLINE):", error);
      // FALLBACK TO OFFLINE MODE
      setIsOffline(true);
      setData(initialOrgData);
      setExpandedIds(new Set([initialOrgData.id]));
      setUnassignedNodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrgChart();
  }, []);

  // --- EXPANSION HANDLERS ---
  const handleToggleExpand = (nodeId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const getAllIds = (node) => {
    if (!node) return [];
    let ids = [node.id];
    if (node.children) {
      node.children.forEach(child => {
        ids = ids.concat(getAllIds(child));
      });
    }
    return ids;
  };

  const handleExpandAll = () => {
    const allIds = getAllIds(data);
    setExpandedIds(new Set(allIds));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set([data.id])); // Keep root expanded
  };

  // --- DND KIT SENSORS ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const selectedNodeParent = useMemo(() => {
    if (!selectedNode || !data) return null;
    return findParent(data, selectedNode.id);
  }, [selectedNode, data]);

  const handleNodeSelect = (node) => {
    if (!isViewDragging) {
      // If we are in "assigning" mode, assign the unassigned node here
      if (assigningNodeId) {
        const unassignedNode = unassignedNodes.find(n => n.id === assigningNodeId);
        if (unassignedNode) {
          setModalState({
            isOpen: true,
            title: 'Asignar Puesto',
            message: `¿Asignar "${unassignedNode.role}" bajo el mando de "${node.role}"?`,
            confirmText: 'Asignar',
            cancelText: 'Cancelar',
            isDestructive: false,
            onConfirm: async () => {
              try {
                await orgService.updateNode(unassignedNode.id, { parentId: node.id });
                setUnassignedNodes(prev => prev.filter(n => n.id !== unassignedNode.id));
                setAssigningNodeId(null);
                await loadOrgChart();
                closeModal();
              } catch (e) {
                console.error('Failed to assign', e);
                alert('Error al asignar puesto');
              }
            },
            onCancel: () => {
              setAssigningNodeId(null);
              closeModal();
            }
          });
        }
        return;
      }
      setSelectedNode(node);
    }
  };

  const handleClosePanel = () => setSelectedNode(null);

  const handleUpdateNode = async (updatedNode) => {
    try {
      await orgService.updateNode(updatedNode.id, updatedNode);
      // Optimistic update
      setData(prevData => {
        const newData = updateNodeInTree(prevData, updatedNode.id, updatedNode);
        setSelectedNode(updatedNode);
        return newData;
      });
    } catch (e) {
      console.error("Update failed", e);
      alert("Error al guardar cambios");
    }
  };

  // Helper: Remove Node from Tree
  const deleteNodeFromTree = (root, nodeId) => {
    if (root.id === nodeId) {
      return null;
    }

    if (root.children) {
      const newChildren = root.children
        .map(child => deleteNodeFromTree(child, nodeId))
        .filter(child => child !== null);

      return { ...root, children: newChildren };
    }
    return root;
  };

  const handleDeleteNode = (nodeId) => {
    if (data.id === nodeId) {
      alert("No se puede eliminar el nodo raíz (Director General). Edítalo en su lugar.");
      return;
    }

    setModalState({
      isOpen: true,
      title: 'Eliminar Puesto',
      message: '¿Estás SEGURO de eliminar este puesto? Esta acción no se puede deshacer y los subordinados podrían quedar huérfanos o eliminarse.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await orgService.deleteNode(nodeId);
          await loadOrgChart(); // Reload to sync
          setSelectedNode(null);
          closeModal();
        } catch (e) {
          console.error("Delete failed", e);
          alert("Error al eliminar");
        }
      },
      onCancel: closeModal
    });
  };

  // Add new node to staging dock
  const handleCreateNode = async (newNode) => {
    try {
      // Insert as unassigned (no parentId)
      const savedNode = await orgService.createNode(newNode);

      // Add to unassigned list with real ID
      // Normalize props for UI (photoUrl)
      const mappedNode = { ...savedNode, photoUrl: savedNode.photo_url, children: [] };

      setUnassignedNodes(prev => [...prev, mappedNode]);
    } catch (e) {
      console.error("Create failed", e);
      alert("Error al crear puesto");
    }
  };

  // --- DRAG START HANDLER ---
  const handleDragStart = (event) => {
    const { active } = event;
    if (active.data?.current?.type === 'unassigned') {
      setActiveDragNode(active.data.current.node);
    } else if (active.data?.current?.node) {
      setActiveDragNode(active.data.current.node);
    }
  };

  // --- DRAG END HANDLER (REARRANGE NODES - PERSISTED) ---
  const handleDragEnd = (event) => {
    setActiveDragNode(null);
    const { active, over } = event;
    if (!over) return;

    // Check if dragging an unassigned node
    if (active.data?.current?.type === 'unassigned') {
      const newNode = active.data.current.node;

      // SPECIAL CASE: Drop on ROOT NODE
      if (over.id === data.id) {
        setModalState({
          isOpen: true,
          title: 'Nuevo Jefe Supremo',
          message: `¿Deseas establecer a "${newNode.role}" como el NUEVO MÁXIMO RESPONSABLE (Jefe de ${data.role})?`,
          confirmText: 'Sí, es el Jefe',
          cancelText: 'No, es Subordinado',
          isDestructive: false,
          onConfirm: async () => {
            try {
              // 1. Ensure newNode is unassigned/root (should already be)
              // 2. Set old root's parent to newNode
              await orgService.updateNode(data.id, { parentId: newNode.id });
              await loadOrgChart();
              closeModal();
            } catch (e) {
              console.error("Failed to set new root", e);
              alert("Error al actualizar jerarquía");
            }
          },
          onCancel: () => {
            // Open the next confirmation modal (Assign as subordinate)
            setModalState({
              isOpen: true,
              title: 'Asignar Subordinado',
              message: `¿Asignar "${newNode.role}" bajo el mando de "${data.role}"?`,
              confirmText: 'Asignar',
              cancelText: 'Cancelar',
              isDestructive: false,
              onConfirm: async () => {
                try {
                  await orgService.updateNode(newNode.id, { parentId: over.id });
                  setUnassignedNodes(prev => prev.filter(n => n.id !== newNode.id));
                  await loadOrgChart();
                  closeModal();
                } catch (e) {
                  console.error("Failed to assign", e);
                  alert("Error al asignar puesto");
                }
              },
              onCancel: closeModal
            });
          }
        });
        return;
      }

      // Verify user intent (Normal Subordinate)
      setModalState({
        isOpen: true,
        title: 'Asignar Puesto',
        message: `¿Asignar "${newNode.role}" bajo el mando de "${over.data?.current?.node?.role || 'este puesto'}"?`,
        confirmText: 'Asignar',
        cancelText: 'Cancelar',
        isDestructive: false,
        onConfirm: async () => {
          try {
            await orgService.updateNode(newNode.id, { parentId: over.id });
            setUnassignedNodes(prev => prev.filter(n => n.id !== newNode.id));
            await loadOrgChart();
            closeModal();
          } catch (e) {
            console.error("Failed to assign", e);
            alert("Error al asignar puesto");
          }
        },
        onCancel: closeModal
      });
      return;
    }

    // Normal Organization Drag & Drop
    if (active.id !== over.id) {
      setModalState({
        isOpen: true,
        title: 'Mover Puesto',
        message: `¿Mover este puesto bajo el mando del nuevo jefe?`,
        confirmText: 'Mover',
        cancelText: 'Cancelar',
        isDestructive: false,
        onConfirm: async () => {
          try {
            await orgService.updateNode(active.id, { parentId: over.id });
            await loadOrgChart();
            closeModal();
          } catch (e) {
            console.error("Move failed", e);
            alert("Error al mover puesto");
          }
        },
        onCancel: closeModal
      });
    }
  };

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length > 2) {
      const found = searchTree(data, term);
      if (found) setSelectedNode(found);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));

  const handleMouseDown = (e) => {
    if (viewMode === 'department') return;
    if (e.target.closest('button') || e.target.closest('.org-card') || e.target.closest('.dept-column') || e.target.closest('.unassigned-dock')) return;
    setIsViewDragging(true);
    setStartX(e.pageX - viewportRef.current.offsetLeft);
    setStartY(e.pageY - viewportRef.current.offsetTop);
    setScrollLeft(viewportRef.current.scrollLeft);
    setScrollTop(viewportRef.current.scrollTop);
  };

  const handleMouseLeave = () => setIsViewDragging(false);
  const handleMouseUp = () => setIsViewDragging(false);

  const handleMouseMove = (e) => {
    if (!isViewDragging) return;
    e.preventDefault();
    const x = e.pageX - viewportRef.current.offsetLeft;
    const y = e.pageY - viewportRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    viewportRef.current.scrollLeft = scrollLeft - walkX;
    viewportRef.current.scrollTop = scrollTop - walkY;
  };

  const scrollViewport = (dx, dy) => {
    if (viewportRef.current) {
      viewportRef.current.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
    }
  };

  // --- RENDERING ---
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', color: '#64748b' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p>Cargando organigrama...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <p>No se encontraron datos o hubo un error.</p>
        <button onClick={loadOrgChart} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header Controls */}
      <header className="org-controls">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <img src="/logosanatorio.png" alt="Sanatorio Argentino" style={{ height: '36px', objectFit: 'contain' }} />
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, color: 'var(--color-primary)' }}>
            Organigrama Institucional
          </h1>
          <span style={{ padding: '0.25rem 0.5rem', background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            PROTOTIPO EDITABLE (LOCAL)
          </span>
          <nav style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.5rem' }}>
            <a href="/" style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem',
              borderRadius: '12px', background: '#f1f5f9', color: '#475569',
              textDecoration: 'none'
            }}>🏠 Inicio</a>
            <a href="/calendario.html" style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem',
              borderRadius: '12px', background: '#e0f2fe', color: '#0284c7',
              textDecoration: 'none'
            }}>📅 Calendario</a>
            <a href="/agenda.html" style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem',
              borderRadius: '12px', background: '#fef3c7', color: '#d97706',
              textDecoration: 'none'
            }}>📋 Agenda Pública</a>
          </nav>
          <UserMenu />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* EXPANSION CONTROLS */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleExpandAll} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>
              Expandir Todo
            </button>
            <button onClick={handleCollapseAll} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>
              Colapsar Todo
            </button>
            <button
              onClick={() => {
                setModalState({
                  isOpen: true,
                  title: '🔄 Sincronizar Estructura',
                  message: '¿Re-sincronizar la base de datos con la estructura definida en data.js? Esto REEMPLAZARÁ todos los datos actuales.',
                  confirmText: 'Sí, Sincronizar',
                  cancelText: 'Cancelar',
                  isDestructive: true,
                  onConfirm: async () => {
                    try {
                      closeModal();
                      setIsLoading(true);
                      const result = await seedDatabase();
                      await loadOrgChart();
                      setIsLoading(false);
                      // Show result in modal
                      setModalState({
                        isOpen: true,
                        title: result.success ? '✅ Sincronización Exitosa' : '❌ Error de Sincronización',
                        message: result.success
                          ? `¡Base de datos sincronizada con éxito! ${result.count} puestos guardados.`
                          : `Error al sincronizar: ${result.error}`,
                        confirmText: 'Aceptar',
                        cancelText: '',
                        isDestructive: false,
                        onConfirm: closeModal,
                        onCancel: closeModal
                      });
                    } catch (e) {
                      console.error('Reseed failed', e);
                      setIsLoading(false);
                      setModalState({
                        isOpen: true,
                        title: '❌ Error Inesperado',
                        message: `Error al sincronizar: ${e.message}`,
                        confirmText: 'Aceptar',
                        cancelText: '',
                        isDestructive: false,
                        onConfirm: closeModal,
                        onCancel: closeModal
                      });
                    }
                  },
                  onCancel: closeModal
                });
              }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #f59e0b', background: '#fffbeb', cursor: 'pointer', fontSize: '0.8rem', color: '#92400e', fontWeight: 600 }}
            >
              🔄 Sincronizar
            </button>
          </div>

          <select
            id="view-mode"
            value={viewMode}
            onChange={(e) => {
              setViewMode(e.target.value);
              setZoom(1);
            }}
            style={{
              padding: '0.5rem',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--glass-border)',
              background: 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(4px)',
              cursor: 'pointer'
            }}
          >
            <option value="hierarchy">Vista Jerárquica</option>
            <option value="department">Vista por Servicios</option>
          </select>
          <input
            type="search"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Buscar colaborador..."
            style={{
              padding: '0.5rem',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--glass-border)',
              width: '250px',
              background: 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(4px)'
            }}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="org-container">

        {/* Chart Viewport */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <main
            ref={viewportRef}
            className="org-tree-container"
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            style={{
              flex: 1,
              transition: 'margin-right 0.3s',
              overflow: 'auto',
              cursor: isViewDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none'
            }}
          >
            {viewMode === 'hierarchy' ? (
              <div
                className="org-tree"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s ease-out',
                  padding: '4rem',
                  minWidth: 'fit-content'
                }}
              >
                <ul>
                  <OrgNode
                    node={data}
                    onSelect={handleNodeSelect}
                    selectedId={selectedNode?.id}
                    expandedIds={expandedIds}
                    onToggle={handleToggleExpand}
                  />
                </ul>
              </div>
            ) : (
              <DepartmentView root={data} onSelect={handleNodeSelect} />
            )}
          </main>

          {/* --- UNASSIGNED NODES DOCK --- */}
          {unassignedNodes.length > 0 && !isDockOpen && (
            <div
              onClick={() => setIsDockOpen(true)}
              style={{
                position: 'fixed',
                bottom: '2rem',
                left: '2rem',
                zIndex: 1000,
                background: '#0284c7',
                color: 'white',
                padding: '0.6rem 1rem',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'transform 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              📋 Puestos sin asignar
              <span style={{ background: 'rgba(255,255,255,0.3)', padding: '0.1rem 0.4rem', borderRadius: '99px', fontSize: '0.7rem' }}>
                {unassignedNodes.length}
              </span>
            </div>
          )}

          {unassignedNodes.length > 0 && isDockOpen && (
            <div className="unassigned-dock" style={{
              position: 'fixed',
              bottom: '2rem',
              left: '2rem',
              zIndex: 1000,
              background: assigningNodeId ? 'rgba(219, 234, 254, 0.98)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(12px)',
              border: assigningNodeId ? '2px solid #3b82f6' : '1px solid var(--glass-border)',
              padding: '1rem',
              borderRadius: '16px',
              boxShadow: assigningNodeId
                ? '0 0 0 4px rgba(59, 130, 246, 0.2), 0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              maxHeight: '40vh',
              width: '300px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Puestos sin asignar</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.7rem', background: '#e2e8f0', color: '#64748b', padding: '0.1rem 0.4rem', borderRadius: '99px' }}>{unassignedNodes.length}</span>
                  <button
                    onClick={() => { setIsDockOpen(false); setAssigningNodeId(null); }}
                    title="Minimizar"
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
                      border: 'none', background: '#f1f5f9',
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8rem', color: '#64748b',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {assigningNodeId && (
                <div style={{
                  background: '#3b82f6',
                  color: 'white',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  animation: 'pulse 2s infinite'
                }}>
                  👆 Hacé clic en un puesto del organigrama para asignar
                  <button
                    onClick={() => setAssigningNodeId(null)}
                    style={{ display: 'block', margin: '0.5rem auto 0', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {unassignedNodes.map(uNode => (
                <div key={uNode.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: assigningNodeId === uNode.id ? '#dbeafe' : 'white',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  border: assigningNodeId === uNode.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  transition: 'all 0.2s'
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#e0f2fe', color: '#0369a1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '0.75rem', flexShrink: 0
                  }}>
                    ?
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{uNode.role}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{uNode.name || 'Sin asignar'}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssigningNodeId(assigningNodeId === uNode.id ? null : uNode.id);
                    }}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: assigningNodeId === uNode.id ? '#3b82f6' : '#e0f2fe',
                      color: assigningNodeId === uNode.id ? 'white' : '#0284c7',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                  >
                    {assigningNodeId === uNode.id ? '✓ Asignando...' : '📌 Asignar'}
                  </button>
                </div>
              ))}

              {!assigningNodeId && (
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: '0.25rem' }}>
                  Clic en "Asignar" y luego en un puesto del organigrama
                </div>
              )}
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {activeDragNode && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                borderLeft: '4px solid #0ea5e9',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                minWidth: '220px',
                pointerEvents: 'none',
                zIndex: 99999
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#e0f2fe', color: '#0369a1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '0.8rem'
                }}>
                  {activeDragNode.name ? activeDragNode.name.charAt(0) : '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>{activeDragNode.role}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{activeDragNode.name || 'Sin asignar'}</div>
                </div>
              </div>
            )}
          </DragOverlay>

        </DndContext>

        {/* RESTORED NAVIGATION CONTROLS */}
        <div className="nav-controls-wrapper">
          <button
            onClick={() => scrollViewport(0, -100)}
            style={{ gridColumn: '2', gridRow: '1', width: '100%', height: '100%', borderRadius: '4px', border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ▲
          </button>

          <button
            onClick={() => scrollViewport(-100, 0)}
            style={{ gridColumn: '1', gridRow: '2', width: '100%', height: '100%', borderRadius: '4px', background: 'white', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ◀
          </button>

          <button
            onClick={() => scrollViewport(0, 100)}
            style={{ gridColumn: '2', gridRow: '2', width: '100%', height: '100%', borderRadius: '4px', background: 'white', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ▼
          </button>

          <button
            onClick={() => scrollViewport(100, 0)}
            style={{ gridColumn: '3', gridRow: '2', width: '100%', height: '100%', borderRadius: '4px', background: 'white', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ▶
          </button>
        </div>

        {/* RESOTRED ZOOM CONTROLS */}
        <div className="zoom-controls-wrapper">
          <button
            onClick={handleZoomIn}
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'white', boxShadow: 'var(--shadow-md)', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            +
          </button>
          <button
            onClick={handleZoomOut}
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'white', boxShadow: 'var(--shadow-md)', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            -
          </button>
        </div>

        <DetailsPanel
          node={selectedNode}
          parentNode={selectedNodeParent}
          onClose={handleClosePanel}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
        />

      </div>

      {/* Floating Action Button (FAB) for New Position */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1), 0 10px 15px rgba(0,0,0,0.1)',
          fontSize: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 100
        }}
        className="fab-add"
      >
        +
      </button>

      {/* New Position Drawer */}
      <NewPositionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onAddNode={handleCreateNode}
      />

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${viewMode === 'hierarchy' ? 'active' : ''}`}
          onClick={() => setViewMode('hierarchy')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="10" y="3" width="4" height="4"></rect>
            <path d="M12 7v10"></path>
            <rect x="4" y="17" width="4" height="4"></rect>
            <path d="M6 17v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"></path>
            <rect x="16" y="17" width="4" height="4"></rect>
          </svg>
          <span>Jerarquía</span>
        </button>

        <button
          className={`nav-item ${viewMode === 'department' ? 'active' : ''}`}
          onClick={() => setViewMode('department')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Servicios</span>
        </button>

        <button
          className="nav-item"
          onClick={() => {
            const searchInput = document.getElementById('mobile-search-input');
            if (searchInput) {
              searchInput.focus();
              searchInput.scrollIntoView();
            } else {
              viewportRef.current.scrollTop = 0;
            }
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Buscar</span>
        </button>
      </nav>

      {/* Mobile Search Overlay */}
      <div
        id="mobile-search-overlay"
        style={{
          display: window.innerWidth <= 768 ? 'block' : 'none',
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          right: '1rem',
          zIndex: 80,
          pointerEvents: 'none'
        }}
      >
        <input
          id="mobile-search-input"
          type="search"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={handleSearch}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '30px',
            border: '1px solid rgba(255,255,255,0.8)',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
            pointerEvents: 'auto',
            opacity: 0.9
          }}
        />
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        isDestructive={modalState.isDestructive}
        onConfirm={modalState.onConfirm}
        onCancel={modalState.onCancel}
      />

    </div>
  );
}

export default App;
