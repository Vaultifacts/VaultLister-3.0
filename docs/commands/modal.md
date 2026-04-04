# /modal - Create Modal Dialog

Create modal dialogs for forms, confirmations, and detail views.

## Usage
```
/modal <name> [type]
```

Types: `form`, `confirm`, `detail`, `wizard`

## Modal Templates

### Form Modal
```javascript
// Handler to show modal
showAdd<Item>Modal: function() {
    modals.show(`
        <div class="modal-header">
            <h3>Add <Item></h3>
            <button class="btn btn-ghost btn-sm" onclick="modals.close()">&times;</button>
        </div>
        <form onsubmit="handlers.save<Item>(event)">
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Name *</label>
                    <input type="text" class="form-input" name="name" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-input" name="description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select class="form-select" name="category">
                        <option value="">Select...</option>
                        <option value="type1">Type 1</option>
                        <option value="type2">Type 2</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create</button>
            </div>
        </form>
    `);
},

// Handler to save
save<Item>: async function(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const data = {
        name: formData.get('name'),
        description: formData.get('description'),
        category: formData.get('category')
    };

    try {
        await api.ensureCSRFToken();
        await api.post('/<items>', data);
        toast.success('<Item> created successfully');
        modals.close();
        await this.load<Items>();
        renderApp(pages.<page>());
    } catch (error) {
        toast.error('Failed to create: ' + error.message);
    }
}
```

### Edit Modal (with existing data)
```javascript
showEdit<Item>Modal: function(item) {
    modals.show(`
        <div class="modal-header">
            <h3>Edit <Item></h3>
            <button class="btn btn-ghost btn-sm" onclick="modals.close()">&times;</button>
        </div>
        <form onsubmit="handlers.update<Item>(event, '${item.id}')">
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Name *</label>
                    <input type="text" class="form-input" name="name"
                           value="${escapeHtml(item.name)}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-input" name="description" rows="3">${escapeHtml(item.description || '')}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button type="submit" class="btn btn-primary">Update</button>
            </div>
        </form>
    `);
}
```

### Confirmation Modal
```javascript
showConfirmDelete: function(id, name) {
    modals.show(`
        <div class="modal-header">
            <h3>Confirm Delete</h3>
            <button class="btn btn-ghost btn-sm" onclick="modals.close()">&times;</button>
        </div>
        <div class="modal-body">
            <p>Are you sure you want to delete <strong>${escapeHtml(name)}</strong>?</p>
            <p class="text-sm text-gray-500">This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
            <button class="btn btn-error" onclick="handlers.confirmDelete('${id}')">Delete</button>
        </div>
    `);
}
```

### Detail View Modal
```javascript
showDetail<Item>: function(item) {
    modals.show(`
        <div class="modal-header">
            <h3>${escapeHtml(item.name)}</h3>
            <button class="btn btn-ghost btn-sm" onclick="modals.close()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="detail-grid">
                <div class="detail-row">
                    <span class="detail-label">Created</span>
                    <span class="detail-value">${new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="badge badge-${item.status === 'active' ? 'success' : 'secondary'}">${item.status}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value">${escapeHtml(item.description || 'No description')}</span>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="modals.close()">Close</button>
            <button class="btn btn-primary" onclick="handlers.showEdit<Item>Modal(${JSON.stringify(item).replace(/"/g, '&quot;')})">Edit</button>
        </div>
    `);
}
```

### Wizard/Multi-Step Modal
```javascript
// State for wizard
wizardStep: 1,
wizardData: {},

showWizard: function() {
    this.wizardStep = 1;
    this.wizardData = {};
    this.renderWizardStep();
},

renderWizardStep: function() {
    const steps = {
        1: `
            <div class="form-group">
                <label class="form-label">Step 1: Basic Info</label>
                <input type="text" class="form-input" id="wizard-name" placeholder="Name">
            </div>
        `,
        2: `
            <div class="form-group">
                <label class="form-label">Step 2: Details</label>
                <textarea class="form-input" id="wizard-details" rows="4" placeholder="Details"></textarea>
            </div>
        `,
        3: `
            <div class="form-group">
                <label class="form-label">Step 3: Confirm</label>
                <p>Name: ${escapeHtml(this.wizardData.name || '')}</p>
                <p>Details: ${escapeHtml(this.wizardData.details || '')}</p>
            </div>
        `
    };

    modals.show(`
        <div class="modal-header">
            <h3>Setup Wizard - Step ${this.wizardStep} of 3</h3>
            <button class="btn btn-ghost btn-sm" onclick="modals.close()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="wizard-progress mb-4">
                ${[1,2,3].map(s => `<div class="wizard-step ${s <= this.wizardStep ? 'active' : ''}">${s}</div>`).join('')}
            </div>
            ${steps[this.wizardStep]}
        </div>
        <div class="modal-footer">
            ${this.wizardStep > 1 ? '<button class="btn btn-secondary" onclick="handlers.wizardPrev()">Back</button>' : ''}
            ${this.wizardStep < 3
                ? '<button class="btn btn-primary" onclick="handlers.wizardNext()">Next</button>'
                : '<button class="btn btn-success" onclick="handlers.wizardFinish()">Finish</button>'}
        </div>
    `);
},

wizardNext: function() {
    // Save current step data
    if (this.wizardStep === 1) {
        this.wizardData.name = document.getElementById('wizard-name').value;
    } else if (this.wizardStep === 2) {
        this.wizardData.details = document.getElementById('wizard-details').value;
    }
    this.wizardStep++;
    this.renderWizardStep();
},

wizardPrev: function() {
    this.wizardStep--;
    this.renderWizardStep();
},

wizardFinish: async function() {
    // Submit wizard data
    try {
        await api.post('/endpoint', this.wizardData);
        toast.success('Setup complete!');
        modals.close();
    } catch (error) {
        toast.error('Failed: ' + error.message);
    }
}
```

## Modal CSS (already in main.css)
```css
.modal-overlay { ... }
.modal { max-width: 500px; }
.modal-header { display: flex; justify-content: space-between; }
.modal-body { padding: 20px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; }
```
