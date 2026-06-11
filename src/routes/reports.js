const express = require('express');
const { sql } = require('kysely');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

const MAX_MONTHS = 24;

const router = express.Router();

router.use(authenticate);

function queryTimeout(req, res, next) {
  res.setTimeout(30000, () => {
    res.status(503).json({ error: 'Report query timed out' });
    req.destroy();
  });
  next();
}
router.use(queryTimeout);

function safeNumber(value, decimals = 2) {
  if (value === null || value === undefined || !isFinite(value)) return 0;
  return parseFloat(Number(value).toFixed(decimals));
}

function applyDateFilter(query, tableAndCol, req) {
  const { start_date, end_date, months } = req.query;
  const [table, dateColumn] = tableAndCol.split('.');
  const allowedTables = { payments: 1, invoices: 1, treatment_records: 1 };
  const allowedCols = { payment_date: 1, invoice_date: 1, treatment_date: 1, created_at: 1 };
  if (!allowedTables[table] || !allowedCols[dateColumn]) {
    return null;
  }
  if (start_date) {
    query = query.where(`${table}.${dateColumn}`, '>=', start_date);
  }
  if (end_date) {
    query = query.where(`${table}.${dateColumn}`, '<=', end_date + 'T23:59:59Z');
  }
  if (months && !start_date && !end_date) {
    const validMonths = Math.max(1, Math.min(parseInt(months) || 12, 60));
    query = query.where(`${table}.${dateColumn}`, '>=', sql`NOW() - INTERVAL ${sql.literal(`${validMonths} months`)}`);
  }
  return query;
}

function toCsvRow(obj, columns) {
  return columns.map(col => {
    const val = obj[col];
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  }).join(',');
}

// Monthly revenue report
router.get('/revenue/monthly', async (req, res, next) => {
  try {
    const months = Math.max(1, Math.min(parseInt(req.query.months) || 12, 60));

    const data = await db
      .selectFrom('payments')
      .select([
        db.fn('DATE_TRUNC', ['month', 'payment_date']).as('month'),
        db.fn.count('id').as('transaction_count'),
        db.fn.sum('amount_dzd').as('total_revenue_dzd'),
      ])
      .where('tenant_id', '=', req.tenantId)
      .where('payment_date', '>=', db.sql`NOW() - INTERVAL ${sql.literal(`${months} months`)}`)
      .groupBy('month')
      .orderBy('month', 'desc')
      .execute();

    const total = data.reduce((sum, row) => sum + safeNumber(row.total_revenue_dzd), 0);
    const avg = data.length > 0 ? total / data.length : 0;

    res.json({ data, summary: { total_revenue_dzd: safeNumber(total), monthly_avg_dzd: safeNumber(avg), months_covered: data.length } });
  } catch (error) {
    next(error);
  }
});

// Procedure frequency report
router.get('/procedures/frequency', async (req, res, next) => {
  try {
    const months = Math.max(1, Math.min(parseInt(req.query.months) || 12, 60));

    const data = await db
      .selectFrom('treatment_records')
      .leftJoin('treatment_categories', 'treatment_records.category_id', 'treatment_categories.id')
      .select([
        'treatment_records.category_id',
        'treatment_categories.category_key',
        db.fn.count('treatment_records.id').as('procedure_count'),
        db.fn.sum('treatment_records.estimated_cost_dzd').as('total_estimated_dzd'),
      ])
      .where('treatment_records.tenant_id', '=', req.tenantId)
      .where('treatment_records.treatment_date', '>=', db.sql`NOW() - INTERVAL ${sql.literal(`${months} months`)}`)
      .groupBy(['treatment_records.category_id', 'treatment_categories.category_key'])
      .orderBy('procedure_count', 'desc')
      .execute();

    const totalProcedures = data.reduce((sum, row) => sum + parseInt(row.procedure_count), 0);

    res.json({
      data: data.map(row => ({
        category_id: row.category_id,
        category_key: row.category_key || 'uncategorized',
        procedure_count: parseInt(row.procedure_count),
        total_estimated_dzd: safeNumber(row.total_estimated_dzd),
        percentage: totalProcedures > 0 ? safeNumber((parseInt(row.procedure_count) / totalProcedures) * 100) : 0,
      })),
      summary: { total_procedures: totalProcedures },
    });
  } catch (error) {
    next(error);
  }
});

// New patients report
router.get('/patients/new', async (req, res, next) => {
  try {
    const months = Math.max(1, Math.min(parseInt(req.query.months) || 12, 60));

    const data = await db
      .selectFrom('patients')
      .select([
        db.fn('DATE_TRUNC', ['month', 'created_at']).as('month'),
        db.fn.count('id').as('new_patients'),
      ])
      .where('tenant_id', '=', req.tenantId)
      .where('created_at', '>=', db.sql`NOW() - INTERVAL ${sql.literal(`${months} months`)}`)
      .groupBy('month')
      .orderBy('month', 'desc')
      .execute();

    const total = data.reduce((sum, row) => sum + parseInt(row.new_patients), 0);

    res.json({ data, summary: { total_new_patients: total, months_covered: data.length } });
  } catch (error) {
    next(error);
  }
});

