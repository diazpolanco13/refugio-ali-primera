# Especificación del Flujo de Usuario
## App Móvil de Censo de Damnificados - Terremoto Venezuela 24 de junio 2026

**Instrucciones para cualquier IA (Grok, Claude, etc.) que lea este archivo:**

1. Lee **completamente** este documento antes de responder.
2. El objetivo de este archivo es definir **únicamente el flujo de usuario** de la aplicación. No contiene código de implementación.
3. Cuando se te pida trabajar con este flujo (ej: "lee el archivo flujo_censo_damnificados_terremoto_2026.md y [tarea]"), comienza confirmando que entendiste el contexto y el flujo completo.
4. Mantén siempre el enfoque en **simplicidad extrema** para uso en teléfono en condiciones de refugio/emergencia.
5. Si se solicita implementar UI, modelo de datos, lógica backend o componentes, hazlo **después** de haber internalizado este flujo y proponiendo soluciones que respeten estrictamente las pantallas, transiciones y reglas aquí descritas.
6. Contexto del proyecto: Aplicación para censar damnificados en refugios/centros de atención tras el terremoto del 24 de junio de 2026 (afectó principalmente La Guaira/Vargas, Caracas y Miranda). Se usa un endpoint gubernamental que, al consultar por cédula, devuelve datos básicos de la persona (incluyendo foto), dirección registrada, teléfonos y familiares vinculados en el sistema nacional. El endpoint puede estar caído (usar caché o modo manual).

---

## 1. Contexto y Objetivo General

Después del terremoto del 24 de junio de 2026, se necesita censar de forma rápida y estructurada a las personas que llegan a refugios en La Guaira, Caracas y Miranda.

**Objetivo principal del flujo:**
Crear **Hogares** (unidades familiares) bien formados en la base de datos, permitiendo:
- Registrar personas **con cédula** aprovechando el endpoint gubernamental.
- Registrar personas **sin cédula** (principalmente niños y algunos adultos).
- Agrupar miembros por familia/hogar.
- Designar un **Líder de Familia** (Jefe/Jefa de Familia).
- Registrar el **estado de la vivienda perdida** y contexto del terremoto.
- Manejar casos especiales: huérfanos, menores separados de su familia, pérdidas de familiares.
- Garantizar que la base de datos quede **estructurada, completa y consultable** (familias, miembros, pérdidas, estado de vivienda por entidad).

El flujo debe ser **super simple**, operable principalmente desde el teléfono de los censistas en refugios, con mínima carga cognitiva y botones grandes.

---

## 2. Principios de Diseño del Flujo

- **Aprovechar el endpoint al máximo**: Precargar todo lo posible (datos básicos, foto, dirección, teléfonos, familiares ya vinculados).
- **Simplicidad primero**: Menos pantallas y toques posibles para lograr un hogar completo.
- **Dualidad clara**: Camino "Tiene cédula" (usa endpoint) vs "No tiene cédula" (formulario mínimo).
- **Preguntar "¿es usted el jefe/a?" temprano**: se pregunta apenas se confirman los datos básicos, antes de la sección de damnificación. Si la respuesta es "No", el flujo no hace perder tiempo con preguntas de hogar a quien no es el jefe.
- **Severidad ≠ ubicación**: la vivienda se diagnostica por su nivel de daño (colapsada / insegura / daños menores / sin daño), no solo por el estado donde está. Son dos preguntas distintas y la severidad es la que importa para el diagnóstico.
- **Captura numérica antes que nominal**: para pérdidas familiares, primero el conteo (cuántos fallecidos, cuántos desaparecidos); el detalle de cada uno (nombre, edad, relación) es opcional y se completa después si hay tiempo.
- **Diagnóstico calculado, no preguntado**: el nivel de afectación de cada hogar (🔴🟡🟢) se deriva de la severidad de vivienda + si hubo pérdidas, nunca se le pregunta directamente al censista.
- **Creación de Hogar como momento clave**: Antes de crear el hogar la UI es de "persona individual + contexto". Después de crear el hogar la UI cambia a "dashboard familiar".
- **Trazabilidad**: Todo registro debe saber si los datos vinieron del endpoint o fueron cargados manualmente.
- **Manejo graceful de fallos**: Cuando el endpoint está caído (como en el ejemplo de Nexus), mostrar banner claro y permitir flujo 100% manual.
- **Casos especiales visibles**: Huérfanos, pérdidas familiares y menores sin acompañante deben tener tratamiento diferenciado pero simple.
- **Nomenclatura de hogares consistente**: Evitar duplicados cuando hay muchas familias con el mismo apellido.

