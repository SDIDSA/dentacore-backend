package com.dentalms.dashboard.service;

import com.dentalms.dashboard.model.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

/**
 * Service for consuming dashboard API endpoints
 * Provides methods to fetch all dashboard statistics with comparative insights
 */
@Service
public class DashboardApiService {
    
    private final WebClient webClient;
    
    @Value("${dashboard.api.base-url:http://localhost:3000}")
    private String baseUrl;
    
    public DashboardApiService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }
    
    /**
     * Get patient statistics with comparative insights
     * @return PatientStats with monthly comparison data
     */
    public Mono<PatientStats> getPatientStats() {
        return webClient.get()
                .uri(baseUrl + "/dashboard/patients")
                .retrieve()
                .bodyToMono(PatientStats.class);
    }
    
    /**
     * Get appointment statistics with weekly comparison
     * @return AppointmentStats with today vs week average comparison
     */
    public Mono<AppointmentStats> getAppointmentStats() {
        return webClient.get()
                .uri(baseUrl + "/dashboard/appointments")
                .retrieve()
                .bodyToMono(AppointmentStats.class);
    }
    
    /**
     * Get today's appointment details
     * @return List of today's appointments with patient and dentist info
     */
    public Flux<TodayAppointment> getTodayAppointments() {
        return webClient.get()
                .uri(baseUrl + "/dashboard/appointments/today")
                .retrieve()
                .bodyToFlux(TodayAppointment.class);
    }
    
    /**
     * Get invoice statistics with monthly comparison
     * @return InvoiceStats with pending invoices and monthly trends
     */
    public Mono<InvoiceStats> getInvoiceStats() {
        return webClient.get()
                .uri(baseUrl + "/dashboard/invoices")
                .retrieve()
                .bodyToMono(InvoiceStats.class);
    }
    
    /**
     * Get revenue statistics with period comparison
     * @param period The period to analyze ("week", "month", "year")
     * @return RevenueStats with current vs previous period comparison
     */
    public Mono<RevenueStats> getRevenueStats(String period) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path(baseUrl + "/dashboard/revenue")
                        .queryParam("period", period)
                        .build())
                .retrieve()
                .bodyToMono(RevenueStats.class);
    }
    
    /**
     * Get revenue statistics for current month (default)
     * @return RevenueStats with monthly comparison
     */
    public Mono<RevenueStats> getMonthlyRevenueStats() {
        return getRevenueStats("month");
    }
    
    /**
     * Get comprehensive dashboard overview
     * @return DashboardOverview with all comparative insights
     */
    public Mono<DashboardOverview> getDashboardOverview() {
        return webClient.get()
                .uri(baseUrl + "/dashboard/overview")
                .retrieve()
                .bodyToMono(DashboardOverview.class);
    }
    
    /**
     * Get recent activity audit logs
     * @param limit Maximum number of activities to return (default: 20)
     * @param days Number of days to look back (default: 7)
     * @return List of recent activities
     */
    public Flux<RecentActivity> getRecentActivity(Integer limit, Integer days) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path(baseUrl + "/dashboard/recent-activity")
                        .queryParamIfPresent("limit", java.util.Optional.ofNullable(limit))
                        .queryParamIfPresent("days", java.util.Optional.ofNullable(days))
                        .build())
                .retrieve()
                .bodyToFlux(RecentActivity.class);
    }
    
    /**
     * Get recent activity with default parameters
     * @return List of recent activities (last 20 activities from past 7 days)
     */
    public Flux<RecentActivity> getRecentActivity() {
        return getRecentActivity(null, null);
    }
}