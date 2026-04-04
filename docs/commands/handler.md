# /handler - Create Frontend Handler

Create event handlers for frontend functionality.

## Usage
```
/handler <name> [type]
```

Types: `crud`, `form`, `modal`, `tab`, `filter`

## Workflow

1. **Add handler to handlers object** in app.js
2. **Connect to UI** via onclick, onchange, etc.
3. **Test functionality**

## Handler Templates

### CRUD Handler
```javascript
// Load items
load<Items>: async function() {
    try {
        const data = await api.get('/<items>');
        store.setState({ <items>: data.<items> || [] });
    } catch (error) {
        console.error('Failed to load:', error);
        toast.error('Failed to load <items>');
    }
},

// Create item
add<Item>: async function(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const itemData = {
        field1: formData.get('field1'),
        field2: formData.get('field2')
    };

    try {
        await api.ensureCSRFToken();
        await api.post('/<items>', itemData);
        toast.success('<Item> created successfully');
        modals.close();
        await this.load<Items>();
        renderApp(pages.<page>());
    } catch (error) {
        toast.error('Failed to create: ' + error.message);
    }
},

// Delete item
delete<Item>: async function(id) {
    if (!confirm('Are you sure you want to delete this?')) return;

    try {
        await api.ensureCSRFToken();
        await api.delete(`/<items>/${id}`);
        toast.success('<Item> deleted');
        await this.load<Items>();
        renderApp(pages.<page>());
    } catch (error) {
        toast.error('Failed to delete: ' + error.message);
    }
}
```

### Form Handler
```javascript
submit<Form>: async function(event) {
    event.preventDefault();

    // Get form values
    const field1 = document.getElementById('field1').value;
    const field2 = document.getElementById('field2').value;

    // Validate
    if (!field1 || !field2) {
        toast.error('All fields required');
        return;
    }

    try {
        await api.ensureCSRFToken();
        await api.post('/endpoint', { field1, field2 });
        toast.success('Saved successfully');
    } catch (error) {
        toast.error('Failed to save: ' + error.message);
    }
}
```

### Modal Handler
```javascript
show<Modal>: function(data = null) {
    const isEdit = data !== null;

    modals.show(`
        <div class="modal-header">
            <h3>${isEdit ? 'Edit' : 'Add'} <Item></h3>
            <button class="btn btn-ghost" onclick="modals.close()">&times;</button>
        </div>
        <form onsubmit="handlers.save<Item>(event, ${isEdit ? `'${data.id}'` : 'null'})">
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Field</label>
                    <input type="text" class="form-input" name="field"
                           value="${isEdit ? escapeHtml(data.field) : ''}" required>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'}</button>
            </div>
        </form>
    `);
}
```

### Tab Handler
```javascript
switch<Page>Tab: function(tab) {
    store.setState({ <page>Tab: tab });
    if (store.state.currentPage === '<page>') {
        renderApp(pages.<page>());
    }
}
```

### Filter Handler
```javascript
filter<Items>: function() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const status = document.getElementById('status-filter').value;

    store.setState({
        <items>Search: search,
        <items>StatusFilter: status
    });

    renderApp(pages.<page>());
}
```

## UI Connection
```html
<!-- Button click -->
<button onclick="handlers.doSomething()">Click</button>

<!-- Form submit -->
<form onsubmit="handlers.submitForm(event)">

<!-- Input change -->
<input onchange="handlers.handleChange(this.value)">

<!-- Select change -->
<select onchange="handlers.filterBy(this.value)">
```
