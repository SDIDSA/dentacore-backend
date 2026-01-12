package com.dentalms.dashboard.model;

import com.google.gson.annotations.SerializedName;

/**
 * Comprehensive dashboard overview with comparative insights
 * Corresponds to /dashboard/overview endpoint
 * Optimized for Retrofit with Gson
 */
public class DashboardOverview {
    
    // Patient metrics
    @SerializedName("active_patients")
    private int activePatients;
    
    @SerializedName("new_patients_this_month")
    private int newPatientsThisMonth;
    
    @SerializedName("patient_growth_percent")
    private double patientGrowthPercent;
    
    @SerializedName("patient_trend")
    private String patientTrend; // "up", "down", "stable"
    
    // Appointment metrics
    @SerializedName("today_appointments")
    private int todayAppointments;
    
    @SerializedName("week_average_appointments")
    private double weekAverageAppointments;
    
    @SerializedName("appointment_trend_percent")
    private double appointmentTrendPercent;
    
    @SerializedName("appointment_trend")
    private String appointmentTrend; // "above_average", "below_average", "average"
    
    // Invoice metrics
    @SerializedName("pending_invoices")
    private int pendingInvoices;
    
    // Revenue metrics
    @SerializedName("monthly_revenue_dzd")
    private double monthlyRevenueDzd;
    
    @SerializedName("last_month_revenue_dzd")
    private double lastMonthRevenueDzd;
    
    @SerializedName("revenue_growth_percent")
    private double revenueGrowthPercent;
    
    @SerializedName("revenue_trend")
    private String revenueTrend; // "up", "down", "stable"
    
    // Constructors
    public DashboardOverview() {}
    
    public DashboardOverview(int activePatients, int newPatientsThisMonth, 
                           double patientGrowthPercent, String patientTrend,
                           int todayAppointments, double weekAverageAppointments,
                           double appointmentTrendPercent, String appointmentTrend,
                           int pendingInvoices, double monthlyRevenueDzd,
                           double lastMonthRevenueDzd, double revenueGrowthPercent,
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
    
    public double getPatientGrowthPercent() { return patientGrowthPercent; }
    public void setPatientGrowthPercent(double patientGrowthPercent) { 
        this.patientGrowthPercent = patientGrowthPercent; 
    }
    
    public String getPatientTrend() { return patientTrend; }
    public void setPatientTrend(String patientTrend) { this.patientTrend = patientTrend; }
    
    public int getTodayAppointments() { return todayAppointments; }
    public void setTodayAppointments(int todayAppointments) { 
        this.todayAppointments = todayAppointments; 
    }
    
    public double getWeekAverageAppointments() { return weekAverageAppointments; }
    public void setWeekAverageAppointments(double weekAverageAppointments) { 
        this.weekAverageAppointments = weekAverageAppointments; 
    }
    
    public double getAppointmentTrendPercent() { return appointmentTrendPercent; }
    public void setAppointmentTrendPercent(double appointmentTrendPercent) { 
        this.appointmentTrendPercent = appointmentTrendPercent; 
    }
    
    public String getAppointmentTrend() { return appointmentTrend; }
    public void setAppointmentTrend(String appointmentTrend) { 
        this.appointmentTrend = appointmentTrend; 
    }
    
    public int getPendingInvoices() { return pendingInvoices; }
    public void setPendingInvoices(int pendingInvoices) { this.pendingInvoices = pendingInvoices; }
    
    public double getMonthlyRevenueDzd() { return monthlyRevenueDzd; }
    public void setMonthlyRevenueDzd(double monthlyRevenueDzd) { 
        this.monthlyRevenueDzd = monthlyRevenueDzd; 
    }
    
    public double getLastMonthRevenueDzd() { return lastMonthRevenueDzd; }
    public void setLastMonthRevenueDzd(double lastMonthRevenueDzd) { 
        this.lastMonthRevenueDzd = lastMonthRevenueDzd; 
    }
    
    public double getRevenueGrowthPercent() { return revenueGrowthPercent; }
    public void setRevenueGrowthPercent(double revenueGrowthPercent) { 
        this.revenueGrowthPercent = revenueGrowthPercent; 
    }
    
    public String getRevenueTrend() { return revenueTrend; }
    public void setRevenueTrend(String revenueTrend) { this.revenueTrend = revenueTrend; }
    
    // Helper methods for formatted display
    public String getFormattedPatientGrowth() {
        return String.format("%.2f%%", patientGrowthPercent);
    }
    
    public String getFormattedAppointmentTrend() {
        return String.format("%.2f%%", appointmentTrendPercent);
    }
    
    public String getFormattedRevenueGrowth() {
        return String.format("%.2f%%", revenueGrowthPercent);
    }
    
    public String getFormattedMonthlyRevenue() {
        return String.format("%.2f DZD", monthlyRevenueDzd);
    }
    
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