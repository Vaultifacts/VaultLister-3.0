# /style - Add CSS Styles

Add and manage CSS styles for VaultLister.

## Usage
```
/style <component|pattern> [variant]
```

## Workflow

1. **Identify what needs styling**
   - New component?
   - Dark mode variant?
   - Responsive adjustment?

2. **Find appropriate section** in `src/frontend/styles/main.css`
   - Components are grouped by type
   - Dark mode styles use `body.dark-mode` prefix

3. **Add styles following patterns**

## Style Patterns

### Card Component
```css
.my-card {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--gray-200);
    overflow: hidden;
}

.my-card-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--gray-200);
}

.my-card-body {
    padding: var(--space-4);
}

/* Dark mode */
body.dark-mode .my-card {
    background: var(--gray-800);
    border-color: var(--gray-700);
}
```

### Button Variants
```css
.btn-custom {
    background: var(--custom-color);
    color: white;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-weight: 500;
    transition: all 0.2s;
}

.btn-custom:hover {
    background: var(--custom-color-dark);
}

.btn-custom:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### Form Elements
```css
.form-custom {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--gray-300);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    transition: border-color 0.2s;
}

.form-custom:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

body.dark-mode .form-custom {
    background: var(--gray-700);
    border-color: var(--gray-600);
    color: white;
}
```

### Badge/Tag
```css
.badge-custom {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
    font-weight: 500;
    border-radius: var(--radius-full);
    background: var(--custom-bg);
    color: var(--custom-text);
}
```

### Table Styles
```css
.data-table-custom {
    width: 100%;
    border-collapse: collapse;
}

.data-table-custom th {
    text-align: left;
    padding: var(--space-3);
    font-weight: 600;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    color: var(--gray-500);
    border-bottom: 2px solid var(--gray-200);
}

.data-table-custom td {
    padding: var(--space-3);
    border-bottom: 1px solid var(--gray-100);
}

.data-table-custom tr:hover {
    background: var(--gray-50);
}
```

### Responsive Layout
```css
.responsive-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-6);
}

@media (max-width: 1024px) {
    .responsive-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 640px) {
    .responsive-grid {
        grid-template-columns: 1fr;
    }
}
```

### Empty State
```css
.empty-state-custom {
    text-align: center;
    padding: var(--space-8);
}

.empty-state-custom-icon {
    color: var(--gray-400);
    margin-bottom: var(--space-4);
}

.empty-state-custom-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--gray-700);
    margin-bottom: var(--space-2);
}

.empty-state-custom-description {
    color: var(--gray-500);
    margin-bottom: var(--space-4);
}
```

## CSS Variables Available
```css
/* Colors */
--primary: #4f46e5;
--success: #10b981;
--warning: #f59e0b;
--error: #ef4444;
--gray-50 through --gray-900

/* Spacing */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;

/* Typography */
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 18px;
--font-size-xl: 20px;

/* Border Radius */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-full: 9999px;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
```
