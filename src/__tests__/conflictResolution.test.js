const conflictResolution = require('../middleware/conflictResolution');

// Runs the middleware against a record updated at `updatedAt` and reports
// whether the route's conflictCheck(record) rejected the write with 409.
function check({ header, body = {}, updatedAt }) {
  const req = { method: 'PATCH', headers: {}, body: { ...body } };
  if (header !== undefined) req.headers['x-client-timestamp'] = String(header);
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  let nextCalled = false;
  conflictResolution(req, res, () => { nextCalled = true; });
  const rejected = res.conflictCheck({ updated_at: new Date(updatedAt) });
  return { rejected, status: res.statusCode, nextCalled, body: req.body };
}

describe('conflictResolution', () => {
  const now = Date.now();

  it('accepts a live edit from a client whose clock runs slow', () => {
    // record created 5s ago; client clock is 10 minutes behind the server
    const r = check({ header: now - 10 * 60 * 1000, updatedAt: now - 5000 });
    expect(r.nextCalled).toBe(true);
    expect(r.rejected).toBe(false);
    expect(r.status).toBe(200);
  });

  it('accepts a live edit with no client timestamp at all', () => {
    expect(check({ updatedAt: now }).rejected).toBe(false);
  });

  it('rejects an offline edit made before the server change, correcting for clock skew', () => {
    // client clock 10 min behind; edit made 2 min ago (client time), server changed 1 min ago
    const skew = 10 * 60 * 1000;
    const r = check({
      header: now - skew,
      body: { clientTimestamp: now - skew - 2 * 60 * 1000, notes: 'x' },
      updatedAt: now - 60 * 1000,
    });
    expect(r.rejected).toBe(true);
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ notes: 'x' });
  });

  it('accepts an offline edit made after the server change despite a slow clock', () => {
    // client clock 10 min behind; server changed 2 min ago, edit made 1 min ago
    const skew = 10 * 60 * 1000;
    const r = check({
      header: now - skew,
      body: { clientTimestamp: now - skew - 60 * 1000 },
      updatedAt: now - 2 * 60 * 1000,
    });
    expect(r.rejected).toBe(false);
  });
});
