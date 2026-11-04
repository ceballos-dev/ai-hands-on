# Día 1 · API REST de Jira con Postman

**Objetivo:** autenticarme en la API de Jira Cloud y crear una historia por API antes de conectar una IA por MCP.
**Tiempo:** [30 min]

## Qué hice
- Espacio Jira con clave DEMO (antes SCRUM) y API token de Atlassian.
- API key de Gemini (AI Studio, nivel gratuito, sin facturación) para la semana 4.
- Colección Postman con Basic Auth (email + token en Postman Vault).
- GET /rest/api/3/myself → 200
- GET /rest/api/3/project/DEMO → 200, id del tipo Historia = 10004
- POST /rest/api/3/issue → 201, ticket DEMO-5

## Qué falló y cómo lo resolví
| # | Síntoma | Causa | Cómo lo diagnostiqué | Solución |
|---|---|---|---|---|
| 1 | Token visible en una captura | Token pegado en claro en el entorno | Revisión de la captura | Token revocado, nuevo token en Postman Vault |
| 2 | 403 en HTML firmado por CloudFront | Petición enviada como GET con body | Respuesta en HTML, no en JSON: no llegó a Jira | Cambiar a POST |
| 3 | 400 "no es un contenido válido de ADF" | La API v3 exige `description` en formato ADF | Error JSON de Jira señalando el campo | Estructura ADF generada con IA y verificada con un 201 y en la web |
| 4 | Ticket creado como DEMO-5 usando la clave SCRUM | Cambié la clave del espacio; Jira mantiene la antigua como alias | Comparar la respuesta con lo esperado | Usar la clave actual DEMO |

## Aprendizajes
- Un 2xx no basta: verifico el resultado en el sistema destino.
- Primero identifico quién responde (CDN o aplicación) por el formato del error.
- La interfaz dice "espacio" y la API dice *project*.
- El id del ticket (10004) y el id del tipo de issue (10004) coinciden por casualidad: son contadores distintos.

## Uso de IA
- La IA me dio la estructura ADF; la validé contra la API real.
