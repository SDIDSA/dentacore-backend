// Audit queue resilience: one invalid entry (e.g. a non-UUID entity_id, as the old
// odontogram delete produced) must not make the entries batched with it get lost.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const crypto = require('crypto');
const db = require('../config/database');
const auditLogger = require('../middleware/auditLogger');

let dbAvailable = true;
let tenantId = null;

beforeAll(async () => {
  try {
    const [t] = await db.insertInto('tenants')
      .values({ name: 'Audit Queue', subdomain: `auditq-${crypto.randomUUID().slice(0, 8)}`, subscription_status: 'tenant.status.trial' })
      .returning('id').execute();
    tenantId = t.id;
  } catch (err) {
    console.warn(`[auditQueue] DB unavailable, skipping suite: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable || !tenantId) return;
  try {
    await db.deleteFrom('audit_logs').where('tenant_id', '=', tenantId).execute();
    await db.deleteFrom('tenants').where('id', '=', tenantId).execute();
  } catch (_) { /* ignore cleanup errors */ }
});

async function waitFor(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

describe('audit queue', () => {
  it('still writes good entries that share a batch with a bad one', async () => {
    if (!dbAvailable) return;
    const goodId = crypto.randomUUID();
    await auditLogger.log({ action: 'DELETE', entityType: 'odontogram_conditions', entityId: `${goodId}:11`, tenantId });
    await auditLogger.log({ action: 'UPDATE', entityType: 'patients', entityId: goodId, tenantId });

    const landed = await waitFor(async () => {
      const rows = await db.selectFrom('audit_logs').select('id')
        .where('tenant_id', '=', tenantId).where('entity_id', '=', goodId).execute();
      return rows.length === 1;
    });
    expect(landed).toBe(true);
  });
});
