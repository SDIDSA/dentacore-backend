const errorMessages = {
  'auth.error.no_token': 'Authentication token is required',
  'auth.error.token_revoked': 'Token has been revoked',
  'auth.error.account_inactive': 'Account is inactive',
  'auth.error.invalid_credentials': 'Invalid email or password',
  'auth.error.invalid_token': 'Invalid or malformed token',
  'auth.error.invalid_refresh_token': 'Invalid refresh token',
  'auth.error.refresh_token_expired': 'Refresh token has expired',
  'auth.error.forbidden': 'Insufficient permissions',
  'auth.error.too_many_attempts': 'Too many login attempts, please try again later',
  'auth.logout.success': 'Logged out successfully',

  'validation.error': 'Validation failed',

  'patient.error.not_found': 'Patient not found',
  'patient.error.duplicate_phone': 'A patient with this phone number already exists',
  'patient.error.duplicate_email': 'A patient with this email already exists',

  'appointment.error.not_found': 'Appointment not found',
  'appointment.error.overlap': 'Appointment time conflicts with an existing appointment',
  'appointment.error.invalid_status': 'Invalid appointment status transition',

  'treatment.error.not_found': 'Treatment record not found',

  'plan.error.not_found': 'Treatment plan not found',

  'invoice.error.not_found': 'Invoice not found',
  'invoice.error.cannot_delete': 'Cannot delete invoice with payments',
  'invoice.error.already_paid': 'Invoice has already been fully paid',

  'payment.error.not_found': 'Payment not found',
  'payment.error.overpayment': 'Payment amount exceeds invoice balance',

  'inventory.error.not_found': 'Inventory item not found',
  'inventory.error.insufficient_stock': 'Insufficient stock quantity',
  'inventory.error.negative_stock': 'Stock quantity cannot be negative',

  'supplier.error.not_found': 'Supplier not found',

  'purchase_order.error.not_found': 'Purchase order not found',
  'purchase_order.error.cannot_modify': 'Cannot modify a received or cancelled purchase order',

  'expense.error.not_found': 'Expense not found',

  'media.error.not_found': 'Media not found',
  'media.error.no_file': 'No file uploaded',
  'media.error.invalid_mime_type': 'Invalid file type, only images are allowed',

  'xray.error.not_found': 'X-ray not found',
  'xray.error.no_file': 'No file uploaded',
  'xray.error.invalid_mime_type': 'Invalid file type',

  'user.error.not_found': 'User not found',
  'user.error.duplicate_email': 'A user with this email already exists',

  'error.duplicate_entry': 'Duplicate entry detected',
  'error.foreign_key_violation': 'Referenced record not found',
  'error.internal_server': 'Internal server error',

  'pagination.error.invalid_limit': 'Limit must be a non-negative number',
  'pagination.error.invalid_offset': 'Offset must be a non-negative number',
};

function getErrorMessage(key) {
  return errorMessages[key] || key;
}

module.exports = { errorMessages, getErrorMessage };
