README DE COMPILACIÓN — Documentación de la migración a TypeScript
====================================================================

Proyecto: Finanzas del hogar
Documento: documentacion_migracion.tex
Fecha: 09/11/2026

1. DEPENDENCIAS VENDORIZADAS
----------------------------

1.1 IEEEtran (clase y estilo bibliográfico)
  Archivo: texmf/tex/latex/ieeetran/IEEEtran.cls
  Versión: V1.8b (2015/08/26)
  URL CTAN: https://mirrors.ctan.org/macros/latex/contrib/IEEEtran/IEEEtran.cls

  Archivo: texmf/tex/latex/ieeetran/IEEEtran.bst
  Versión: V1.14 (2015/08/26)
  URL CTAN: https://mirrors.ctan.org/macros/latex/contrib/IEEEtran/bibtex/IEEEtran.bst

1.2 babel-spanish
  Archivos: texmf/tex/generic/babel-spanish/spanish.ldf
            texmf/tex/generic/babel-spanish/romanidx.sty
  Origen: paquete CTAN babel-contrib/spanish (zip con fecha 2021-05-27)
  URL CTAN: https://mirrors.ctan.org/macros/latex/contrib/babel-contrib/spanish.zip
  Nota: el archivo spanish.ldf NO se distribuye precompilado en el zip;
        se generó con:  latex -interaction=nonstopmode spanish.ins

1.3 PlantUML (no versionado por tamaño)
  Archivo: herramientas/plantuml.jar (22 MB, no incluido en el repositorio)
  Versión: 1.2024.7
  URL Maven: https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2024.7/plantuml-1.2024.7.jar
  SHA-256: cb42e3272fedecc0ed20ee0c9cef31873d1c42a489043971038631d357f467e6
  Descarga reproducible: bash herramientas/descargar_plantuml.sh

2. RENDER DE DIAGRAMAS
----------------------

2.1 Por qué no se usa `-tpdf`
  PlantUML 1.2024.7 (jar de Maven) no incluye las clases de Apache Batik
  (org.apache.batik.apps.rasterizer.SVGConverter). Por eso `-tpdf` falla con
  ClassNotFoundException. El pipeline adoptado es:
      .puml -> SVG (PlantUML) -> PDF vectorial (LibreOffice)
  LibreOffice conserva los trazados vectoriales; se verificó que los PDF
  resultantes no contienen imágenes raster embebidas.

2.2 Versión de LibreOffice usada
  LibreOffice 24.2.7.2 420(Build:2)

