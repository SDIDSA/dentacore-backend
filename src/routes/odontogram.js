const express = require('express');
const { param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
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
  const position = parseInt(fdiNumber[1]);
  return {
    fdi: fdiNumber,
    quadrant: parseInt(quadrant),
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

      const toothMap = {};
      for (const t of FDI_TEETH) {
        const toothTreatments = treatments.filter(tr => tr.tooth_number === t);
        const toothXrays = xrays.filter(x => x.tooth_number === t);
        toothMap[t] = {
          ...getToothInfo(t),
          status: determineStatus(toothTreatments, toothXrays),
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

module.exports = router;
