const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');
const db = require('../config/database');

const router = express.Router();

router.use(authenticate);

const FDI_TEETH = [
  '11', '12', '13', '14', '15', '16', '17', '18',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '31', '32', '33', '34', '35', '36', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48',
];

const QUADRANTS = {
  '1': { label: 'Upper Right', region: 'upper' },
  '2': { label: 'Upper Left', region: 'upper' },
  '3': { label: 'Lower Left', region: 'lower' },
  '4': { label: 'Lower Right', region: 'lower' },
};

function getToothInfo(fdiNumber) {
  const quadrant = fdiNumber[0];
  const position = Number.parseInt(fdiNumber[1]);
  return {
    fdi: fdiNumber,
    quadrant: Number.parseInt(quadrant),
    quadrant_label: QUADRANTS[quadrant]?.label || 'Unknown',
    region: QUADRANTS[quadrant]?.region || 'unknown',
    position,
  };
}

function determineStatus(treatments, xrays) {
  const extracted = treatments.filter(t => t.treatment_performed?.toLowerCase().includes('extraction'));
  if (extracted.length > 0) return 'extracted';

  const treated = treatments.filter(t =>
    t.treatment_performed && !t.treatment_performed.toLowerCase().includes('extraction')
  );
  if (treated.length > 0) return 'treated';

  const hasXrays = xrays.length > 0;
  if (hasXrays) return 'examined';

  return 'healthy';
}

router.get('/:patientId',
  param('patientId').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const { patientId } = req.params;

      await db
        .selectFrom('patients')
        .select('id')
        .where('id', '=', patientId)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirstOrThrow(() => Object.assign(new Error('patient.error.not_found'), { status: 404 }));

      const treatments = await db
        .selectFrom('treatment_records')
        .select([
          'tooth_number',
          'treatment_performed',
          'diagnosis',
          'treatment_date',
          'estimated_cost_dzd',
        ])
        .where('patient_id', '=', patientId)
        .where('tenant_id', '=', req.tenantId)
        .where('tooth_number', 'is not', null)
        .execute();

      const xrays = await db
        .selectFrom('xrays')
        .select([
          'tooth_number',
          'description',
          'captured_date',
        ])
        .where('patient_id', '=', patientId)
        .where('tenant_id', '=', req.tenantId)
        .where('tooth_number', 'is not', null)
        .execute();

      const conditions = await db
        .selectFrom('odontogram_conditions')
        .select([
          'tooth_number',
          'condition',
          'notes',
          'updated_at',
        ])
        .where('patient_id', '=', patientId)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      const conditionMap = {};
      for (const c of conditions) {
        conditionMap[c.tooth_number] = c;
      }

      const toothMap = {};
      for (const t of FDI_TEETH) {
        const toothTreatments = treatments.filter(tr => tr.tooth_number === t);
        const toothXrays = xrays.filter(x => x.tooth_number === t);
        const savedCondition = conditionMap[t];
        toothMap[t] = {
          ...getToothInfo(t),
          status: savedCondition ? savedCondition.condition : determineStatus(toothTreatments, toothXrays),
          condition: savedCondition ? savedCondition.condition : null,
          condition_notes: savedCondition ? savedCondition.notes : null,
          treatments: toothTreatments.map(tr => ({
            treatment_performed: tr.treatment_performed,
            diagnosis: tr.diagnosis,
            date: tr.treatment_date,
            cost_dzd: tr.estimated_cost_dzd,
          })),
          xray_count: toothXrays.length,
        };
      }

      res.json({
        patient_id: patientId,
        teeth: toothMap,
        summary: {
          total: FDI_TEETH.length,
          healthy: Object.values(toothMap).filter(t => t.status === 'healthy').length,
          treated: Object.values(toothMap).filter(t => t.status === 'treated').length,
          examined: Object.values(toothMap).filter(t => t.status === 'examined').length,
          extracted: Object.values(toothMap).filter(t => t.status === 'extracted').length,
        },
        quadrants: [
          { id: 1, label: 'Upper Right', teeth: FDI_TEETH.filter(t => t.startsWith('1')) },
          { id: 2, label: 'Upper Left', teeth: FDI_TEETH.filter(t => t.startsWith('2')) },
          { id: 3, label: 'Lower Left', teeth: FDI_TEETH.filter(t => t.startsWith('3')) },
          { id: 4, label: 'Lower Right', teeth: FDI_TEETH.filter(t => t.startsWith('4')) },
        ],
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add or update a tooth condition note
router.put('/:patientId/tooth/:toothNumber',
  param('patientId').isUUID(),
  param('toothNumber').isIn(FDI_TEETH),
  body('condition').isString().notEmpty(),
  body('notes').optional().isString(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const { patientId, toothNumber } = req.params;
      const { condition, notes } = req.body;

      await db
        .selectFrom('patients')
        .select('id')
        .where('id', '=', patientId)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirstOrThrow(() => Object.assign(new Error('patient.error.not_found'), { status: 404 }));

      const existing = await db
        .selectFrom('odontogram_conditions')
        .select('id')
        .where('patient_id', '=', patientId)
        .where('tooth_number', '=', toothNumber)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (existing) {
        await db
          .updateTable('odontogram_conditions')
          .set({
            condition,
            notes: notes || null,
            updated_at: sql`NOW()`,
          })
          .where('id', '=', existing.id)
          .execute();
      } else {
        await db
          .insertInto('odontogram_conditions')
          .values({
            patient_id: patientId,
            tooth_number: toothNumber,
            condition,
            notes: notes || null,
            tenant_id: req.tenantId,
          })
          .execute();
      }

      res.json({ success: true, tooth_number: toothNumber, condition });
    } catch (error) {
      next(error);
    }
  }
);

// Remove a tooth condition
router.delete('/:patientId/tooth/:toothNumber',
  param('patientId').isUUID(),
  param('toothNumber').isIn(FDI_TEETH),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const { patientId, toothNumber } = req.params;

      const condition = await db
        .selectFrom('odontogram_conditions')
        .selectAll()
        .where('patient_id', '=', patientId)
        .where('tooth_number', '=', toothNumber)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!condition) {
        return res.status(404).json({ error: 'odontogram.error.not_found' });
      }

      await db
        .deleteFrom('odontogram_conditions')
        .where('patient_id', '=', patientId)
        .where('tooth_number', '=', toothNumber)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      condition.status_key = 'odontogram_condition.status.deleted';

      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'odontogram_conditions',
          entityId: `${patientId}:${toothNumber}`,
          tenantId: req.tenantId,
          oldValues: condition
        });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
