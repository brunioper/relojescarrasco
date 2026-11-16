#!/usr/bin/env bash
# Corre en tu máquina las mismas verificaciones rápidas que el CI
# (linter, tipos y tests unitarios) antes de subir cambios.
#
# Uso: scripts/verificar.sh
# Las pruebas de base de datos y de navegador corren en GitHub Actions
# (necesitan Docker); ver .github/workflows/ci.yml.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "1/3 Linter…";            npm run lint
echo "2/3 Tipos…";             npm run typecheck
echo "3/3 Tests unitarios…";   npm test

echo
echo "Todo en verde. Para publicar: subí la rama, abrí un PR y esperá el CI."
