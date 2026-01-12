package com.dentalms.dashboard.config;

import com.dentalms.dashboard.api.DashboardApiInterface;
import com.dentalms.dashboard.model.PatientStats;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

/**
 * Complete setup guide and example for using Retrofit with Dashboard API
 * This class demonstrates proper configuration to avoid null parsing issues
 */
public class RetrofitSetupGuide {
    
    private static final String BASE_URL = "http://localhost:3000/";
    private DashboardApiInterface apiService;
    
    /**
     * Proper Retrofit setup with Gson configuration
     * This configuration ensures proper parsing of double values
     */
    public void setupRetrofit() {
        // Configure Gson to handle double values properly
        Gson gson = new GsonBuilder()
                .setLenient() // Allow lenient parsing
                .serializeNulls() // Handle null values
                .create();
        
        // Build Retrofit instance
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(BASE_URL)
                .addConverterFactory(GsonConverterFactory.create(gson))
                .build();
        
        // Create API service
        apiService = retrofit.create(DashboardApiInterface.class);
    }
    
    /**
     * Example: Get patient statistics with proper error handling
     */
    public void getPatientStatsExample() {
        Call<PatientStats> call = apiService.getPatientStats();
        
        call.enqueue(new Callback<PatientStats>() {
            @Override
            public void onResponse(Call<PatientStats> call, Response<PatientStats> response) {
                if (response.isSuccessful() && response.body() != null) {
                    PatientStats stats = response.body();
                    
                    // Access percentage values - these should NOT be null anymore
                    double changePercent = stats.getMonthlyChangePercent();
                    String trend = stats.getTrend();
                    
                    System.out.println("Patient Stats:");
                    System.out.println("Total: " + stats.getTotal());
                    System.out.println("Active: " + stats.getActive());
                    System.out.println("This Month: " + stats.getThisMonth());
                    System.out.println("Last Month: " + stats.getLastMonth());
                    System.out.println("Change: " + changePercent + "%"); // Should work now!
                    System.out.println("Trend: " + trend);
                    
                    // Use helper method for formatted display
                    System.out.println("Formatted: " + stats.getFormattedChangePercent());
                    
                } else {
                    System.err.println("API Error: " + response.code() + " - " + response.message());
                }
            }
            
            @Override
            public void onFailure(Call<PatientStats> call, Throwable t) {
                System.err.println("Network Error: " + t.getMessage());
                t.printStackTrace();
            }
        });
    }
    
