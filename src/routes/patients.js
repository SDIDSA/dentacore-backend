const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');

const router = express.Router();

router.use(authenticate);

// Get all patients
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom('patients')
      .leftJoin('wilayas', 'patients.wilaya_id', 'wilayas.id')
      .select([
        'patients.id',
        'patients.patient_code',
        'patients.first_name',
        'patients.last_name',
        'patients.date_of_birth',
        'patients.gender',
        'patients.phone',
        'patients.email',
        'patients.address',
        'patients.emergency_contact_name',
        'patients.emergency_contact_phone',
        'patients.medical_history',
        'patients.allergies',
        'patients.blood_type',
        'patients.is_active',
        'patients.created_at',
        'wilayas.name_key as wilaya_name_key'
      ])
      .where('patients.is_active', '=', true);

    if (search) {
      query = query.where((eb) =>
        eb.or([
          eb('patients.first_name', 'ilike', `%${search}%`),
          eb('patients.last_name', 'ilike', `%${search}%`),
          eb('patients.patient_code', 'ilike', `%${search}%`)
        ])
      );
    }

    const patients = await query
      .orderBy('patients.created_at', 'desc')
      .limit(Number(limit))
      .offset(Number(offset))
      .execute();

    res.json({ patients });
  } catch (error) {
    next(error);
  }
});

// Get patient by ID
router.get('/:id', async (req, res, next) => {
  try {
    const patient = await db
      .selectFrom('patients')
      .leftJoin('wilayas', 'patients.wilaya_id', 'wilayas.id')
      .select([
        'patients.id',
        'patients.patient_code',
        'patients.first_name',
        'patients.last_name',
        'patients.date_of_birth',
        'patients.gender',
        'patients.phone',
        'patients.email',
        'patients.wilaya_id',
        'patients.address',
        'patients.emergency_contact_name',
        'patients.emergency_contact_phone',
        'patients.medical_history',
        'patients.allergies',
        'patients.blood_type',
        'patients.is_active',
        'patients.created_at',
        'wilayas.name_key as wilaya_name_key'
      ])
      .where('patients.id', '=', req.params.id)
      .executeTakeFirst();

    if (!patient) {
      return res.status(404).json({ error: 'patient.error.not_found' });
    }

    res.json(patient);
  } catch (error) {
    next(error);
  }
});

// Create patient
router.post('/',
  body('first_name').trim().notEmpty(),
  body('last_name').trim().notEmpty(),
  body('date_of_birth').isDate(),
  body('gender').isIn(['patient.gender.male', 'patient.gender.female']),
  body('phone').matches(/^\+213[0-9]{9}$/),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const {
        first_name, last_name, date_of_birth, gender, phone, email,
        wilaya_id, address, emergency_contact_name, emergency_contact_phone,
        medical_history, allergies, blood_type
      } = req.body;

      // Generate patient code
      const year = new Date().getFullYear();
      const countResult = await db
        .selectFrom('patients')
        .select(sql`COUNT(*)`.as('count'))
        .where('patient_code', 'like', `PAT-${year}-%`)
        .executeTakeFirst();

      const nextNum = parseInt(countResult.count) + 1;
      const patient_code = `PAT-${year}-${String(nextNum).padStart(4, '0')}`;

      const patient = await db
        .insertInto('patients')
        .values({
          patient_code,
          first_name,
          last_name,
          date_of_birth,
          gender,
          phone,
          email: email || null,
          wilaya_id: wilaya_id || null,
          address: address || null,
          emergency_contact_name: emergency_contact_name || null,
          emergency_contact_phone: emergency_contact_phone || null,
          medical_history: medical_history || null,
          allergies: allergies || null,
          blood_type: blood_type || null,
          created_by: req.user.id
        })
        .returningAll()
        .executeTakeFirst();

      // Log the patient creation
      await req.audit.log({
        action: 'CREATE',
        entityType: 'patients',
        entityId: patient.id,
        newValues: patient
      });

      res.status(201).json(patient);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
