package com.dentalms.dashboard.client;

import com.dentalms.dashboard.model.*;
import com.dentalms.dashboard.service.DashboardApiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Client wrapper for dashboard API operations
 * Provides both reactive and blocking access to dashboard statistics
 */
@Component
public class DashboardClient {
    
    private final DashboardApiService dashboardApiService;
    
    @Autowired
    public DashboardClient(DashboardApiService dashboardApiService) {
        this.dashboardApiService = dashboardApiService;
    }
    
    // Reactive methods (non-blocking)
    
    /**
     * Get patient statistics reactively
     * @return Mono<PatientStats> with comparative insights
     */
    public Mono<PatientStats> getPatientStatsAsync() {
        return dashboardApiService.getPatientStats();
    }
    
    /**
     * Get appointment statistics reactively
     * @return Mono<AppointmentStats> with weekly comparison
     */
    public Mono<AppointmentStats> getAppointmentStatsAsync() {
        return dashboardApiService.getAppointmentStats();
    }
    
    /**
     * Get revenue statistics reactively
     * @param period The period to analyze
     * @return Mono<RevenueStats> with period comparison
     */
    public Mono<RevenueStats> getRevenueStatsAsync(String period) {
        return dashboardApiService.getRevenueStats(period);
    }
    
    /**
     * Get comprehensive dashboard overview reactively
     * @return Mono<DashboardOverview> with all metrics
     */
    public Mono<DashboardOverview> getDashboardOverviewAsync() {
        return dashboardApiService.getDashboardOverview();
    }
    
    /**
     * Get today's appointments reactively
     * @return Flux<TodayAppointment> stream of appointments
     */
    public Flux<TodayAppointment> getTodayAppointmentsAsync() {
        return dashboardApiService.getTodayAppointments();
    }
    
    /**
     * Get recent activity reactively
     * @param limit Maximum number of activities
     * @param days Number of days to look back
     * @return Flux<RecentActivity> stream of activities
     */
    public Flux<RecentActivity> getRecentActivityAsync(Integer limit, Integer days) {
        return dashboardApiService.getRecentActivity(limit, days);
    }
    
    // Blocking methods (synchronous)
    
    /**
     * Get patient statistics synchronously
     * @return PatientStats with comparative insights
     */
    public PatientStats getPatientStats() {
        return dashboardApiService.getPatientStats().block();
    }
    
    /**
     * Get appointment statistics synchronously
     * @return AppointmentStats with weekly comparison
     */
    public AppointmentStats getAppointmentStats() {
        return dashboardApiService.getAppointmentStats().block();
    }
    
    /**
     * Get invoice statistics synchronously
     * @return InvoiceStats with monthly comparison
     */
    public InvoiceStats getInvoiceStats() {
        return dashboardApiService.getInvoiceStats().block();
    }
    
    /**
     * Get revenue statistics synchronously
     * @param period The period to analyze
     * @return RevenueStats with period comparison
     */
    public RevenueStats getRevenueStats(String period) {
        return dashboardApiService.getRevenueStats(period).block();
    }
    
    /**
     * Get monthly revenue statistics synchronously
     * @return RevenueStats with monthly comparison
     */
    public RevenueStats getMonthlyRevenueStats() {
        return dashboardApiService.getMonthlyRevenueStats().block();
    }
    
    /**
     * Get comprehensive dashboard overview synchronously
     * @return DashboardOverview with all metrics
     */
    public DashboardOverview getDashboardOverview() {
        return dashboardApiService.getDashboardOverview().block();
    }
    
    /**
     * Get today's appointments synchronously
     * @return List of today's appointments
     */
    public List<TodayAppointment> getTodayAppointments() {
        return dashboardApiService.getTodayAppointments().collectList().block();
    }
    
    /**
     * Get recent activity synchronously
     * @param limit Maximum number of activities
     * @param days Number of days to look back
     * @return List of recent activities
     */
    public List<RecentActivity> getRecentActivity(Integer limit, Integer days) {
        return dashboardApiService.getRecentActivity(limit, days).collectList().block();
    }
    
    /**
     * Get recent activity with default parameters synchronously
     * @return List of recent activities (last 20 from past 7 days)
     */
    public List<RecentActivity> getRecentActivity() {
        return dashboardApiService.getRecentActivity().collectList().block();
    }
    
    // Async methods (CompletableFuture)
    
    /**
     * Get all dashboard statistics asynchronously
     * @return CompletableFuture with complete dashboard data
     */
    public CompletableFuture<DashboardOverview> getAllDashboardStatsAsync() {
        return dashboardApiService.getDashboardOverview().toFuture();
    }
    
    /**
     * Get patient and appointment stats together asynchronously
     * @return CompletableFuture with combined stats
     */
    public CompletableFuture<String> getQuickSummaryAsync() {
        return Mono.zip(
                dashboardApiService.getPatientStats(),
                dashboardApiService.getAppointmentStats(),
                dashboardApiService.getMonthlyRevenueStats()
        ).map(tuple -> {
            PatientStats patients = tuple.getT1();
            AppointmentStats appointments = tuple.getT2();
            RevenueStats revenue = tuple.getT3();
            
            return String.format(
                "Dashboard Summary: %d active patients (%s trend), %d appointments today (%s vs average), %s DZD revenue (%s trend)",
                patients.getActive(),
                patients.getTrend(),
                appointments.getToday(),
                appointments.getTrend(),
                revenue.getCurrentPeriodDzd(),
                revenue.getTrend()
            );
        }).toFuture();
    }
}