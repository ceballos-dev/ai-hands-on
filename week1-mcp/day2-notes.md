# Día 2 · Claude conectado a Jira (conector MCP de Atlassian)

**Tiempo:** ~1 h el paso 0 [ajustar el total]

## Mi referencia antes de usar IA (paso 0)
- Épica "Comunicación con Mercedes" con 3 historias: recuperación y listado de piezas de repuesto, pedido de piezas de repuesto, solicitud de stock de vehículos de fábrica.
- Preguntas al cliente: qué API usar y qué datos de acceso; cómo van a usar la información; cómo quieren las interfaces de solicitud y visualización.

## Prompts usados
- Paso 3 (ingenuo): "Crea en el espacio DEMO un ticket por cada petición de este email: ..."
- Paso 4 (diseñado): "Tenemos que corregir los tickets,Primero necesito una EPICA qeu se llame Conector Mercedes, una descripcion de la epica y en el tenemos la preguntas para el cliente siguientes:
                      ¿Cual es la api a utilizar?¿Que tipo de autenticacion tienen y cuales son las credenciales?¿Hay que realizar una certificacion con ellos? Dentro de los tickets hay que quitar el correo que no es necesario, se puede poner como dato adjunto en la epica.
                      Hay que añadir un ticket que sea conexion con la API que sera el ticket para comprobar credenciales y se creara la funcion de conexion para lanzar las consultas.
                        Tambien añadiria un ticket de certificacion porque probablemente hay que pasarlo. De  momento haz esto"
- Paso 5 (corrección): tiene que asociar estos tickets a la epica recien creada, Los 3 tickets depende de la tarea conexion con la API, y la DEMO 11 depende de que todas las anteriores esten realizadas,
                      Muestrame los cambios antes de hacerlos. Por otra parte Actualiza DEMO-6, 7 y 8: formato “Como… quiero… para…”. Todo lo que no esté en el email del cliente márcalo como “(supuesto, confirmar con el cliente)” y añádelo a la sección de preguntas. Incluye solo criterios de aceptación
                      genéricos de integración (errores, timeouts, registro) y deja los de negocio como pendientes. Enséñame la propuesta antes de modificar nada.PAra DEMO 6 vamos a suponer que las consultas se harán por partnumber, bastidor del vehiculo y por descripcion. Es mas tiene sentido que cuando
                      se va a pedir una pieza de repuesto se indique el bastidor seimpre porqeu de ese modo sabemos si las piezas son compatibles.
                      El usuario seran los del departamento de recambios que tiene todo taller, se consultan las piezas para poder realizar el pedido.
                      Para DEMO 7 TEnemos que confirmar con el cliente a que se refiere con hacer pedidos si es de vehiculos o de piezas, aunqeu entendemos que sea de piezas ya que las estamos consultando.
                      En el caso de piezas vovleran a ser los usuarios del departamento de recambios. El resto de preguntas tienen sentido.
                      Para DEMO-8 el stock lo querra ver un comercial ya que es el que se dedica a la venta de vehiculos, hay que preguntar si el stock es de vehiculo nuevo o usado de la red mercedes, 
                      Si se va ver un listado de stock ¿significa que tambien quieren hacer pedidos de estos vehiculos?
                      Cambia en DEMO-10 la frase “credenciales facilitadas por el cliente” por una pregunta abierta y pon estas prioridades: DEMO-10 Highest, DEMO-6 High, DEMO-8 Medium, DEMO-7 Low.

## Resultados
| Paso | Tickets | Qué hizo bien | Qué hizo mal | Cómo lo detecté |
|---|---|---|---|---|
| 3 | DEMO-6, 7, 8 | No inventó datos; preguntas lógicas | Sin épica (cumplió la instrucción literal), sin trabajo común, "Como usuario" sin "para…", interpretó "recuperar" como "consultar" sin marcarlo, escribió en Jira sin enseñarme la propuesta | Revisión en Jira contra el email y contra mi referencia |
| 4 | DEMO-9, 10, 11 | Épica, ticket habilitador, certificación (aportada por mí en el prompt), preguntas comunes en la épica | Dependencias solo en texto, historias sin actualizar, supuso que las credenciales las da el cliente, todo con prioridad Medium | Revisión en Jira (con ayuda del tutor) |
| 5 | DEMO-6, 7, 8, 10 | Enlaces "bloquea" creados; historias con rol, "para…" y supuestos marcados; criterios de integración genéricos; pregunta de pedidos duplicados | No cambió títulos, credenciales ni prioridades: no se lo pedí o no lo aprobé | Revisión en Jira |
| 5b | DEMO-6, 7, 8, 10 | Títulos, pregunta abierta de credenciales y prioridades aplicados | — | Verificado en Jira |

## Mi referencia frente a la IA
| Aporte | Yo | IA |
|---|---|---|
| Épica | ✅ | ❌ (paso 3) |
| Certificación con la marca | ✅ | ❌ |
| Para qué usan la información | ✅ | ❌ (paso 3) |
| Diseño de interfaces | ✅ | ❌ |
| Pedidos duplicados si falla la conexión | ❌ | ✅ |
| Stock de concesionario o de fábrica | ❌ (supuse "fábrica" sin marcarlo) | ✅ |
| Pedido de piezas o de vehículos | ❌ (supuse "piezas") | ✅ |
| Ticket habilitador de conexión | ❌ | ❌ (sugerencia del tutor) |

## Aprendizajes
- La IA no estructura el trabajo por su cuenta: si quiero una jerarquía, la tengo que pedir.
- Lo que no está en el email no se escribe como hecho: se pregunta o se marca como supuesto. Yo también cometí ese fallo en mi referencia.
- La IA aporta casos técnicos límite (duplicados); yo aporto el dominio (certificación) y el negocio (uso, interfaces).
- Pedir siempre la propuesta antes de escribir en Jira. La aprobación previa solo cubre lo que apruebo de forma explícita.
- Verificar siempre en Jira: nunca doy por hecho que se aplicó todo.
- Mi tutor (IA) propuso un rol y un beneficio que no venían en el email; lo detecté yo.
