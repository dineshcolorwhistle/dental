# Implementation Plan — Multi-Language Support (i18n)

This document outlines the proposed design and implementation plan to add multi-language support (English and Spanish) to the Dental Lab Management System, with Spanish (`es`) set as the primary/default language to target users in Mexico.

---

## User Review Required

Before starting the implementation, please review the following architectural and design choices:

> [!IMPORTANT]
> **Default Language:** Spanish (`es-MX`) will be set as the system default. The application will auto-detect the user's browser language, but fallback to Spanish if the browser language is unsupported or if no language preference is set.
>
> **Database Modifications:** We propose adding a `preferredLanguage` column to the `User` and `TenantSettings` tables. This ensures the user's language setting persists across different devices and allows the backend to send transactional emails/notifications in their language of choice.
>
> **Dynamic Routing vs. Client-Side Translation:** We suggest client-side translation via `react-i18next` with local storage saving, rather than language-specific URL prefixes (like `/es/dashboard` vs `/en/dashboard`), for a cleaner single-page application experience.
>
> **Spanish Keyboard & Character Input Support:**
> * **UTF-8 Encoding:** The database (PostgreSQL via Prisma) and API layer (NestJS/JSON payload) use UTF-8 character encoding by default. This natively supports all Spanish characters (`á`, `é`, `í`, `ó`, `ú`, `ü`, `ñ`, `Ñ`, `¿`, `¡`) without any special configuration.
> * **Input Controls:** All input fields in the forms (e.g., patient name, specification notes) will accept direct keyboard entry in Spanish. The user's operating system/device keyboard layout manages the generation of these characters. They will be stored and retrieved from the database exactly as typed.

---

## Open Questions

> [!NOTE]
> 1. **Email Templates:** Are there any email notification flows currently in place that need translation files on the backend immediately?
> 2. **Master Data Translation:** Should custom database fields created by users (like custom "Work Types" or "Processes") support translations, or is it sufficient to translate only the system UI? (We recommend system UI only for Phase 1).

---

## Proposed Changes

We will group the changes into **Database**, **Backend (NestJS)**, and **Frontend (React)** layers.

---

### Database Changes

To store user language preferences, we will modify the database schema using Prisma:

#### [MODIFY] [schema.prisma](file:///c:/dental/backend/prisma/schema.prisma)

1. Introduce a `Language` enum:
   ```prisma
   enum Language {
     EN
     ES
   }
   ```
2. Add `preferredLanguage` to the `User` model:
   ```prisma
   model User {
     // ... other fields
     preferredLanguage Language @default(ES) @map("preferred_language")
     // ... relations
   }
   ```
3. Add `defaultLanguage` to `TenantSettings` model (to set a tenant-wide default):
   ```prisma
   model TenantSettings {
     // ... other fields
     defaultLanguage Language @default(ES) @map("default_language")
     // ... relations
   }
   ```
4. Run standard Prisma migrations:
   ```bash
   npx prisma migrate dev --name add_language_support
   ```

---

### Backend (NestJS) Component

We need to support detecting the language on API requests to return localized validation errors or messages.

#### [NEW] `backend/src/common/interceptors/language.interceptor.ts`
An interceptor that extracts language headers or user preferences.
- Scans `Accept-Language` header, query parameter `?lang=`, or the authenticated user's `preferredLanguage`.
- Sets a request-scoped context language value.

#### [NEW] `backend/src/common/i18n` (or integration of `nestjs-i18n`)
- Integrate `nestjs-i18n` or set up translation files (`es.json`, `en.json`) for backend error messages and email notifications.

---

### Frontend (React) Component

The React application will use `i18next` and `react-i18next` to translate UI elements.

