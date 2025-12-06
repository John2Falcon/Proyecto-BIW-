from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import shutil
from typing import List, Optional
from fastapi.responses import FileResponse
from fastapi import HTTPException

# --- CAPA DE DOMINIO / SERVICIOS (Clean Architecture) ---
from solr_cliente import SolrCliente
from procesador_documentos import ProcesadorDocumentos
from gestor_semillas import GestorSemillas
from crawler import ServicioCrawler

app = FastAPI(title="Buscador Backend - API de Recuperación")

CARPETA_DESCARGAS = "archivos_subidos"

# Asegurar que la carpeta exista al iniciar la app
os.makedirs(CARPETA_DESCARGAS, exist_ok=True)

# --- INYECCIÓN DE DEPENDENCIAS ---
solr = SolrCliente()
procesador = ProcesadorDocumentos()
gestor_semillas = GestorSemillas()
crawler = ServicioCrawler()

CARPETA_UPLOADS = "archivos_subidos"
os.makedirs(CARPETA_UPLOADS, exist_ok=True)

# Configuración CORS (Permitir acceso desde Astro)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE TRANSFERENCIA DE DATOS (DTOs) ---

class BusquedaRequest(BaseModel):
    """
    Define el contrato estricto de búsqueda.
    Nota: No incluimos 'pagina' ni 'rows' porque la estrategia 
    es recuperar un bloque fijo de 500 resultados (Client-Side Pagination).
    """
    query: str
    categorias: List[str] = Field(default_factory=list) 
    extensiones: List[str] = Field(default_factory=list)
    orden: str = "ninguno"
    pagina: int
    rows: int


class UrlRequest(BaseModel):
    url: str

class ListaUrlsRequest(BaseModel):
    urls: List[str]

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {"estado": "Sistema de Recuperación Online", "motor": "Apache Solr"}

@app.post("/buscar")
def buscar_documentos(req: BusquedaRequest):
    print(f"🔍 Procesando consulta: '{req.query}'")
    # 1. Adaptación de Filtros
    filtros_activos = {}
    if req.categorias:
        filtros_activos['categorias'] = req.categorias
    if req.extensiones:
        filtros_activos['extensiones'] = req.extensiones
    
    print(req.categorias)
    print(req.extensiones)
    print(req.orden)
    
    filtros_finales = filtros_activos if filtros_activos else None

    # --- CORRECCIÓN AQUÍ ---
    # 2. Adaptación del Ordenamiento (Sanitización)
    # Solr no entiende "ninguno". Si llega eso, enviamos None para que ordene por score.
    orden_solr = None
    
    if req.orden and req.orden != "ninguno":
        # Aquí podrías mapear otros valores amigables si quisieras
        # ej: if req.orden == "antiguos": orden_solr = "fecha_creacion asc"
        orden_solr = req.orden

    # 3. Llamada al Servicio de Solr
    respuesta = solr.buscar(
        query=req.query, 
        filtros=filtros_finales, 
        orden=orden_solr, # <--- Pasamos la variable limpia, no req.orden directo
        pagina=req.pagina, 
        rows_por_pagina=req.rows
    )
    return respuesta

# --- GESTIÓN DE CRAWLER Y SEMILLAS ---

@app.get("/urls")
def obtener_semillas():
    return gestor_semillas.obtener_urls()

@app.post("/urls")
def guardar_semillas(item: ListaUrlsRequest):
    resultado = gestor_semillas.guardar_urls(item.urls)
    if not resultado["exito"]:
        raise HTTPException(status_code=400, detail=resultado)
    return {"mensaje": "Semillas actualizadas", "urls": gestor_semillas.obtener_urls()}

@app.post("/crawler")
def ejecutar_crawler():
    urls = gestor_semillas.obtener_urls()
    if not urls:
        raise HTTPException(status_code=400, detail="No hay URLs semilla definidas.")
    
    reporte = crawler.ejecutar_crawling(urls)
    return {"mensaje": "Ciclo de crawling finalizado", "detalles": reporte}

# --- INGESTA DE DOCUMENTOS (ETL) ---

@app.get("/sugerencias")
def obtener_sugerencias(q: str):
    """
    Proxy directo al componente Suggester de Solr.
    Ideal para el autocompletado del SearchBox.
    """
    if not q: 
        return {"suggestions": []}
    sugerencias = solr.obtener_sugerencias(q)
    print(sugerencias)
    return sugerencias

