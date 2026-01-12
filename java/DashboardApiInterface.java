package com.dentalms.dashboard.api;

import com.dentalms.dashboard.model.*;
import retrofit2.Call;
import retrofit2.http.GET;
import retrofit2.http.Query;
import java.util.List;

/**
 * Retrofit interface for Dashboard API endpoints
 * Optimized for Gson parsing with proper annotations
 */
public interface DashboardApiInterface {
    
    /**
     * Get patient statistics with comparative insights
     * @return PatientStats with monthly comparison data
     */
    @GET("dashboard/patients")
    Call<PatientStats> getPatientStats();
    
    /**
     * Get appointment statistics with weekly comparison
     * @return AppointmentStats with today vs week average comparison
     */
    @GET("dashboard/appointments")
    Call<AppointmentStats> getAppointmentStats();
    
    /**
     * Get today's appointment details
     * @return List of today's appointments with patient and dentist info
     */
    @GET("dashboard/appointments/today")
    Call<List<TodayAppointment>> getTodayAppointments();
    
    /**
     * Get invoice statistics with monthly comparison
     * @return InvoiceStats with pending invoices and monthly trends
     */
    @GET("dashboard/invoices")
    Call<InvoiceStats> getInvoiceStats();
    
    /**
     * Get revenue statistics with period comparison
     * @param period The period to analyze ("week", "month", "year")
     * @return RevenueStats with current vs previous period comparison
     */
    @GET("dashboard/revenue")
    Call<RevenueStats> getRevenueStats(@Query("period") String period);
    
    /**
     * Get comprehensive dashboard overview
     * @return DashboardOverview with all comparative insights
     */
    @GET("dashboard/overview")
    Call<DashboardOverview> getDashboardOverview();
    
    /**
     * Get recent activity audit logs
     * @param limit Maximum number of activities to return (optional)
     * @param days Number of days to look back (optional)
     * @return List of recent activities
     */
    @GET("dashboard/recent-activity")
    Call<List<RecentActivity>> getRecentActivity(
        @Query("limit") Integer limit,
        @Query("days") Integer days
    );
}