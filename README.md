# Prototipo Organigrama Interactivo - Sanatorio Argentino

Este prototipo implementa la propuesta de **Transformación Digital del Organigrama**, convirtiendo la estructura estática en una herramienta de gestión interactiva.

## Características Implementadas

1.  **Arquitectura de Datos Desacoplada**:
    *   Estructura jerárquica basada en JSON (`src/data.js`).
    *   Soporta N niveles de profundidad (Jefe -> Coordinador -> Colaborador).

2.  **Diseño Visual "Clean & Clinical"**:
    *   Uso de variables CSS semánticas (sin frameworks pesados innecesarios).
    *   Distinción visual entre puestos médicos (Azul) y administrativos (Gris).
    *   Indicadores claros de **Vacantes** (borde punteado, opacidad).

3.  **Interactividad (Divulgación Progresiva)**:
    *   **Vista de Árbol**: Muestra solo la estructura jerárquica y fotos.
    *   **Panel de Detalles (Manpower)**: Al hacer clic en una tarjeta, se despliega un panel lateral (`<aside>`) con la información detallada (ID Puesto, Centro de Costos, FTE) para no saturar la vista principal.

4.  **Accesibilidad**:
    *   Estructura semántica `<ul>`/`<li>`.
    *   Navegación por teclado (`Tab`, `Enter`).
    *   Atributos ARIA (`aria-expanded`, `aria-hidden`).

## Cómo Ejecutar

1.  Abrir una terminal en esta carpeta.
2.  Instalar dependencias (si no se ha hecho):
    ```bash
    npm install
    ```
3.  Iniciar el servidor de desarrollo:
    ```bash
    npm run dev
    ```
4.  Abrir el enlace mostrado (ej: `http://localhost:5173`).

## Estructura del Proyecto

*   `src/data.js`: Definición de la jerarquía (Edite este archivo para probar otros árboles).
*   `src/components/OrgNode.jsx`: Componente recursivo que renderiza cada "tarjeta".
*   `src/components/DetailsPanel.jsx`: Panel lateral con información de gestión.
*   `src/index.css`: Sistema de diseño y variables de estilo.
