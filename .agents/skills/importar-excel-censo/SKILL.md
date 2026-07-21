---
name: importar-excel-censo
description: Importa Excel de censo externo a Importaciones Excel con verificación Nexus por cédula y flags SIIPOL/seguridad. Usar cuando el usuario pida importar excel, importar censo, verificar planilla, o pase un .xlsx para cargar personas.
---

# Importar Excel Censo

## Cuándo usar

Usar si usuario pide importar un `.xlsx` de censo, relaciones externas, SIIPOL, solicitados, registros policiales, o una planilla de campamento.

## Entrada esperada

- Archivo `.xlsx` accesible en VPS, preferido `tmp/<archivo>.xlsx` dentro del
  proyecto o `/tmp/<archivo>.xlsx`.
- Si planilla es de un solo campamento, pedir o inferir `--centro-id`.
- Credenciales en entorno: `NEXUS_SCRIPT_EMAIL` y `NEXUS_SCRIPT_PASSWORD`.
- `.env` del repo con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y opcional `VITE_NEXUS_GATEWAY_URL`.

## Flujo de comandos

Siempre ejecutar primero un dry-run **local, sin Nexus**. Valida hoja,
encabezados, nombres, campamentos y flags antes de gastar consultas:

```bash
python3 scripts/importar_excel_censo.py \
  --archivo "tmp/ARCHIVO.xlsx" \
  --dry-run
```

Si `errores_match = 0`, ejecutar segundo dry-run con Nexus:

```bash
python3 scripts/importar_excel_censo.py \
  --archivo "tmp/ARCHIVO.xlsx" \
  --con-nexus \
  --concurrency 5 \
  --timeout-nexus 20 \
  --dry-run
```

Aplicar solo después de mostrar resumen y recibir confirmación explícita:

```bash
python3 scripts/importar_excel_censo.py \
  --archivo "tmp/ARCHIVO.xlsx" \
  --con-nexus \
  --solo-cache-nexus \
  --aplicar
```

`--solo-cache-nexus` es obligatorio en la aplicación inmediatamente posterior
al dry-run Nexus: reutiliza verificaciones guardadas y evita repetir cédulas
que ya devolvieron 404. Esas filas conservan datos del Excel.

El script bloquea `--aplicar` si hay filas inválidas, campamentos inexistentes
o inactivos. `--permitir-omisiones` habilita importación parcial; usarlo solo
con aprobación explícita después de informar cantidades y causas.

**Dato político (referéndum / militancia):** nunca se importa.
`firmo_contra_presidente` siempre queda `false`. Columnas `Firmó contra el
Gob.` / texto de firma / `Milita oposición` / afiliación (PJ, Vente) se
ignoran y se limpian de `observaciones_seguridad` (se conservan solo
solicitado, reg. policial y deportado). `--omitir-firmo-presidente` es
legado no-op.

## Archivos consolidados

- El script busca automáticamente, entre todas las hojas, la primera con
  encabezados reales de censo. Ignora hojas de resumen.
- Si hay columna `Campamento`, resuelve cada fila por nombre contra centros
  reales, incluyendo detección explícita de centros inactivos.
- No pasar `--centro-id` a un consolidado: mezclaría toda la red en un centro.
- `Nombre completo` se separa como 2 nombres + apellidos cuando hay 4+ tokens;
  Nexus reemplaza identidad cuando existe cédula verificable.
- Filas sin nombre recuperable se omiten y deben quedar en
  `errores_por_tipo.sin_nombre`.
- Cédulas repetidas se consultan una sola vez en Nexus y se reportan como
  `documentos_repetidos`.

Si Excel de una sola hoja trae columna de campamento por fila y el encabezado
no usa un alias conocido:

```bash
python3 scripts/importar_excel_censo.py \
  --archivo "tmp/ARCHIVO.xlsx" \
  --col-centro "Campamento" \
  --dry-run
```

## Flujo obligatorio

1. Confirmar que archivo existe y es `.xlsx`.
2. Resolver campamento:
   - **Preferir `--col-centro`** si Excel trae columna Campamento (match
     por nombre → id real). El `N.°` de la UI **no siempre** = `centro-NN`
     (ej. N.° 32 Mamá Rosa = `centro-36`; `centro-32` = Andrés Bello).
   - Solo usar `--centro-id` tras verificar en BD nombre+nro del id;
     no asumir por número del id.
3. Ejecutar dry-run local sin Nexus. Debe mostrar hoja elegida, filas,
   campamentos sin resolver/inactivos y nombres inválidos.
