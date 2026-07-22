# Nexus Onfalo — integración en Refugios Transitorios

Documentación de la implementación del endpoint institucional **Nexus / Onfalo**
en la herramienta de gestión de campamentos (emergencia Caracas / La Guaira,
24-jun-2026).

Fecha de avance: **09–10 jul 2026**.

---

## Preámbulo — qué queremos hacer y dónde estamos trabados

### El problema en campo

Levantar un censo nominal en un campamento de cientos de personas es lento y
desgastante. Los damnificados ya fueron censados muchas veces (Excel, Word,
otras instituciones); no quieren dictar otra vez nombre, cédula, dirección y
familia. Los funcionarios también están agotados. Gran parte de lo que hoy
está en `censo_registros` (UI: **Importaciones Excel**) vino de importar esas
planillas ajenas vía MCP/scripts, no de un flujo cómodo en la app.

### Qué queremos lograr con este endpoint

Usar Nexus como **atajo de verificación**, no como otro formulario:

1. El censador pide la cédula al jefe de familia (o a la persona).
2. La app consulta Nexus y trae datos básicos (nombres, sexo, edad, nacimiento,
   teléfonos) y, cuando existan, vínculos familiares.
3. **Lo crítico:** mostrar la **foto SAIME** para que el funcionario confirme
   que la cédula corresponde a quien tiene enfrente.
4. Con un botón, registrar a esa persona en la **base nominal** verificada
   (`refugiados` + alojamiento en el campamento).
5. Si es jefe de hogar, crear el hogar identificado por su cédula; luego
   agregar familiares (marcando los que Nexus sugiera o buscando otra cédula
   en secuencia), sin reescribir fichas a mano.

Así el censo pasa de “llenar planilla” a “verificar y confirmar”, y la data
queda donde debe vivir operativamente (nominal), no solo en un staging de
campo.

### Foto SAIME: activa (opción B, 22-jul-2026)

El endpoint `POST …/full/{letra}/{cedula}` devuelve el **nombre** del archivo
de foto (`photoPersons[0].photo.url` → slim `foto_nombre`). La imagen vive en
**MinIO** (`alfa-images`, VPN `10.51.12.85:9000`). El gateway la sirve en
`GET /foto/<filename>` (JWT / secret). La UI `/censo` la muestra al verificar.
Detalle en **§6**.

### Qué sí está listo mientras tanto

VPN + gateway en Dokploy, consulta por cédula, slim para la UI, creación de
hogar en nominal y lista de familiares cuando Nexus los trae. Detalle técnico
abajo.

---

## 1. Contexto técnico del API

La institución SP3/Onfalo brindó acceso a un API interno que, dada una cédula,
devuelve la ficha de la persona (nombres, sexo, edad, fecha de nacimiento,
teléfonos, vínculos familiares cuando existen, metadatos de foto SAIME, etc.).

El DNS `api.onfalo.nexus.ia.ve` **solo resuelve dentro de la VPN** de SP3
(Kratos). Desde Internet público da `NXDOMAIN`. Por eso hace falta un túnel
OpenVPN permanente en el VPS.

---

## 2. Endpoint institucional (fuente)

| Campo | Valor |
|---|---|
| Base URL | `https://api.onfalo.nexus.ia.ve` |
| Método / ruta | `POST /v1/person/search/external/full/{letra}/{cedula}` |
| `letra` | `V` (venezolano), `E` (extranjero), `J` (jurídico) |
| `cedula` | Solo dígitos, sin letra |
| Headers | `X-Api-Key`, `X-Tenant-Id: sp3`, `Content-Type: application/json` |
| Tenant | `sp3` |
| IP interna (VPN) | `10.51.2.21` (resuelto por DNS `10.51.3.220`) |

Credenciales VPN (usuario OpenVPN): ver `vpn.txt` (no versionar en público).
Config `.ovpn`: `kratos-UDP4-59890-Campamentos_sebin-connect-config.ovpn`
(servidor `190.205.115.107:59890` UDP).

La API key vive **solo** en el env del compose Dokploy `nexus-vpn`
(`NEXUS_API_KEY`), nunca en el frontend.

Ejemplo de respuesta completa (cédula de prueba del desarrollador):

- Crudo: `ejemplo_V17089732_full.json`
- Formateado: `ejemplo_V17089732_full.pretty.json`
- Slim (lo que consume la UI de censo): `ejemplo_V17089732_censo_slim.json`