---

## 3. Flujo Completo de Usuario (Pantallas y Transiciones)

### Pantalla 1: Búsqueda Inicial de Persona

- Pantalla de entrada principal.
- Campo grande de búsqueda: Tipo de documento (V / E) + número de cédula.
- Botón principal: **Buscar** (llama al endpoint gubernamental).
- Botón secundario visible: **Registrar sin cédula / Modo manual**.
- Historial reciente de personas buscadas (caché local).
- Banner superior (solo cuando aplica): "Nexus / Registro Nacional fuera de línea – usando datos en caché o modo manual".

**Acciones posibles:**
- Introducir cédula → Buscar → Ir a Pantalla 2 con datos precargados.
- Elegir "sin cédula" → Ir directamente a formulario mínimo de persona (nombres, apellidos, sexo, edad/fecha nacimiento) → luego continuar al contexto del terremoto.

### Pantalla 2: Perfil del Damnificado + Contexto del Terremoto

Esta es la pantalla central del flujo. Se muestra después de una búsqueda exitosa por cédula (o después de crear una persona manual).

**Contenido que debe mostrar (en orden lógico):**

1. **Foto del damnificado** (campo nuevo)
   - Si el endpoint devuelve foto → mostrarla.
   - Si no hay foto → placeholder + botón "Tomar foto con la cámara".

2. **Datos básicos de la persona** (chips o líneas compactas)
   - Nombre completo
   - Edad + Fecha de nacimiento
   - Sexo
   - Estado civil (si viene)
   - Indicador de verificación (ej: SAIME)

3. **Declaración de Líder de Familia** (se pregunta temprano, antes de la sección de hogar, para no hacerle preguntas de damnificación a quien no es el jefe)
   - Toggle o dos botones grandes: **¿Es usted el Jefe o Jefa de Familia?** (Sí / No)
   - Si marca **NO**:
     - Los datos ya obtenidos de esta persona (foto, datos básicos, dirección, teléfonos) quedan guardados en sesión.
     - La pantalla ofrece un único botón: **"Buscar al Jefe/a de Familia"** (vuelve a Pantalla 1, esta persona queda "en espera").
     - Cuando se cree o se encuentre el hogar del jefe, esta persona aparece como sugerencia de alta rápida ("Agregar a {nombre del hogar}"), igual que un familiar traído por el Registro Nacional.
     - El resto de esta pantalla (dirección, teléfonos, familiares sugeridos, damnificación) **no se muestra** para un no-jefe: esas preguntas son del hogar, se responden una sola vez.
   - Si marca **SÍ** → continúa con el resto de la pantalla (pasos 4-7).

4. **Dirección registrada** (compactada y legible)
   - Formatear la dirección larga que devuelve el endpoint en 3-4 líneas claras con saltos de línea.
   - Ejemplo visual:
     ```
     Avenida Principal de Macaracauy
     Urbanización El Encantado Humboldt
     Edificio Torre J, Piso 10, Apartamento 7
     Bajando por Hidrocapital de Macaracauy
     ```

5. **Teléfonos**
   - Mostrar los teléfonos que trae el endpoint como chips o lista.
   - Botón "+ Añadir teléfono" (modal simple: número + tipo: Principal / Alternativo / Familiar).

6. **Familiares según el Registro Nacional** (los que devuelve el endpoint)
   - Lista de familiares con nombre, cédula y parentesco (Padre/Madre, etc.).
   - Por cada familiar: botón grande **"Está aquí conmigo — Agregar"** (un clic; el texto deja explícito que confirma presencia física en el refugio, no solo el vínculo que registra el Estado — Nexus puede traer familiares fallecidos, ausentes o que viven en otro lugar).
   - Al pulsar, el familiar se marca visualmente como "Agregado a esta familia" (queda pendiente de confirmación al crear el hogar).

