import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import os
import tempfile 
import shutil 
import hashlib 

from procesador_documentos import ProcesadorDocumentos
from solr_cliente import SolrCliente

# ===================================================================
# FUNCIÓN AUXILIAR DE HASHING (Clean Code: fuera de la clase principal)
# ===================================================================
def generar_hash_contenido(contenido: str) -> str:
    """
    Genera un hash SHA256 del contenido normalizado para comparación.
    """
    if not contenido:
        return ""
    contenido_normalizado = contenido.lower().strip()
    return hashlib.sha256(contenido_normalizado.encode('utf-8')).hexdigest()

# Definición de tipos MIME y extensiones soportadas
MIME_BINARIO_SOPORTADO = [
    'application/pdf', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', # .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', # .pptx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', # .xlsx
]

EXTENSIONES_BINARIAS = ['.pdf', '.docx', '.pptx', '.xlsx', '.txt']

class ServicioCrawler:
    def __init__(self):
        self.procesador = ProcesadorDocumentos()
        self.solr = SolrCliente()
        self.MAX_PROFUNDIDAD = 1 
        self.MAX_LINKS_POR_PAGINA = 10 
        
        self.CARPETA_TEMP = os.path.join(os.getcwd(), 'crawler_temp') 
        os.makedirs(self.CARPETA_TEMP, exist_ok=True)
        print(f"📁 Carpeta temporal para binarios: {self.CARPETA_TEMP}")

    def ejecutar_crawling(self, semillas):
        visitadas = set()
        cola = [] # (url, nivel)
        reporte = {"procesados": 0, "errores": [], "total_encontrados": 0}
        documentos_reindexados = 0 

        for url in semillas:
            cola.append((url, 0))

        headers = {'User-Agent': 'Mozilla/5.0 (Bot Estudiantil)'}

        # CAMBIO CRÍTICO: Eliminar el límite de páginas totales del `while`
        # El ciclo continúa mientras haya elementos en la cola.
        while cola: 
            url_actual, nivel = cola.pop(0)

            # 1. PREVENCIÓN DE DUPLICADOS Y CICLOS (Usando el set 'visitadas')
            if url_actual in visitadas: continue

            # Se añade aquí, justo antes del bloque try, asegurando que si falla,
            # no se intente crawlear de nuevo.
            visitadas.add(url_actual) 

            es_binario = False
            ruta_temp = None
            
            try:
                print(f"🕷 Nivel {nivel} | Crawling: {url_actual}")
                
                resp = requests.get(url_actual, headers=headers, timeout=10, stream=True)
                resp.raise_for_status()
                
                content_type = resp.headers.get('Content-Type', '').split(';')[0].lower()
                
                if content_type in MIME_BINARIO_SOPORTADO or any(url_actual.lower().endswith(ext) for ext in EXTENSIONES_BINARIAS):
                    es_binario = True
                    
                doc_solr = None
                
                if es_binario:
                    # --- RUTA BINARIA ---
                    nombre_archivo = url_actual.split('/')[-1]
                    if '.' not in nombre_archivo:
                        extension_inferida = next((ext for ext in EXTENSIONES_BINARIAS if ext in url_actual.lower()), '.bin')
                        nombre_archivo = f"documento_crawl_{len(visitadas)}{extension_inferida}"

                    extension_con_punto = "." + nombre_archivo.split('.')[-1].lower()
                    
                    ruta_temp = os.path.join(self.CARPETA_TEMP, next(tempfile._get_candidate_names()) + extension_con_punto)
                    
                    print(f"📄 Descargando binario ({extension_con_punto}) a temporal...")

                    with open(ruta_temp, 'wb') as f:
                        shutil.copyfileobj(resp.raw, f)
                    
                    doc_solr = self.procesador.procesar_archivo(ruta_temp, nombre_archivo)
                    
                else:
                    # --- RUTA HTML ---
                    if not ('text/html' in content_type or 'text/plain' in content_type):
                        print(f"🚫 Saltando: {url_actual}. Tipo MIME no compatible para navegación/indexación: {content_type}")
                        continue
                        
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    
                    # 4. EXTRAER LINKS y LIMITAR LA AMPLITUD
                    if nivel < self.MAX_PROFUNDIDAD:
                        nuevos_links = self._extraer_links_del_html(soup, url_actual)
                        
                        # FILTRO CRÍTICO DE AMPLITUD: Tomamos solo los primeros 10
                        for link in nuevos_links[:self.MAX_LINKS_POR_PAGINA]: 
                            # Solo agregamos a la cola si NO ha sido visitado antes
                            if link not in visitadas: 
                                cola.append((link, nivel + 1))
                                
                    # 5. GENERAR DOCUMENTO SOLR
                    doc_solr = self.procesador.procesar_html_descargado(
                        html_content=resp.text,
                        url_origen=url_actual
                    )
                
                
                # 6. LÓGICA DE REINDEXACIÓN CONDICIONAL (DEDUPING)
                if doc_solr and 'contenido' in doc_solr:
                    contenido_nuevo = doc_solr['contenido']
                    hash_nuevo = generar_hash_contenido(contenido_nuevo)
                    
                    doc_viejo = self.solr.obtener_hash_existente(url_actual) 
                    
                    debe_reindexar = True
                    
                    if doc_viejo and doc_viejo.get('hash_contenido'):
                        hash_viejo = doc_viejo['hash_contenido']
                        
                        if hash_nuevo == hash_viejo:
                            print(f"🔄 Saltando: {url_actual}. El contenido no ha cambiado.")
                            debe_reindexar = False
                        else:
                            print(f"⚠️ Reindexando: {url_actual}. Contenido modificado.")
                            
                    elif doc_viejo:
                        print(f"⚠️ Reindexando: {url_actual}. Documento existe, pero no tiene hash anterior.")

                    if debe_reindexar:
                        doc_solr['hash_contenido'] = hash_nuevo 
                        self.solr.indexar_documento(doc_solr)
                        reporte["procesados"] += 1
                        documentos_reindexados += 1 
                
            except Exception as e:
                msg = f"Error en {url_actual}: {str(e)}"
                print(f"❌ {msg}")
                reporte["errores"].append(msg)
            finally:
                if ruta_temp and os.path.exists(ruta_temp):
                    os.remove(ruta_temp) 
                    
        # CONSTRUIR SUGERENCIAS SOLO SI HUBO CAMBIOS
        if documentos_reindexados > 0:
            print(f"✅ Se reindexaron {documentos_reindexados} documentos. Actualizando Suggester.")
            self.solr.construir_sugerencias()
        else:
            print("💤 No hubo cambios en el índice. Suggester no actualizado.")

        reporte["total_encontrados"] = len(visitadas)
        return reporte

    def _extraer_links_del_html(self, soup, url_base):
        # ... (La lógica se mantiene igual) ...
        links = []
        dominio_base = urlparse(url_base).netloc

        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            url_absoluta = urljoin(url_base, href).split('#')[0]
            
            parsed = urlparse(url_absoluta)
            
            if parsed.scheme in ['http', 'https'] and parsed.netloc == dominio_base:
                links.append(url_absoluta)
        
        return list(set(links))