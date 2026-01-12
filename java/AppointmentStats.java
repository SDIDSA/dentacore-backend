package com.dentalms.dashboard.model;

import com.google.gson.annotations.SerializedName;

/**
 * Appointment statistics with weekly comparison insights
 * Corresponds to /dashboard/appointments endpoint
 * Optimized for Retrofit with Gson
 */
public class AppointmentStats {
    
    @SerializedName("today")
    private int today;
    
    @SerializedName("completed")
    private int completed;
    
    @SerializedName("pending")
    private int pending;
    
    @SerializedName("week_total")
    private int weekTotal;
    
    @SerializedName("week_average")
    private double weekAverage;
    
    @SerializedName("today_vs_average_percent")
    private double todayVsAveragePercent;
    
    @SerializedName("trend")
    private String trend; // "above_average", "below_average", "average"
    
    // Constructors
    public AppointmentStats() {}
    
    public AppointmentStats(int today, int completed, int pending, int weekTotal,
                           double weekAverage, double todayVsAveragePercent, String trend) {
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
    
    public double getWeekAverage() { return weekAverage; }
    public void setWeekAverage(double weekAverage) { this.weekAverage = weekAverage; }
    
    public double getTodayVsAveragePercent() { return todayVsAveragePercent; }
    public void setTodayVsAveragePercent(double todayVsAveragePercent) { 
        this.todayVsAveragePercent = todayVsAveragePercent; 
    }
    
    public String getTrend() { return trend; }
    public void setTrend(String trend) { this.trend = trend; }
    
    // Helper methods
    public String getFormattedTrendPercent() {
        return String.format("%.2f%%", todayVsAveragePercent);
    }
    
    public boolean isAboveAverage() {
        return "above_average".equals(trend);
    }
    
    public boolean isBelowAverage() {
        return "below_average".equals(trend);
    }
    
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