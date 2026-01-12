package com.dentalms.dashboard.model;

import com.google.gson.annotations.SerializedName;

/**
 * Patient statistics with comparative insights
 * Corresponds to /dashboard/patients endpoint
 * Optimized for Retrofit with Gson
 */
public class PatientStats {
    
    @SerializedName("total")
    private int total;
    
    @SerializedName("active")
    private int active;
    
    @SerializedName("this_month")
    private int thisMonth;
    
    @SerializedName("last_month")
    private int lastMonth;
    
    @SerializedName("monthly_change_percent")
    private double monthlyChangePercent; // Use primitive double, Gson handles null as 0.0
    
    @SerializedName("trend")
    private String trend; // "up", "down", "stable"
    
    // Constructors
    public PatientStats() {}
    
    public PatientStats(int total, int active, int thisMonth, int lastMonth, 
                       double monthlyChangePercent, String trend) {
        this.total = total;
        this.active = active;
        this.thisMonth = thisMonth;
        this.lastMonth = lastMonth;
        this.monthlyChangePercent = monthlyChangePercent;
        this.trend = trend;
    }
    
    // Getters and Setters
    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }
    
    public int getActive() { return active; }
    public void setActive(int active) { this.active = active; }
    
    public int getThisMonth() { return thisMonth; }
    public void setThisMonth(int thisMonth) { this.thisMonth = thisMonth; }
    
    public int getLastMonth() { return lastMonth; }
    public void setLastMonth(int lastMonth) { this.lastMonth = lastMonth; }
    
    public double getMonthlyChangePercent() { return monthlyChangePercent; }
    public void setMonthlyChangePercent(double monthlyChangePercent) { 
        this.monthlyChangePercent = monthlyChangePercent; 
    }
    
    public String getTrend() { return trend; }
    public void setTrend(String trend) { this.trend = trend; }
    
    // Helper methods for display
    public String getFormattedChangePercent() {
        return String.format("%.2f%%", monthlyChangePercent);
    }
    
    public boolean isGrowthPositive() {
        return monthlyChangePercent > 0;
    }
    
    @Override
    public String toString() {
        return "PatientStats{" +
                "total=" + total +
                ", active=" + active +
                ", thisMonth=" + thisMonth +
                ", lastMonth=" + lastMonth +
                ", monthlyChangePercent=" + monthlyChangePercent +
                ", trend='" + trend + '\'' +
                '}';
    }
}