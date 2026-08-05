const db = require('../config/database');
const logger = require('../config/logger');

const REMINDER_HOURS_BEFORE = 24;

async function checkUpcomingAppointments(tenantId) {
  const now = new Date();
  const reminderWindow = new Date(now.getTime() + REMINDER_HOURS_BEFORE * 60 * 60 * 1000);

  const appointments = await db
    .selectFrom('appointments')
    .innerJoin('patients', 'appointments.patient_id', 'patients.id')
    .innerJoin('users', 'appointments.dentist_id', 'users.id')
    .select([
      'appointments.id',
      'appointments.appointment_date',
      'appointments.reason',
      'patients.id as patient_id',
      'patients.full_name as patient_name',
      'patients.phone as patient_phone',
      'patients.email as patient_email',
      'users.full_name as dentist_name',
    ])
    .where('appointments.tenant_id', '=', tenantId)
    .where('appointments.appointment_date', '>=', now.toISOString())
    .where('appointments.appointment_date', '<=', reminderWindow.toISOString())
    .where('appointments.status_key', '=', 'appt.status.scheduled')
    .execute();

  const sent = [];
  for (const apt of appointments) {
    const existing = await db
      .selectFrom('notifications')
      .select('id')
      .where('appointment_id', '=', apt.id)
      .where('type', '=', 'reminder')
      .where('sent_at', '>=', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .executeTakeFirst();

    if (existing) continue;

    const message = buildReminderMessage(apt);
    const channel = apt.patient_email ? 'email' : 'sms';

    await db
      .insertInto('notifications')
      .values({
        tenant_id: tenantId,
        appointment_id: apt.id,
        patient_id: apt.patient_id,
        type: 'reminder',
        channel,
        recipient: apt.patient_email || apt.patient_phone,
        title: 'Rappel de rendez-vous',
        message,
        status: 'sent',
        sent_at: new Date(),
      })
      .execute();

    logger.info('Reminder sent', { appointmentId: apt.id, patient: apt.patient_name, channel });
    sent.push({ appointmentId: apt.id, channel, message });
  }

  return sent;
}

function buildReminderMessage(apt) {
  const date = new Date(apt.appointment_date);
  const time = date.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
  const day = date.toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long' });
  return `Rappel: votre rendez-vous chez le dentiste est le ${day} à ${time}. Motif: ${apt.reason || 'Consultation'}. Dr. ${apt.dentist_name}`;
}

async function sendEmailNotification(recipient, subject, message) {
  if (!process.env.SMTP_HOST) {
    logger.info('Email not sent (SMTP not configured)', { recipient, subject });
    return { delivered: false, reason: 'SMTP not configured' };
  }
  try {
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch {
      logger.warn('nodemailer not installed — email sending unavailable');
      return { delivered: false, reason: 'nodemailer not installed' };
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number.parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@dentacore.dz',
      to: recipient,
      subject,
      text: message,
    });
    return { delivered: true };
  } catch (err) {
    logger.error('Email delivery failed', { error: err.message, recipient });
    return { delivered: false, reason: err.message };
  }
}

async function checkLowStockAndNotify(tenantId, itemId) {
  const lowStockItems = await db
    .selectFrom('v_low_stock_items')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .execute();

  const created = [];
  for (const item of lowStockItems) {
    if (itemId && item.id !== itemId) continue;

    const existing = await db
      .selectFrom('notifications')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('inventory_item_id', '=', item.id)
      .where('type', '=', 'low_stock')
      .where('status', '=', 'unread')
      .executeTakeFirst();

    if (existing) continue;

    const message = `Low stock alert: "${item.name}" (${item.item_code}) — current stock: ${item.current_stock}, minimum: ${item.min_stock_level}. Shortage: ${item.shortage_quantity} ${item.unit_of_measure || 'units'}.`;

    await db
      .insertInto('notifications')
      .values({
        tenant_id: tenantId,
        inventory_item_id: item.id,
        type: 'low_stock',
        channel: 'in_app',
        title: 'Alerte stock faible',
        message,
        status: 'unread',
        created_at: new Date(),
      })
      .execute();

    created.push(item.id);
  }

  return created;
}

module.exports = { checkUpcomingAppointments, sendEmailNotification, checkLowStockAndNotify };
