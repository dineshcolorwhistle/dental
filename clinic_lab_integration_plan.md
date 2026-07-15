# Clinic and Lab Integration Module Implementation Plan

This plan details the design and implementation steps for completing the Clinic and Lab integration module in the Dental Lab Management System.

---

## Proposed Architecture

To connect the external Clinic application with our Lab application, we will extend the existing `IntegrationController` under the `integration` module. Since a secure API key authentication strategy via `ApiKeyGuard` (`X-API-Key` header) is already implemented in the Lab application, we will leverage it to authenticate the Clinic application.

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│        Clinic Portal            │                 │         Lab Application         │
│ (External App / Client Portal)  │                 │    (This NestJS / React App)    │
└────────────────┬────────────────┘                 └────────────────┬────────────────┘
                 │                                                   │
                 │ 1. Initial Setup / Configuration                  │
                 ├──────────────────────────────────────────────────►│ POST /api/integration/config
                 │ (Header: X-API-Key: <key>)                        │
                 │                                                   │
                 │ 2. Request WO Setup Metadata (Folio & Prosthesis) │
                 ├──────────────────────────────────────────────────►│ GET /api/integration/work-orders/setup
                 │ (Header: X-API-Key: <key>)                        │
                 │                                                   │
                 │ 3. Create Work Order                              │
                 ├──────────────────────────────────────────────────►│ POST /api/integration/work-orders
                 │ (Header: X-API-Key: <key>)                        │
                 │                                                   │
                 │ 4. Fetch Pending External Verifications           │
                 ├──────────────────────────────────────────────────►│ GET /api/integration/work-orders/pending-verifications
                 │ (Header: X-API-Key: <key>)                        │
                 │                                                   │
                 │ 5. Submit Verification Decision (Success/Rework)  │
                 ├──────────────────────────────────────────────────►│ POST /api/integration/work-orders/verify
                 │ (Header: X-API-Key: <key>)                        │
                 │                                                   │
