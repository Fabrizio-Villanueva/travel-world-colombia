---
description: Verificar, commitear y poner en línea (push a main → deploy automático de Vercel) el trabajo pendiente del repo.
---

Publica en producción todo el trabajo pendiente de este repositorio. Argumentos opcionales: $ARGUMENTS (si vienen, úsalos como pista para el mensaje del commit).

Sigue este orden y no te saltes pasos:

1. **Revisar qué hay**: `git status --short` y `git diff --stat`. Si no hay cambios, dilo y termina.
2. **Verificar**: `npx tsc --noEmit -p tsconfig.json` y `npx eslint` sobre los archivos cambiados. Si tocaste páginas, layouts o componentes de servidor, corre también `npx next build`. Si algo falla, arréglalo antes de seguir; no publiques con errores.
3. **Migraciones**: si hay un archivo nuevo en `supabase/migrations/` que aún no se aplicó en producción, aplícalo con el MCP de Supabase (proyecto `xedqgagkrtfcbenyimkg`) ANTES del push.
4. **Commit**: un solo commit con mensaje en español, formato `tipo(ámbito): resumen` (feat/fix/perf/chore…), cuerpo con el porqué y qué se verificó, y la línea de atribución de Claude al final. Escribe el mensaje en un archivo del scratchpad y usa `git commit -F <archivo>` (en PowerShell el here-string no entra por stdin). No incluyas archivos temporales (`scripts/_tmp-*`).
5. **Push**: `git push origin main`. Main es la rama de producción: Vercel despliega solo.
6. **Confirmar el deploy**: consulta `gh api repos/Fabrizio-Villanueva/travel-world-colombia/commits/<sha>/status --jq .state` cada 10 s hasta `success` (o `failure`, y entonces revisa el build de Vercel).
7. **Reportar** en 3 a 6 líneas: commit, estado del deploy, qué cambió para el usuario final y qué quedó pendiente. Si hubo migración, dilo.
