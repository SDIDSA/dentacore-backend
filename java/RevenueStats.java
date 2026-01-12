package com.dentalms.dashboard.model;

import com.google.gson.annotations.SerializedName;

/**
 * Revenue statistics with period comparison insights
 * Corresponds to /dashboard/revenue endpoint
 * Optimized for Retrofit with Gson
 */
public class RevenueStats {
    
    @SerializedName("period")
    private String period; // "week", "month", "year"
    
    @SerializedName("current_period_dzd")
    private double currentPeriodDzd;
    
    @SerializedName("previous_period_dzd")
    private double previousPeriodDzd;
    
    @SerializedName("change_percent")
    private double changePercent;
    
    @SerializedName("trend")
    private String trend; // "up", "down", "stable"
    
    @SerializedName("total_dzd")
    private double totalDzd; // Legacy field for backward compatibility
    
    // Constructors
    public RevenueStats() {}
    
    public RevenueStats(String period, double currentPeriodDzd, double previousPeriodDzd,
                       double changePercent, String trend, double totalDzd) {
        this.period = period;
        this.currentPeriodDzd = currentPeriodDzd;
        this.previousPeriodDzd = previousPeriodDzd;
        this.changePercent = changePercent;
        this.trend = trend;
        this.totalDzd = totalDzd;
    }
    
    // Getters and Setters
    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }
    
    public double getCurrentPeriodDzd() { return currentPeriodDzd; }
    public void setCurrentPeriodDzd(double currentPeriodDzd) { 
        this.currentPeriodDzd = currentPeriodDzd; 
    }
    
    public double getPreviousPeriodDzd() { return previousPeriodDzd; }
    public void setPreviousPeriodDzd(double previousPeriodDzd) { 
        this.previousPeriodDzd = previousPeriodDzd; 
    }
    
    public double getChangePercent() { return changePercent; }
    public void setChangePercent(double changePercent) { this.changePercent = changePercent; }
    
    public String getTrend() { return trend; }
    public void setTrend(String trend) { this.trend = trend; }
    
    public double getTotalDzd() { return totalDzd; }
    public void setTotalDzd(double totalDzd) { this.totalDzd = totalDzd; }
    
    // Helper methods
    public String getFormattedChangePercent() {
        return String.format("%.2f%%", changePercent);
    }
    
    public String getFormattedCurrentAmount() {
        return String.format("%.2f DZD", currentPeriodDzd);
    }
    
    public String getFormattedPreviousAmount() {
        return String.format("%.2f DZD", previousPeriodDzd);
    }
    
    public boolean isGrowthPositive() {
        return changePercent > 0;
    }
    
    @Override
    public String toString() {
        return "RevenueStats{" +
                "period='" + period + '\'' +
                ", currentPeriodDzd=" + currentPeriodDzd +
                ", previousPeriodDzd=" + previousPeriodDzd +
                ", changePercent=" + changePercent +
                ", trend='" + trend + '\'' +
                ", totalDzd=" + totalDzd +
                '}';
    }
}