@app.post("/subir")
async def subir_archivos_en_lote(files: List[UploadFile] = File(...)):
    
    logs_respuesta = []
    archivos_indexados_con_exito = 0

    # La carpeta CARPETA_UPLOADS es ahora la carpeta permanente
    
    for file in files:
        ruta_archivo = os.path.join(CARPETA_UPLOADS, file.filename)
        log_entry = {"nombre": file.filename, "estado": "FALLÓ", "detalle": ""}
        
        # Bandera de control CRÍTICA: Asumimos que debemos borrar si la ejecución del try falla.
        # Si el try es exitoso, la bandera se pondrá en False.
        debe_borrar_archivo = True 
        
        try:
            # 1. 🔑 Guardar el archivo directamente en la carpeta permanente (CARPETA_UPLOADS)
            # Esto simplifica la lógica, ya que la carpeta /archivos_subidos ahora tiene doble función.
            with open(ruta_archivo, "wb") as buffer:
                buffer.write(await file.read()) 
            
            # 2. Procesamiento (Extracción de Texto + Metadatos)
            # Nota: Si su procesador usa lógica de hash, debe estar aquí.
            doc_procesado = procesador.procesar_archivo(ruta_archivo, file.filename)
            
            # 3. Indexación en Solr
            # Su lógica de deduplicación con hash iría aquí antes de indexar.
            solr.indexar_documento(doc_procesado)
            
            # 4. ÉXITO: Marcamos el estado como exitoso y evitamos el borrado.
            archivos_indexados_con_exito += 1
            log_entry = {"nombre": file.filename, "estado": "ÉXITO", "detalle": "Documento indexado y guardado permanentemente."}
            
            # 🔑 CRÍTICO: Desactivamos el borrado, el archivo se queda.
            debe_borrar_archivo = False 
            
        except Exception as e:
            # Captura y registra el error para este archivo, pero no detiene el lote
            log_entry["detalle"] = f"Error procesando: {str(e)}"
            # La bandera 'debe_borrar_archivo' sigue en True (su valor inicial)
            
        finally:
            # 5. 🔑 CONTROL DE PERSISTENCIA (Clean Code)
            # Borra el archivo SOLO si hubo un error (debe_borrar_archivo=True) 
            # Y si el archivo físico llegó a guardarse (os.path.exists).
            if debe_borrar_archivo and os.path.exists(ruta_archivo):
                os.remove(ruta_archivo)
                log_entry["detalle"] += " -> Archivo eliminado por error."
            
        logs_respuesta.append(log_entry)

    # 6. Construir sugerencias solo una vez, al finalizar el lote.
    if archivos_indexados_con_exito > 0:
        solr.construir_sugerencias()
        
    return {
        "mensaje": f"Proceso finalizado. {archivos_indexados_con_exito} documento(s) indexado(s).",
        "log_detalle": logs_respuesta
    }

# --- ENDPOINT /descargas (Permanece igual y funciona con la carpeta CARPETA_UPLOADS) ---

@app.get("/descargas/{nombre_archivo}")
async def descargar_archivo(nombre_archivo: str):
    print(nombre_archivo)
    # La carpeta CARPETA_UPLOADS fue renombrada a CARPETA_DESCARGAS_PERMANENTE
    ruta_archivo = os.path.join(CARPETA_UPLOADS, nombre_archivo) # O CARPETA_DESCARGAS_PERMANENTE
    
    if not os.path.exists(ruta_archivo):
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado en el servidor: {nombre_archivo}")
    
    return FileResponse(
        path=ruta_archivo, 
        filename=nombre_archivo, 
        media_type='application/octet-stream'
    )

@app.delete("/limpiar")
def limpiar_indice():
    """
    Endpoint destructivo.
    1. Borra todo el índice de Solr.
    2. Borra todos los archivos subidos físicamente del disco.
    """
    
    # 1. Limpiar el índice de Solr
    exito = solr.eliminar_todo()
    
    if not exito:
        raise HTTPException(status_code=500, detail="No se pudo limpiar el índice en Solr")
    
    # --- 🔑 2. Limpiar la carpeta física de archivos subidos ---
    try:
        # Recorrer todos los elementos dentro de la carpeta
        for elemento in os.listdir(CARPETA_UPLOADS):
            ruta_completa = os.path.join(CARPETA_UPLOADS, elemento)
            if os.path.isfile(ruta_completa) or os.path.islink(ruta_completa):
                os.unlink(ruta_completa) # Borrar archivos y enlaces simbólicos
            elif os.path.isdir(ruta_completa):
                # Opcional: Si hubiera subdirectorios, borrarlos recursivamente
                shutil.rmtree(ruta_completa) 

    except Exception as e:
        # Si la limpieza del disco falla, lo registramos pero aún informamos que Solr se limpió
        print(f"⚠️ Advertencia: Falló la limpieza de archivos en disco: {e}")
        return {
            "mensaje": "Índice de Solr eliminado, pero la limpieza de archivos en disco falló.",
            "detalle_disco": str(e)
        }
    
    return {
        "mensaje": "✅ Índice y archivos subidos eliminados correctamente. El sistema está limpio."
    }