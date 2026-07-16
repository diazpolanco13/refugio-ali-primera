# Plan: Identidad definitiva de operadores de terreno (cédula + Telegram)

> **Estado: FASE A IMPLEMENTADA Y VERIFICADA (16-jul-2026, tarde).** El plan
> se escribió en la mañana del 16-jul; Carlos cerró las decisiones pendientes
> ese mismo día y la Fase A (login por cédula + bandeja de aprobación) quedó
> en producción. Ver "Fase A — qué quedó implementado" al final. Pendientes:
> Fase B (bot Telegram) y Fase C (IA sobre reportes).
>
> Decisiones tomadas el 16-jul:
> 1. Anti-suplantación: **(b) bandeja de aprobación** (`/usuarios/terreno`,
>    admin + analista). Un rechazo bloquea el próximo login por cédula.
> 2. Fusión de duplicados: **al identificarse con cédula** (gradual, sin
>    script masivo). Los usuarios `operador-*` viejos conviven mientras tanto.
> 3. Limpieza: **ejecutada** — 49 usuarios borrados (39 solo-centro-prueba +
>    10 nombres basura inequívocos; 303 → 254 operadores). `luis`/`Yorman`
>    quedaron (plausiblemente reales).
> 4. Telegram (Fase B) sigue pendiente de decidir bot propio vs Hermes.

## Qué se persigue (objetivo del usuario)

1. **Identidad real y única por funcionario de terreno.** Hoy el acceso por
   `/terreno` crea un usuario nuevo POR CADA identificación (self-declarada,
   sin verificar). El usuario quiere: login con **cédula**, verificada contra
   **Nexus** (API institucional que ya está integrada), de modo que una
   persona = un usuario para siempre, sin importar dispositivo o campamento.
2. **Telegram verificado, no tecleado.** Sustituir el campo "Teléfono
   (Telegram)" por un botón de vínculo real (deep-link al bot) que capture el
   `chat_id`. Es la base de la fase siguiente:
3. **IA operativa sobre los reportes** (ya hay infraestructura lista, ver
   `docs/hermes-gateway.md`): recordatorios por Telegram a quien no ha
   reportado, revisión automática de completitud/coherencia del reporte
   diario, sugerencias de redacción. Los analistas hoy revisan a mano los
   ~61 reportes diarios; la meta es que solo revisen lo flaggeado.
4. **Reducir fricción del formulario de identificación**: de 4 campos a 1
   (jerarquía) + 1 toque (Telegram). Unidad e institución salen solas del
   campamento (cada campamento ya tiene unidad de revista asignada:
   `supervision.unidad_sebin`).

## Contexto actual (medido en BD el 16-jul-2026)

- 300 usuarios `operador-centro-XX-<hash>` en `perfiles` (de 344 totales).
- Solo **179 nombres distintos**: 53 personas tienen 2+ usuarios (121
  usuarios "extra" por re-identificación — misma persona, otro dispositivo u
  otro día). 39 usuarios en `centro-prueba` (tests). 14 nombres basura.
  **`cedula` está NULL en los 300.**
- Flujo actual (`login-terreno` Edge Function): QR con token `personal` de
  `tokens_centros` → formulario self-declarado (jerarquía, nombre,
  institución, teléfono a mano) → crea usuario nuevo + magiclink → sesión
  rol `operador` limitada a ese centro. Ver CLAUDE.md sección "Login de
  terreno por QR".
- Nexus: gateway `nexus-gateway` en Dokploy (JWT de Supabase requerido),
  caché en `nexus_consultas` (la 2ª consulta de una cédula no toca la VPN).
  Ver `nexusEndPoint/README.md`.
- IA local lista: Hermes gateway (`127.0.0.1:8642/v1`) + Gemma 4 12B en DGX
  vía Tailscale. Ver `docs/hermes-gateway.md`.

## Diseño acordado

### Principio: QR + cédula = dos factores complementarios
- **QR del campamento** (ya existe) prueba: "estás autorizado a operar en
  ESTE campamento". Se mantiene tal cual, revocable.
