# LGU Real Property FAAS System

**A full-stack real property assessment management system** for Local Government Units (LGUs) to streamline Field Appraisal and Assessment Sheet (FAAS) processing with role-based workflows, automated document generation, and real-time analytics.

Built to digitize and modernize property assessment workflows, reducing manual paperwork and enabling efficient approval chains for government property valuation.

## 🚀 Key Features

- **FAAS Record Management**
  - Create, edit, and track property assessment records with full audit trails
  - Advanced search and filtering capabilities for efficient data retrieval
  - Bulk operations support for handling large datasets

- **Multi-Tier Approval Workflow**
  - **Encoder Role**: Initial data entry and preliminary validation
  - **Approver Role**: Final review and record authorization
  - Status tracking with timestamps and user attribution for compliance
  - Notification system for pending approvals

- **Automated Document Generation**
  - Python-powered Excel export with formatted layouts and formulas
  - PDF generation with official assessment document formatting
  - Batch processing for multiple records with progress tracking

- **Dashboard & Analytics**
  - Real-time statistics on pending, approved, and rejected records
  - Recent activity timeline for transparency
  - Performance metrics for monitoring workflow efficiency

- **User Management**
  - Role-based access control (RBAC) with permission enforcement
  - User profile management with secure authentication

## 📊 Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite |
| **Backend** | Node.js, Express.js |
| **Database** | MySQL 8.0+ |
| **Document Generation** | Python 3.10+, OpenPyXL, ReportLab |
| **Build Tools** | Vite, Bun |

---

## 🛠️ Prerequisites
Before setting up the system at home, ensure you have the following installed:
1.  **Node.js** (v18 or higher)
2.  **MySQL Server** (XAMPP or MySQL Community Server)
3.  **Python 3.10+**
4.  **Git** (for cloning and version control)

---

## 💻 Local Setup Instructions

### 1. Database Setup
1.  Open your MySQL management tool (e.g., phpMyAdmin or MySQL Workbench).
2.  Create a new database named `realproperty_db`.
3.  Import the `realproperty_db.sql` file located in the root directory.

### 2. Backend Configuration
1.  Navigate to the `backend` folder.
2.  Copy `.env.example` to a new file named `.env`.
3.  Update the database credentials in `.env`:
    ```env
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=your_password
    DB_NAME=realproperty_db
    DB_PORT=3306
    PORT=3000
    FRONTEND_URL=http://localhost:5173
    ```

### 3. Frontend Configuration
1.  Navigate to the root project folder.
2.  Copy `.env.example` to a new file named `.env`.
3.  Update the API URL:
    ```env
    VITE_API_BASE_URL=http://localhost:3000
    ```

### 4. Install Dependencies
Open a terminal in the root directory and run:

**Frontend Dependencies:**
```bash
npm install
```

**Backend Dependencies:**
```bash
cd backend
npm install
```

**Python Dependencies:**
```bash
cd python
pip install -r requirements.txt
```

---

## 🏃 Running the System

### Option A: Using the Automated Script (Windows)
Simply double-click the `START-SYSTEM.bat` file in the root directory. This will launch both the backend and frontend servers in separate windows.

### Option B: Manual Start
1.  **Backend**: `cd backend && npm run dev`
2.  **Frontend**: `npm run dev`

Access the system at: `http://localhost:5173`

---

## 👤 Default Test Accounts

| Role | Username | Password |
|------|----------|----------|
| Encoder | `encoder1` | `encoder123` |
| Approver | `approver1` | `approver123` |

---

## 🎯 Architecture Highlights

- **Separation of Concerns**: Frontend (React/TypeScript) decoupled from backend API with environment-based configuration
- **Role-Based Access Control**: Middleware-enforced permission system ensuring data security
- **Scalable Document Generation**: Python microservice handles resource-intensive PDF/Excel operations asynchronously
- **Responsive Design**: Tailwind CSS for professional, mobile-friendly UI
- **Database Design**: Normalized schema with proper indexing for performance on large datasets

---

## 📁 Project Structure

```
FAAS SYSTEM/
├── frontend/           # React TypeScript application
├── backend/            # Node.js Express server
│   ├── controllers/    # Request handlers
│   ├── routes/         # API endpoints
│   ├── middleware/     # Auth, validation, error handling
│   ├── services/       # Business logic
│   ├── utils/          # Helpers (database, email, Excel)
│   └── python/         # Document generation scripts
├── src/                # Shared components & utilities
└── [config files]      # Vite, ESLint, Tailwind config
```
