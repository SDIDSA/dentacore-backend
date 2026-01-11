package com.dentalms.dashboard.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/**
 * Patient statistics with comparative insights
 * Corresponds to /dashboard/patients endpoint
 */
public class PatientStats {
    
    @JsonProperty("total")
    private int total;
    
    @JsonProperty("active")
    private int active;
    
    @JsonProperty("this_month")
    private int thisMonth;
    
    @JsonProperty("last_month")
    private int lastMonth;
    
    @JsonProperty("monthly_change_percent")
    private BigDecimal monthlyChangePercent;
    
    @JsonProperty("trend")
    private String trend; // "up", "down", "stable"
    
    // Constructors
    public PatientStats() {}
    
    public PatientStats(int total, int active, int thisMonth, int lastMonth, 
                       BigDecimal monthlyChangePercent, String trend) {
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
    
    public BigDecimal getMonthlyChangePercent() { return monthlyChangePercent; }
    public void setMonthlyChangePercent(BigDecimal monthlyChangePercent) { 
        this.monthlyChangePercent = monthlyChangePercent; 
    }
    
    public String getTrend() { return trend; }
    public void setTrend(String trend) { this.trend = trend; }
    
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