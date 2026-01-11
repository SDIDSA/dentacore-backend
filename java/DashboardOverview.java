package com.dentalms.dashboard.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/**
 * Comprehensive dashboard overview with comparative insights
 * Corresponds to /dashboard/overview endpoint
 */
public class DashboardOverview {
    
    // Patient metrics
    @JsonProperty("active_patients")
    private int activePatients;
    
    @JsonProperty("new_patients_this_month")
    private int newPatientsThisMonth;
    
    @JsonProperty("patient_growth_percent")
    private BigDecimal patientGrowthPercent;
    
    @JsonProperty("patient_trend")
    private String patientTrend; // "up", "down", "stable"
    
    // Appointment metrics
    @JsonProperty("today_appointments")
    private int todayAppointments;
    
    @JsonProperty("week_average_appointments")
    private BigDecimal weekAverageAppointments;
    
    @JsonProperty("appointment_trend_percent")
    private BigDecimal appointmentTrendPercent;
    
    @JsonProperty("appointment_trend")
    private String appointmentTrend; // "above_average", "below_average", "average"
    
    // Invoice metrics
    @JsonProperty("pending_invoices")
    private int pendingInvoices;
    
    // Revenue metrics
    @JsonProperty("monthly_revenue_dzd")
    private BigDecimal monthlyRevenueDzd;
    
    @JsonProperty("last_month_revenue_dzd")
    private BigDecimal lastMonthRevenueDzd;
    
    @JsonProperty("revenue_growth_percent")
    private BigDecimal revenueGrowthPercent;
    
    @JsonProperty("revenue_trend")
    private String revenueTrend; // "up", "down", "stable"
    
    // Constructors
    public DashboardOverview() {}
    
    public DashboardOverview(int activePatients, int newPatientsThisMonth, 
                           BigDecimal patientGrowthPercent, String patientTrend,
                           int todayAppointments, BigDecimal weekAverageAppointments,
                           BigDecimal appointmentTrendPercent, String appointmentTrend,
                           int pendingInvoices, BigDecimal monthlyRevenueDzd,
                           BigDecimal lastMonthRevenueDzd, BigDecimal revenueGrowthPercent,
                           String revenueTrend) {
        this.activePatients = activePatients;
        this.newPatientsThisMonth = newPatientsThisMonth;
        this.patientGrowthPercent = patientGrowthPercent;
        this.patientTrend = patientTrend;
        this.todayAppointments = todayAppointments;
        this.weekAverageAppointments = weekAverageAppointments;
        this.appointmentTrendPercent = appointmentTrendPercent;
        this.appointmentTrend = appointmentTrend;
        this.pendingInvoices = pendingInvoices;
        this.monthlyRevenueDzd = monthlyRevenueDzd;
        this.lastMonthRevenueDzd = lastMonthRevenueDzd;
        this.revenueGrowthPercent = revenueGrowthPercent;
        this.revenueTrend = revenueTrend;
    }
    
    // Getters and Setters
    public int getActivePatients() { return activePatients; }
    public void setActivePatients(int activePatients) { this.activePatients = activePatients; }
    
    public int getNewPatientsThisMonth() { return newPatientsThisMonth; }
    public void setNewPatientsThisMonth(int newPatientsThisMonth) { 
        this.newPatientsThisMonth = newPatientsThisMonth; 
    }
    
    public BigDecimal getPatientGrowthPercent() { return patientGrowthPercent; }
    public void setPatientGrowthPercent(BigDecimal patientGrowthPercent) { 
        this.patientGrowthPercent = patientGrowthPercent; 
    }
    
    public String getPatientTrend() { return patientTrend; }
    public void setPatientTrend(String patientTrend) { this.patientTrend = patientTrend; }
    
    public int getTodayAppointments() { return todayAppointments; }
    public void setTodayAppointments(int todayAppointments) { 
        this.todayAppointments = todayAppointments; 
    }
    
    public BigDecimal getWeekAverageAppointments() { return weekAverageAppointments; }
    public void setWeekAverageAppointments(BigDecimal weekAverageAppointments) { 
        this.weekAverageAppointments = weekAverageAppointments; 
    }
    
    public BigDecimal getAppointmentTrendPercent() { return appointmentTrendPercent; }
    public void setAppointmentTrendPercent(BigDecimal appointmentTrendPercent) { 
        this.appointmentTrendPercent = appointmentTrendPercent; 
    }
    
    public String getAppointmentTrend() { return appointmentTrend; }
    public void setAppointmentTrend(String appointmentTrend) { 
        this.appointmentTrend = appointmentTrend; 
    }
    
    public int getPendingInvoices() { return pendingInvoices; }
    public void setPendingInvoices(int pendingInvoices) { this.pendingInvoices = pendingInvoices; }
    
    public BigDecimal getMonthlyRevenueDzd() { return monthlyRevenueDzd; }
    public void setMonthlyRevenueDzd(BigDecimal monthlyRevenueDzd) { 
        this.monthlyRevenueDzd = monthlyRevenueDzd; 
    }
    
    public BigDecimal getLastMonthRevenueDzd() { return lastMonthRevenueDzd; }
    public void setLastMonthRevenueDzd(BigDecimal lastMonthRevenueDzd) { 
        this.lastMonthRevenueDzd = lastMonthRevenueDzd; 
    }
    
    public BigDecimal getRevenueGrowthPercent() { return revenueGrowthPercent; }
    public void setRevenueGrowthPercent(BigDecimal revenueGrowthPercent) { 
        this.revenueGrowthPercent = revenueGrowthPercent; 
    }
    
    public String getRevenueTrend() { return revenueTrend; }
    public void setRevenueTrend(String revenueTrend) { this.revenueTrend = revenueTrend; }
    
    @Override
    public String toString() {
        return "DashboardOverview{" +
                "activePatients=" + activePatients +
                ", newPatientsThisMonth=" + newPatientsThisMonth +
                ", patientGrowthPercent=" + patientGrowthPercent +
                ", patientTrend='" + patientTrend + '\'' +
                ", todayAppointments=" + todayAppointments +
                ", weekAverageAppointments=" + weekAverageAppointments +
                ", appointmentTrendPercent=" + appointmentTrendPercent +
                ", appointmentTrend='" + appointmentTrend + '\'' +
                ", pendingInvoices=" + pendingInvoices +
                ", monthlyRevenueDzd=" + monthlyRevenueDzd +
                ", lastMonthRevenueDzd=" + lastMonthRevenueDzd +
                ", revenueGrowthPercent=" + revenueGrowthPercent +
                ", revenueTrend='" + revenueTrend + '\'' +
                '}';
    }
}