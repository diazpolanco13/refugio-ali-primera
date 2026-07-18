---
name: importar-excel-censo
description: Importa Excel de censo externo a Importaciones Excel con verificación Nexus por cédula y flags SIIPOL/seguridad. Usar cuando el usuario pida importar excel, importar censo, verificar planilla, o pase un .xlsx para cargar personas.
---

# Importar Excel Censo

## Cuándo usar

Usar si usuario pide importar un `.xlsx` de censo, relaciones externas, SIIPOL, solicitados, registros policiales, o una planilla de campamento.

## Entrada esperada

- Archivo `.xlsx` accesible en VPS, preferido `/tmp/<archivo>.xlsx`.
- Si planilla es de un solo campamento, pedir o inferir `--centro-id`.
- Credenciales en entorno: `NEXUS_SCRIPT_EMAIL` y `NEXUS_SCRIPT_PASSWORD`.
- `.env` del repo con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y opcional `VITE_NEXUS_GATEWAY_URL`.

## Comando base

Siempre ejecutar primero dry-run:

```bash
python3 scripts/importar_excel_censo.py \
  --archivo /tmp/ARCHIVO.xlsx \
  --centro-id centro-XX \
  --con-nexus \
  --concurrency 5 \
  --dry-run
```

Aplicar solo después de mostrar resumen al usuario y recibir confirmación explícita:

```bash
python3 scripts/importar_excel_censo.py \
  --archivo /tmp/ARCHIVO.xlsx \
  --centro-id centro-XX \
  --con-nexus \
  --concurrency 5 \
  --aplicar
```

Si Excel trae columna de campamento por fila:

```bash
python3 scripts/importar_excel_censo.py \
  --archivo /tmp/ARCHIVO.xlsx \
  --col-centro "Campamento" \
  --con-nexus \
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
3. Ejecutar dry-run con `--con-nexus`.
   - usar calibración validada `--concurrency 5`: máximo 5 en vuelo y arranques
     escalonados a una solicitud cada 200 ms;
   - nunca aumentar sobre 5 sin prueba controlada y autorización del usuario.
4. Reportar:
   - `filas_leidas`, `listas`, `con_cedula`, `sin_cedula`;
   - `nexus_ya_verificadas_unicas`, `nexus_consultadas`,
     `nexus_verificadas_nuevas`, `nexus_error`;
   - `solicitados`, `registro_policial`;
   - errores de centro/nombre y muestra.
5. Preguntar confirmación antes de `--aplicar`.
6. Ejecutar `--aplicar`.
7. Verificar vista Importaciones Excel: filtros Solicitados / Con reg. policial.

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

Seguridad:

- `Tiene Registro Policial`, `Registro Policial`, `Con reg. policial` → `registro_policial`
- `Está Solicitado`, `Solicitado`, `Requerido` → `solicitado`
- Texto SIIPOL con `se encuentra solicitado` / `solicitado por` /
  `persona extraviada` / `extraviada(o)` → `solicitado` (denuncia de
  extraviado = búsqueda activa; misma bandeja KPI Solicitados)
- `Firmó contra Presidente`, `Firmo vs Pres.` → `firmo_contra_presidente`
- `Deportado` → `deportado`
- `Tipo de Registro` → `tipo_registro_policial`
- `Observaciones` / `Información de interés` → `observaciones_seguridad`

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
