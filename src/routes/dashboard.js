const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');

const router = express.Router();

router.use(authenticate);

// Helper function to safely format numbers and avoid null/NaN/Infinity
function safeNumber(value, decimals = 2) {
  if (value === null || value === undefined || !isFinite(value)) {
    return 0;
  }
  return parseFloat(value.toFixed(decimals));
}

// Get patient statistics with comparative insights
router.get('/patients', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [totalPatients, activePatients, thisMonthPatients, lastMonthPatients] = await Promise.all([
      db.selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .executeTakeFirst(),
      db.selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .where('status_key', '=', 'user.status.active')
        .executeTakeFirst(),
      db.selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .where('created_at', '>=', startOfMonth.toISOString())
        .executeTakeFirst(),
      db.selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .where('created_at', '>=', startOfLastMonth.toISOString())
        .where('created_at', '<=', endOfLastMonth.toISOString())
        .executeTakeFirst()
    ]);

    const thisMonth = parseInt(thisMonthPatients.count);
    const lastMonth = parseInt(lastMonthPatients.count);

    let monthlyChange = 0;
    if (lastMonth > 0) {
      monthlyChange = ((thisMonth - lastMonth) / lastMonth * 100);
    } else if (thisMonth > 0) {
      monthlyChange = 100; // 100% growth when going from 0 to any positive number
    }

    // Ensure we don't have NaN or Infinity
    if (!isFinite(monthlyChange)) {
      monthlyChange = 0;
    }

    res.json({
      total: parseInt(totalPatients.count),
      active: parseInt(activePatients.count),
      this_month: thisMonth,
      last_month: lastMonth,
      monthly_change_percent: safeNumber(monthlyChange),
      trend: monthlyChange > 0 ? 'up' : monthlyChange < 0 ? 'down' : 'stable'
    });
  } catch (error) {
    next(error);
  }
});

// Get appointment statistics with comparative insights
router.get('/appointments', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Calculate last 7 business days (excluding today)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const [todayAppointments, completedToday, last7DaysAppointments] = await Promise.all([
      db.selectFrom('appointments')
        .select(sql`COUNT(*)`.as('count'))
        .where('appointment_date', '>=', today.toISOString())
        .where('appointment_date', '<', tomorrow.toISOString())
        .executeTakeFirst(),
      db.selectFrom('appointments')
        .select(sql`COUNT(*)`.as('count'))
        .where('appointment_date', '>=', today.toISOString())
        .where('appointment_date', '<', tomorrow.toISOString())
        .where('status_key', '=', 'appt.status.completed')
        .executeTakeFirst(),
      db.selectFrom('appointments')
        .select(sql`COUNT(*)`.as('count'))
        .where('appointment_date', '>=', sevenDaysAgo.toISOString())
        .where('appointment_date', '<=', yesterday.toISOString())
        .executeTakeFirst()
    ]);

    const todayCount = parseInt(todayAppointments.count);
    const completedCount = parseInt(completedToday.count);
    const last7DaysTotal = parseInt(last7DaysAppointments.count);
    const weekAverage = last7DaysTotal / 7;

    let todayVsAverage = 0;
    if (weekAverage > 0) {
      todayVsAverage = ((todayCount - weekAverage) / weekAverage * 100);
    } else if (todayCount > 0) {
      todayVsAverage = 100; // 100% above average when average is 0 but today has appointments
    }

    // Ensure we don't have NaN or Infinity
    if (!isFinite(todayVsAverage)) {
      todayVsAverage = 0;
    }

    res.json({
      today: todayCount,
      completed: completedCount,
      pending: todayCount - completedCount,
      last_7_days_total: last7DaysTotal,
      week_average: safeNumber(weekAverage, 1),
      today_vs_average_percent: safeNumber(todayVsAverage),
      trend: todayVsAverage > 0 ? 'up' : todayVsAverage < 0 ? 'down' : 'stable'
    });
  } catch (error) {
    next(error);
  }
});

// Get today's appointments with details
router.get('/appointments/today', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await db
      .selectFrom('appointments')
      .innerJoin('patients', 'appointments.patient_id', 'patients.id')
      .innerJoin('users', 'appointments.dentist_id', 'users.id')
      .select([
        'appointments.id',
        'appointments.appointment_date',
        'appointments.duration_minutes',
        'appointments.status_key',
        'appointments.reason',
        sql`patients.first_name || ' ' || patients.last_name`.as('patient_name'),
        'patients.phone as patient_phone',
        'users.full_name as dentist_name'
      ])
      .where('appointments.appointment_date', '>=', today.toISOString())
      .where('appointments.appointment_date', '<', tomorrow.toISOString())
      .orderBy('appointments.appointment_date', 'asc')
      .execute();

    res.json(appointments);
  } catch (error) {
    next(error);
  }
});

