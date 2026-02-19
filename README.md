# LGU Real Property FAAS System

A comprehensive system for managing Real Property Field Appraisal and Assessment Sheets (FAAS), including automated Excel generation and approval workflows.

## 🚀 Features
- **FAAS Management**: Create, edit, and track FAAS records.
- **Approval Workflow**: Multi-role system (Encoder/Approver) for record validation.
- **Excel & PDF Generation**: Automated generation of official documents using Python.
- **Dashboard**: Real-time stats and recent activity tracking.

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

## 📤 Preparing for GitHub
Before pushing your code to GitHub, follow these tips:
1.  **Fresh SQL Dump**: Export your latest database to `realproperty_db.sql` to include any new users or records you've created.
2.  **Check .gitignore**: Ensure that `node_modules`, `.env`, and `uploads/` are NOT being uploaded.
3.  **Clean Uploads**: Don't upload test images or generated spreadsheets to GitHub.

---

## 👤 Default Accounts (for testing)
- **Role**: Encoder | **Username**: `encoder1` | **Password**: `encoder123`
- **Role**: Approver | **Username**: `approver1` | **Password**: `approver123`