```

---

## Proposed Design Choices & Requirements Additions

> [!IMPORTANT]
> **API Key Scope and Doctor/Clinic Mapping**
> - **API Key Security:** Every integration request is authenticated with the `X-API-Key` header, validating the specific tenant and branch.
> - **Clinic & Doctor Sync:** 
>   - A clinic is uniquely identified by its URL (`clinicUrl`), and can have multiple doctors.
>   - The configuration endpoint accepts `clinicUrl` and doctor details (such as `name`, `email`).
>   - We lookup/register each doctor row in the database using the criteria `{ externalId: clinicUrl, name: doctorName, tenantId, branchId }`, mapping `clinicUrl` to the `externalId` column.
>   - The config response returns the doctor's unique system database UUID (`id`).
> - **Multi-Doctor & Multi-Clinic Isolation:** Subsequent calls (like Work Order creation) require sending BOTH `clinicUrl` and `doctorId` to ensure requests are authorized and correctly scoped to the specific doctor of that clinic.
> - **Process Automation:** Predefined process assignments for the chosen prosthesis type are loaded dynamically, mapped to new work order process steps, and initialized.
> - **In-App Notifications:** When a new Work Order is created from the Clinic application, all active Admins and Owners of the associated branch are notified. Both English and Spanish notification messages are fully supported.
> 
> **External Verification & Clinic Notifications**
> - **Clinic Notification Email:** When a work order transitions to an external verification stage (`isVerification: true` and `technicianId: null`), the lab application will automatically trigger an email notification to the clinic doctor (if the doctor has a configured email).
> - **Spanish & English Templates:** Handlebars templates (`external-verification-pending.hbs` and `external-verification-pending-es.hbs`) will be created to send stylized emails in the doctor's preferred or organization fallback language.
> - **Verification Completion Integration:** A new endpoint `POST /api/integration/work-orders/verify` will allow external clinics to approve or reject the verification. This will leverage the existing robust `WorkOrdersService.endVerification` method, automatically handling step completion, transitions to subsequent steps, repetitions, or rework flags.

---

## API Endpoints Reference and Payloads

Below are concrete examples of the request and response formats for all the integration endpoints using `clinicUrl` and `doctorId` as identifiers:

### 1. Initial Setup / Configuration
Register or update the clinic doctor information in the lab system.

- **URL:** `POST /api/integration/config`
- **Headers:** 
  - `X-API-Key: dlk_examplekey12345`
  - `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "clinicUrl": "https://smiledental.com",
    "name": "Dr. Jane Doe",
    "clinicName": "Smile Dental Clinic",
    "email": "jane.doe@example.com",
    "phone": "+1234567890",
    "address": "123 Main St, Suite 4B"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "lab": {
      "id": "lab-branch-uuid-456",
      "name": "Downtown Lab Branch",
      "code": "DTL",
      "organization": "Mega Dental Labs Inc"
    },
    "doctor": {
      "id": "doctor-uuid-in-lab-database",
      "name": "Dr. Jane Doe",
      "clinicName": "Smile Dental Clinic",
      "externalId": "https://smiledental.com"
    }
  }
  ```

---

### 2. Request Work Order Setup Metadata
Fetch available prosthesis types and generate the next valid sequential folio number.

- **URL:** `GET /api/integration/work-orders/setup`
- **Headers:** 
  - `X-API-Key: dlk_examplekey12345`
- **Request Body:** None
- **Response (200 OK):**
  ```json
  {
    "prosthesisTypes": [
      {
        "id": "prosthesis-type-uuid-1",
        "name": "Zirconia Crown",
        "description": "High-translucency monolithic zirconia restoration"
      },
      {
        "id": "prosthesis-type-uuid-2",
        "name": "E.Max Veneer",
        "description": "Lithium disilicate glass-ceramic veneer"
      }
    ],
    "nextFolioNumber": "DTL0042"
  }
  ```

---

### 3. Create Work Order
Submit a new work order from the clinic application. The lab system dynamically resolves the default processes for the selected prosthesis type and triggers notifications.

- **URL:** `POST /api/integration/work-orders`
- **Headers:** 
  - `X-API-Key: dlk_examplekey12345`
  - `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "clinicUrl": "https://smiledental.com",
    "doctorId": "doctor-uuid-in-lab-database",
    "patient": "John Smith",
    "prosthesisTypeId": "prosthesis-type-uuid-1",
    "boxNumber": "Box 105",
    "color": "A2",
    "notes": "Urgent, please complete before Saturday.",
    "totalQuote": 450.00,
    "initialPayment": 100.00
  }
  ```
- **Response (21 Created):**
  ```json
  {
    "id": "work-order-uuid-1234",
    "tenantId": "tenant-uuid-5678",
    "branchId": "lab-branch-uuid-456",
    "folioNumber": "DTL0042",
    "doctorId": "doctor-uuid-in-lab-database",
    "patient": "John Smith",
    "boxNumber": "Box 105",
    "prosthesisTypeId": "prosthesis-type-uuid-1",
    "specification": null,
    "color": "A2",
    "notes": "Urgent, please complete before Saturday.",
    "totalQuote": 450,
    "initialPayment": 100,
    "qrToken": "qr-token-uuid-abcd",
    "status": "CREATED",
    "repetitionCount": 0,
    "createdById": "admin-user-uuid",
    "createdAt": "2026-07-15T13:24:22.000Z",
    "updatedAt": "2026-07-15T13:24:22.000Z",
    "processes": [
      {
        "id": "process-uuid-99",
        "workOrderId": "work-order-uuid-1234",
        "processName": "Scanning",
        "technicianId": "tech-user-uuid",
        "sequence": 0,
        "isVerification": false,
        "status": "NOT_STARTED"
      },
      {
        "id": "process-uuid-100",
        "workOrderId": "work-order-uuid-1234",
        "processName": "Quality Check",
        "technicianId": null,
        "sequence": 1,
        "isVerification": true,
        "status": "NOT_STARTED"
      }
    ]
  }
  ```

---

### 4. Fetch Pending External Verifications
Allows the clinic application to query work orders that are currently waiting for their verification decision.

- **URL:** `GET /api/integration/work-orders/pending-verifications?clinicUrl=https%3A%2F%2Fsmiledental.com&doctorId=doctor-uuid-in-lab-database`
- **Headers:** 
  - `X-API-Key: dlk_examplekey12345`
- **Request Body:** None
- **Response (200 OK):**
  ```json
  [
    {
      "id": "work-order-uuid-1234",
      "folioNumber": "DTL0042",
      "patient": "John Smith",
      "boxNumber": "Box 105",
      "color": "A2",
      "notes": "Urgent, please complete before Saturday.",
      "status": "CREATED",
      "createdAt": "2026-07-15T13:24:22.000Z",
      "prosthesisType": {
        "id": "prosthesis-type-uuid-1",
        "name": "Zirconia Crown"
      },
      "processes": [
        {
          "id": "process-uuid-100",
          "workOrderId": "work-order-uuid-1234",
          "processName": "Quality Check",
          "sequence": 1,
          "isVerification": true,
          "status": "IN_PROGRESS",
          "startedAt": "2026-07-15T13:30:00.000Z"
        }
      ]
    }
  ]
  ```

---

### 5. Submit Verification Decision
Submit a decision to approve or reject the verification.

- **URL:** `POST /api/integration/work-orders/verify`
- **Headers:** 
  - `X-API-Key: dlk_examplekey12345`
  - `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "clinicUrl": "https://smiledental.com",
    "doctorId": "doctor-uuid-in-lab-database",
    "workOrderId": "work-order-uuid-1234",
    "outcome": "SUCCESS",
    "notes": "Crown looks perfect and fits nicely."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Verification outcome SUCCESS submitted successfully.",
    "nextStep": {
      "processName": "Finishing",
      "status": "NOT_STARTED"
    }
  }
  ```

---

## Proposed Changes

### 1. Mail Templates & Service (NestJS)

#### [NEW] [external-verification-pending.hbs](file:///c:/dental/backend/src/modules/mail/templates/external-verification-pending.hbs)
- Styled Handlebars email template in English to notify the clinic doctor that their verification is required.

#### [NEW] [external-verification-pending-es.hbs](file:///c:/dental/backend/src/modules/mail/templates/external-verification-pending-es.hbs)
- Styled Handlebars email template in Spanish (default fallback).

#### [MODIFY] [mail.service.ts](file:///c:/dental/backend/src/modules/mail/mail.service.ts)
- Add `sendExternalVerificationPending` method to send the email using the appropriate language template.

---

### 2. DTO Files (NestJS)

We will introduce the following DTOs under `backend/src/modules/integration/dto`:

#### [NEW] [configure-integration.dto.ts](file:///c:/dental/backend/src/modules/integration/dto/configure-integration.dto.ts)
- Payload for registering/updating clinic doctor. Use `clinicUrl` as unique identifier.
```typescript
import { IsNotEmpty, IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfigureIntegrationDto {
  @ApiProperty({ example: 'https://smiledental.com', description: 'The unique URL of the clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicUrl: string;

  @ApiProperty({ example: 'Dr. Jane Doe', description: 'The doctor name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'Smile Dental Clinic', description: 'The clinic name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicName: string;

  @ApiProperty({ example: 'jane.doe@example.com', description: 'The clinic email address', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+1234567890', description: 'The clinic phone number', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ example: '123 Main St, Suite 4B', description: 'The clinic address', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;
}
```

#### [NEW] [create-integration-work-order.dto.ts](file:///c:/dental/backend/src/modules/integration/dto/create-integration-work-order.dto.ts)
- Payload for creating work orders. Requires both `clinicUrl` and `doctorId`.
```typescript
import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIntegrationWorkOrderDto {
  @ApiProperty({ example: 'https://smiledental.com', description: 'The unique URL of the clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicUrl: string;

  @ApiProperty({ example: 'doctor-uuid-in-lab-database', description: 'Database ID of the doctor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  doctorId: string;

  @ApiProperty({ example: 'John Smith', description: 'Patient name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  patient: string;

  @ApiProperty({ example: 'uuid-of-prosthesis-type', description: 'Database ID of the prosthesis type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prosthesisTypeId: string;

  @ApiProperty({ example: 'Box 105', description: 'Box number', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  boxNumber?: string;

  @ApiProperty({ example: 'A2', description: 'Color specification', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @ApiProperty({ example: 'Please finish before Saturday.', description: 'Additional doctor notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 450.5, description: 'Total price quote', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  totalQuote?: number;

  @ApiProperty({ example: 100.0, description: 'Initial payment amount', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  initialPayment?: number;
}
```

#### [NEW] [verify-integration-work-order.dto.ts](file:///c:/dental/backend/src/modules/integration/dto/verify-integration-work-order.dto.ts)
- Payload for submitting verification decisions. Requires both `clinicUrl` and `doctorId`.
```typescript
import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyIntegrationWorkOrderDto {
  @ApiProperty({ example: 'https://smiledental.com', description: 'The unique URL of the clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicUrl: string;

  @ApiProperty({ example: 'doctor-uuid-in-lab-database', description: 'Database ID of the doctor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  doctorId: string;

  @ApiProperty({ example: 'uuid-or-folio', description: 'The work order ID or Folio Number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  workOrderId: string;

  @ApiProperty({ example: 'SUCCESS', description: 'The outcome of verification (SUCCESS, REWORK, or REPETITION)' })
  @IsString()
  @IsNotEmpty()
  outcome: 'SUCCESS' | 'REWORK' | 'REPETITION';

  @ApiProperty({ example: 'Approved, looks great.', description: 'Optional feedback notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
```

#### [NEW] [index.ts](file:///c:/dental/backend/src/modules/integration/dto/index.ts)
- Export DTOs.

---

### 3. Module & Core Services Integration (NestJS)

#### [MODIFY] [integration.module.ts](file:///c:/dental/backend/src/modules/integration/integration.module.ts)
- Import `NotificationsModule`, `WorkOrdersModule`, and `MailModule`.

#### [MODIFY] [work-orders.module.ts](file:///c:/dental/backend/src/modules/work-orders/work-orders.module.ts)
- Import `MailModule`.

#### [MODIFY] [technician-portal.module.ts](file:///c:/dental/backend/src/modules/technician-portal/technician-portal.module.ts)
- Import `MailModule`.

#### [MODIFY] [work-orders.service.ts](file:///c:/dental/backend/src/modules/work-orders/work-orders.service.ts)
- Inject `MailService`.
- Inside `create`, `endVerification`, and other step transitions, check if the next step is an external verification step (`nextProcess.isVerification && !nextProcess.technicianId`). If so, send the email notification to the clinic doctor.

#### [MODIFY] [technician-portal.service.ts](file:///c:/dental/backend/src/modules/technician-portal/technician-portal.service.ts)
- Inject `MailService`.
- Inside `complete` (where steps transition), check if the next step is an external verification step and send the email notification to the clinic doctor.

---

### 4. Integration Controller (NestJS)

#### [MODIFY] [integration.controller.ts](file:///c:/dental/backend/src/modules/integration/integration.controller.ts)
- Implement:
  1. `POST /api/integration/config`
  2. `GET /api/integration/work-orders/setup`
  3. `POST /api/integration/work-orders`
  4. `GET /api/integration/work-orders/pending-verifications?clinicUrl=...&doctorId=...`
  5. `POST /api/integration/work-orders/verify` (calls `WorkOrdersService.endVerification` using the branch default admin / first admin ID to bypass standard validation checks).

---

### 5. Notification translations (NestJS)

#### [MODIFY] [notifications.service.ts](file:///c:/dental/backend/src/modules/notifications/notifications.service.ts)
- Translate `New Work Order from Clinic` title and description to Spanish inside `translateNotification`.

---

## Verification Plan

### Automated Tests
- Build check: Validate compilation using:
  ```powershell
  npx tsc --noEmit
  ```

### Manual Verification
- We will write a test script in the scratch directory to simulate:
  1. Registering multiple clinics (e.g. Clinic A and Clinic B) under the same API key using `POST /api/integration/config` with unique `clinicUrl`s.
  2. Creating a Work Order for Clinic A.
  3. Verifying that when the Work Order transitions to external verification, the doctor at Clinic A receives the verification email notification.
  4. Fetching pending verifications for Clinic A and ensuring Clinic B cannot see them.
  5. Approving/Rejecting verification for Clinic A via the `POST /api/integration/work-orders/verify` endpoint, and verifying status updates and transition to next step / rework state in the database.
