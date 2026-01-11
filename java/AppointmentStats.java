package com.dentalms.dashboard.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/**
 * Appointment statistics with weekly comparison insights
 * Corresponds to /dashboard/appointments endpoint
 */
public class AppointmentStats {
    
    @JsonProperty("today")
    private int today;
    
    @JsonProperty("completed")
    private int completed;
    
    @JsonProperty("pending")
    private int pending;
    
    @JsonProperty("week_total")
    private int weekTotal;
    
    @JsonProperty("week_average")
    private BigDecimal weekAverage;
    
    @JsonProperty("today_vs_average_percent")
    private BigDecimal todayVsAveragePercent;
    
    @JsonProperty("trend")
    private String trend; // "above_average", "below_average", "average"
    
    // Constructors
    public AppointmentStats() {}
    
    public AppointmentStats(int today, int completed, int pending, int weekTotal,
                           BigDecimal weekAverage, BigDecimal todayVsAveragePercent, String trend) {
        this.today = today;
        this.completed = completed;
        this.pending = pending;
        this.weekTotal = weekTotal;
        this.weekAverage = weekAverage;
        this.todayVsAveragePercent = todayVsAveragePercent;
        this.trend = trend;
    }
    
    // Getters and Setters
    public int getToday() { return today; }
    public void setToday(int today) { this.today = today; }
    
    public int getCompleted() { return completed; }
    public void setCompleted(int completed) { this.completed = completed; }
    
    public int getPending() { return pending; }
    public void setPending(int pending) { this.pending = pending; }
    
    public int getWeekTotal() { return weekTotal; }
    public void setWeekTotal(int weekTotal) { this.weekTotal = weekTotal; }
    
    public BigDecimal getWeekAverage() { return weekAverage; }
    public void setWeekAverage(BigDecimal weekAverage) { this.weekAverage = weekAverage; }
    
    public BigDecimal getTodayVsAveragePercent() { return todayVsAveragePercent; }
    public void setTodayVsAveragePercent(BigDecimal todayVsAveragePercent) { 
        this.todayVsAveragePercent = todayVsAveragePercent; 
    }
    
    public String getTrend() { return trend; }
    public void setTrend(String trend) { this.trend = trend; }
    
    @Override
    public String toString() {
        return "AppointmentStats{" +
                "today=" + today +
                ", completed=" + completed +
                ", pending=" + pending +
                ", weekTotal=" + weekTotal +
                ", weekAverage=" + weekAverage +
                ", todayVsAveragePercent=" + todayVsAveragePercent +
                ", trend='" + trend + '\'' +
                '}';
    }
}