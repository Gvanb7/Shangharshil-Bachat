# Shangharshil Yuva Bachat Samuha Website

A web application for managing the transactions related to a bachat samuha.

## Features
- Admin can add users, manage savings, loans, expenditures and related financial activities
- Users can register using pre-approved email and OTP
- Dashboard for users and admin
- Loan management and tracking
- Responsive UI built with React + TailwindCSS

## Tech Stack
- Backend: Django, Django REST Framework
- Frontend: React, TailwindCSS, Vite
- Database: Supabase (PostgreSQL)
- Authentication: OTP-based email login

## Installation

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
source venv/bin/activate #On Mac/Linux
pip install -r requirements.txt

### Frontend
cd frontend
npm install
npm run dev
