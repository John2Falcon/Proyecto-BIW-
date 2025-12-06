// Explorer.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { SearchBox } from "./SearchBox";
import { SearchResults } from "./SearchResults";
import { FiltrosBusqueda } from "./FiltrosBusqueda"; 
// 🔑 Importamos el controlador de búsqueda.
import { controlador_busqueda } from "../controladores/controlador_busqueda";

// --- DEFINICIÓN DE TIPOS ---
interface SolrResponse {
  docs: any[];
  numFound: number;
  spellcheck: string | null;
  facets: any;
}

interface Filtros {
  categorias: string[];
  extensiones: string[];
  orden: string; 
}

export const Explorer: React.FC = () => {
  // --- CONFIGURACIÓN UI ---
  const ANCHO_CONTENEDOR_RESULTADOS = "850px"; 
  // const API_BUSQUEDA_URL = "http://localhost:8000/buscar"; // ELIMINADO (Modularizado)
  const RESULTADOS_POR_PAGINA = 10;

  // --- ESTADO GLOBAL DE LA BÚSQUEDA ---
  // Fuente de verdad única para filtros y query
  const [resultados, setResultados] = useState<SolrResponse | null>(null);
  const [cargando, setCargando] = useState(false);
  const [consultaActual, setConsultaActual] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [filtrosActuales, setFiltrosActuales] = useState<Filtros>({
    categorias: [],
    extensiones: [],
    orden: "ninguno",
  });

  const listaResultadosRef = useRef<HTMLDivElement>(null);

  // --- LÓGICA DE BÚSQUEDA CENTRALIZADA (SOLR) ---
  /**
   * Ejecuta la petición al backend. 
   * Recibe parámetros opcionales; si no se pasan, usa el estado actual.
   */
  const ejecutarBusquedaBackend = async (
    query: string, 
    filtros: Filtros, 
    pagina: number
  ) => {
    // Si no hay query y no hay filtros, no buscamos nada (pantalla limpia)
    const hayFiltros = filtros.categorias.length > 0 || filtros.extensiones.length > 0;
    if ((!query || query.trim() === "") && !hayFiltros) return;

    const queryFinal = (!query || query.trim() === "") ? "*:*" : query;
    setCargando(true);

    try {
      // COMENTARIO DE INTENCIÓN: Usamos el controlador modularizado para desacoplar 
      // la UI de la capa de red (Controlador de Servicio).
      const datos = await controlador_busqueda.buscar(
        queryFinal,
        filtros,
        filtros.orden, // El controlador debe usar este valor
        pagina, 
        RESULTADOS_POR_PAGINA
      );
      
      setResultados(datos);
      
    } catch (error) {
        // El error ya fue reportado por el controlador, aquí solo manejamos el estado de la UI
        console.error("Error en la capa de control/red:", error);
        setResultados(null);
    } finally {
        setCargando(false);
    }
  };

  // --- HANDLERS (CONTROLADORES DE EVENTOS) ---

  // 1. Cuando el usuario escribe y da Enter en SearchBox
  const alBuscarNuevaQuery = (q: string) => {
    setConsultaActual(q);
    setPaginaActual(1); // Reset paginación en nueva búsqueda
    // Mantenemos los filtros que ya tenía el usuario activos
    ejecutarBusquedaBackend(q, filtrosActuales, 1);
  };

  // 2. Cuando el usuario cambia UN filtro (Checkbox/Select)
  // Esta función se pasa a FiltrosBusqueda.tsx
  const alCambiarFiltros = (nuevosFiltros: Filtros) => {
    setFiltrosActuales(nuevosFiltros); // Actualizamos UI visualmente
    setPaginaActual(1); // Reset paginación al filtrar
    // Disparamos búsqueda inmediata con la Query actual + Nuevos Filtros
    ejecutarBusquedaBackend(consultaActual, nuevosFiltros, 1);
  };

  // 3. Paginación
  const cambiarPagina = (nuevaPagina: number) => {
    setPaginaActual(nuevaPagina);
    ejecutarBusquedaBackend(consultaActual, filtrosActuales, nuevaPagina);
    // Scroll al top
    if (listaResultadosRef.current) {
        listaResultadosRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 4. Spellcheck (Corrección ortográfica)
  const aplicarCorreccion = (correccion: string) => {
    alBuscarNuevaQuery(correccion); // Se comporta como una nueva búsqueda
  };

  // --- CÁLCULOS DE VISUALIZACIÓN ---
  const { documentosVisibles, totalPaginas, totalDocs } = useMemo(() => {
    if (!resultados) return { documentosVisibles: [], totalPaginas: 0, totalDocs: 0 };
    
    // COMENTARIO DE INTENCIÓN: Como la API Python ya hace el corte (slicing) 
    // y solo devuelve los 10 documentos de la página actual, usamos los docs 
    // directamente, sin necesidad de 'slice' en el frontend.
    return {
        documentosVisibles: resultados.docs,
        totalPaginas: Math.ceil(resultados.numFound / RESULTADOS_POR_PAGINA),
        totalDocs: resultados.numFound
    };
  }, [resultados]); 

  
  return (
    <div className="w-full h-screen bg-[#C0C0C0] font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <div className="flex-shrink-0 p-6 border-b-2 border-white/50 shadow-sm bg-[#C0C0C0] z-10">
        <div className="max-w-7xl mx-auto">
            <h2 className="text-xl font-bold text-black border-b border-gray-500 pb-2 flex items-center gap-2">
                <span>🔎</span> Buscador IR (Solr + Python)
            </h2>
        </div>
      </div>

      {/* CUERPO */}
      <div className="flex-1 flex justify-center p-6 overflow-hidden">
          <div className="w-full max-w-7xl flex flex-col md:flex-row gap-6 h-full">
              
              {/* SIDEBAR (FILTROS CONTROLADOS) */}
              <div className="w-full md:w-1/4 flex-shrink-0 overflow-y-auto pr-2">
                  <div className="border-2 border-t-black border-l-black border-b-white border-r-white p-2 bg-[#C0C0C0]">
                    {/* Pasamos estado y el handler de actualización inmediata */}
                    <FiltrosBusqueda 
                        filtros={filtrosActuales} 
                        alCambiarFiltros={alCambiarFiltros} 
                    />
                  </div>
              </div>

              {/* COLUMNA CENTRAL */}
              <div 
                className="flex flex-col gap-4" 
                style={{ width: ANCHO_CONTENEDOR_RESULTADOS }}
              >
                  {/* CAJA DE BÚSQUEDA */}
                  <div className="flex-shrink-0 relative z-50">
                      <SearchBox 
                        key={consultaActual} // Truco para forzar re-render si cambia externamente (spellcheck)
                        defaultValue={consultaActual}
                        onSearch={alBuscarNuevaQuery} 
                      />
                  </div>

                  {/* RESULTADOS */}
                  <div className="flex-1 bg-white border-2 border-t-black border-l-black border-b-white border-r-white flex flex-col min-h-0">
                      
                      {/* Cabecera de estado */}
                      <div className="p-4 border-b border-gray-100 flex-shrink-0 bg-gray-50">
                        {cargando && (
                            <div className="flex justify-center items-center text-blue-800">
                                <span className="animate-spin mr-2">⏳</span>
                                <span className="font-mono">Consultando índice...</span>
                            </div>
                        )}
                        
                        {!cargando && resultados?.spellcheck && (
                            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 text-gray-800 font-sans flex items-center gap-2 shadow-sm">
                                <span className="text-xl">💡</span>
                                <span>¿Quizás quisiste decir</span>
                                <button 
                                    onClick={() => aplicarCorreccion(resultados.spellcheck!)}
                                    className="font-bold text-blue-700 underline decoration-2 hover:text-blue-900 cursor-pointer"
                                >
                                    {resultados.spellcheck}
                                </button>
                                <span>?</span>
                            </div>
                        )}

                        {!cargando && totalDocs === 0 && resultados && (
                            <div className="text-center text-gray-500 font-mono py-2">
                                No se encontraron documentos para estos filtros/consulta.
                            </div>
                        )}
                      </div>

                      {/* Lista Scrollable */}
                      <div 
                        ref={listaResultadosRef} 
                        className="flex-1 overflow-y-auto p-4 bg-white"
                      >
                        {!cargando && (
                            <SearchResults docs={documentosVisibles} />
                        )}
                      </div>

                      {/* Paginación */}
                      {!cargando && totalPaginas > 1 && (
                          <div className="p-4 border-t border-gray-200 bg-gray-100 flex-shrink-0 flex justify-between items-center">
                              <div className="text-xs text-gray-500 font-mono">
                                  Total: {totalDocs} docs
                              </div>
                              
                              <div className="flex gap-2">
                                  <button
                                    onClick={() => cambiarPagina(paginaActual - 1)}
                                    disabled={paginaActual === 1}
                                    className="px-3 py-1 border rounded hover:bg-gray-200 disabled:opacity-50 text-black text-sm"
                                  >
                                    Anterior
                                  </button>
                                  <span className="px-2 py-1 font-bold text-sm flex items-center">
                                      {paginaActual} / {totalPaginas}
                                  </span>
                                  <button
                                    onClick={() => cambiarPagina(paginaActual + 1)}
                                    disabled={paginaActual === totalPaginas}
                                    className="px-3 py-1 border rounded hover:bg-gray-200 disabled:opacity-50 text-black text-sm"
                                  >
                                    Siguiente
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};