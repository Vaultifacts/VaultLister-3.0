# /route - Create Backend API Route

Create new API routes for VaultLister backend.

## Usage
```
/route <name> [endpoints...]
```

## Workflow

1. **Create route file** at `src/backend/routes/<name>.js`

2. **Implement router function** with standard pattern:
   ```javascript
   import { v4 as uuidv4 } from 'uuid';
   import { query } from '../db/database.js';

   export async function <name>Router(ctx) {
       const { method, path, body, query: queryParams, user } = ctx;

       // GET /api/<name> - List all
       if (method === 'GET' && (path === '/' || path === '')) {
           // Implementation
       }

       // GET /api/<name>/:id - Get single
       if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
           const id = path.slice(1);
           // Implementation
       }

       // POST /api/<name> - Create
       if (method === 'POST' && (path === '/' || path === '')) {
           // Implementation
       }

       // PUT /api/<name>/:id - Update
       if (method === 'PUT' && path.match(/^\/[a-f0-9-]+$/)) {
           // Implementation
       }

       // DELETE /api/<name>/:id - Delete
       if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
           // Implementation
       }

       return { status: 404, data: { error: 'Route not found' } };
   }
   ```

3. **Register in server.js**
   - Add import: `import { <name>Router } from './routes/<name>.js';`
   - Add to apiRoutes: `'/api/<name>': <name>Router,`
   - Add to protectedPrefixes if auth required: `'/api/<name>',`

4. **Test endpoints**
   ```bash
   curl http://localhost:3000/api/<name>
   ```

## Response Format
```javascript
return { status: 200, data: { items: [], total: 0 } };
return { status: 201, data: { item } };
return { status: 400, data: { error: 'Validation error' } };
return { status: 404, data: { error: 'Not found' } };
```

## Best Practices
- Always validate required fields
- Use UUIDs for IDs: `const id = uuidv4();`
- Filter by `user_id` for user-scoped data
- Return consistent response shapes
- Add pagination (limit/offset) for list endpoints
