const db = require('../config/database');

/**
 * Audit logging middleware to track user actions
 */
const auditLogger = {
  /**
   * Log an audit event
   * @param {Object} params - Audit parameters
   * @param {string} params.userId - User ID performing the action
   * @param {string} params.action - Action performed (CREATE, UPDATE, DELETE, etc.)
   * @param {string} params.entityType - Type of entity (patients, appointments, etc.)
   * @param {string} params.entityId - ID of the entity
   * @param {Object} params.oldValues - Previous values (for updates)
   * @param {Object} params.newValues - New values
   * @param {string} params.ipAddress - Client IP address
   * @param {string} params.userAgent - Client user agent
   */
  async log({
    userId,
    action,
    entityType,
    entityId,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      await db
        .insertInto('audit_logs')
        .values({
          user_id: userId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          old_values: oldValues ? JSON.stringify(oldValues) : null,
          new_values: newValues ? JSON.stringify(newValues) : null,
          ip_address: ipAddress,
          user_agent: userAgent
        })
        .execute();
    } catch (error) {
      // Don't throw errors for audit logging failures
      console.error('Audit logging failed:', error);
    }
  },

  /**
   * Express middleware to capture request info for audit logging
   */
  middleware() {
    return (req, res, next) => {
      // Add audit helper to request object
      req.audit = {
        log: (params) => this.log({
          ...params,
          userId: req.user?.id,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        })
      };

      // Capture original res.json to log successful operations
      const originalJson = res.json;
      res.json = function(data) {
        // Store response data for potential audit logging
        res.locals.responseData = data;
        return originalJson.call(this, data);
      };

      next();
    };
  }
};

module.exports = auditLogger;