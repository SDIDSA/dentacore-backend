const db = require('../config/database');
const logger = require('../config/logger');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;
let queue = [];
let processing = false;

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const batch = queue.splice(0);
  try {
    await db.insertInto('audit_logs')
      .values(batch.map(entry => ({
        tenant_id: entry.tenantId,
        user_id: entry.userId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        new_values: entry.newValues ? JSON.stringify(entry.newValues) : null,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
      })))
      .execute();
  } catch (error) {
    logger.error('Audit batch insert failed, entries queued for retry', { error: error.message, batchSize: batch.length });
    for (const entry of batch) {
      if (entry._retries < MAX_RETRIES) {
        queue.push({ ...entry, _retries: (entry._retries || 0) + 1 });
      }
    }
  } finally {
    processing = false;
    if (queue.length > 0) {
      setTimeout(processQueue, RETRY_DELAY_MS);
    }
  }
}

function enqueue(entry) {
  queue.push({ ...entry, _retries: 0 });
  if (!processing) {
    setImmediate(processQueue);
  }
}

/**
 * Audit logging middleware to track user actions
 */
const auditLogger = {
  /**
   * Log an audit event
   * @param {Object} params - Audit parameters
   * @param {string} params.userId - User ID performing the action
   * @param {string} params.tenantId - Tenant ID (required)
   * @param {string} params.action - Action performed (CREATE, UPDATE, DELETE, etc.)
   * @param {string} params.entityType - Type of entity (patients, appointments, etc.)
   * @param {string} params.entityId - ID of the entity
   * @param {Object} params.oldValues - Previous values (for updates)
   * @param {Object} params.newValues - New values
   * @param {string} params.ipAddress - Client IP address
   * @param {string} params.userAgent - Client user agent
   */
  async log(params, trx = null) {
    if (trx) {
      try {
        await trx
          .insertInto('audit_logs')
          .values({
            tenant_id: params.tenantId,
            user_id: params.userId,
            action: params.action,
            entity_type: params.entityType,
            entity_id: params.entityId,
            old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
            new_values: params.newValues ? JSON.stringify(params.newValues) : null,
            ip_address: params.ipAddress,
            user_agent: params.userAgent,
          })
          .execute();
      } catch (error) {
        logger.error('Audit log failed within transaction, queuing', { error: error.message, entityType: params.entityType });
        enqueue(params);
      }
    } else {
      enqueue(params);
    }
  },

  /**
   * Express middleware to capture request info for audit logging
   */
  middleware() {
    return (req, res, next) => {
      req.audit = {
        log: (params) => this.log({
          userId: req.user?.id,
          tenantId: req.tenantId,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
          ...params
        })
      };
      const originalJson = res.json;
      res.json = function (data) {
        res.locals.responseData = data;
        return originalJson.call(this, data);
      };

      next();
    };
  },

  getQueueLength() {
    return queue.length;
  }
};

module.exports = auditLogger;