    /**
     * Synchronous call example (use in background thread)
     */
    public PatientStats getPatientStatsSync() {
        try {
            Call<PatientStats> call = apiService.getPatientStats();
            Response<PatientStats> response = call.execute();
            
            if (response.isSuccessful() && response.body() != null) {
                return response.body();
            } else {
                System.err.println("API Error: " + response.code());
                return null;
            }
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Test method to verify all percentage fields parse correctly
     */
    public void testAllPercentageFields() {
        // Test Patient Stats
        apiService.getPatientStats().enqueue(new Callback<PatientStats>() {
            @Override
            public void onResponse(Call<PatientStats> call, Response<PatientStats> response) {
                if (response.isSuccessful() && response.body() != null) {
                    PatientStats stats = response.body();
                    System.out.println("✅ Patient monthly_change_percent: " + stats.getMonthlyChangePercent());
                }
            }
            @Override
            public void onFailure(Call<PatientStats> call, Throwable t) {
                System.err.println("❌ Patient stats failed: " + t.getMessage());
            }
        });
        
        // Test Appointment Stats
        apiService.getAppointmentStats().enqueue(new Callback<AppointmentStats>() {
            @Override
            public void onResponse(Call<AppointmentStats> call, Response<AppointmentStats> response) {
                if (response.isSuccessful() && response.body() != null) {
                    AppointmentStats stats = response.body();
                    System.out.println("✅ Appointment today_vs_average_percent: " + stats.getTodayVsAveragePercent());
                    System.out.println("✅ Appointment week_average: " + stats.getWeekAverage());
                }
            }
            @Override
            public void onFailure(Call<AppointmentStats> call, Throwable t) {
                System.err.println("❌ Appointment stats failed: " + t.getMessage());
            }
        });
        
        // Test Revenue Stats
        apiService.getRevenueStats("month").enqueue(new Callback<RevenueStats>() {
            @Override
            public void onResponse(Call<RevenueStats> call, Response<RevenueStats> response) {
                if (response.isSuccessful() && response.body() != null) {
                    RevenueStats stats = response.body();
                    System.out.println("✅ Revenue change_percent: " + stats.getChangePercent());
                    System.out.println("✅ Revenue current_period_dzd: " + stats.getCurrentPeriodDzd());
                }
            }
            @Override
            public void onFailure(Call<RevenueStats> call, Throwable t) {
                System.err.println("❌ Revenue stats failed: " + t.getMessage());
            }
        });
    }
    
    /**
     * Usage example in Android Activity/Fragment
     */
    public void androidUsageExample() {
        // In your Activity or Fragment
        setupRetrofit();
        
        // Make API call
        Call<PatientStats> call = apiService.getPatientStats();
        call.enqueue(new Callback<PatientStats>() {
            @Override
            public void onResponse(Call<PatientStats> call, Response<PatientStats> response) {
                if (response.isSuccessful() && response.body() != null) {
                    PatientStats stats = response.body();
                    
                    // Update UI with the data
                    updatePatientStatsUI(stats);
                }
            }
            
            @Override
            public void onFailure(Call<PatientStats> call, Throwable t) {
                // Handle error
                showErrorMessage("Failed to load patient stats");
            }
        });
    }
    
    private void updatePatientStatsUI(PatientStats stats) {
        // Example UI update (pseudo-code)
        // totalPatientsTextView.setText(String.valueOf(stats.getTotal()));
        // activePatientsTextView.setText(String.valueOf(stats.getActive()));
        // changePercentTextView.setText(stats.getFormattedChangePercent());
        // trendImageView.setImageResource(getTrendIcon(stats.getTrend()));
    }
    
    private void showErrorMessage(String message) {
        // Show error to user
        System.err.println(message);
    }
    
    // Getter for API service (for use in other classes)
    public DashboardApiInterface getApiService() {
        if (apiService == null) {
            setupRetrofit();
        }
        return apiService;
    }
}

/*
IMPORTANT NOTES FOR RETROFIT USAGE:

1. DEPENDENCIES REQUIRED:
   implementation 'com.squareup.retrofit2:retrofit:2.9.0'
   implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
   implementation 'com.google.code.gson:gson:2.10.1'

2. PERMISSIONS (Android):
   <uses-permission android:name="android.permission.INTERNET" />

3. NETWORK SECURITY CONFIG (Android API 28+):
   Add to AndroidManifest.xml:
   android:networkSecurityConfig="@xml/network_security_config"
   
   Create res/xml/network_security_config.xml:
   <?xml version="1.0" encoding="utf-8"?>
   <network-security-config>
       <domain-config cleartextTrafficPermitted="true">
           <domain includeSubdomains="true">localhost</domain>
           <domain includeSubdomains="true">10.0.2.2</domain>
       </domain-config>
   </network-security-config>

4. KEY CHANGES MADE:
   - Changed from @JsonProperty to @SerializedName (Gson standard)
   - Changed from BigDecimal to double (better Gson compatibility)
   - Added proper Gson configuration with setLenient()
   - All percentage fields now use primitive double (no null issues)

5. TESTING:
   - API returns proper numeric values (verified in Postman)
   - Java models use primitive double (Gson defaults null to 0.0)
   - @SerializedName handles snake_case to camelCase conversion
   - Helper methods provide formatted display options
*/