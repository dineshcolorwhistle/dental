# Dental Lab Management System — Frontend Design Rules

## 🎨 Color Palette & Theming
The application supports both Light (default) and Dark themes. The themes are strictly controlled by CSS variables located in `src/index.css`.

**Core Palette Rules:**
Any new UI component **MUST ONLY** use the provided CSS variables. **DO NOT** hardcode hex colors in your components.

*   **Primary Blue:** `#6FAED9` → mapped to `--accent-primary`
*   **Soft Sky Blue:** `#A9CFE8` → mapped to `--accent-secondary`
*   **Very Light Blue (Tint):** `#EAF4FB` → mapped to `--bg-base` (in Light Mode)

### Using Variables
Whenever styling elements, refer to the semantic variables:
*   `--bg-base`: Main page background.
*   `--bg-surface`: Containers, sidebars, topbars.
*   `--bg-card`: Cards with glassmorphism effects.
*   `--text-primary`, `--text-secondary`, `--text-muted`: Text colors.
*   `--accent-primary`, `--accent-secondary`: Buttons, links, active states, and gradients.

**Example Usage:**
```css
.my-new-button {
  background: var(--accent-primary);
  color: #fff;
}
.my-new-button:hover {
  background: var(--accent-primary-hover);
}
```

## 🌗 Dark Mode Implementation
*   Dark mode is activated when the `data-theme="dark"` attribute is present on the `<html>` document root.
*   The `ThemeContext` automatically handles the toggle and persists the user's preference in `localStorage`.
*   You can access the current theme via `const { theme, toggleTheme } = useTheme();`.

## 📱 Mobile-Friendly & Responsive Guidelines
1.  **Fluid Layouts:** Avoid fixed widths (e.g., `width: 500px;`). Use `max-width`, `flex`, `grid`, and percentages.
2.  **Breakpoints:**
    *   `@media (max-width: 768px)`: Target tablets and smaller. E.g., collapse the sidebar into a hamburger menu.
    *   `@media (max-width: 480px)`: Target mobile phones. E.g., stack grid columns.
3.  **Touch Targets:** Ensure all buttons, links, and inputs are at least `44px` tall for easy tapping on mobile devices.
4.  **Padding & Margins:** Use responsive padding. (e.g. `padding: 1rem` on mobile, `padding: 2rem` on desktop).
