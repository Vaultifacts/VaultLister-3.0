# /page - Create Frontend Page

Create new frontend pages for VaultLister SPA.

## Usage
```
/page <name> [tabs...]
```

## Workflow

1. **Add state properties** in `src/frontend/core/store.js` store.state:
   ```javascript
   state: {
       // ... existing
       <name>Tab: 'default',
       <name>Data: [],
   }
   ```

2. **Create page function** in pages object:
   ```javascript
   <name>() {
       const currentTab = store.state.<name>Tab || 'default';
       const data = store.state.<name>Data || [];

       const tabContent = {
           default: `
               <div class="card">
                   <div class="card-header">
                       <h3 class="card-title">Title</h3>
                   </div>
                   <div class="card-body">
                       ${data.length === 0 ? `
                           <div class="empty-state">
                               <div class="empty-state-icon">${components.icon('icon', 48)}</div>
                               <h3 class="empty-state-title">No data yet</h3>
                               <p class="empty-state-description">Description here</p>
                           </div>
                       ` : `
                           <!-- Data display -->
                       `}
                   </div>
               </div>
           `
       };

       return `
           <div class="page-header">
               <h1 class="page-title">${Name}</h1>
               <p class="page-description">Page description</p>
           </div>

           <div class="tabs mb-6">
               <button class="tab ${currentTab === 'default' ? 'active' : ''}"
                       onclick="handlers.switch${Name}Tab('default')">Tab 1</button>
           </div>

           ${tabContent[currentTab] || tabContent.default}
       `;
   }
   ```

3. **Add handlers**:
   ```javascript
   switch<Name>Tab: function(tab) {
       store.setState({ <name>Tab: tab });
       if (store.state.currentPage === '<name>') {
           renderApp(pages.<name>());
       }
   },

   load<Name>Data: async function() {
       try {
           const data = await api.get('/<name>');
           store.setState({ <name>Data: data.items || [] });
       } catch (error) {
           toast.error('Failed to load data');
       }
   }
   ```

4. **Add navigation** in sidebar navItems:
   ```javascript
   { id: '<name>', label: '<Name>', icon: 'icon-name' }
   ```

5. **Register route**:
   ```javascript
   router.register('<name>', () => renderApp(pages.<name>()));
   ```

## Components Available
- `components.statCard(title, value, icon, change)`
- `components.icon(name, size)`
- `components.platformLogo(platform)`
- `escapeHtml(text)` for user content
