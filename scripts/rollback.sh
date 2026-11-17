#!/usr/bin/env bash
# Vuelve producción a la versión anterior (deshace el último deploy).
#
# Uso:
#   scripts/rollback.sh              # vuelve a la versión anterior
#   scripts/rollback.sh <url-deploy> # vuelve a un deploy puntual (ver `vercel ls`)
#
# Requiere haber iniciado sesión con `vercel login` (o VERCEL_TOKEN).
# No toca la base de datos: solo cambia qué versión del sitio está publicada.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Deploys recientes:"
npx --yes vercel@latest ls relojescarrasco 2>/dev/null | head -8 || true
echo

if [ "$#" -ge 1 ]; then
  npx --yes vercel@latest rollback "$1" --yes
else
  npx --yes vercel@latest rollback --yes
fi

echo
echo "Listo. Verificando el sitio en producción…"
SMOKE_BASE_URL="https://www.relojescarrasco.com" npm run test:smoke