2.3 Comandos exactos por figura (sin comodines)
  Se ejecutan desde la raíz del repositorio. El directorio /tmp/opencode/svg
  debe existir:  mkdir -p /tmp/opencode/svg figuras/pdf

  --- Fig. 1a: casos de uso, operaciones financieras ---
  java -jar herramientas/plantuml.jar -tsvg -o /tmp/opencode/svg figuras/plantuml/casos-uso-financiero.puml
  soffice --headless --convert-to pdf --outdir figuras/pdf /tmp/opencode/svg/casos-uso-financiero.svg
  pdfimages -list figuras/pdf/casos-uso-financiero.pdf

  --- Fig. 1b: casos de uso, hogar y usuarios ---
  java -jar herramientas/plantuml.jar -tsvg -o /tmp/opencode/svg figuras/plantuml/casos-uso-hogar.puml
  soffice --headless --convert-to pdf --outdir figuras/pdf /tmp/opencode/svg/casos-uso-hogar.svg
  pdfimages -list figuras/pdf/casos-uso-hogar.pdf

  --- Fig. 2: componentes ---
  java -jar herramientas/plantuml.jar -tsvg -o /tmp/opencode/svg figuras/plantuml/componentes.puml
  soffice --headless --convert-to pdf --outdir figuras/pdf /tmp/opencode/svg/componentes.svg
  pdfimages -list figuras/pdf/componentes.pdf

  --- Fig. 3: secuencia, registrar gasto ---
  java -jar herramientas/plantuml.jar -tsvg -o /tmp/opencode/svg figuras/plantuml/secuencia-registrar-gasto.puml
  soffice --headless --convert-to pdf --outdir figuras/pdf /tmp/opencode/svg/secuencia-registrar-gasto.svg
  pdfimages -list figuras/pdf/secuencia-registrar-gasto.pdf

  --- Fig. 4: colaboración, registrar gasto ---
  java -jar herramientas/plantuml.jar -tsvg -o /tmp/opencode/svg figuras/plantuml/colaboracion-registrar-gasto.puml
  soffice --headless --convert-to pdf --outdir figuras/pdf /tmp/opencode/svg/colaboracion-registrar-gasto.svg
  pdfimages -list figuras/pdf/colaboracion-registrar-gasto.pdf

  --- Fig. 5a: clases, dominio financiero ---
  java -jar herramientas/plantuml.jar -tsvg -o /tmp/opencode/svg figuras/plantuml/clases-dominio-financiero.puml
  soffice --headless --convert-to pdf --outdir figuras/pdf /tmp/opencode/svg/clases-dominio-financiero.svg
  pdfimages -list figuras/pdf/clases-dominio-financiero.pdf

  --- Fig. 5b: clases, usuarios y hogar ---
  java -jar herramientas/plantuml.jar -tsvg -o /tmp/opencode/svg figuras/plantuml/clases-usuarios-hogar.puml
  soffice --headless --convert-to pdf --outdir figuras/pdf /tmp/opencode/svg/clases-usuarios-hogar.svg
  pdfimages -list figuras/pdf/clases-usuarios-hogar.pdf

2.4 Verificación de vectorialidad
  `pdfimages -list <archivo>.pdf` debe imprimir la cabecera y NINGUNA fila de
  imagen. Resultado registrado el 09/11/2026 para las siete figuras:

  figuras/pdf/casos-uso-financiero.pdf         0 imágenes embebidas
  figuras/pdf/casos-uso-hogar.pdf              0 imágenes embebidas
  figuras/pdf/componentes.pdf                  0 imágenes embebidas
  figuras/pdf/secuencia-registrar-gasto.pdf    0 imágenes embebidas
  figuras/pdf/colaboracion-registrar-gasto.pdf 0 imágenes embebidas
  figuras/pdf/clases-dominio-financiero.pdf    0 imágenes embebidas
  figuras/pdf/clases-usuarios-hogar.pdf        0 imágenes embebidas

  Comprobación de páginas: `pdfinfo <archivo>.pdf` debe reportar 1 página.

2.5 Alternativas si LibreOffice falla
  Si `soffice --convert-to pdf` no está disponible o falla, usar cualquiera
  de estos conversores SVG -> PDF y mantener el mismo nombre de salida:
      rsvg-convert -f pdf -o figuras/pdf/<figura>.pdf /tmp/opencode/svg/<figura>.svg
      inkscape /tmp/opencode/svg/<figura>.svg --export-filename=figuras/pdf/<figura>.pdf
  En ambos casos repetir la verificación con `pdfimages -list`. No se debe
  sustituir por una captura PNG: el artículo exige figuras vectoriales.

2.6 Vista previa para revisión visual (opcional)
  java -jar herramientas/plantuml.jar -tpng -o /tmp/opencode/preview figuras/plantuml/<figura>.puml
  Los PNG son solo para inspección; no se incluyen en el PDF del artículo.

