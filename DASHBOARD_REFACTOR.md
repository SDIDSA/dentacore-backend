# Dashboard API Refactor

## Overview
Refactored the dashboard API to move statistical calculations from backend to frontend, providing raw data endpoints for better performance and flexibility.

## Changes Made

### 1. New Entity Routes Created
- **`/api/v1/treatments`** - Full CRUD operations for treatment records
- **`/api/v1/payments`** - Full CRUD operations for payments
- **`/api/v1/invoices`** - Full CRUD operations for invoices with line items

### 2. Dashboard Routes Simplified
Replaced complex statistical endpoints with raw data endpoints:

#### Old Endpoints (Removed)
- `GET /api/v1/dashboard/patients` - Calculated statistics
- `GET /api/v1/dashboard/appointments` - Calculated statistics  
- `GET /api/v1/dashboard/treatments` - Calculated statistics
- `GET /api/v1/dashboard/revenue` - Calculated statistics
- `GET /api/v1/dashboard/overview` - Calculated overview

#### New Raw Data Endpoints
- `GET /api/v1/dashboard/patients/raw` - Raw patient data with filters
- `GET /api/v1/dashboard/appointments/raw` - Raw appointment data with filters
- `GET /api/v1/dashboard/treatments/raw` - Raw treatment data with filters
- `GET /api/v1/dashboard/payments/raw` - Raw payment data with filters

#### Kept Unchanged
- `GET /api/v1/dashboard/appointments/today` - Today's appointments (for display)
- `GET /api/v1/dashboard/recent-activity` - Recent audit logs (for display)

## Benefits

### Performance
- Reduced server-side computation
- Faster API responses
- Better caching opportunities on frontend

### Flexibility
- Frontend can calculate any time period
- Custom aggregations possible
- Real-time updates easier to implement

### Maintainability
- Simpler backend logic
- Calculations centralized in frontend
- Easier to add new metrics

## Frontend Integration

### Raw Data Usage
```javascript
// Get patients for current month
const response = await fetch('/api/v1/dashboard/patients/raw?start_date=2024-02-01&end_date=2024-02-29');
const { patients } = await response.json();

// Calculate statistics in frontend
const activePatients = patients.filter(p => ['patient.status.active', 'patient.status.new'].includes(p.status_key));
const newThisMonth = patients.filter(p => new Date(p.created_at) >= monthStart);
```

### Entity Routes Usage
```javascript
// Get all treatments with filters
const treatments = await fetch('/api/v1/treatments?start_date=2024-02-01&patient_id=123');

// Create new payment
const payment = await fetch('/api/v1/payments', {
  method: 'POST',
  body: JSON.stringify({
    amount_dzd: 5000,
    payment_method: 'cash',
    payment_date: '2024-02-15T10:00:00Z',
    patient_id: '123'
  })
});
```

## Migration Notes

### For Frontend Developers
1. Update dashboard components to use new raw data endpoints
2. Implement calculation logic in frontend utilities
3. Use entity routes for CRUD operations instead of dashboard endpoints

### For Backend Developers
1. All new routes follow existing patterns (authentication, validation, audit logging)
2. Tenant isolation maintained across all endpoints
3. Error handling consistent with existing codebase