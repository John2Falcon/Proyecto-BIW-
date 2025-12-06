// SubidaArchivos.tsx (Finalizado para envío de lote)

import React, { useState, useRef } from "react";

// Requisito: Código modular y limpio, llamando al endpoint /subir
export const SubidaArchivos: React.FC = () => {
    const [archivosSeleccionados, setArchivosSeleccionados] = useState<File[]>([]);
    const [estadoSubida, setEstadoSubida] = useState<string>(""); 
    const [mensajeSubida, setMensajeSubida] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);

    const API_SUBIR_URL = "http://localhost:8000/subir"; 

    const manejarSeleccionArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setArchivosSeleccionados(Array.from(e.target.files));
            setEstadoSubida("espera");
            setMensajeSubida(`Archivos listos para subir: ${e.target.files.length} documento(s)...`);
        }
    };
    
    const iniciarSubida = async () => {
        if (archivosSeleccionados.length === 0) return;

        setEstadoSubida("cargando");
        setMensajeSubida(`Subiendo e indexando ${archivosSeleccionados.length} documento(s)...`);

        const formData = new FormData();
        
        // COMENTARIO DE INTENCIÓN: Adjuntamos todos los archivos al mismo campo 'files' 
        // para que FastAPI los reciba como List[UploadFile] y pueda iterarlos 
        // y ejecutar Suggester una sola vez (eficiencia).
        for (const archivo of archivosSeleccionados) {
            formData.append("files", archivo); 
        }
        
        let logFinal = "";

        try {
            const respuesta = await fetch(API_SUBIR_URL, {
                method: "POST",
                body: formData,
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                // Error general de la API
                throw new Error(datos.detail || `Error de servidor general.`);
            }

            // COMENTARIO DE INTENCIÓN: Procesar el log detallado que viene del backend
            logFinal = datos.log_detalle.map((entry: any) => 
                `[${entry.estado}] ${entry.nombre}: ${entry.detalle}`
            ).join('\n');
            
            // El mensaje principal de éxito/resumen es el que devuelve el endpoint
            setMensajeSubida(`${datos.mensaje}\n\n--- DETALLE ---\n${logFinal}`);
            setEstadoSubida("exito"); 

        } catch (e: any) {
            setEstadoSubida("error");
            setMensajeSubida(`❌ ERROR CRÍTICO DE CONEXIÓN o SERVIDOR:\n${e.message}`);
        }
        
        setArchivosSeleccionados([]);
        if (inputRef.current) inputRef.current.value = "";
    };

    const puedeSubir = archivosSeleccionados.length > 0 && estadoSubida !== "cargando";
    
    return (
        <div className="max-w-xl mx-auto p-6 bg-[#C0C0C0] border-2 border-t-white border-l-white border-b-black border-r-black font-sans shadow-xl">
            <h2 className="text-xl font-bold text-black mb-4 border-b border-gray-500 pb-2">
                📂 Uploader de Documentos
            </h2>
            
            <div className="mb-4">
                <label className="block text-black font-semibold mb-2">
                    Selecciona archivos (se pueden subir más de 1):
                </label>
                <input
                    ref={inputRef}
                    type="file"
                    multiple 
                    onChange={manejarSeleccionArchivos}
                    className="block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 
                        file:border-2 file:border-t-white file:border-l-white 
                        file:border-b-black file:border-r-black file:text-black file:font-bold 
                        file:cursor-pointer file:bg-[#C0C0C0] hover:file:bg-[#D6D6D6]"
                    accept=".pdf,.docx,.xlsx,.pptx,.txt" 
                />
            </div>
            
            <button
                onClick={iniciarSubida}
                disabled={!puedeSubir}
                className={`w-full px-4 py-2 font-bold text-black text-lg mt-3 
                    ${puedeSubir 
                        ? "bg-[#008080] border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white cursor-pointer text-white" 
                        : "bg-gray-400 border-2 border-t-gray-500 border-l-gray-500 border-b-gray-700 border-r-gray-700 cursor-not-allowed text-gray-700"
                    }`}
            >
                {estadoSubida === "cargando" ? "Indexando Documentos..." : "Subir Documento(s)"}
            </button>

            {(estadoSubida === "cargando" || mensajeSubida) && (
                <div className={`mt-4 p-3 font-mono text-sm whitespace-pre-wrap text-black ${estadoSubida === "error" ? "bg-red-200" : estadoSubida === "exito" ? "bg-green-200" : "bg-yellow-200"} border-2 border-t-black border-l-black border-b-white border-r-white`}>
                    {mensajeSubida}
                </div>
            )}
        </div>
    );
};