---

## 3. Arquitectura: dónde corre

```
┌─────────────────┐     HTTPS + JWT      ┌──────────────────────────────┐
│  PWA /censo     │ ───────────────────► │  Traefik (Dokploy)            │
│  (navegador)    │  Bearer sesión       │  nexus.m0n1t0r-d3-3v3nt0s.net │
└─────────────────┘                      └──────────────┬───────────────┘
                                                        │ :8080
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │  Contenedor nexus-gateway    │
                                         │  (Alpine + OpenVPN + proxy)  │
                                         │  red: dokploy-network        │
                                         └──────────────┬───────────────┘
                                                        │ VPN tun0
                                                        │ ruta 10.51.0.0/16
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │  api.onfalo.nexus.ia.ve      │
                                         │  (10.51.2.21)                │
                                         └──────────────────────────────┘
```

### Componentes

| Pieza | Dónde | Rol |
|---|---|---|
| Compose **nexus-vpn** | Dokploy, proyecto `refugio-ali-primera`, env `production` | Orquesta el contenedor |
| Contenedor `nexus-gateway` | VPS (mismo host que la PWA) | OpenVPN + proxy HTTP Python |
| Archivos de runtime | Host: `/etc/dokploy/nexus-vpn/` (bind-mount `:ro`) | `client.ovpn`, `entrypoint.sh`, `proxy.py`, `up.sh` |
| Dominio HTTPS | `nexus.m0n1t0r-d3-3v3nt0s.net` (Let's Encrypt vía Dokploy) | Expone el proxy al navegador |
| Frontend | `src/data/reposNexus.ts`, `src/features/censo/CensoNexusPanel.tsx` | UI “Por cédula” en `/censo` |
| Destino de datos | Supabase tablas nominales | Tras “Verificar y crear hogar” |

**ComposeId Dokploy:** `y5vhq15sJ4FjvBNd9_fyn`  
**AppName:** `compose-nexus-vpn-dyztvg`

### Decisiones de seguridad del túnel

El `.ovpn` institucional trae `redirect-gateway def1` (enviaría **todo** el
tráfico del contenedor/VPS por la VPN y tumbaría el servidor). En runtime:

1. Se elimina `redirect-gateway` del cliente.
2. `pull-filter ignore redirect-gateway` y `pull-filter ignore "dhcp-option DNS"`.
3. Solo se añade ruta a **`10.51.0.0/16`** vía el gateway del túnel (`10.0.8.1`).
4. **No** se enruta `10.0.0.0/8` completo (rompe `dokploy-network`, que usa `10.0.1.0/24`).
5. DNS interno: `nameserver 10.51.3.220` en `/etc/resolv.conf` del contenedor.
6. El proxy habla al upstream por **IP fija** `NEXUS_IP=10.51.2.21` + header
   `Host: api.onfalo.nexus.ia.ve` (evita fallos si se pierde el resolv).

---

## 4. Gateway HTTP (`proxy.py`)

Escucha en `:8080` dentro del contenedor.

### Rutas

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| `GET` | `/health` | No | `{"ok":true,"service":"nexus-gateway"}` |
| `POST` | `/v1/person/search/external/full/{V\|E\|J}/{cedula}` | Sí | JSON **completo** del upstream |
| `POST` | `…/full/{letra}/{cedula}/censo` | Sí | JSON **slim** para la UI de censo |

### Autorización (una de dos)

1. **`Authorization: Bearer <JWT de Supabase>`** — valida contra
   `{SUPABASE_URL}/auth/v1/user` con la anon key. Es lo que usa el navegador
   (sesión de login o de QR de terreno).
2. **`X-Gateway-Secret`** — secreto del env Dokploy; para scripts/ops en el VPS.

CORS: orígenes de producción y dev (`m0n1t0r-d3-3v3nt0s.net`, localhost:5173/5180,
IP del VPS).

La **API key de Nexus nunca sale** del contenedor.

### Slim `/censo` (campos útiles)

Extrae de `data`:

- Identidad: nombres, apellidos, sexo, edad, fecha_nacimiento, estado_civil
- `foto_nombre` / `tiene_foto_saime` (solo nombre de archivo, ver §6)
- `telefonos` (telecom + fiscal)
- `direccion_fiscal`
- `familiares[]` desde `fiscalRelations` (personas, no empresas) +
  `militaryData.Familiar` / IPSFA

Ejemplo slim: `ejemplo_V17089732_censo_slim.json`.

---

## 5. Frontend (app)

| Archivo | Función |
|---|---|
| `src/data/reposNexus.ts` | `buscarPersonaNexus(letra, cedula)` → gateway HTTPS + JWT |
| `src/data/reposCensoNexus.ts` | Alta en nominal: crear/actualizar refugiado, familia, alojamiento |
| `src/domain/nexusPersona.ts` | Tipos del slim |
| `src/features/censo/CensoNexusPanel.tsx` | UI: buscar → verificar → crear hogar → familiares |
| `src/features/censo/CensoView.tsx` | Pestañas **Por cédula** / **Planilla manual** |

Variable de entorno (build):

```bash
VITE_NEXUS_GATEWAY_URL=https://nexus.m0n1t0r-d3-3v3nt0s.net
```

Flujo de campo:

1. Entrar a `/censo` (idealmente con `?t=` del QR de terreno → sesión operador).
2. Pestaña **Por cédula** → campamento.
3. Digitar cédula → Buscar.
4. Revisar ficha → **Verificar y crear hogar** (jefe = esa cédula).
5. Marcar familiares detectados o buscar otra cédula y agregar al mismo hogar.
6. Los datos quedan en la base **nominal**, no en `censo_registros` (staging).

La planilla manual antigua sigue disponible en la otra pestaña (staging
`censo_registros`).

---

## 6. Foto SAIME — mecanismo y wire-up

**Circuito:**

1. Onfalo da el **nombre** del archivo: `photoPersons[0].photo.url` → slim
   `foto_nombre` (ej. `V-17089732-186c1dea.jpg`).
2. La imagen vive en MinIO institucional: `http://10.51.12.85:9000`, bucket
   **`alfa-images`**, key = `foto_nombre`.
3. **Nuestro gateway** (opción B, 22-jul-2026) hace `GetObject` SigV4 (stdlib,
   sin boto3) vía VPN y expone:

   `GET /foto/<foto_nombre>` — auth JWT Supabase o `X-Gateway-Secret`.

**Estado: ACTIVO**

| Pieza | Dónde |
|---|---|
| Vars `MINIO_HOST/PORT/ACCESS_KEY/SECRET_KEY/BUCKET` | Dokploy compose `nexus-vpn` (no git) |
| `proxy.py` con `/foto` | `/etc/dokploy/nexus-vpn/proxy.py` (bind-mount) |
| Cliente UI | `cargarFotoSaime()` en `reposNexus.ts` |
| Avatares censo | `CensoNexusPanel`: prioriza SAIME sobre `foto_url` Storage viejo |

Health: `GET /health` → `{ "foto_minio": true }` si las vars están cargadas.

**No cachear en Supabase Storage** (factura + roadmap de salir de Supabase).

### Cache MinIO propio — ACTIVO (22-jul-2026)

MinIO **propio** en Dokploy (compose **`minio-cache`**, mismo proyecto/env que
`nexus-vpn`) como almacén de media post-Supabase. Flujo cache-aside en el
gateway:

```
GET /foto/<nombre>
  → ¿objeto en MinIO propio (bucket saime-fotos)? → servir  (cache=hit, ~0.06 s)
  → miss → MinIO institucional (VPN) → PutObject propio best-effort → servir
```

Medido: hit ~0.06 s vs miss ~0.6 s. Las fotos ya cacheadas se sirven
**aunque la VPN esté caída**. Cero bytes SAIME en Supabase.

| Pieza | Valor |
|---|---|
| Compose Dokploy | `minio-cache` (raw, imagen `minio/minio`, volumen `minio-cache-data`) |
| API S3 | `http://minio-cache:9000` — **solo** red interna `dokploy-network`, no publicado |
| Consola | `127.0.0.1:9001` del VPS — solo por túnel SSH (`ssh -L 9001:localhost:9001`) |
| Buckets | `saime-fotos` (cache SAIME, key = `foto_nombre`) · `media` (futuro fotos campo/centros) |
| Credenciales | **nuevas** (no las institucionales): `/etc/dokploy/minio-cache/env.secret` + env Dokploy |
| Vars del gateway | `CACHE_MINIO_HOST/PORT/ACCESS_KEY/SECRET_KEY/BUCKET` en compose `nexus-vpn` |
| Logs | `docker logs nexus-gateway \| grep "foto "` → `cache=hit\|miss\|origin_fail` |

Los objetos son inmutables por nombre (el `foto_nombre` lleva sufijo hash), así
que el cache no necesita TTL ni invalidación.

**Gotcha DNS (musl/Alpine):** el contenedor `nexus-gateway` pisa
`resolv.conf` con el DNS de la VPN, y el resolver de musl consulta todos los
nameservers en paralelo (un NXDOMAIN público le gana al DNS de Docker). Por eso
`entrypoint.sh` restaura `127.0.0.11` al arrancar, resuelve `minio-cache` con
`dig @127.0.0.11` y fija la IP en `/etc/hosts` **antes** de cambiar el DNS.
Si `minio-cache` cambia de IP (redeploy), `docker restart nexus-gateway`;
mientras tanto el proxy degrada solo a servir desde el origen.

---

## 7. Secretos y archivos sensibles

| Qué | Dónde | ¿Git? |
|---|---|---|
| API key Nexus, VPN user/pass, PROXY_SECRET, anon Supabase | Dokploy env del compose + `/etc/dokploy/nexus-vpn/env.secret` | **No** |
| `ONFALO_MINIO_*` / `MINIO_*` (foto SAIME, origen) | Dokploy env del compose `nexus-vpn` | **No** |
| `CACHE_MINIO_*` (cache propio) | Dokploy env de `nexus-vpn` y `minio-cache` + `/etc/dokploy/minio-cache/env.secret` | **No** |
| `.ovpn` con cert/key | `/etc/dokploy/nexus-vpn/client.ovpn` (y copia local en `runtime/`) | **No** (gitignore) |
| `vpn.txt`, `runtime/` | Local / host | **No** |
| Esta documentación, ejemplos JSON, `endpointNexus.txt` | `nexusEndPoint/` | Sí (sin keys) |

En `.gitignore` del repo:

```
nexusEndPoint/runtime/
nexusEndPoint/vpn.txt
nexusEndPoint/*.ovpn
```

---

## 8. Operación rápida

```bash
# Salud pública (incluye foto_minio)
curl -sS https://nexus.m0n1t0r-d3-3v3nt0s.net/health

# Foto SAIME (ops)
curl -sS -o /tmp/saime.jpg \
  -H "X-Gateway-Secret: $PROXY_SECRET" \
  "https://nexus.m0n1t0r-d3-3v3nt0s.net/foto/V-17089732-186c1dea.jpg"

# Consulta slim (ops, con secret del env Dokploy)
curl -sS -X POST \
  "https://nexus.m0n1t0r-d3-3v3nt0s.net/v1/person/search/external/full/V/17089732/censo" \
  -H "Content-Type: application/json" \
  -H "X-Gateway-Secret: $PROXY_SECRET" \
  -d '{}'

# Estado del contenedor
docker ps --filter name=nexus-gateway
docker logs nexus-gateway --tail 50
```

Redeploy desde Dokploy: compose **nexus-vpn** → Redeploy  
(o MCP `compose-deploy` con `composeId: y5vhq15sJ4FjvBNd9_fyn`).

Tras cambiar `proxy.py` / `entrypoint.sh` en `/etc/dokploy/nexus-vpn/`, basta
`docker restart nexus-gateway` (bind-mount) o un redeploy completo si cambió
el `docker-compose` / env.

---

## 9. Estado de avance (checklist)

- [x] VPN OpenVPN a Kratos/SP3 en contenedor Dokploy (sin `redirect-gateway`)
- [x] Proxy HTTP con API key Nexus encapsulada
- [x] Auth por JWT Supabase + secret de gateway
- [x] Dominio HTTPS `nexus.m0n1t0r-d3-3v3nt0s.net`
- [x] Respuesta slim para censo + extracción de familiares (IPSFA / fiscal)
- [x] UI `/censo` → **Por cédula** → hogar en base nominal
- [x] Aviso si la persona ya está activa en otro campamento
- [x] Pulido del flujo (10-jul): los **familiares sugeridos del jefe** persisten
      tras crear el hogar (antes se perdían al limpiar la ficha y el paso 5 del
      flujo no era usable); si el jefe ya es jefe activo en el campamento se
      **reanuda su hogar** en vez de crear una familia duplicada; **pre-chequeo
      nominal** al buscar (badge "Ya registrado / Jefe de hogar aquí" y otros
      campamentos con **nombres legibles**, no ids); parentesco directo con
      `Select` único en vez de botones por parentesco.
- [x] Alta de menores sin cédula en el mismo flujo de hogar
      (`registrarMiembroSinDocumento` en `reposCensoNexus.ts`: crea el
      refugiado sin documento y lo aloja en el hogar activo; si solo se conoce
      la edad se guarda fecha de nacimiento aproximada = hoy − edad)
- [x] **Caché de consultas** (10-jul): tabla `nexus_consultas` (PK letra+cedula,
      slim jsonb, RLS solo `authenticated`; migración `nexus_consultas_cache`,
      referencia en `supabase/nexus_consultas.sql`).
      `buscarPersonaNexusConCache()` en `reposNexus.ts` lee primero nuestra BD
      y solo va al gateway si no hay consulta guardada (también en el alta
      masiva de familiares); cada respuesta viva se guarda. La ficha indica la
      procedencia («Consulta guardada del DD/MM» con botón **Reconsultar**).
      Beneficio extra: el censo por cédula sigue operativo con la VPN caída
      para cédulas ya consultadas.
- [x] **Vista de verificación** (10-jul): franja fija «Registrando en
      \<campamento\>» (con botón Cambiar cuando no se entra por QR) y bloque
      «Dirección registrada — verifique la procedencia» (dirección fiscal +
      instrucción de pedir la dirección de palabra antes de leerla, filtro
      contra falsos damnificados), estado civil y todos los teléfonos.
- [x] **Verificación reforzada** (10-jul, segunda pasada):
      **Teléfonos confirmables con un toque** (chip → verificado; botón
      «+ Añadir»; los confirmados se guardan como principal/alternos del
      refugiado vía `telefonosConfirmados` en `registrarPersonaNexusEnNominal`).
      **Familiares visibles en la fase de verificación** con nacimiento, edad
      calculada, insignia «Falleció AAAA-MM-DD» y botón «Ver» (consulta la
      cédula del familiar con un toque, vía caché). **Alerta FALLECIDO** en
      rojo si la cédula del titular tiene acta de defunción. Chips
      estado/municipio/parroquia fiscales en el bloque de dirección.
- [x] **Redeploy del gateway con `fallecido`/`ubicacion_fiscal`** — verificado
      aplicado en producción (22-jul-2026): el `proxy.py` del host ya incluye
      `fallecido`/`fecha_fallecimiento`, merge fiscal+IPSFA de familiares,
      `ubicacion_fiscal` y el fix del centinela `0001-01-01`. Las consultas
      viejas en `nexus_consultas` se refrescan con «Reconsultar».
- [x] **Foto SAIME** — Opción B activa (22-jul-2026): MinIO institucional vía
      VPN; gateway `GET /foto/<filename>`; UI prioriza SAIME.
- [x] **Cache MinIO propio** — ACTIVO (22-jul-2026): compose Dokploy
      `minio-cache` (buckets `saime-fotos` + `media`), cache-aside en el
      gateway (`cache=hit` ~0.06 s; sirve fotos cacheadas con VPN caída),
      credenciales propias, API S3 solo red interna, consola solo por túnel
      SSH. Ver §6.
- [ ] Edge Function opcional (hoy el browser habla directo al gateway)
- [ ] Commit/push a `main` + env `VITE_NEXUS_GATEWAY_URL` en build Dokploy de la PWA

---

## 10. Contenido de esta carpeta

| Archivo | Descripción |
|---|---|
| `README.md` | Este documento |
| `USO_GATEWAY.md` | Resumen corto de consumo del gateway |
| `endpointNexus.txt` | Notas del endpoint institucional |
| `flujo_censo_damnificados_terremoto_2026.md` | **Especificación del flujo de censo** (a desarrollar) |
| `VIGILANTE_TELEGRAM.md` | Alertas Telegram de caída/reactivación del API |
| `vpn.txt` | Usuario/clave VPN (**secreto, no subir**) |
| `kratos-…-connect-config.ovpn` | Perfil OpenVPN original (**secreto**) |
| `ejemplo_V17089732_*.json` | Respuestas de ejemplo del API |
| `runtime/` | Copia de trabajo local del proxy/ovpn (**gitignore**) |

La copia **canónica en producción** de scripts/ovpn está en
`/etc/dokploy/nexus-vpn/` en el VPS.
