const express = require('express');
const request = require('supertest');
const { body, validationResult } = require('express-validator');
const { EMAIL_NORMALIZE } = require('../utils/email');

// Login looks users up by the normalized address, so normalizing must not
// rewrite it beyond lowercasing (Gmail dots / +tags are part of the stored email).
const app = express();
app.use(express.json());
app.post('/echo', body('email').isEmail().normalizeEmail(EMAIL_NORMALIZE), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).end();
  res.json({ email: req.body.email });
});

describe('EMAIL_NORMALIZE', () => {
  it.each([
    ['zinou.teyar@gmail.com', 'zinou.teyar@gmail.com'],
    ['First.Last+clinic@Gmail.com', 'first.last+clinic@gmail.com'],
    ['someone@googlemail.com', 'someone@googlemail.com'],
    ['a.b+x@outlook.com', 'a.b+x@outlook.com'],
    ['Admin@ElQods.DZ', 'admin@elqods.dz'],
  ])('%s -> %s', async (input, expected) => {
    const res = await request(app).post('/echo').send({ email: input });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(expected);
  });
});
