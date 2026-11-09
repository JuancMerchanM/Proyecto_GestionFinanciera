#!/usr/bin/env bash
# Descarga PlantUML 1.2024.7 (22 MB) en herramientas/plantuml.jar.
# No se versiona el binario porque supera el umbral de ~5 MB.
set -euo pipefail
cd "$(dirname "$0")"

URL="https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2024.7/plantuml-1.2024.7.jar"
SHA256="cb42e3272fedecc0ed20ee0c9cef31873d1c42a489043971038631d357f467e6"

if [ -f plantuml.jar ] && echo "$SHA256  plantuml.jar" | sha256sum -c - >/dev/null 2>&1; then
  echo "PlantUML ya disponible y verificado."
  exit 0
fi

echo "Descargando PlantUML 1.2024.7..."
curl -fL -o plantuml.jar "$URL"
echo "$SHA256  plantuml.jar" | sha256sum -c -
echo "Listo: herramientas/plantuml.jar"
