# Campamentos y Organismos de Seguridad Encargados

**Fuente de verdad** para `centros.data.cuerpo` y `centros.data.seguridad.organismo`.

Migraciones:
- Caracas/Miranda: `supabase/actualizar_cuerpos_campamentos_org_seguridad.sql`
- La Guaira: `supabase/actualizar_cuerpos_la_guaira_consolidado.sql`

Reglas:
- **Vacío** = `—`, «No asignado», «No tiene», o FANB sin componente (no es cuerpo).
- **Doble organismo** (La Guaira #2–3, #14): `cuerpo` = primero listado; `organismo` = texto completo del MD.

---

## CARACAS / MIRANDA

| # | Campamento | Org. Seguridad | centro_id | Nombre en Supabase |
|---|---|---|---|---|
| 1 | GBM El Valle (Gimnasio Vertical) | Guardia del Pueblo | centro-53 | GBM El Valle (Gimnasio Vertical) |
| 2 | GBM Caricuao (Gimnasio Vertical – UD4) | GNB | centro-66 | GBM Caricuao (Gimnasio Vertical) |
| 3 | U.E.N Josefa Irasquin López (El Cafetal – Baruta) | Poli Baruta | centro-37 | UEN Josefa Irausquin Lopez, El Cafetal |
| 4 | CEN Simoncito "Mamá Rosa" (Urb. La Limonera – Baruta) | GNB | centro-36 | CEIN Mamá Rosa, Urb La Limonera |
| 5 | UE Juan Antonio Pérez Bonalde (Catia – Pquia. Sucre) | Poli Caracas | centro-34 | UED Juan Antonio Perez Bonalde |
| 6 | UEN Juan Landaeta (Pquia. Sucre) | CICPC | centro-16 | Liceo Juan Landaeta |
| 7 | Complejo Educativo José Gervasio Artigas (Propatria) | CICPC | centro-17 | UE Gervacio Artigas |
| 8 | Liceo Bolivariano Juan Lovera (Pquia. Macarao) | CICPC | centro-18 | Liceo Juan Lovera |
| 9 | UEN Claudio Feliciano (Pquia. Macarao) | CICPC | centro-19 | CE Claudio Feliciano |
| 10 | Gimnasio Vertical Pinto Salinas | GNB | centro-59 | GBM Pinto Salinas (Gimnasio Vertical) |
| 11 | Liceo Miguel Antonio Caro (Parque Alí Primera – Pquia. Sucre) | CICPC | centro-14 | CE Miguel Antonio Caro |
| 12 | U.E. Armando Zuloaga Blanco (Pquia. San José) | DGCIM | centro-13 | UEN Armando Zuluaga |
| 13 | Complejo Guayana Esequiba (Pquia. San Bernardino) | Poli Caracas | centro-65 | Complejo Guayana Esequiba |
| 14 | ETI Leonardo Infante (Petare) | SEBIN | centro-09 | ETI Leonardo Infante |
| 15 | UEN Mariano Picón Salas (Petare) | SEBIN | centro-10 | U. E. N. Mariano Picón Salas |
| 16 | Gimnasio Vertical Santa Teresa (Quinta Crespo) | GNB | centro-57 | Gimnasio Vertical Santa Teresa |
| 17 | San Pedro Claver (23 de Enero) | *(vacío)* | centro-58 | San Pedro Claver |
| 18 | UEN Luis Hurtado Higuera (El Junquito) | PNB | centro-26 | UE Luis Hurtado |
| 19 | CMAPP El Junquito (El Junquito) | GNB | centro-63 | CMAPP El Junquito |
| 20 | UNES del Junquito (El Junquito) | PNB | centro-64 | UNES del Junquito |
| 21 | Escuela Nuestra América (Pquia. San Juan) | *(vacío)* | centro-94 | Escuela Nuestra América |
| 22 | CEI Paula María Nieves (Pquia. Altagracia) | *(vacío)* | centro-95 | C.E.I. Paula María Nieves |
| 23 | UE Jesús Enrique Lozada (Pquia. El Recreo) | SEBIN | centro-11 | UE Jesús Enrique Lossada |
| 24 | UN Francisco Pimentel (Pquia. Santa Teresa) | GNB | centro-02 | UEN Francisco Pimentel |
| 25 | U.E.N. Pedro Emilio Coll (Pquia. Coche) | GNB | centro-01 | UEN Pedro Emilio Coll |
| 26 | Andrés Bello (La Candelaria) | Poli Caracas | centro-32 | CE Andres Bello |
| 27 | UENB Carlos Delgado Chalbaud (Pquia. Coche) | Poli Caracas | centro-33 | UENB coronel Carlos Delgado Chalboud |
| 28 | PSUV Caracas (Pquia. San Bernardino) | *(vacío)* | centro-62 | U.E.N VICENTE LANDAETA GIL |
| 29 | Gran Colombia 1 (Pquia. Santa Rosalía) | GNB | centro-03 | UEN Gran Colombia — Edif. Colombia |
| 30 | Gran Colombia 2 (Pquia. Santa Rosalía) | GNB | centro-51 | UEN Gran Colombia — Edif. Perú |
| 31 | Gran Colombia 3 (Pquia. Santa Rosalía) | GNB | centro-52 | UEN Gran Colombia — Edif. Ecuador |
| 32 | Gran Colombia 4 (Pquia. Santa Rosalía) | GNB | centro-54 | UEN Gran Colombia — Edif. Bolivia |
| 33 | UEN Vicente Gil (San Bernardino) | PNB | centro-21 | UEN Vicente Gil |
| 34 | UE Luis Padrino (Pquia. San Juan) | PNB | centro-20 | UE Luis Padrino |
| 35 | UEN Zoe Xiques Silva (San Martín) | GNB | centro-60 | UEN Zoe Xiques Silva |
| 36 | Estacionamiento Hotel Ávila (Pquia. San Bernardino) | Poli Caracas | centro-61 | Estacionamiento Hotel Ávila |
| 37 | UEN Maestra Judith Liendo (Pquia. El Valle) | GNB | centro-06 | Liceo Judith Liendo |
| 38 | Liceo Leopoldo Aguerrevere (Pquia. San Pedro) | GNB | centro-08 | Liceo Leopoldo Aguerrevere |
| 39 | Escuela Nacional de Artes Escénicas César Rengifo (Pquia. La Pastora) | SEBIN | centro-12 | UE Cesar Rengifo |
| 40 | E.T.I. Rafael Vegas (Pquia. Sucre) | *(vacío)* | centro-93 | E.T.I. Rafael Vegas |
| 41 | UEN Doctor Guillermo Delgado Palacios (Pquia. El Valle) | GNB | centro-05 | EBN Dr. Guillermo Delgado Palacios |
| 42 | Liceo José Ávalos (Pquia. El Valle) | GNB | centro-04 | Liceo Jose Avalos |
| 43 | Coliseo La Urbina (Petare) | Poli Sucre | centro-55 | COLISEO LA URBINA |
| 44 | Escuela Internacional de Liderazgo Antonio José de Sucre (Filas de Mariche) | PNB | centro-50 | ESCUELA INTERNACIONAL DE LIDERAZGO ANTONIO JOSÉ DE SUCRE |
| 45 | UEN Generalísimo Francisco de Miranda (Filas de Mariche) | Poli Sucre | centro-45 | UEN GENERALÍSIMO FRANCISCO DE MIRANDA |
| 46 | UEN Rafael Napoleón Baute (Petare) | Poli Sucre | centro-43 | UEN RAFAEL NAPOLEÓN BAUTE |
| 47 | CEN Negro Primero Caucagüita (Caucagüita – Petare) | Poli Sucre | centro-44 | CEN NEGRO PRIMERO CAUCAGUITA |
| 48 | UEN Eduardo Crema (El Paraíso) | PNB | centro-27 | UEN Eduardo Crema |
| 49 | UEN Pedro Fontes (Pquia. La Vega) | PNB | centro-25 | UEN Pedro Fontes |
| 50 | UE José Ignacio Paz Castillo (Pquia. La Pastora) | PNB | centro-24 | UE Jose Ignacio Paz Castillo |
| 51 | Liceo Agustín Aveledo (La Pastora) | PNB | centro-23 | Liceo Agustín Aveledo |
| 52 | Ciudadela Catia 2 (Catia – Pquia. Sucre) | PNB | centro-56 | Ciudadela de Catia 2 |
| 53 | UE Alejo Fortique (Baruta) | Poli Baruta | centro-31 | UEN Alejo Fortique |
| 54 | UEN Conopoima (Pquia. El Hatillo) | Poli Hatillo | centro-41 | EU Conopoima |
| 55 | UEN Lino de Clemente (Pquia. Baruta) | Poli Baruta | centro-38 | CEIN Lino Clemente, Baruta |
| 56 | UEN El Libertador (Chacao) | Poli Chacao | centro-40 | UEN EI Libertador |
| 57 | UEN Jesús María Alfaro Zamora (El Cafetal) | Poli Baruta | centro-39 | UEN Jesús Maria Alfaro, Cafetal |
| 58 | CEN Luis Beltrán Prieto Figuera (Pquia. Leoncio Martínez) | Poli Sucre | centro-42 | CEN Luis Beltran Prieto Figueroa |
| 59 | UEE Adolfo Navas Coronado (Las Minas de Baruta) | Poli Baruta | centro-30 | UEE Adolfo Nava Coronado |
| 60 | Unidad Educativa Tito Salas (Baruta) | Poli Baruta | centro-28 | UEN Tito Salas |
| 61 | UEN Sorocaima (Baruta) | Poli Baruta | centro-29 | UEN Sorocaima |
| 62 | CEN Ana María Campos (Filas de Mariche) | Poli Miranda | centro-46 | CEN ANA MARÍA CAMPOS |
| 63 | Unidad Educ. Estadal Francisco Iznardi (La Dolorita – Petare) | Poli Miranda | centro-48 | CEN FRANCISCO IZNARDI |
| 64 | UEN Dr. José de Jesús Arocha (Petare) | Poli Miranda | centro-49 | UEN JOSÉ DE JESÚS AROCHA |

**Subtotal Caracas/Miranda: 64 campamentos**

---

## LA GUAIRA

| # | Campamento | Org. Seguridad | centro_id | Nombre en Supabase | cuerpo en BD |
|---|---|---|---|---|---|
| 1 | CANES Escuela de Grumetes (Pquia. Catia La Mar) | Armada Bolivariana | centro-67 | Escuela de Grumetes (Canes) | Armada Bolivariana |
| 2 | Universidad Marítima del Caribe (Pquia. Catia La Mar) | PNB / Ejército | centro-68 | Universidad Marítima del Caribe | PNB |
| 3 | C.E.I Manuel Gual (Pquia. Catia La Mar) | GNB / PNB | centro-69 | C.E.I. MANUEL GUAL | GNB |
| 4 | Narciso Gonel (Pquia. Catia La Mar) | GNB | centro-70 | U.E.N. Narciso Gonell | GNB |
| 5 | Escuela Ángel Valero Hosto (Pquia. Catia La Mar) | GNB | centro-71 | ESCUELA ÁNGEL VALERO HOSTOS | GNB |
| 6 | Complejo Educativo Antonio José de Sucre (Pquia. Catia La Mar) | GNB | centro-72 | Complejo Educativo Antonio José de Sucre | GNB |
| 7 | Campamento César Nieves (Pquia. Catia La Mar) | GNB | centro-73 | Campamento César Nieves | GNB |
| 8 | Gustavo Olivares Bosques (Pquia. Catia La Mar) | GNB | centro-74 | U.E.N. Gustavo Olivares Bosques | GNB |
| 9 | Liceo Armando Reverón (Pquia. Urimare) | GNB | centro-75 | Liceo Armando Reverón | GNB |
| 10 | Refugio para Niños y Niñas (Pquia. Urimare) | *(vacío)* | centro-76 | Refugio para Niños y Niñas | — |
| 11 | Refugio para Adultos y Adultas Mayores – Escuela Santa Eduvigis (Pquia. Urimare) | Guardia del Pueblo | centro-77 | Refugio… Santa Eduvigis | Guardia del Pueblo |
| 12 | Juan de Urpín (Pquia. Urimare) | GNB | centro-78 | E.N.B. Juan de Urpín | GNB |
| 13 | Estadio Miguel Montes (Pquia. Urimare) | GNB | centro-79 | Estadio Miguel Montes | GNB |
| 14 | Liceo Lorenzo González (Pquia. Carlos Soublette) | Milicia / Ejército | centro-80 | Liceo Lorenzo González | Milicia |
| 15 | Unidad Educativa 10 de Marzo (Pquia. Carlos Soublette) | Ejército | centro-81 | Unidad Educativa 10 de Marzo | Ejército |
| 16 | Polideportivo José María Vargas (Pquia. Carlos Soublette) | GNB | centro-82 | Polideportivo José María Vargas | GNB |
| 17 | Juan Germán Roscio (Pquia. Maiquetía) | GNB | centro-83 | U.E.N. Juan Germán Roscio | GNB |
| 18 | Liceo Licenciado Aranda (Pquia. Maiquetía) | *(vacío)* | centro-84 | Liceo Licenciado Aranda | — |
| 19 | Escuela Juan Aranaga (Pquia. Maiquetía) | GNB | centro-85 | E.B.E. Juan Aranaga | GNB |
| 20 | Manuel Segundo Sánchez (Pquia. Maiquetía) | GNB | centro-86 | E.N.B. Manuel Segundo Sánchez | GNB |
| 21 | Complejo Educativo República de Panamá (Pquia. La Guaira) | GNB | centro-87 | Complejo Educativo República de Panamá | GNB |
| 22 | Escuela Estadal La Guaira (Pquia. La Guaira) | Armada | centro-88 | Escuela Estadal La Guaira | Armada Bolivariana |
| 23 | Fundación Sol de Vargas (Pquia. Caraballeda) | Armada | centro-89 | Fundación Sol de Vargas | Armada Bolivariana |
| 24 | Escuela Guaicamacuto (Pquia. Macuto) | GNB | centro-90 | Escuela Integral Básica Guaicamacuto | GNB |
| 25 | Ciudad Vacacional Los Caracas (Pquia. Naiguatá) | *(vacío — FANB)* | centro-91 | Ciudad Vacacional Los Caracas | — |
| 26 | Universidad Simón Bolívar (Pquia. Naiguatá) | PNB | centro-92 | USB Sede Litoral (Camurí Grande) | PNB |
| 27 | La Lucha | PNB | 79017db9-… | LA LUCHA | PNB |
| 28 | Mare Abajo | GNB | 039c414d-… | MARE ABAJO | GNB |

**Subtotal La Guaira: 28 campamentos**

---

## RESUMEN GENERAL

| Estado | Campamentos | Con cuerpo | Vacío |
|---|---:|---:|---:|
| Caracas / Miranda | 64 | 59 | 5 |
| La Guaira | 28 | 24 | 4 |
| **TOTAL** | **92** | **83** | **9** |

---

**Notas**

- `centro-prueba` (sandbox): no se modifica en migraciones.
- **#28 Caracas:** MD «PSUV Caracas»; Supabase `centro-62` = «U.E.N VICENTE LANDAETA GIL» → vacío.
- **#25 La Guaira:** FANB no es cuerpo policial en el catálogo → vacío.
- Catálogo UI: `Armada Bolivariana` y `Ejército` añadidos en `centrosTransitorios.ts` (sin logo aún).
