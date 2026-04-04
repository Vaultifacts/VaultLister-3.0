# /api - Test API Endpoints

Test and debug API endpoints.

## Usage
```
/api <method> <endpoint> [data]
```

## Workflow

1. **Get auth token** (for protected routes)
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@vaultlister.com","password":"DemoPassword123!"}'
   ```

2. **Make API request**
   ```bash
   # GET request
   curl http://localhost:3000/api/endpoint \
     -H "Authorization: Bearer <token>"

   # POST request
   curl -X POST http://localhost:3000/api/endpoint \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"field":"value"}'

   # PUT request
   curl -X PUT http://localhost:3000/api/endpoint/id \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"field":"newvalue"}'

   # DELETE request
   curl -X DELETE http://localhost:3000/api/endpoint/id \
     -H "Authorization: Bearer <token>"
   ```

3. **Analyze response**
   - Check status code
   - Verify response data structure
   - Check for errors

## Common Endpoints

### Authentication
```bash
# Login
POST /api/auth/login
{"email":"...", "password":"..."}

# Register
POST /api/auth/register
{"email":"...", "password":"...", "fullName":"..."}

# Refresh token
POST /api/auth/refresh
{"refreshToken":"..."}
```

### Inventory
```bash
# List inventory
GET /api/inventory?limit=50&offset=0&status=active

# Get single item
GET /api/inventory/:id

# Create item
POST /api/inventory
{"title":"...", "category":"...", "costPrice":0, "listPrice":0}

# Update item
PUT /api/inventory/:id
{"title":"...", "status":"..."}

# Delete item
DELETE /api/inventory/:id
```

### Sales
```bash
# List sales
GET /api/sales?platform=ebay&status=pending

# Record sale
POST /api/sales
{"inventoryId":"...", "platform":"ebay", "salePrice":50, "buyerUsername":"..."}

# Update sale status
PUT /api/sales/:id
{"status":"shipped", "trackingNumber":"..."}
```

### Financials
```bash
# List purchases
GET /api/financials/purchases

# Create purchase
POST /api/financials/purchases
{"vendorName":"...", "purchaseDate":"2024-01-01", "items":[...]}

# Get P&L
GET /api/financials/profit-loss?start=2024-01-01&end=2024-12-31

# Get financial statements
GET /api/financials/statements?start=2024-01-01&end=2024-12-31
```

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (CSRF, rate limit) |
| 404 | Not found |
| 429 | Too many requests |
| 500 | Server error |

## Debugging Tips

### Check if server is running
```bash
curl http://localhost:3000/api/auth/login -I
```

### See full response with headers
```bash
curl -v http://localhost:3000/api/endpoint
```

### Pretty print JSON
```bash
curl http://localhost:3000/api/endpoint | jq .
```

### Test with CSRF token
```bash
# Get CSRF token from response header
TOKEN=$(curl -s -I http://localhost:3000/api/auth/csrf | grep X-CSRF-Token | cut -d' ' -f2)

# Use in subsequent request
curl -X POST http://localhost:3000/api/endpoint \
  -H "X-CSRF-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```