- **Cédula** prueba: "eres TÚ". Verificada contra Nexus la primera vez;
  después contra nuestra propia BD (`perfiles.cedula`) — sin VPN.

### Flujo de identificación nuevo (`/terreno`)
1. Escanea QR → `asegurarSesionTerreno` establece sesión (como hoy).
2. Pantalla de identificación pide **solo la cédula**.
   - Si la cédula ya existe en `perfiles` → "¿Eres <nombre>?" → confirmar →
     re-login como ese usuario (`op-<cedula_norm>`), agrega el centro a
     `centros_asignados` si es nuevo. **No consulta Nexus.**
   - Si es cédula nueva → lookup Nexus (o caché `nexus_consultas`) →
     muestra nombre → confirmar → crea usuario `op-<cedula_norm>` único.
   - **Fallback VPN caída + cédula nunca vista**: permitir nombre manual con
     flag `verificado: false` visible para analistas (caso raro; no puede
     bloquear el parte del día).
3. Campos automáticos (solo lectura, con opción "cambiar"):
   - **Unidad**: de `supervision.unidad_sebin` del campamento (catálogo
     `src/domain/unidadesSebin.ts`).
   - **Institución/cuerpo**: del cuerpo asignado al campamento.
4. Único campo manual: **jerarquía** — SELECT con jerarquías SEBIN
   normalizadas (hoy texto libre produce "insp"/"Inspector"/"INSPECTOR JEFE"),
   precargada si la persona ya se identificó antes.
5. Botón **"Vincular Telegram"** (no bloqueante el día 1): deep-link
   `t.me/<bot>?start=<token-único>` → el bot recibe `/start`, captura
   `chat_id` y lo casa con el usuario. Tabla nueva `telegram_operadores`
   (user_id, cedula_norm, chat_id, verificado_ts). Badge "Telegram
   pendiente" visible para analistas.

### Anti-suplantación (decidir mañana el nivel)
La cédula NO es secreta: con el QR + la cédula de un colega, alguien podría
registrarse como él. Opciones discutidas, de menos a más estrictas:
- **a)** Solo bitácora: registrar todo en `historial` y confiar en revisión.
- **b)** Bandeja "identificaciones nuevas" que analistas aprueban a
  posteriori (no bloquea el trabajo).
- **c)** Roster de cédulas autorizadas por campamento (`roster_operadores`),
  cargado por analistas: login solo si la cédula está en el roster.
El usuario aún no eligió; la recomendación técnica fue (c) o mínimo (b).
El vínculo Telegram mitiga parcialmente (primer casamiento cédula↔chat gana,
y logins desde dispositivo nuevo pueden pedir confirmación "¿eres tú?" por
Telegram = segundo factor real).

### Migración de los 300 existentes
- Fusionar retroactivamente duplicados obvios (mismo nombre normalizado +
  mismo teléfono) cuando la persona se identifique con cédula: los usuarios
  viejos se desactivan, `historial`/`updated_by` quedan intactos.
- Borrar los 39 de `centro-prueba` y los 14 basura.
- Periodo de transición: el flujo viejo sigue N semanas con banner
  "identifícate con tu cédula"; luego `login-terreno` v3 lo apaga.

## Fases de implementación

- **Fase A — Login por cédula** (1 día): migración SQL (perfiles.cedula
  unique para operadores + tabla roster si se elige (c)), Edge Function
  `login-terreno` v3 (find-or-create por cédula, integra lookup Nexus
  server-side o recibe la ficha del frontend), UI de `/terreno`
  (TerrenoView: cédula → confirmación, unidad/cuerpo automáticos, jerarquía
  select). ⚠️ Recordar el gotcha de `CREATE OR REPLACE FUNCTION` → re-otorga
  EXECUTE a PUBLIC (ver CLAUDE.md, pasó 2 veces).
- **Fase B — Bot Telegram + vínculo** (1 día): bot **`@campamento_inteligente_bot`**
  (nombre decidido el 16-jul); token de BotFather,
  contenedor bot en Dokploy (proyecto independiente o junto a hermes-agent),
  tabla `telegram_operadores`, deep-link + captura de chat_id, comando
  /start. El bot también absorbe el "bot emisor" pendiente del roadmap
  (publicar partes con `reporteTelegram*.ts`, pie `REF:` parseable).
