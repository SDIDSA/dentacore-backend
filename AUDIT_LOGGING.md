# Audit Logging System

The audit logging system automatically tracks user actions and system events in the `audit_logs` table.

## How It Works

### 1. Database Table
The `audit_logs` table stores:
- `user_id`: Who performed the action
- `action`: What was done (CREATE, UPDATE, DELETE, LOGIN, etc.)
- `entity_type`: What type of record (patients, appointments, etc.)
- `entity_id`: Which specific record
- `old_values`: Previous values (for updates)
- `new_values`: New values
- `ip_address`: Client IP
- `user_agent`: Browser/client info
- `created_at`: When it happened

### 2. Middleware Setup
The `auditLogger` middleware is added to the app and provides:
- Automatic IP address and user agent capture
- `req.audit.log()` helper function for easy logging

### 3. Usage in Routes
Add audit logging after successful operations:

```javascript
// After creating a record
await req.audit.log({
  action: 'CREATE',
  entityType: 'patients',
  entityId: patient.id,
  newValues: patient
});

// After updating a record
await req.audit.log({
  action: 'UPDATE',
  entityType: 'appointments',
  entityId: appointment.id,
  oldValues: { status_key: 'appt.status.scheduled' },
  newValues: { status_key: 'appt.status.completed' }
});
```

## Dashboard Integration

The `/dashboard/recent-activity` endpoint shows:
- Recent appointments (created/updated)
- Recent treatments
- Recent payments
- Recent audit logs (system actions)

Query parameters:
- `limit`: Number of activities (default: 20)
- `days`: Days to look back (default: 7)

## Sample Data

The seed file includes sample audit logs so you can see the feature working immediately after database setup.

## When Audit Logs Are Created

Currently implemented in:
- ✅ Patient creation (`src/routes/patients.js`)
- ✅ Appointment creation and status updates (`src/routes/appointments.js`)
- ✅ User management (create, update, delete, login)
- ⏳ Add to other routes as needed (treatments, payments, etc.)

## Adding to More Routes

To add audit logging to other operations:

1. Ensure the route uses the `authenticate` middleware (provides `req.user`)
2. Add `await req.audit.log({...})` after successful database operations
3. Include relevant old/new values for updates

The audit logging is designed to fail silently - if logging fails, it won't break the main operation.