// Get treatment statistics with comparative insights
router.get('/treatments', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [totalTreatments, thisMonthTreatments, lastMonthTreatments] = await Promise.all([
      db.selectFrom('treatment_records')
        .select(sql`COUNT(*)`.as('count'))
        .executeTakeFirst(),
      db.selectFrom('treatment_records')
        .select(sql`COUNT(*)`.as('count'))
        .where('treatment_date', '>=', startOfMonth.toISOString())
        .executeTakeFirst(),
      db.selectFrom('treatment_records')
        .select(sql`COUNT(*)`.as('count'))
        .where('treatment_date', '>=', startOfLastMonth.toISOString())
        .where('treatment_date', '<=', endOfLastMonth.toISOString())
        .executeTakeFirst()
    ]);

    const thisMonthCount = parseInt(thisMonthTreatments.count);
    const lastMonthCount = parseInt(lastMonthTreatments.count);

    let countChange = 0;
    if (lastMonthCount > 0) {
      countChange = ((thisMonthCount - lastMonthCount) / lastMonthCount * 100);
    } else if (thisMonthCount > 0) {
      countChange = 100;
    }

    // Ensure we don't have NaN or Infinity
    if (!isFinite(countChange)) countChange = 0;

    res.json({
      total_treatments: parseInt(totalTreatments.count),
      this_month_count: thisMonthCount,
      last_month_count: lastMonthCount,
      count_change_percent: safeNumber(countChange),
      trend: countChange > 0 ? 'up' : countChange < 0 ? 'down' : 'stable'
    });
  } catch (error) {
    next(error);
  }
});

// Get revenue statistics with comparative insights
router.get('/revenue', async (req, res, next) => {
  try {
    const period = req.query.period || 'month'; // month, week, year
    const now = new Date();

    let currentStart, currentEnd, previousStart, previousEnd, periodName;

    switch (period) {
      case 'week':
        // Current week (Monday to Sunday)
        currentStart = new Date(now);
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentStart.setDate(now.getDate() - daysToMonday);
        currentStart.setHours(0, 0, 0, 0);

        currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + 6);
        currentEnd.setHours(23, 59, 59, 999);

        // Previous week
        previousStart = new Date(currentStart);
        previousStart.setDate(currentStart.getDate() - 7);
        previousEnd = new Date(currentEnd);
        previousEnd.setDate(currentEnd.getDate() - 7);
        periodName = 'week';
        break;

      case 'year':
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        periodName = 'year';
        break;

      default: // month
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        periodName = 'month';
    }

    const [currentRevenue, previousRevenue] = await Promise.all([
      db.selectFrom('payments')
        .select(sql`COALESCE(SUM(amount_dzd), 0)`.as('total'))
        .where('payment_date', '>=', currentStart.toISOString())
        .where('payment_date', '<=', currentEnd.toISOString())
        .executeTakeFirst(),
      db.selectFrom('payments')
        .select(sql`COALESCE(SUM(amount_dzd), 0)`.as('total'))
        .where('payment_date', '>=', previousStart.toISOString())
        .where('payment_date', '<=', previousEnd.toISOString())
        .executeTakeFirst()
    ]);

    const currentAmount = parseFloat(currentRevenue.total);
    const previousAmount = parseFloat(previousRevenue.total);

    let changePercent = 0;
    if (previousAmount > 0) {
      changePercent = ((currentAmount - previousAmount) / previousAmount * 100);
    } else if (currentAmount > 0) {
      changePercent = 100;
    }

    // Ensure we don't have NaN or Infinity
    if (!isFinite(changePercent)) {
      changePercent = 0;
    }

    res.json({
      period: periodName,
      current_period_dzd: safeNumber(currentAmount),
      previous_period_dzd: safeNumber(previousAmount),
      change_percent: safeNumber(changePercent),
      trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'stable',
      // Legacy field for backward compatibility
      total_dzd: safeNumber(currentAmount)
    });
  } catch (error) {
    next(error);
  }
});

