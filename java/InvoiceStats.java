package com.dentalms.dashboard.model;

import com.google.gson.annotations.SerializedName;

/**
 * Invoice statistics with monthly comparison insights
 * Corresponds to /dashboard/invoices endpoint
 * Optimized for Retrofit with Gson
 */
public class InvoiceStats {
    
    @SerializedName("pending_count")
    private int pendingCount;
    
    @SerializedName("pending_amount_dzd")
    private double pendingAmountDzd;
    
    @SerializedName("this_month_count")
    private int thisMonthCount;
    
    @SerializedName("last_month_count")
    private int lastMonthCount;
    
    @SerializedName("this_month_amount_dzd")
    private double thisMonthAmountDzd;
    
    @SerializedName("last_month_amount_dzd")
    private double lastMonthAmountDzd;
    
    @SerializedName("count_change_percent")
    private double countChangePercent;
    
    @SerializedName("amount_change_percent")
    private double amountChangePercent;
    
    @SerializedName("count_trend")
    private String countTrend; // "up", "down", "stable"
    
    @SerializedName("amount_trend")
    private String amountTrend; // "up", "down", "stable"
    
    // Constructors
    public InvoiceStats() {}
    
    public InvoiceStats(int pendingCount, double pendingAmountDzd, 
                       int thisMonthCount, int lastMonthCount,
                       double thisMonthAmountDzd, double lastMonthAmountDzd,
                       double countChangePercent, double amountChangePercent,
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
    
    public double getPendingAmountDzd() { return pendingAmountDzd; }
    public void setPendingAmountDzd(double pendingAmountDzd) { 
        this.pendingAmountDzd = pendingAmountDzd; 
    }
    
    public int getThisMonthCount() { return thisMonthCount; }
    public void setThisMonthCount(int thisMonthCount) { this.thisMonthCount = thisMonthCount; }
    
    public int getLastMonthCount() { return lastMonthCount; }
    public void setLastMonthCount(int lastMonthCount) { this.lastMonthCount = lastMonthCount; }
    
    public double getThisMonthAmountDzd() { return thisMonthAmountDzd; }
    public void setThisMonthAmountDzd(double thisMonthAmountDzd) { 
        this.thisMonthAmountDzd = thisMonthAmountDzd; 
    }
    
    public double getLastMonthAmountDzd() { return lastMonthAmountDzd; }
    public void setLastMonthAmountDzd(double lastMonthAmountDzd) { 
        this.lastMonthAmountDzd = lastMonthAmountDzd; 
    }
    
    public double getCountChangePercent() { return countChangePercent; }
    public void setCountChangePercent(double countChangePercent) { 
        this.countChangePercent = countChangePercent; 
    }
    
    public double getAmountChangePercent() { return amountChangePercent; }
    public void setAmountChangePercent(double amountChangePercent) { 
        this.amountChangePercent = amountChangePercent; 
    }
    
    public String getCountTrend() { return countTrend; }
    public void setCountTrend(String countTrend) { this.countTrend = countTrend; }
    
    public String getAmountTrend() { return amountTrend; }
    public void setAmountTrend(String amountTrend) { this.amountTrend = amountTrend; }
    
    // Helper methods
    public String getFormattedCountChange() {
        return String.format("%.2f%%", countChangePercent);
    }
    
    public String getFormattedAmountChange() {
        return String.format("%.2f%%", amountChangePercent);
    }
    
    public String getFormattedPendingAmount() {
        return String.format("%.2f DZD", pendingAmountDzd);
    }
    
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