package com.dentalms.dashboard.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

/**
 * Today's appointment details
 * Corresponds to /dashboard/appointments/today endpoint
 */
public class TodayAppointment {
    
    @JsonProperty("id")
    private String id;
    
    @JsonProperty("appointment_date")
    private LocalDateTime appointmentDate;
    
    @JsonProperty("duration_minutes")
    private int durationMinutes;
    
    @JsonProperty("status_key")
    private String statusKey;
    
    @JsonProperty("reason")
    private String reason;
    
    @JsonProperty("patient_name")
    private String patientName;
    
    @JsonProperty("patient_phone")
    private String patientPhone;
    
    @JsonProperty("dentist_name")
    private String dentistName;
    
    // Constructors
    public TodayAppointment() {}
    
    public TodayAppointment(String id, LocalDateTime appointmentDate, int durationMinutes,
                           String statusKey, String reason, String patientName,
                           String patientPhone, String dentistName) {
        this.id = id;
        this.appointmentDate = appointmentDate;
        this.durationMinutes = durationMinutes;
        this.statusKey = statusKey;
        this.reason = reason;
        this.patientName = patientName;
        this.patientPhone = patientPhone;
        this.dentistName = dentistName;
    }
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public LocalDateTime getAppointmentDate() { return appointmentDate; }
    public void setAppointmentDate(LocalDateTime appointmentDate) { 
        this.appointmentDate = appointmentDate; 
    }
    
    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }
    
    public String getStatusKey() { return statusKey; }
    public void setStatusKey(String statusKey) { this.statusKey = statusKey; }
    
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    
    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }
    
    public String getPatientPhone() { return patientPhone; }
    public void setPatientPhone(String patientPhone) { this.patientPhone = patientPhone; }
    
    public String getDentistName() { return dentistName; }
    public void setDentistName(String dentistName) { this.dentistName = dentistName; }
    
    @Override
    public String toString() {
        return "TodayAppointment{" +
                "id='" + id + '\'' +
                ", appointmentDate=" + appointmentDate +
                ", durationMinutes=" + durationMinutes +
                ", statusKey='" + statusKey + '\'' +
                ", reason='" + reason + '\'' +
                ", patientName='" + patientName + '\'' +
                ", patientPhone='" + patientPhone + '\'' +
                ", dentistName='" + dentistName + '\'' +
                '}';
    }
}