// Get overview with comparative insights (lightweight summary)
router.get('/overview', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

    // Calculate last 7 days for appointment average (excluding today)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const [
      activePatients,
      newPatientsThisMonth,
      newPatientsLastMonth,
      todayAppointments,
      last7DaysAppointments,
      thisMonthTreatments,
      lastMonthTreatments,
      monthlyRevenue,
      lastMonthRevenue
    ] = await Promise.all([
      db.selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .where('status_key', '=', 'user.status.active')
        .executeTakeFirst(),
      db.selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .where('created_at', '>=', startOfMonth.toISOString())
        .executeTakeFirst(),
      db.selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .where('created_at', '>=', startOfLastMonth.toISOString())
        .where('created_at', '<=', endOfLastMonth.toISOString())
        .executeTakeFirst(),
      db.selectFrom('appointments')
        .select(sql`COUNT(*)`.as('count'))
        .where('appointment_date', '>=', today.toISOString())
        .where('appointment_date', '<', tomorrow.toISOString())
        .executeTakeFirst(),
      db.selectFrom('appointments')
        .select(sql`COUNT(*)`.as('count'))
        .where('appointment_date', '>=', sevenDaysAgo.toISOString())
        .where('appointment_date', '<=', yesterday.toISOString())
        .executeTakeFirst(),
      db.selectFrom('treatment_records')
        .select(sql`COUNT(*)`.as('count'))
        .where('treatment_date', '>=', startOfMonth.toISOString())
        .executeTakeFirst(),
      db.selectFrom('treatment_records')
        .select(sql`COUNT(*)`.as('count'))
        .where('treatment_date', '>=', startOfLastMonth.toISOString())
        .where('treatment_date', '<=', endOfLastMonth.toISOString())
        .executeTakeFirst(),
      db.selectFrom('payments')
        .select(sql`COALESCE(SUM(amount_dzd), 0)`.as('total'))
        .where('payment_date', '>=', startOfMonth.toISOString())
        .executeTakeFirst(),
      db.selectFrom('payments')
        .select(sql`COALESCE(SUM(amount_dzd), 0)`.as('total'))
        .where('payment_date', '>=', startOfLastMonth.toISOString())
        .where('payment_date', '<=', endOfLastMonth.toISOString())
        .executeTakeFirst()
    ]);

    // Calculate comparative metrics
    const newThisMonth = parseInt(newPatientsThisMonth.count);
    const newLastMonth = parseInt(newPatientsLastMonth.count);

    let patientGrowth = 0;
    if (newLastMonth > 0) {
      patientGrowth = ((newThisMonth - newLastMonth) / newLastMonth * 100);
    } else if (newThisMonth > 0) {
      patientGrowth = 100;
    }
    if (!isFinite(patientGrowth)) patientGrowth = 0;

    const todayAppts = parseInt(todayAppointments.count);
    const last7DaysTotal = parseInt(last7DaysAppointments.count);
    const weekAverage = last7DaysTotal / 7;

    let appointmentTrend = 0;
    if (weekAverage > 0) {
      appointmentTrend = ((todayAppts - weekAverage) / weekAverage * 100);
    } else if (todayAppts > 0) {
      appointmentTrend = 100;
    }
    if (!isFinite(appointmentTrend)) appointmentTrend = 0;

    const currentRevenue = parseFloat(monthlyRevenue.total);
    const previousRevenue = parseFloat(lastMonthRevenue.total);

    let revenueGrowth = 0;
    if (previousRevenue > 0) {
      revenueGrowth = ((currentRevenue - previousRevenue) / previousRevenue * 100);
    } else if (currentRevenue > 0) {
      revenueGrowth = 100;
    }
    if (!isFinite(revenueGrowth)) revenueGrowth = 0;

    const thisMonthTreatmentsCount = parseInt(thisMonthTreatments.count);
    const lastMonthTreatmentsCount = parseInt(lastMonthTreatments.count);

    let treatmentGrowth = 0;
    if (lastMonthTreatmentsCount > 0) {
      treatmentGrowth = ((thisMonthTreatmentsCount - lastMonthTreatmentsCount) / lastMonthTreatmentsCount * 100);
    } else if (thisMonthTreatmentsCount > 0) {
      treatmentGrowth = 100;
    }
    if (!isFinite(treatmentGrowth)) treatmentGrowth = 0;

    res.json({
      active_patients: parseInt(activePatients.count),
      new_patients_this_month: newThisMonth,
      patient_growth_percent: safeNumber(patientGrowth),
      patient_trend: patientGrowth > 0 ? 'up' : patientGrowth < 0 ? 'down' : 'stable',

      today_appointments: todayAppts,
      week_average_appointments: safeNumber(weekAverage, 1),
      appointment_trend_percent: safeNumber(appointmentTrend),
      appointment_trend: appointmentTrend > 0 ? 'above_average' : appointmentTrend < 0 ? 'below_average' : 'average',

      treatments_this_month: thisMonthTreatmentsCount,
      treatments_last_month: lastMonthTreatmentsCount,
      treatment_growth_percent: safeNumber(treatmentGrowth),
      treatment_trend: treatmentGrowth > 0 ? 'up' : treatmentGrowth < 0 ? 'down' : 'stable',

      monthly_revenue_dzd: safeNumber(currentRevenue),
      last_month_revenue_dzd: safeNumber(previousRevenue),
      revenue_growth_percent: safeNumber(revenueGrowth),
      revenue_trend: revenueGrowth > 0 ? 'up' : revenueGrowth < 0 ? 'down' : 'stable'
    });
  } catch (error) {
    next(error);
  }
});

// Get recent activity for dashboard
router.get('/recent-activity', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const days = parseInt(req.query.days) || 7;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get recent audit logs with user information - raw data
    const recentActivity = await db
      .selectFrom('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .select([
        'audit_logs.id',
        'audit_logs.action',
        'audit_logs.entity_type',
        'audit_logs.entity_id',
        'audit_logs.old_values',
        'audit_logs.new_values',
        'audit_logs.ip_address',
        'audit_logs.user_agent',
        'audit_logs.created_at',
        'users.full_name as user_name',
        'users.email as user_email'
      ])
      .where('audit_logs.created_at', '>=', cutoffDate.toISOString())
      .orderBy('audit_logs.created_at', 'desc')
      .limit(limit)
      .execute();

    res.json(recentActivity);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
