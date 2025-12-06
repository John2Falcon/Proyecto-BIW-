// controlador_busqueda.js
// Asumimos que la constante API_BASE está definida en './config'

// Importar la configuración base si es necesario (Asegúrese de tener un archivo config.js/ts)
// import { API_BASE } from './config'; 
// Si no usa un archivo config, puede definir API_BASE aquí, por ejemplo:
const API_BASE = "http://localhost:8000"; 


export const controlador_busqueda = {
    /**
     * Realiza la petición POST al backend Python para buscar documentos.
     * * @param {string} query - La consulta de búsqueda (ej. 'Facultad de Química').
     * @param {object} filtros - Objeto con las listas de categorias y extensiones.
     * @param {string} orden - Criterio de ordenamiento (ej. 'fecha desc').
     * @param {number} pagina - Número de página actual.
     * @param {number} rows_por_pagina - Cantidad de resultados por página (10).
     */
    async buscar(query, filtros, orden, pagina, rows_por_pagina) {
        
        // Comentario de Intención: Garantizamos que todos los parámetros de control
        // de la búsqueda (Query, Filtros y Paginación) se envíen en un solo cuerpo JSON.
        const cuerpoPeticion = {
            query: query,
            categorias: filtros.categorias || [], 
            extensiones: filtros.extensiones || [], 
            orden: orden || 'ninguno',
            pagina: pagina, // ¡CRÍTICO para la paginación!
            rows: rows_por_pagina // ¡CRÍTICO para el slicing en Python!
        };
        
        try {
            const res = await fetch(`${API_BASE}/buscar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cuerpoPeticion),
            });
            
            if (!res.ok) throw new Error(`Error Solr en API: ${res.status}`);
            
            // Retorna la estructura {docs, numFound, spellcheck, facets}
            return await res.json();
            
        } catch (error) {
            console.error("[ERROR Controlador Busqueda]: Fallo en la red o el API", error);
            // Devolvemos una estructura de fallo compatible para evitar errores en React
            return { docs: [], numFound: 0, spellcheck: null, facets: {} };
        }
    },

    async obtenerSugerencias(texto) {
        if (!texto || texto.length < 2) return [];
        try {
            const res = await fetch(`${API_BASE}/sugerencias?q=${encodeURIComponent(texto)}`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.suggestions || []; 
        } catch (error) {
            return [];
        }
    }
};