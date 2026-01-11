package com.dentalms.dashboard.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/**
 * Revenue statistics with period comparison insights
 * Corresponds to /dashboard/revenue endpoint
 */
public class RevenueStats {
    
    @JsonProperty("period")
    private String period; // "week", "month", "year"
    
    @JsonProperty("current_period_dzd")
    private BigDecimal currentPeriodDzd;
    
    @JsonProperty("previous_period_dzd")
    private BigDecimal previousPeriodDzd;
    
    @JsonProperty("change_percent")
    private BigDecimal changePercent;
    
    @JsonProperty("trend")
    private String trend; // "up", "down", "stable"
    
    @JsonProperty("total_dzd")
    private BigDecimal totalDzd; // Legacy field for backward compatibility
    
    // Constructors
    public RevenueStats() {}
    
    public RevenueStats(String period, BigDecimal currentPeriodDzd, BigDecimal previousPeriodDzd,
                       BigDecimal changePercent, String trend, BigDecimal totalDzd) {
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
    
    public BigDecimal getCurrentPeriodDzd() { return currentPeriodDzd; }
    public void setCurrentPeriodDzd(BigDecimal currentPeriodDzd) { 
        this.currentPeriodDzd = currentPeriodDzd; 
    }
    
    public BigDecimal getPreviousPeriodDzd() { return previousPeriodDzd; }
    public void setPreviousPeriodDzd(BigDecimal previousPeriodDzd) { 
        this.previousPeriodDzd = previousPeriodDzd; 
    }
    
    public BigDecimal getChangePercent() { return changePercent; }
    public void setChangePercent(BigDecimal changePercent) { this.changePercent = changePercent; }
    
    public String getTrend() { return trend; }
    public void setTrend(String trend) { this.trend = trend; }
    
    public BigDecimal getTotalDzd() { return totalDzd; }
    public void setTotalDzd(BigDecimal totalDzd) { this.totalDzd = totalDzd; }
    
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