7. **Sección obligatoria: Damnificación por el Terremoto** (nueva información que recolecta la app)
   - **Severidad de la vivienda** (el dato que realmente diagnostica la situación; se pregunta primero dentro de esta sección y es el único campo obligatorio):
     - 4 opciones grandes de un toque:
       - 🔴 Vivienda colapsada / destruida
       - 🟠 Inhabitable / insegura (daño estructural, no puede volver)
       - 🟡 Daños menores (podría volver, salió por precaución)
       - 🟢 Sin daño (evacuación preventiva, la vivienda no está afectada)
   - **Ubicación de la vivienda afectada** (secundaria, opcional; solo pedirla si aporta algo distinto al refugio donde ya está):
     - 4 opciones grandes: Caracas / Miranda / Vargas (La Guaira) / Otro.
     - Si selecciona "Otro" → aparece selector con lista completa de estados de Venezuela.
   - **Miembros de la familia damnificados**:
     - Pregunta clara: "Incluyendo usted, ¿cuántos miembros de su familia nuclear resultaron damnificados por el terremoto?"
     - Control numérico grande (+ / - o input) para indicar la cantidad esperada.
   - **Pérdida de familiares** (conteo primero, detalle opcional después — prioriza velocidad sobre completitud):
     - Dos controles numéricos grandes, siempre visibles: **"Fallecidos confirmados"** y **"Desaparecidos"** (+ / -). Estos dos números son el dato crítico y no requieren nada más para guardarse.
     - Si cualquiera de los dos conteos es mayor a 0 → aparece, colapsado por defecto, **"+ Agregar detalle"** (opcional, se puede repetir tantas veces como pérdidas se quieran detallar):
       - Relación (select: Cónyuge, Hijo/a, Padre/Madre, Hermano/a, Otro)
       - Nombre aproximado (opcional)
       - Edad aproximada (opcional)
       - Estado: Fallecido / Desaparecido (debe sumar consistente con el conteo, sin bloquear si no cuadra exacto)
     - El censo es válido con solo el conteo; el detalle no bloquea nada ni es obligatorio.

**Acción final de esta pantalla:**
- Botón grande **"Verificar y crear hogar"**, habilitado en cuanto se responde la Severidad de vivienda (el resto de los campos de la sección 7 son opcionales o tienen default en 0).
- Antes de pulsar, se muestra preview del nombre sugerido del hogar (ej: "Díaz Polanco #014").
- Pulsar → Se ejecuta la creación en base de datos.
- El usuario actual queda registrado como **Líder**.
- Todos los familiares que se marcaron "Está aquí conmigo — Agregar" se asocian automáticamente al nuevo hogar.
- **Transición de estado de la UI**: La pantalla cambia a la vista de "Hogar Creado" (Pantalla 3). No se regresa a la vista de persona individual.

### Pantalla 3: Dashboard del Hogar Creado (Estado después de crear hogar)

Una vez creado el hogar, la interfaz cambia completamente a modo "familia".

**Elementos principales:**

- **Header fijo**:
  - Nombre del hogar grande y destacado (ej: "Díaz Polanco #014")
  - Badge o línea: "Líder: [Nombre completo del jefe/jefa]"
  - Información rápida: Cantidad de miembros | **Nivel de afectación** (🔴/🟡/🟢, calculado) | Severidad de vivienda | Fecha de registro

- **Sección: Miembros de la Familia**
  - Lista clara de todos los miembros actuales del hogar.
  - Por cada miembro mostrar:
    - Foto pequeña (si existe)
    - Nombre completo
    - Parentesco con el líder (Líder / Madre / Padre / Hijo/a / etc.)
    - Cédula o etiqueta "Sin cédula"
    - Badge sutil: "Del registro oficial" o "Agregado manualmente"
  - Posibilidad de quitar un miembro del hogar (con confirmación y motivo simple).

- **Botón de acción principal** (flotante o destacado):
  - **"+ Agregar nuevo miembro a la familia"**

- Pestañas o secciones secundarias (opcional pero útil):
  - Resumen del censo familiar
  - Notas / Observaciones del hogar
  - Pérdidas reportadas (si las hubo)

