// Public clinic self-signup — creates a trial tenant + its admin account.
// Unauthenticated by design (the only other such surfaces are auth.js login
// and publicBookings.js). Guarded by a strict per-IP limiter because tenant
// creation is the most expensive public mutation in the system.
const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../config/logger');

const router = express.Router();

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'signup.error.too_many' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// slugs that must never be claimable (routes/infra namespaces)
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'book', 'signup', 'login', 'mail', 'ftp',
  'sera', 'dentacore', 'localhost', 'docs', 'status', 'help', 'support',
]);

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const PHONE_RE = /^\+213[0-9]{9}$/;

const TRIAL_DAYS = 30;

const error = (res, code, err) => res.status(code).json({ error: err });

router.post('/',
  signupLimiter,
  body('clinic_name').isString().trim().isLength({ min: 2, max: 255 }),
  body('subdomain').isString().trim().toLowerCase().isLength({ min: 1, max: 63 })
    .custom((v) => SUBDOMAIN_RE.test(v) && !RESERVED_SUBDOMAINS.has(v)),
  body('full_name').isString().trim().isLength({ min: 2, max: 255 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('phone').isString().trim().custom((v) => PHONE_RE.test(v)),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    const { clinic_name, subdomain, full_name, email, password, phone } = req.body;

    try {
      const result = await db.transaction().execute(async (trx) => {
        const subdomainTaken = await trx
          .selectFrom('tenants')
          .select('id')
          .where('subdomain', '=', subdomain)
          .executeTakeFirst();
        if (subdomainTaken) {
          return { conflict: 'signup.error.subdomain_taken' };
        }

        const emailTaken = await trx
          .selectFrom('users')
          .select('id')
          .where('email', '=', email)
          .executeTakeFirst();
        if (emailTaken) {
          return { conflict: 'signup.error.email_taken' };
        }

        const role = await trx
          .selectFrom('roles')
          .select('id')
          .where('role_key', '=', 'auth.role.admin')
          .executeTakeFirst();
        if (!role) {
          throw new Error('auth.role.admin role missing');
        }

        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

        const [tenant] = await trx
          .insertInto('tenants')
          .values({
            name: clinic_name,
            subdomain,
            subscription_status: 'tenant.status.trial',
            subscription_started_at: new Date(),
            subscription_ends_at: trialEnd,
          })
          .returningAll()
          .execute();

        const [newUser] = await trx
          .insertInto('users')
          .values({
            tenant_id: tenant.id,
            email,
            password_hash: bcrypt.hashSync(password, 10),
            full_name,
            phone,
            status_key: 'user.status.active',
          })
          .returning('id')
          .execute();

        await trx
          .insertInto('user_roles')
          .values({ user_id: newUser.id, role_id: role.id })
          .execute();

        return {
          tenant: { name: tenant.name, subdomain: tenant.subdomain },
          trial_ends_at: trialEnd.toISOString(),
        };
      });

      if (result.conflict) {
        return error(res, 409, result.conflict);
      }

      logger.info('clinic signup', { subdomain: result.tenant.subdomain });
      return res.status(201).json(result);
    } catch (err) {
      // unique-constraint backstop in case of a race past the in-txn checks
      if (err && err.code === '23505') {
        return error(res, 409, 'signup.error.subdomain_taken');
      }
      logger.error('clinic signup failed', { error: err.message });
      return next(err);
    }
  }
);

module.exports = router;