4. Solo si matching está limpio, ejecutar dry-run con `--con-nexus`.
   - usar calibración validada `--concurrency 5`: máximo 5 en vuelo y arranques
     escalonados a una solicitud cada 200 ms;
   - nunca aumentar sobre 5 sin prueba controlada y autorización del usuario.
   - el script emite progreso cada 10 respuestas o 10 segundos;
   - cada petición corta según `--timeout-nexus` (20 s recomendado).
5. Reportar:
   - `filas_leidas`, `listas`, `con_cedula`, `sin_cedula`;
   - `documentos_repetidos`, `errores_por_tipo`, `centros_con_error`;
   - `nexus_ya_verificadas_unicas`, `nexus_consultadas`,
     `nexus_verificadas_nuevas`, `nexus_error`,
     `nexus_omitidas_solo_cache`;
   - `solicitados`, `registro_policial`;
   - `verificados_siipol`;
   - columnas sensibles ignoradas (referéndum / militancia).
6. Si hay errores, corregirlos o pedir aprobación explícita para importación
   parcial con `--permitir-omisiones`.
7. Preguntar confirmación antes de `--aplicar`.
8. Ejecutar `--aplicar`.
9. Verificar vista Importaciones Excel: filtros Solicitados / Con reg. policial.

## Mapeo

Identidad:

- Si persona tiene cédula `V` o `E`, Nexus manda nombres, edad, sexo y teléfono si falta.
- Antes de cualquier petición, consultar `nexus_consultas` por `letra + cedula`.
- Si existe ficha válida en `nexus_consultas`, reutilizarla y **no llamar Nexus**.
- Deduplicar cédulas del mismo Excel: una cédula genera como máximo una petición.
- Toda respuesta Nexus exitosa se guarda en `nexus_consultas`, incluso durante
  dry-run; así `--aplicar` reutiliza la ficha y no repite la consulta.
- Si Nexus falla, usar datos del Excel y reportar en `nexus_errores`.
- Nunca inventar cédulas ni nombres.

Verificación SIIPOL:

- La fuente autoritativa es una lista explícita de personas enviadas a SIIPOL,
  no una planilla general de censo ni la verificación Nexus.
- Ejecutar primero:

  ```bash
  python3 scripts/importar_excel_censo.py \
    --archivo "tmp/LISTA-SIIPOL.xlsx" \
    --reconciliar-siipol \
    --dry-run
  ```

- Tras confirmación explícita:

  ```bash
  python3 scripts/importar_excel_censo.py \
    --archivo "tmp/LISTA-SIIPOL.xlsx" \
    --reconciliar-siipol \
    --aplicar
  ```

- `censo_reconciliar_siipol` reemplaza el estado previo: solo documentos
  presentes quedan `verificado_siipol = true`.
- Filas sin documento quedan pendientes; no hacer matching por nombre por
  riesgo de homónimos.
- Importaciones generales futuras no cambian la marca SIIPOL.
- Nexus verifica identidad; **no** equivale a verificación SIIPOL.
- **Nunca reimportar el mismo archivo** para hacer backfill: filas sin cédula
  no tienen clave única y se duplicarían.

Seguridad:

- `Tiene Registro Policial`, `Registro Policial`, `Reg. policial`,
  `Con reg. policial` → `registro_policial`
- `Está Solicitado`, `Solicitado`, `Requerido` → `solicitado`
- Texto SIIPOL con `se encuentra solicitado` / `solicitado por` /
  `persona extraviada` / `extraviada(o)` → `solicitado` (denuncia de
  extraviado = búsqueda activa; misma bandeja KPI Solicitados)
- `Firmó contra Presidente`, `Firmo vs Pres.`, `Milita oposición`,
  afiliación política en texto → **ignorados** (scrub; no persisten)
- `Deportado` → `deportado`
- `Tipo de Registro` → `tipo_registro_policial`
- `Descripción (verificación)` / `Observaciones` /
  `Información de interés` → `observaciones_seguridad`

Destino BD:

- Tabla `censo_registros`
- RPC `censo_importar_lote`
- `origen = import_excel`
- `fuente_archivo = nombre del archivo`

## Reglas de seguridad

- No importar `censo_registros` sin dry-run previo. Dry-run puede escribir
  exclusivamente caché de verificaciones en `nexus_consultas`.
- No usar usuario anon; requiere sesión admin/analista.
- No mostrar datos sensibles innecesarios en la respuesta; resumen basta.
- Si aparecen solicitados o registros policiales, informar conteos, no copiar observaciones completas salvo que usuario lo pida.
