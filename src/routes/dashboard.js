const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');

const router = express.Router();

router.use(authenticate);

// Get dashboard statistics and today's appointments
router.get('/', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get statistics
    const [
      totalPatients,
      activePatients,
      todayAppointments,
      completedToday,
      pendingInvoices,
      totalRevenue
    ] = await Promise.all([
      // Total patients
      db.selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .executeTakeFirst(),

      // Active patients
      db.selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .where('is_active', '=', true)
        .executeTakeFirst(),

      // Today's appointments count
      db.selectFrom('appointments')
        .select(sql`COUNT(*)`.as('count'))
        .where('appointment_date', '>=', today.toISOString())
        .where('appointment_date', '<', tomorrow.toISOString())
        .executeTakeFirst(),

      // Completed appointments today
      db.selectFrom('appointments')
        .select(sql`COUNT(*)`.as('count'))
        .where('appointment_date', '>=', today.toISOString())
        .where('appointment_date', '<', tomorrow.toISOString())
        .where('status_key', '=', 'appt.status.completed')
        .executeTakeFirst(),

      // Pending invoices
      db.selectFrom('invoices')
        .select([
          sql`COUNT(*)`.as('count'),
          sql`COALESCE(SUM(total_dzd - paid_amount_dzd), 0)`.as('total_pending')
        ])
        .where('payment_status_key', 'in', ['invoice.status.unpaid', 'invoice.status.partial', 'invoice.status.overdue'])
        .executeTakeFirst(),

      // Total revenue (this month)
      db.selectFrom('payments')
        .select(sql`COALESCE(SUM(amount_dzd), 0)`.as('total'))
        .where(sql`DATE_TRUNC('month', payment_date)`, '=', sql`DATE_TRUNC('month', CURRENT_DATE)`)
        .executeTakeFirst()
    ]);

    // Get today's appointments with details
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

    res.json({
      statistics: {
        patients: {
          total: parseInt(totalPatients.count),
          active: parseInt(activePatients.count)
        },
        appointments: {
          today: parseInt(todayAppointments.count),
          completed: parseInt(completedToday.count),
          pending: parseInt(todayAppointments.count) - parseInt(completedToday.count)
        },
        invoices: {
          pending_count: parseInt(pendingInvoices.count),
          pending_amount_dzd: parseFloat(pendingInvoices.total_pending)
        },
        revenue: {
          this_month_dzd: parseFloat(totalRevenue.total)
        }
      },
      today_appointments: appointments
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