2.7 Inserción en el artículo (solo PDF vectorial)
  Fig. 1a/1b y Fig. 5a/5b: figure* con dos subfigure de 0.48\linewidth;
    \includegraphics[width=\linewidth] en cada subfigura.
  Fig. 2, 3 y 4: figure* con \includegraphics[width=\textwidth].
  No se usa \resizebox ni rotación.

  TABLA: Tamaño tipográfico efectivo por figura
  (alto de glifo nativo 14.3 pt escalado al ancho de inserción)
  +--------+----------------------+------------------+
  | Figura | Ancho de inserción   | Tamaño efectivo  |
  +--------+----------------------+------------------+
  | 1a     | 0.48\textwidth       | 8.3 pt           |
  | 1b     | 0.48\textwidth       | 8.3 pt           |
  | 2      | \textwidth           | 6.4 pt           |
  | 3      | \textwidth           | 5.7 pt           |
  | 4      | \textwidth           | 5.0 pt           |
  | 5a     | 0.48\textwidth       | 7.3 pt           |
  | 5b     | 0.48\textwidth       | 10.0 pt          |
  +--------+----------------------+------------------+

  Las Fig. 3 y 4 quedan por debajo de 7 pt porque su relación de aspecto
  (1.30:1 y 4.36:1) agota el ancho de página. Se aceptó conscientemente
  ese tamaño: son diagramas de alta densidad cuya lectura plena depende
  del zoom en la versión digital. No se regeneran ni se rotan.

3. COMPILACIÓN DEL DOCUMENTO
----------------------------

  export TEXINPUTS="$PWD/texmf//:"
  export BSTINPUTS="$PWD/texmf//:"

  pdflatex -interaction=nonstopmode documentacion_migracion.tex
  bibtex documentacion_migracion
  pdflatex -interaction=nonstopmode documentacion_migracion.tex
  pdflatex -interaction=nonstopmode documentacion_migracion.tex

  DECISIÓN DE BIBLIOGRAFÍA (Opción A): se migró a BibTeX. `referencias.bib`
  es la fuente de las nueve entradas y alimenta la compilación mediante
  \bibliographystyle{IEEEtran} + \bibliography{referencias}. El ciclo
  pdflatex -> bibtex -> pdflatex x2 produce 0 referencias indefinidas y las
  nueve entradas. Se eligió esta opción porque conserva el .bib funcional y
  es más defendible académicamente; el encabezado de la sección se fuerza a
  «Referencias» con \renewcommand{\refname}{Referencias}.

  Nota: latexmk no está instalado en el entorno; el ciclo anterior es su
  equivalente. Si se instala, puede usarse:
      latexmk -pdf -interaction=nonstopmode documentacion_migracion.tex

3.1 Parche de fuentes del IEEEtran vendorizado
  IEEEtran.cls (V1.8b, CTAN) fue modificado localmente en las líneas 495 y
  4595 para sustituir ptm (Times) por cmr (Computer Modern) debido a la
  ausencia de fuentes ptm en el entorno de compilación. El resultado conserva
  la estructura IEEEtran pero no la tipografía Times estándar de IEEE.

  El entorno no incluye el paquete psnfss completo (no existen ptmr7t.tfm ni
  ptmri7t.tfm). El parche exacto, reproducible desde la raíz del repositorio,
  es:
      sed -i '495s/{ptm}/{cmr}/' texmf/tex/latex/ieeetran/IEEEtran.cls
      sed -i '4595s/{ptm}/{cmr}/' texmf/tex/latex/ieeetran/IEEEtran.cls
  Además, el preámbulo del .tex fuerza cmr/cmss/cmtt y redefine
  \@IEEESAVESTATEfontfamily. El PDF resultante usa Computer Modern Type 1;
  `pdffonts documentacion_migracion.pdf` muestra solo fuentes Type 1.

  Alternativa si se exige apariencia IEEE estricta (Times): vendorizar las
  fuentes ptm en texmf/ y revertir el parche. No se aplicó por iniciativa
  propia; requiere confirmación del autor.

4. SALIDAS
----------
  documentacion_migracion.pdf   (PDF final, 11 páginas: artículo completo + anexo)
  documentacion_migracion.aux   (auxiliar, regenerable)
  documentacion_migracion.log   (registro de compilación; 0 overfull)