- **Fase C — IA sobre reportes**: cron de recordatorios (quién no reportó a
  hora de corte → DM), revisión de reportes al llegar (completitud,
  coherencia numérica, redacción — LLM propone, humano aprueba, NUNCA
  reescritura silenciosa), resumen diario a analistas con lo flaggeado.
  Regla: validaciones deterministas en código; LLM solo para texto.

## Decisiones pendientes (Fases B/C)

1. ¿Vínculo Telegram obligatorio a partir de cuándo? (Día 1 no bloqueante.)
2. ¿El bot de Fases B/C es contenedor propio (recomendado: determinista) o
   se usa el soporte Telegram nativo de Hermes? (Hermes-como-bot quedó
   sugerido solo para modo consulta de autoridades.)
3. Horas de corte del recordatorio de reporte (Fase C).
4. ¿Cuándo apagar el flujo legacy `funcionario` (v2)? Hoy sigue vivo para
   /censo y para sesiones guardadas; `login-terreno` v3 lo mantiene.

## Fase A — qué quedó implementado (16-jul-2026)

- **Migración `identidad_operadores_fase_a`** (referencia:
  `supabase/identidad_operadores.sql`): `perfiles.cedula_norm` (dígitos,
  única por operador — misma convención que `refugiados`), `verificado_nexus`,
  `aprobacion`/`aprobacion_por`/`aprobacion_ts`; helper `mi_identidad()`
  (el usuario no puede tocar su cédula/verificación/aprobación); RLS:
  analista ve y gestiona perfiles `operador` sin poder cambiarles el rol;
  tabla `app_secrets` (RLS deny-all, solo service role) con
  `nexus_gateway_secret` para consultar el gateway server-side.
- **Edge Function `login-terreno` v3** (referencia en
  `supabase/functions/login-terreno/`): `paso: "consultar"` (perfil →
  `nexus_consultas` → gateway con `X-Gateway-Secret`, timeout 8s →
  `no_disponible`) y `paso: "entrar"` (find-or-create `op-<cedula_norm>`,
  suma el campamento a `centros_asignados`, `aprobacion: 'pendiente'` al
  crear, fallback nombre manual `verificado_nexus: false` con Nexus caído,
  bloqueo 403 si `aprobacion = 'rechazada'`, bloqueo 409 si la cédula figura
  fallecida). Flujos legacy v1/v2 intactos (transición; /censo los usa).
- **UI `/terreno`**: `IdentificacionCedula.tsx` (cédula → "¿Es usted X?" →
  jerarquía SELECT del catálogo nuevo `src/domain/jerarquiasSebin.ts` +
  institución/unidad automáticas del campamento → entrar). La sesión por
  pestaña (`terrenoFuncionario.ts`) guarda `cedula`/`letra`/`verificadoNexus`;
  `loginTerreno.ts` ganó `consultarIdentidadTerreno` / `entrarPorCedula` /
  `asegurarSesionTerrenoCedula`. Sesiones legacy guardadas siguen funcionando.
- **Bandeja `/usuarios/terreno`** (`BandejaOperadoresView.tsx`, admin +
  analista, item "Identificaciones terreno" en el sidebar): pestañas
  Pendientes/Aprobados/Rechazados/Todos, badge Verificado/Sin verificar,
  campamentos, aprobar/rechazar con `historial`
  (`aprobar_identificacion`/`rechazar_identificacion`).
- **Verificado E2E contra producción**: consultar por caché, entrar (creó
  `op-17089732`), multi-campamento (centro-01 + centro-02, mismo usuario),
  bloqueo de rechazado (403), RLS del analista (ve/aprueba, no escala rol) y
  anti-auto-aprobación del operador.
- **Limpieza ejecutada**: 49 usuarios borrados de `auth.users` (cascade a
  `perfiles`), registrado en `historial` (`limpieza_usuarios_terreno`).
