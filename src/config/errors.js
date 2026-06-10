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
  'patient.error.has_invoices': 'Cannot delete patient with existing invoices',

  'appointment.error.not_found': 'Appointment not found',
  'appointment.error.overlap': 'Appointment time conflicts with an existing appointment',
  'appointment.error.invalid_status': 'Invalid appointment status transition',
  'appointment.error.has_invoices': 'Cannot delete appointment with associated invoices',

  'treatment.error.not_found': 'Treatment record not found',

  'plan.error.not_found': 'Treatment plan not found',

  'invoice.error.not_found': 'Invoice not found',
  'invoice.error.cannot_delete': 'Cannot delete invoice with payments',
  'invoice.error.already_paid': 'Invoice has already been fully paid',

  'payment.error.not_found': 'Payment not found',
  'payment.error.overpayment': 'Payment amount exceeds invoice balance',
  'payment.error.invoice_not_found': 'Invoice not found for payment',

  'inventory.error.not_found': 'Inventory item not found',
  'inventory.error.insufficient_stock': 'Insufficient stock quantity',
  'inventory.error.negative_stock': 'Stock quantity cannot be negative',

  'supplier.error.not_found': 'Supplier not found',

  'purchase_order.error.not_found': 'Purchase order not found',
  'purchase_order.error.cannot_modify': 'Cannot modify a received or cancelled purchase order',

  'expense.error.not_found': 'Expense not found',

  'po.error.not_found': 'Purchase order not found',
  'po.error.item_not_found': 'Purchase order item not found',
  'po.error.quantity_exceeds': 'Quantity exceeds available stock',
  'po.error.invalid_status': 'Invalid purchase order status',
  'po.error.cannot_delete': 'Cannot delete purchase order with received items',

  'inventory.error.movement_not_found': 'Inventory movement not found',
  'inventory.error.category_not_found': 'Inventory category not found',
  'inventory.error.category_has_items': 'Category has associated items',
  'inventory.error.category_has_subcategories': 'Category has subcategories',
  'inventory.error.supplier_not_found': 'Supplier not found',
  'inventory.error.item_not_found': 'Inventory item not found',

  'media.error.not_found': 'Media not found',
  'media.error.no_file': 'No file uploaded',
  'media.error.invalid_mime_type': 'Invalid file type, only images are allowed',

  'xray.error.not_found': 'X-ray not found',
  'xray.error.no_file': 'No file uploaded',
  'xray.error.invalid_mime_type': 'Invalid file type',

  'user.error.not_found': 'User not found',
  'user.error.duplicate_email': 'A user with this email already exists',
  'user.error.email_exists': 'A user with this email already exists',
  'user.error.phone_exists': 'A user with this phone number already exists',
  'user.error.invalid_role': 'Invalid role specified',
  'user.error.cannot_change_own_status': 'Cannot change your own account status',
  'user.error.cannot_delete_self': 'Cannot delete your own account',

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