// Appointment statistics report
router.get('/appointments/stats', async (req, res, next) => {
  try {
    const months = Math.max(1, Math.min(parseInt(req.query.months) || 12, 60));

    const data = await db
      .selectFrom('appointments')
      .select([
        db.fn('DATE_TRUNC', ['month', 'appointment_date']).as('month'),
        'status_key',
        db.fn.count('id').as('appointment_count'),
      ])
      .where('tenant_id', '=', req.tenantId)
      .where('appointment_date', '>=', db.sql`NOW() - INTERVAL ${sql.literal(`${months} months`)}`)
      .groupBy(['month', 'status_key'])
      .orderBy('month', 'desc')
      .execute();

    const total = data.reduce((sum, row) => sum + parseInt(row.appointment_count), 0);

    const byStatus = {};
    for (const row of data) {
      if (!byStatus[row.status_key]) {
        byStatus[row.status_key] = 0;
      }
      byStatus[row.status_key] += parseInt(row.appointment_count);
    }

    res.json({
      data,
      summary: {
        total_appointments: total,
        by_status: Object.entries(byStatus).map(([key, count]) => ({
          status_key: key,
          count,
          percentage: total > 0 ? safeNumber((count / total) * 100) : 0,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Treatment plan summary report
router.get('/plans/summary', async (req, res, next) => {
  try {
    const data = await db
      .selectFrom('treatment_plans')
      .select([
        'status_key',
        db.fn.count('id').as('plan_count'),
        db.fn.sum('estimated_total_dzd').as('total_estimated_dzd'),
      ])
      .where('tenant_id', '=', req.tenantId)
      .groupBy('status_key')
      .execute();

    const total = data.reduce((sum, row) => sum + parseInt(row.plan_count), 0);

    res.json({
      data: data.map(row => ({
        status_key: row.status_key,
        plan_count: parseInt(row.plan_count),
        total_estimated_dzd: safeNumber(row.total_estimated_dzd),
        percentage: total > 0 ? safeNumber((parseInt(row.plan_count) / total) * 100) : 0,
      })),
      summary: { total_plans: total },
    });
  } catch (error) {
    next(error);
  }
});

// Revenue by payment method
router.get('/revenue/by-method', async (req, res, next) => {
  try {
    let query = db
      .selectFrom('payments')
      .innerJoin('payment_methods', 'payments.payment_method_id', 'payment_methods.id')
      .select([
        'payment_methods.method_key as payment_method',
        db.fn.count('payments.id').as('transaction_count'),
        db.fn.sum('payments.amount_dzd').as('total_dzd'),
      ])
      .where('payments.tenant_id', '=', req.tenantId);

    query = applyDateFilter(query, 'payments.payment_date', req);
    if (!query) return res.status(400).json({ error: 'Invalid date filter parameters' });

    const data = await query
      .groupBy('payment_methods.method_key')
      .orderBy('total_dzd', 'desc')
      .execute();

    const grandTotal = data.reduce((sum, row) => sum + safeNumber(row.total_dzd), 0);

    res.json({
      data: data.map(row => ({
        payment_method: row.payment_method,
        transaction_count: parseInt(row.transaction_count),
        total_dzd: safeNumber(row.total_dzd),
        percentage: grandTotal > 0 ? safeNumber((safeNumber(row.total_dzd) / grandTotal) * 100) : 0,
      })),
      summary: { grand_total_dzd: safeNumber(grandTotal) },
    });
  } catch (error) {
    next(error);
  }
});

// Per-dentist stats
router.get('/dentist/stats', async (req, res, next) => {
  try {
    let query = db
      .selectFrom('treatment_records')
      .innerJoin('users', 'treatment_records.dentist_id', 'users.id')
      .select([
        'treatment_records.dentist_id',
        'users.full_name as dentist_name',
        db.fn.count('treatment_records.id').as('treatment_count'),
        db.fn.sum('treatment_records.estimated_cost_dzd').as('total_estimated_dzd'),
      ])
      .where('treatment_records.tenant_id', '=', req.tenantId);

    query = applyDateFilter(query, 'treatment_records.treatment_date', req);
    if (!query) return res.status(400).json({ error: 'Invalid date filter parameters' });

    const data = await query
      .groupBy(['treatment_records.dentist_id', 'users.full_name'])
      .orderBy('treatment_count', 'desc')
      .execute();

    const grandTotal = data.reduce((sum, row) => sum + parseInt(row.treatment_count), 0);

    res.json({
      data: data.map(row => ({
        dentist_id: row.dentist_id,
        dentist_name: row.dentist_name,
        treatment_count: parseInt(row.treatment_count),
        total_estimated_dzd: safeNumber(row.total_estimated_dzd),
        percentage: grandTotal > 0 ? safeNumber((parseInt(row.treatment_count) / grandTotal) * 100) : 0,
      })),
      summary: { total_treatments: grandTotal },
    });
  } catch (error) {
    next(error);
  }
});

// Export revenue data as CSV
router.get('/revenue/export', async (req, res, next) => {
  try {
    let query = db
      .selectFrom('payments')
      .leftJoin('patients', 'payments.patient_id', 'patients.id')
      .innerJoin('payment_methods', 'payments.payment_method_id', 'payment_methods.id')
      .select([
        'payments.id',
        'payments.payment_date',
        'payments.amount_dzd',
        'payment_methods.method_key as payment_method',
        'payments.reference_number',
        'patients.full_name as patient_name',
        'patients.patient_code',
      ])
      .where('payments.tenant_id', '=', req.tenantId);

    query = applyDateFilter(query, 'payments.payment_date', req);
    if (!query) return res.status(400).json({ error: 'Invalid date filter parameters' });

    const payments = await query
      .orderBy('payments.payment_date', 'desc')
      .limit(10000)
      .execute();

    const columns = ['id', 'payment_date', 'amount_dzd', 'payment_method', 'reference_number', 'patient_name', 'patient_code'];
    const header = columns.join(',');
    const rows = payments.map(p => toCsvRow(p, columns));
    const csv = header + '\n' + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue-export.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