#### [NEW] `frontend/src/i18n/config.ts`
Initialize and configure `i18next`:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      es: { translation: esTranslations },
    },
    fallbackLng: 'es', // Default to Spanish for Mexico
    supportedLngs: ['en', 'es'],
    interpolation: {
      escapeValue: false, // React already escapes values to prevent XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

#### [NEW] `frontend/src/i18n/locales/es.json`
Translation dictionary for Spanish (Mexico). Example:
```json
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "search": "Buscar...",
    "loading": "Cargando..."
  },
  "navigation": {
    "dashboard": "Tablero",
    "workOrders": "Órdenes de Trabajo",
    "doctors": "Dentistas",
    "technicians": "Técnicos",
    "branches": "Sucursales"
  },
  "login": {
    "title": "Iniciar Sesión",
    "email": "Correo Electrónico",
    "password": "Contraseña",
    "submit": "Entrar"
  }
}
```

#### [NEW] `frontend/src/i18n/locales/en.json`
Translation dictionary for English. Example:
```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "search": "Search...",
    "loading": "Loading..."
  },
  "navigation": {
    "dashboard": "Dashboard",
    "workOrders": "Work Orders",
    "doctors": "Doctors",
    "technicians": "Technicians",
    "branches": "Branches"
  },
  "login": {
    "title": "Sign In",
    "email": "Email Address",
    "password": "Password",
    "submit": "Login"
  }
}
```

#### [NEW] `frontend/src/components/LanguageSelector.tsx`
A dropdown or button toggle in the Navbar that:
- Displays current language (with a globe icon or label like `ES` / `EN`).
- Allows switching languages dynamically via `i18n.changeLanguage(lang)`.
- Sends an API call to save the user's preference in the DB if authenticated.

#### [MODIFY] [main.tsx](file:///c:/dental/frontend/src/main.tsx)
- Import `./i18n/config` at the entry point to load configuration.

#### [MODIFY] Layouts & Pages
- Replace hardcoded text strings in components with `t('namespace.key')` from the `useTranslation` hook:
  ```typescript
  import { useTranslation } from 'react-i18next';
  
  const { t } = useTranslation();
  // Usage: <h1>{t('login.title')}</h1>
  ```

---

## Challenges and Cost Implications

### Implementation Challenges
1. **Locating Hardcoded Strings:** Manually scanning all ~19 pages and components in `frontend/src/pages` (such as `WorkOrdersPage.tsx`, `FinancePage.tsx`, etc.) to extract hardcoded labels, placeholder texts, and alert messages, and replacing them with `t(...)` keys.
2. **Translation of Enums and DB Statuses:** Handling status fields like `WorkOrderStatus` (e.g., `IN_PROGRESS`, `COMPLETED`). Since these are database enums stored in English, they need lookup tables on the frontend to display translated labels (e.g., "En Progreso", "Completado") in the UI.
3. **Zod Validation Schema Messages:** Form validation schemas (defined via Zod) need translation support to show error messages (e.g., "Email is required" vs "El correo electrónico es requerido") in the user's selected language.
4. **Localization of Dates and Currencies:** Mexico targets expect date formats like `DD/MM/YYYY` and Mexican Peso currency formats (`$1,200.00 MXN`). Dayjs or standard formatting locales need to toggle dynamically based on language detection.
5. **Database Preference Persistence:** Synchronizing user language choices from the React UI to the database `preferredLanguage` field to persist user preferences across browser sessions.

### Cost & API Requirements
* **No Paid APIs Required:**
  * The frontend localization libraries (`i18next` and `react-i18next`) are completely open-source and free.
  * All translations are stored inside local JSON files (`es.json`, `en.json`), meaning no external machine translation API (like Google Translate or DeepL) is requested to display UI translations.
* **Potential Future Costs (Optional):** If the client later requests *automatic real-time translation of user-entered comments/notes* (e.g. translating custom technician notes from Spanish to English), we would need to integrate a paid service like Google Translate API. Dynamic translation of the application interface, however, does not require it.

---

## Verification Plan

### Automated Tests
- Test language utility functions and language detector configuration.
- Write backend middleware unit tests verifying the extraction of `Accept-Language` headers.

### Manual Verification
1. Open the application. Check that Spanish is active by default.
2. Toggle the language selector to "English" and verify that:
   - UI elements change to English.
   - Page URL/state stays consistent.
   - Setting is saved in `localStorage` and persists on page reload.
3. Authenticate, change language settings, and verify the `preferredLanguage` changes in the database.
