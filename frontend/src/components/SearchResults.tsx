// SearchResults.tsx

import React from "react";

const LARGO_MAXIMO_FALLBACK = 200;
// Interfaz para un documento individual (basado en TU schema.xml)
interface SolrDoc {
  id: string;
  titulo?: string | string[];    
  contenido?: string | string[];
  url?: string;
  extension?: string;
  categoria?: string | string[];
  fecha?: string;  // Campo de fecha (pdate en Solr)
  score?: number;  // Campo de relevancia calculado por Solr
  // 🔑 CAMBIO: Campo que contiene el HTML del snippet resaltado.
  contenido_snippet?: string; 
}

// Props simplificadas: Solo recibe la lista de docs
interface Props {
  docs: SolrDoc[];
}


export const SearchResults: React.FC<Props> = ({ docs }) => {
  // Manejo de estado vacío
  if (!docs || docs.length === 0) {
    return null; 
  }

  // Función auxiliar para formatear la fecha de Solr (ISO string)
  const formatearFecha = (fechaISO?: string) => {
    if (!fechaISO) return "Fecha desconocida";
    try {
      return new Date(fechaISO).toLocaleDateString("es-MX", {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return fechaISO;
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {docs.map((doc, index) => {
        // Normalización de datos
        const titulo = Array.isArray(doc.titulo) ? doc.titulo[0] : doc.titulo;
        
        // 1. Obtener el snippet ya procesado por Solr/Python (contiene HTML <em>)
        // El campo 'contenido_snippet' ya trae el fragmento clave y los <em> tags.
        let snippetFinal = doc.contenido_snippet;
        
        const contenidoOriginal = Array.isArray(doc.contenido) ? doc.contenido[0] : doc.contenido;
        // 2. Fallback: Si no hay snippet resaltado (ej. no hubo match o el campo no existe), 
        // usamos el contenido original y lo truncamos como antes.
        if (!snippetFinal || snippetFinal.trim() === '' || !snippetFinal.includes('<em>')) {
            const contenido = Array.isArray(doc.contenido) ? doc.contenido[0] : doc.contenido;
            snippetFinal = contenido && typeof contenido === 'string' 
                ? contenido.substring(0, LARGO_MAXIMO_FALLBACK) + "..." 
                : "Contenido no disponible";
        }
        
        // Calcular color del score (Visualización de Relevancia)
        const scoreVal = doc.score || 0;
        const scoreColor = scoreVal > 2.0 ? "bg-green-100 text-green-800" : "bg-yellow-50 text-yellow-700";

        return (
          <div 
            key={doc.id || index} 
            className="group block p-4 bg-white border border-gray-200 hover:border-blue-300 transition-colors shadow-sm relative"
          >
            {/* 0. Cabecera con Score y Fecha (sin cambios) */}
            <div className="flex justify-between items-center mb-2 text-xs font-mono border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2">
                    {/* Badge de Relevancia */}
                    <span className={`px-2 py-0.5 rounded font-bold border ${scoreColor} border-opacity-20`}>
                        Relevancia: {scoreVal.toFixed(2)}
                    </span>
                    
                    {/* Fecha */}
                    <span className="text-gray-500 flex items-center gap-1">
                         {formatearFecha(doc.fecha)}
                    </span>
                </div>
            </div>

            {/* 1. Título Enlazado (sin cambios) */}
            <a 
              href={doc.url || "#"} 
              target="_blank"
              rel="noreferrer" 
              className="text-lg font-medium text-blue-700 group-hover:underline decoration-2 visited:text-purple-900 block"
            >
              {titulo || "Documento sin título"}
            </a>

            {/* 2. URL Breadcrumb (sin cambios) */}
            <div className="text-xs text-green-700 mb-2 mt-1 font-mono truncate">
              {doc.url || doc.id}
            </div>

            {/* 3. Snippet / Contenido */}
            {/* 🔑 CRÍTICO: Usamos dangerouslySetInnerHTML para renderizar el HTML que Solr 
               ha marcado con las etiquetas <em>. Esto resuelve el requerimiento.
            */}
            <p 
              className="text-sm text-gray-700 leading-relaxed font-serif"
              dangerouslySetInnerHTML={{ __html: snippetFinal }}
            >
            </p>

            {/* 4. Metadatos (Badges) (sin cambios) */}
            <div className="mt-3 flex gap-2 flex-wrap">
                {doc.extension && (
                    <span className="px-2 py-0.5 text-xs font-bold text-gray-600 bg-gray-100 border border-gray-300 rounded uppercase">
                        {doc.extension}
                    </span>
                )}
                {doc.categoria && (
                    <span className="px-2 py-0.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded">
                        {Array.isArray(doc.categoria) ? doc.categoria.join(", ") : doc.categoria}
                    </span>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
};