### Flujo de "Agregar Nuevo Miembro" (desde Pantalla 3)

Se abre como modal o pantalla dedicada con dos caminos claros:

**Pregunta inicial grande:**
**¿Esta persona tiene cédula?**

- **Opción SÍ**:
  - Muestra input para escribir la cédula.
  - Botón "Consultar Registro Nacional".
  - Si encuentra datos → precarga la información y muestra preview.
  - Botón de confirmación: "Agregar como [sugerir parentesco] al hogar".

- **Opción NO** (sin cédula):
  - Formulario mínimo y amigable con campos grandes:
    - Nombres
    - Apellidos
    - Sexo (chips grandes: Masculino / Femenino)
    - Fecha de nacimiento **o** Edad estimada (especialmente útil para niños)
    - Parentesco con el líder actual (select: Hijo/a, Nieto/a, Hermano/a, Sobrino/a, Otro familiar, No familiar)
  - **Toggle especial visible**: "Este es un menor huérfano o separado de su familia"
    - Si se activa → aparece campo de observaciones/notas para el equipo de atención psicosocial del refugio.
    - Se marca internamente con prioridad de atención.

- Botón final: **"Agregar al Hogar"**

Este flujo de agregar miembro se puede repetir tantas veces como sea necesario (incluso días después).

---

## 4. Lógica de Nomenclatura de Hogares

Regla clara para evitar colisiones cuando hay muchas familias con el mismo apellido:

- El nombre base se forma con los apellidos de los líderes (padre y/o madre).
- Se agrega un número incremental **por combinación de apellidos dentro del mismo refugio**.
- Ejemplos:
  - Primera familia Díaz Polanco del refugio → "Díaz Polanco #001"
  - Segunda familia Díaz Polanco del mismo refugio → "Díaz Polanco #002"
  - Familia García → "García #005"
- El censista puede editar ligeramente el nombre sugerido en el momento de crear el hogar (ej: agregar segundo apellido o referencia corta).
- El contador debe ser atómico por refugio para evitar duplicados concurrentes.

---

## 5. Casos Especiales y Cómo se Manejan

| Caso                                      | Dónde se maneja en el flujo                              | Tratamiento especial                                                                 |
|-------------------------------------------|----------------------------------------------------------|--------------------------------------------------------------------------------------|
| Niño o persona sin cédula                 | Pantalla 2 (si es el primer registro) o flujo "Agregar Miembro" → Opción NO | Formulario mínimo + opción de marcar como huérfano                                 |
| Menor huérfano o separado de familia      | Toggle en formulario "sin cédula"                        | Activar flag interno + campo de observaciones para psicosocial + posible prioridad |
| Pérdida de familiares (fallecidos/desaparecidos) | Sección "Pérdida de familiares" en Pantalla 2         | Guardar en estructura separada (no como miembros del hogar)                          |
| Persona ya registrada en otro hogar       | Al buscar cédula que ya existe en la BD local            | Mostrar alerta clara: "Ya está registrada en el Hogar X. ¿Desea transferirla?"       |
| Endpoint / Nexus caído                    | Banner superior + opción de flujo manual completo        | Permitir crear persona y hogar sin datos del endpoint                                |
| Múltiples familias con mismo apellido     | Lógica de nomenclatura + contador por refugio            | Nombre del hogar con sufijo numérico                                                 |
| Familia con solo menores huérfanos        | Al crear hogar o agregar miembros                        | Permitir designar un adulto responsable temporal o marcar como "Hogar de menores bajo custodia del refugio" |
| Cambiar líder de familia posteriormente   | Desde el Dashboard del Hogar (acción secundaria)         | Opción de transferir liderazgo (con confirmación)                                    |
| Primera persona buscada no es el jefe/a   | Pregunta "¿Es jefe/a?" en el paso 3 de Pantalla 2         | Se salta toda la sección de damnificación; la persona queda "en espera" para agregarse al hogar real |
| Diagnóstico rápido de severidad global    | Dashboard / lista de hogares                              | **Nivel de afectación** (🔴/🟡/🟢) calculado a partir de severidad de vivienda + si hubo fallecidos/desaparecidos — no se pregunta, se deriva |

