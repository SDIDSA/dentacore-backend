# Dashboard Comparative Insights

The dashboard endpoints now provide comprehensive comparative insights to help track performance trends and make data-driven decisions.

## Updated Endpoints

### 1. `/dashboard/patients` - Patient Statistics with Growth Tracking

**New Response Fields:**
```json
{
  "total": 150,
  "active": 145,
  "this_month": 12,
  "last_month": 8,
  "monthly_change_percent": 50.0,
  "trend": "up"
}
```

- `this_month`: New patients added this month
- `last_month`: New patients added last month
- `monthly_change_percent`: Percentage change in new patient acquisition
- `trend`: "up", "down", or "stable"

### 2. `/dashboard/appointments` - Appointment Statistics with Weekly Comparison

**New Response Fields:**
```json
{
  "today": 8,
  "completed": 5,
  "pending": 3,
  "week_total": 45,
  "week_average": 6.4,
  "today_vs_average_percent": 25.0,
  "trend": "above_average"
}
```

- `week_total`: Total appointments this week (Monday-Sunday)
- `week_average`: Daily average appointments this week
- `today_vs_average_percent`: How today compares to the week's average
- `trend`: "above_average", "below_average", or "average"

### 3. `/dashboard/invoices` - Invoice Statistics with Monthly Comparison

**New Response Fields:**
```json
{
  "pending_count": 5,
  "pending_amount_dzd": 15000.00,
  "this_month_count": 25,
  "last_month_count": 20,
  "this_month_amount_dzd": 75000.00,
  "last_month_amount_dzd": 60000.00,
  "count_change_percent": 25.0,
  "amount_change_percent": 25.0,
  "count_trend": "up",
  "amount_trend": "up"
}
```

- Monthly invoice count and amount comparisons
- Separate trend tracking for count vs amount
- Helps identify billing performance changes

### 4. `/dashboard/revenue` - Revenue Statistics with Period Comparison

**Enhanced Response:**
```json
{
  "period": "month",
  "current_period_dzd": 85000.00,
  "previous_period_dzd": 70000.00,
  "change_percent": 21.43,
  "trend": "up",
  "total_dzd": 85000.00
}
```

- Supports `?period=week|month|year` parameter
- Compares current period to previous period
- Maintains backward compatibility with `total_dzd`

### 5. `/dashboard/overview` - Comprehensive Dashboard Summary

**Enhanced Response:**
```json
{
  "active_patients": 145,
  "new_patients_this_month": 12,
  "patient_growth_percent": 50.0,
  "patient_trend": "up",
  
  "today_appointments": 8,
  "week_average_appointments": 6.4,
  "appointment_trend_percent": 25.0,
  "appointment_trend": "above_average",
  
  "pending_invoices": 5,
  
  "monthly_revenue_dzd": 85000.00,
  "last_month_revenue_dzd": 70000.00,
  "revenue_growth_percent": 21.43,
  "revenue_trend": "up"
}
```

## Key Benefits

1. **Trend Analysis**: All endpoints now provide trend indicators (up/down/stable)
2. **Performance Tracking**: Compare current performance against historical data
3. **Growth Metrics**: Track patient acquisition, revenue growth, and appointment trends
4. **Actionable Insights**: Percentage changes help identify significant improvements or declines
5. **Backward Compatibility**: Existing fields maintained for current integrations

## Usage Examples

### Frontend Dashboard Cards

```javascript
// Patient Growth Card
const patientData = await fetch('/dashboard/patients').then(r => r.json());
console.log(`New patients: ${patientData.this_month} (${patientData.monthly_change_percent}% vs last month)`);

// Appointment Performance Card
const appointmentData = await fetch('/dashboard/appointments').then(r => r.json());
console.log(`Today: ${appointmentData.today} appointments (${appointmentData.today_vs_average_percent}% vs week average)`);

// Revenue Tracking Card
const revenueData = await fetch('/dashboard/revenue?period=month').then(r => r.json());
console.log(`Revenue: ${revenueData.current_period_dzd} DZD (${revenueData.change_percent}% vs last month)`);
```

### Trend Indicators

Use the `trend` fields to show visual indicators:
- `"up"` → Green arrow up ↗️
- `"down"` → Red arrow down ↘️
- `"stable"` → Gray horizontal line ➡️
- `"above_average"` → Green up indicator
- `"below_average"` → Orange down indicator
- `"average"` → Gray neutral indicator

## Database Performance

All queries are optimized with:
- Proper date range filtering
- Efficient aggregation functions
- Existing database indexes
- Parallel query execution where possible

The comparative insights add minimal overhead while providing significant business value.