# API keys

## Create
Authenticated OWNER/ADMIN:

```http
POST /api/api-keys
Authorization: Bearer <access_jwt>
Content-Type: application/json

{ "organizationId": "<uuid>", "name": "CI", "scopes": ["scans:write", "scans:read"] }
```

Response includes `key` **once** (`qalab_…`).

## Authenticate

```http
POST /api/scans
Authorization: Bearer qalab_…
Content-Type: application/json

{ "websiteId": "<uuid>", "maxPages": 20 }
```

Or:

```http
X-API-Key: qalab_…
```

## Scopes
| Scope | Routes |
|-------|--------|
| `scans:write` | `POST /scans`, `POST /scans/:id/cancel` |
| `scans:read` | `GET /scans`, `GET /scans/:id` |

API keys only access websites/projects inside **their organization**.

## CI example

```bash
export QA_LAB_API_KEY=qalab_…
export API=https://api.example.com/api
export WEBSITE_ID=…

curl -sS -X POST "$API/scans" \
  -H "Authorization: Bearer $QA_LAB_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"websiteId\":\"$WEBSITE_ID\",\"maxPages\":30}"
```