---

## 6. Estructura de Datos Conceptual (Entidades Principales)

La base de datos debe soportar al menos estas entidades y relaciones para que el flujo funcione correctamente:

- **Persona**: Datos básicos (cédula opcional, nombres, apellidos, fecha nacimiento, sexo, foto, teléfonos, dirección original del endpoint, fuente del dato, timestamps).
- **Hogar**: Nombre del hogar, líder (referencia a Persona), refugio al que pertenece, fecha de creación, y el bloque de damnificación:
  - `severidad_vivienda` (colapsada / insegura / danos_menores / sin_dano) — el dato de diagnóstico, obligatorio.
  - `ubicacion_vivienda_estado` (texto, opcional) — estado de Venezuela donde está la vivienda afectada.
  - `miembros_damnificados_declarados` (int, opcional).
  - `fallecidos_confirmados` (int, default 0) y `desaparecidos` (int, default 0) — el conteo rápido, siempre presente.
  - `nivel_afectacion` — **calculado**, no capturado: se deriva de `severidad_vivienda` + si `fallecidos_confirmados`/`desaparecidos` > 0. No se guarda como input directo del censista.
- **MiembroDeHogar** (tabla de unión): Conecta Persona con Hogar, indica parentesco, si es líder, fecha en que fue agregado y quién lo agregó.
- **PerdidaFamiliar**: Relacionada con un Hogar. Registro **opcional y repetible** de detalle de una pérdida (relación, nombre aproximado, edad aproximada, estado fallecido/desaparecido, notas). El conteo rápido vive en `Hogar.fallecidos_confirmados`/`Hogar.desaparecidos`; esta tabla es solo el detalle adicional cuando hay tiempo de capturarlo.
- **ConsultaEndpoint** (log opcional pero recomendado): Guarda las consultas realizadas al endpoint para auditoría y trazabilidad.

Esta estructura permite consultas útiles como:
- Total de damnificados por refugio y por severidad de vivienda.
- Familias con fallecidos o desaparecidos, y su detalle cuando existe.
- Cantidad de menores sin cédula registrados como huérfanos.
- Hogares por nivel de afectación (🔴/🟡/🟢), para triage y priorización de atención.
- etc.

---

## 7. Consideraciones de UX/UI para Móvil en Contexto de Emergencia

- Todo con **botones grandes** y targets táctiles amplios.
- Navegación lineal clara con botón "Atrás" visible.
- Auto-guardado frecuente de datos intermedios.
- Confirmaciones modales solo en acciones irreversibles (crear hogar, quitar miembro, marcar huérfano).
- Lenguaje claro, empático y en español venezolano natural.
- Modo oscuro preferente (como en el ejemplo de la interfaz actual).
- Funcionamiento aceptable con conexión intermitente (caché + cola de sincronización).
- Indicadores visuales claros de "datos precargados del registro oficial" vs "datos cargados manualmente".

---

## 8. Resumen del Flujo en una Línea por Pantalla

1. **Buscar persona por cédula** (o empezar manual) → Precarga datos del endpoint.
2. **Declarar si es líder** (si no, se pospone sin más preguntas) y, solo si lo es, **completar contexto del terremoto** (severidad de vivienda + miembros damnificados + conteo rápido de pérdidas).
3. **Crear Hogar** → La UI cambia a modo familiar.
4. **Agregar miembros** (con o sin cédula, incluyendo huérfanos) desde el dashboard del hogar.
5. Repetir paso 4 tantas veces como sea necesario.

---

**Fin del documento.**

Este archivo contiene la especificación completa y madurada del flujo de usuario.  
Cualquier desarrollo posterior (UI, backend, modelo de datos, etc.) debe respetar estrictamente las pantallas, transiciones, campos obligatorios y lógica de negocio aquí descritos.

---
*Documento generado para uso en servidor / entornos de desarrollo con IA. Versión del flujo: 11 de julio de 2026.*
*Revisión 12-jul-2026: severidad de vivienda separada de ubicación (diagnóstico real), pregunta de líder movida antes de la sección de damnificación, pérdidas familiares con conteo rápido + detalle opcional repetible, nivel de afectación calculado (no preguntado).*