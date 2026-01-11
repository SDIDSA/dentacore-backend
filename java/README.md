# Dashboard Java Models and Services

This package contains Java classes that correspond to the dashboard API endpoints with comparative insights.

## Model Classes

### Core Statistics Models

1. **`PatientStats.java`** - Patient statistics with growth tracking
   - Total and active patient counts
   - Monthly new patient comparison
   - Growth percentage and trend indicators

2. **`AppointmentStats.java`** - Appointment statistics with weekly comparison
   - Today's appointments vs completed/pending
   - Weekly totals and daily averages
   - Performance vs average indicators

3. **`InvoiceStats.java`** - Invoice statistics with monthly comparison
   - Pending invoice counts and amounts
   - Monthly invoice generation trends
   - Separate tracking for count vs amount changes

4. **`RevenueStats.java`** - Revenue statistics with period comparison
   - Current vs previous period revenue
   - Supports week/month/year periods
   - Percentage change and trend analysis

5. **`DashboardOverview.java`** - Comprehensive dashboard summary
   - All key metrics in one response
   - Patient, appointment, and revenue insights
   - Executive-level dashboard data

### Detail Models

6. **`TodayAppointment.java`** - Individual appointment details
   - Today's appointment information
   - Patient and dentist details
   - Status and scheduling information

7. **`RecentActivity.java`** - Audit log entries
   - System activity tracking
   - User action history
   - Change tracking with old/new values

## Service Classes

### `DashboardApiService.java`
- **Purpose**: Reactive service for consuming dashboard API endpoints
- **Technology**: Spring WebFlux with WebClient
- **Methods**: All dashboard endpoints with reactive Mono/Flux return types
- **Features**: 
  - Non-blocking API calls
  - Configurable base URL
  - Query parameter support

### `DashboardClient.java`
- **Purpose**: Client wrapper providing multiple access patterns
- **Access Patterns**:
  - **Reactive**: Mono/Flux for non-blocking operations
  - **Blocking**: Synchronous methods with `.block()`
  - **Async**: CompletableFuture for async operations
- **Features**:
  - Flexible API consumption
  - Combined statistics methods
  - Quick summary generation

## Usage Examples

### Basic Usage
```java
@Autowired
private DashboardClient dashboardClient;

// Get patient statistics
PatientStats patients = dashboardClient.getPatientStats();
System.out.println("New patients this month: " + patients.getThisMonth());
System.out.println("Growth trend: " + patients.getTrend());

// Get comprehensive overview
DashboardOverview overview = dashboardClient.getDashboardOverview();
System.out.println("Revenue growth: " + overview.getRevenueGrowthPercent() + "%");
```

### Reactive Usage
```java
// Non-blocking reactive approach
dashboardClient.getPatientStatsAsync()
    .subscribe(stats -> {
        System.out.println("Active patients: " + stats.getActive());
        System.out.println("Monthly change: " + stats.getMonthlyChangePercent() + "%");
    });

// Combine multiple stats
Mono.zip(
    dashboardClient.getPatientStatsAsync(),
    dashboardClient.getAppointmentStatsAsync(),
    dashboardClient.getRevenueStatsAsync("month")
).subscribe(tuple -> {
    PatientStats patients = tuple.getT1();
    AppointmentStats appointments = tuple.getT2();
    RevenueStats revenue = tuple.getT3();
    
    // Process combined data
});
```

### Async Usage
```java
// CompletableFuture approach
CompletableFuture<DashboardOverview> future = dashboardClient.getAllDashboardStatsAsync();
future.thenAccept(overview -> {
    System.out.println("Dashboard loaded: " + overview.getActivePatients() + " patients");
});

// Quick summary
dashboardClient.getQuickSummaryAsync()
    .thenAccept(summary -> System.out.println(summary));
```

## Key Features

### Comparative Insights
- **Month-over-month**: Patient growth, invoice trends, revenue changes
- **Week-over-week**: Appointment performance vs averages
- **Trend Indicators**: "up", "down", "stable", "above_average", "below_average"

### Data Types
- **BigDecimal**: Used for all monetary values and percentages for precision
- **LocalDateTime**: Used for timestamps with proper timezone handling
- **String**: Used for trend indicators and status keys

### JSON Mapping
- **@JsonProperty**: Ensures proper mapping with snake_case API responses
- **Flexible Constructors**: Support for both empty and full constructors
- **toString()**: Comprehensive string representation for debugging

## Dependencies

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework</groupId>
        <artifactId>spring-webflux</artifactId>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-annotations</artifactId>
    </dependency>
</dependencies>
```

## Configuration

```yaml
dashboard:
  api:
    base-url: http://localhost:3000  # Default API base URL
```

These Java classes provide a complete, type-safe interface to the dashboard API with support for all the comparative insights and trend analysis features.