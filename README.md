# Dental Management System - Backend

Node.js backend for Algerian Dental Management System with PostgreSQL.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update `.env` with your database credentials

4. Create the database:
```bash
createdb dental_management
```

5. Run the database schema:
```bash
psql -U postgres -d dental_management -f db.sql
```

6. Test database connection:
```bash
npm run test:db
```

7. Seed basic data (roles, admin user, etc.):
```bash
npm run seed
```

8. Start the server:
```bash
npm run dev
```

## Testing the API

Login with the seeded admin user:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dental.dz","password":"admin123"}'
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Patients
- `GET /api/patients` - List patients (with search & pagination)
- `GET /api/patients/:id` - Get patient details
- `POST /api/patients` - Create new patient

### Appointments
- `GET /api/appointments` - List appointments (filterable)
- `POST /api/appointments` - Create appointment
- `PATCH /api/appointments/:id/status` - Update appointment status

## Environment Variables

See `.env.example` for required configuration.
