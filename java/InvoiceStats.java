package com.dentalms.dashboard.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/**
 * Invoice statistics with monthly comparison insights
 * Corresponds to /dashboard/invoices endpoint
 */
public class InvoiceStats {
    
    @JsonProperty("pending_count")
    private int pendingCount;
    
    @JsonProperty("pending_amount_dzd")
    private BigDecimal pendingAmountDzd;
    
    @JsonProperty("this_month_count")
    private int thisMonthCount;
    
    @JsonProperty("last_month_count")
    private int lastMonthCount;
    
    @JsonProperty("this_month_amount_dzd")
    private BigDecimal thisMonthAmountDzd;
    
    @JsonProperty("last_month_amount_dzd")
    private BigDecimal lastMonthAmountDzd;
    
    @JsonProperty("count_change_percent")
    private BigDecimal countChangePercent;
    
    @JsonProperty("amount_change_percent")
    private BigDecimal amountChangePercent;
    
    @JsonProperty("count_trend")
    private String countTrend; // "up", "down", "stable"
    
    @JsonProperty("amount_trend")
    private String amountTrend; // "up", "down", "stable"
    
    // Constructors
    public InvoiceStats() {}
    
    public InvoiceStats(int pendingCount, BigDecimal pendingAmountDzd, 
                       int thisMonthCount, int lastMonthCount,
                       BigDecimal thisMonthAmountDzd, BigDecimal lastMonthAmountDzd,
                       BigDecimal countChangePercent, BigDecimal amountChangePercent,
                       String countTrend, String amountTrend) {
        this.pendingCount = pendingCount;
        this.pendingAmountDzd = pendingAmountDzd;
        this.thisMonthCount = thisMonthCount;
        this.lastMonthCount = lastMonthCount;
        this.thisMonthAmountDzd = thisMonthAmountDzd;
        this.lastMonthAmountDzd = lastMonthAmountDzd;
        this.countChangePercent = countChangePercent;
        this.amountChangePercent = amountChangePercent;
        this.countTrend = countTrend;
        this.amountTrend = amountTrend;
    }
    
    // Getters and Setters
    public int getPendingCount() { return pendingCount; }
    public void setPendingCount(int pendingCount) { this.pendingCount = pendingCount; }
    
    public BigDecimal getPendingAmountDzd() { return pendingAmountDzd; }
    public void setPendingAmountDzd(BigDecimal pendingAmountDzd) { 
        this.pendingAmountDzd = pendingAmountDzd; 
    }
    
    public int getThisMonthCount() { return thisMonthCount; }
    public void setThisMonthCount(int thisMonthCount) { this.thisMonthCount = thisMonthCount; }
    
    public int getLastMonthCount() { return lastMonthCount; }
    public void setLastMonthCount(int lastMonthCount) { this.lastMonthCount = lastMonthCount; }
    
    public BigDecimal getThisMonthAmountDzd() { return thisMonthAmountDzd; }
    public void setThisMonthAmountDzd(BigDecimal thisMonthAmountDzd) { 
        this.thisMonthAmountDzd = thisMonthAmountDzd; 
    }
    
    public BigDecimal getLastMonthAmountDzd() { return lastMonthAmountDzd; }
    public void setLastMonthAmountDzd(BigDecimal lastMonthAmountDzd) { 
        this.lastMonthAmountDzd = lastMonthAmountDzd; 
    }
    
    public BigDecimal getCountChangePercent() { return countChangePercent; }
    public void setCountChangePercent(BigDecimal countChangePercent) { 
        this.countChangePercent = countChangePercent; 
    }
    
    public BigDecimal getAmountChangePercent() { return amountChangePercent; }
    public void setAmountChangePercent(BigDecimal amountChangePercent) { 
        this.amountChangePercent = amountChangePercent; 
    }
    
    public String getCountTrend() { return countTrend; }
    public void setCountTrend(String countTrend) { this.countTrend = countTrend; }
    
    public String getAmountTrend() { return amountTrend; }
    public void setAmountTrend(String amountTrend) { this.amountTrend = amountTrend; }
    
    @Override
    public String toString() {
        return "InvoiceStats{" +
                "pendingCount=" + pendingCount +
                ", pendingAmountDzd=" + pendingAmountDzd +
                ", thisMonthCount=" + thisMonthCount +
                ", lastMonthCount=" + lastMonthCount +
                ", thisMonthAmountDzd=" + thisMonthAmountDzd +
                ", lastMonthAmountDzd=" + lastMonthAmountDzd +
                ", countChangePercent=" + countChangePercent +
                ", amountChangePercent=" + amountChangePercent +
                ", countTrend='" + countTrend + '\'' +
                ", amountTrend='" + amountTrend + '\'' +
                '}';
    }
}