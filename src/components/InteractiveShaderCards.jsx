import { useEffect } from 'react';

// Selector de todas las tarjetas del ecosistema RRHH que reciben el efecto Shader Interactivo
const SHADER_CARD_SELECTOR = [
  '.sel-kpi-card',
  '.sel-panel-card',
  '.sel-header',
  '.sel-table-card',
  '.sel-guide-card',
  '.sel-filters',
  '.pm-kpi-card',
  '.pm-header',
  '.pm-matrix-card',
  '.pm-table-card',
  '.pm-box',
  '.pm-filters',
  '.prestadores-list__card',
  '.home-module-card',
  '.org-card',
].join(', ');

// Tarjetas compactas que además reciben inclinación 3D (micro-tilt) y destello especular
const TILT_CARD_SELECTOR = [
  '.sel-kpi-card',
  '.sel-guide-card',
  '.pm-kpi-card',
  '.prestadores-list__card',
  '.home-module-card',
].join(', ');

export default function InteractiveShaderCards() {
  useEffect(() => {
    let rafId = null;

    const handlePointerMove = (e) => {
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const cards = document.querySelectorAll(SHADER_CARD_SELECTOR);
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          // Solo actualizar si el cursor está cerca o dentro de la tarjeta
          const pad = 120;
          if (
            e.clientX < rect.left - pad ||
            e.clientX > rect.right + pad ||
            e.clientY < rect.top - pad ||
            e.clientY > rect.bottom + pad
          ) {
            if (card.classList.contains('shader-card--hovered')) {
              card.classList.remove('shader-card--hovered');
              card.style.setProperty('--rx', '0deg');
              card.style.setProperty('--ry', '0deg');
            }
            return;
          }

          if (!card.classList.contains('shader-card')) {
            card.classList.add('shader-card');
            if (card.matches(TILT_CARD_SELECTOR)) {
              card.classList.add('shader-card--tiltable');
            }
          }

          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty('--mouse-x', `${x}px`);
          card.style.setProperty('--mouse-y', `${y}px`);

          const isInside =
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;

          if (isInside) {
            card.classList.add('shader-card--hovered');
            if (card.matches(TILT_CARD_SELECTOR)) {
              const normX = (x / rect.width) - 0.5;
              const normY = (y / rect.height) - 0.5;
              const maxTilt = 5.5; // Grados de inclinación 3D suave
              const rx = (-normY * maxTilt).toFixed(2);
              const ry = (normX * maxTilt).toFixed(2);
              card.style.setProperty('--rx', `${rx}deg`);
              card.style.setProperty('--ry', `${ry}deg`);
              card.style.setProperty('--glare-angle', `${Math.round(Math.atan2(normY, normX) * (180 / Math.PI) + 135)}deg`);
            }
          } else {
            card.classList.remove('shader-card--hovered');
            card.style.setProperty('--rx', '0deg');
            card.style.setProperty('--ry', '0deg');
          }
        });
      });
    };

    // Inicializar clases en tarjetas existentes y nuevas
    const initCards = () => {
      document.querySelectorAll(SHADER_CARD_SELECTOR).forEach((card) => {
        card.classList.add('shader-card');
        if (card.matches(TILT_CARD_SELECTOR)) {
          card.classList.add('shader-card--tiltable');
        }
      });
    };

    initCards();
    const observer = new MutationObserver(initCards);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return null;
}
