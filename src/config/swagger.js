const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DentaCore API',
      version: '1.0.0',
      description: 'Multi-tenant Algerian Dental Management System REST API',
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Patient: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            patient_code: { type: 'string', example: 'PAT-2025-0001' },
            full_name: { type: 'string' },
            date_of_birth: { type: 'string', format: 'date' },
            gender: { type: 'string', example: 'patient.gender.male' },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
            status_key: { type: 'string' },
            blood_type: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Appointment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            appointment_date: { type: 'string', format: 'date-time' },
            duration_minutes: { type: 'integer' },
            status_key: { type: 'string' },
            reason: { type: 'string' },
            patient_name: { type: 'string' },
            dentist_name: { type: 'string' },
          },
        },
        TreatmentRecord: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            treatment_date: { type: 'string', format: 'date' },
            tooth_number: { type: 'string' },
            diagnosis: { type: 'string' },
            treatment_performed: { type: 'string' },
            estimated_cost_dzd: { type: 'number' },
            dentist_name: { type: 'string' },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            amount_dzd: { type: 'number' },
            payment_date: { type: 'string', format: 'date-time' },
            payment_method: { type: 'string' },
            reference_number: { type: 'string' },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoice_number: { type: 'string' },
            invoice_date: { type: 'string', format: 'date' },
            subtotal_dzd: { type: 'number' },
            total_dzd: { type: 'number' },
            status_key: { type: 'string' },
          },
        },
        InventoryItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            item_code: { type: 'string' },
            name: { type: 'string' },
            unit_of_measure: { type: 'string' },
            unit_cost_dzd: { type: 'number' },
            current_stock: { type: 'number' },
            min_stock_level: { type: 'number' },
          },
        },
        TreatmentPlan: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            plan_name: { type: 'string' },
            status_key: { type: 'string' },
            estimated_total_dzd: { type: 'number' },
            actual_total_dzd: { type: 'number' },
            treatment_count: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        XRay: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tooth_number: { type: 'string' },
            description: { type: 'string' },
            captured_date: { type: 'string', format: 'date' },
            cloudinary_url: { type: 'string' },
          },
        },
        Expense: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            amount_dzd: { type: 'number' },
            category_key: { type: 'string' },
            description: { type: 'string' },
            expense_date: { type: 'string', format: 'date' },
          },
        },
        PurchaseOrder: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            order_number: { type: 'string' },
            status_key: { type: 'string' },
            total_amount_dzd: { type: 'number' },
            supplier_name: { type: 'string' },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            action: { type: 'string' },
            entity_type: { type: 'string' },
            entity_id: { type: 'string' },
            user_name: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            full_name: { type: 'string' },
            email: { type: 'string' },
            role_key: { type: 'string' },
            status_key: { type: 'string' },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error key for i18n' },
            details: {
              type: 'array',
              items: { type: 'object' },
              description: 'Validation error details',
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
          },
        },
      },
    },
    paths: {
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      id: { type: 'string' },
                      fullName: { type: 'string' },
                      roleKey: { type: 'string' },
                      tenantId: { type: 'string' },
                    },
                  },
                },
              },
            },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout and revoke tokens',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Logged out' } },
        },
      },
      '/auth/validate': {
        get: {
          tags: ['Auth'],
          summary: 'Validate access token',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Token valid' }, 401: { description: 'Invalid token' } },
        },
      },
      '/patients': {
        get: {
          tags: ['Patients'],
          summary: 'List patients (with pagination)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'status_key', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Array of patient IDs or paginated response' } },
        },
        post: {
          tags: ['Patients'],
          summary: 'Create a new patient',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['full_name', 'date_of_birth', 'gender', 'phone'],
                  properties: {
                    full_name: { type: 'string' },
                    date_of_birth: { type: 'string', format: 'date' },
                    gender: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: 'string' },
                    blood_type: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Created patient' } },
        },
      },
      '/patients/{id}': {
        get: {
          tags: ['Patients'],
          summary: 'Get patient details',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Patient details' }, 404: { description: 'Not found' } },
        },
        patch: {
          tags: ['Patients'],
          summary: 'Update patient',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Updated patient' } },
        },
        delete: {
          tags: ['Patients'],
          summary: 'Delete patient',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 204: { description: 'Deleted' } },
        },
      },
      '/patients/{id}/status': {
        patch: {
          tags: ['Patients'],
          summary: 'Update patient status',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Status updated' } },
        },
      },
      '/appointments': {
        get: {
          tags: ['Appointments'],
          summary: 'List appointments',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Appointments list' } },
        },
        post: {
          tags: ['Appointments'],
          summary: 'Create appointment',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Created' } },
        },
      },
      '/appointments/{id}': {
        get: { tags: ['Appointments'], summary: 'Get appointment', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Appointment details' } } },
        patch: { tags: ['Appointments'], summary: 'Update appointment', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Appointments'], summary: 'Delete appointment', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/appointments/range': {
        get: {
          tags: ['Appointments'],
          summary: 'Get appointments by date range',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'start_date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
            { name: 'end_date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Appointments in range' } },
        },
      },
      '/treatments': {
        get: { tags: ['Treatments'], summary: 'List treatments', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Treatment list' } } },
        post: { tags: ['Treatments'], summary: 'Create treatment record', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/treatments/{id}': {
        get: { tags: ['Treatments'], summary: 'Get treatment', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Treatment details' } } },
        put: { tags: ['Treatments'], summary: 'Update treatment', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Treatments'], summary: 'Delete treatment', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/treatment-plans': {
        get: {
          tags: ['Treatment Plans'],
          summary: 'List treatment plans (paginated)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'patient_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['created_at', 'plan_name', 'estimated_total_dzd', 'status_key', 'updated_at'] } },
            { name: 'sort_order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'Paginated plans' } },
        },
        post: { tags: ['Treatment Plans'], summary: 'Create treatment plan', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/treatment-plans/{id}': {
        get: { tags: ['Treatment Plans'], summary: 'Get plan with treatments', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Plan details' } } },
        patch: { tags: ['Treatment Plans'], summary: 'Update plan', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Treatment Plans'], summary: 'Delete plan', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Deleted' } } },
      },
      '/treatment-plans/{id}/treatments': {
        post: { tags: ['Treatment Plans'], summary: 'Add treatment to plan', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Treatment added' } } },
      },
      '/treatment-plans/{id}/treatments/{treatmentId}': {
        delete: { tags: ['Treatment Plans'], summary: 'Remove treatment from plan', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'treatmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Treatment removed' } } },
      },
      '/payments': {
        get: { tags: ['Payments'], summary: 'List payments', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Payment list' } } },
        post: { tags: ['Payments'], summary: 'Create payment', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/payments/{id}': {
        get: { tags: ['Payments'], summary: 'Get payment', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Payment details' } } },
        delete: { tags: ['Payments'], summary: 'Delete payment', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/invoices': {
        get: { tags: ['Invoices'], summary: 'List invoices', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Invoice list' } } },
        post: { tags: ['Invoices'], summary: 'Create invoice', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/invoices/{id}': {
        get: { tags: ['Invoices'], summary: 'Get invoice', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Invoice details' } } },
        put: { tags: ['Invoices'], summary: 'Update invoice', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Invoices'], summary: 'Delete invoice', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/invoices/{id}/payments': {
        post: { tags: ['Invoices'], summary: 'Add payment to invoice', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 201: { description: 'Payment added' } } },
      },
      '/inventory/items': {
        get: { tags: ['Inventory'], summary: 'List inventory items', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Item list' } } },
        post: { tags: ['Inventory'], summary: 'Create inventory item', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/inventory/items/{id}': {
        get: { tags: ['Inventory'], summary: 'Get item details', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Item details' } } },
        patch: { tags: ['Inventory'], summary: 'Update item', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Inventory'], summary: 'Delete item', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/inventory/items/{id}/adjust-stock': {
        post: { tags: ['Inventory'], summary: 'Adjust stock quantity', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Stock adjusted' } } },
      },
      '/inventory/categories': {
        get: { tags: ['Inventory'], summary: 'List inventory categories', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Category list' } } },
      },
      '/inventory/suppliers': {
        get: { tags: ['Inventory'], summary: 'List suppliers', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Supplier list' } } },
        post: { tags: ['Inventory'], summary: 'Create supplier', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/inventory/suppliers/{id}': {
        get: { tags: ['Inventory'], summary: 'Get supplier', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Supplier details' } } },
        patch: { tags: ['Inventory'], summary: 'Update supplier', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Inventory'], summary: 'Delete supplier', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/purchase-orders': {
        get: { tags: ['Purchase Orders'], summary: 'List purchase orders', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Purchase order list' } } },
        post: { tags: ['Purchase Orders'], summary: 'Create purchase order', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/purchase-orders/{id}': {
        get: { tags: ['Purchase Orders'], summary: 'Get purchase order', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Purchase order details' } } },
        patch: { tags: ['Purchase Orders'], summary: 'Update purchase order', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Purchase Orders'], summary: 'Delete purchase order', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/expenses': {
        get: { tags: ['Expenses'], summary: 'List expenses', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Expense list' } } },
        post: { tags: ['Expenses'], summary: 'Create expense', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/expenses/{id}': {
        get: { tags: ['Expenses'], summary: 'Get expense', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Expense details' } } },
        patch: { tags: ['Expenses'], summary: 'Update expense', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Expenses'], summary: 'Delete expense', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/media': {
        get: { tags: ['Media'], summary: 'List media', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Media list' } } },
      },
      '/media/{id}': {
        get: { tags: ['Media'], summary: 'Get media details', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Media details' } } },
        delete: { tags: ['Media'], summary: 'Delete media', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/media/upload': {
        post: {
          tags: ['Media'],
          summary: 'Upload media file',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } },
          },
          responses: { 201: { description: 'Uploaded' } },
        },
      },
      '/xrays': {
        get: { tags: ['X-Rays'], summary: 'List x-rays', security: [{ bearerAuth: [] }], responses: { 200: { description: 'X-ray list' } } },
      },
      '/xrays/{id}': {
        get: { tags: ['X-Rays'], summary: 'Get x-ray', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'X-ray details' } } },
        patch: { tags: ['X-Rays'], summary: 'Update x-ray', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['X-Rays'], summary: 'Delete x-ray', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/xrays/upload': {
        post: {
          tags: ['X-Rays'],
          summary: 'Upload x-ray image',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, patient_id: { type: 'string' }, tooth_number: { type: 'string' }, description: { type: 'string' } } } } },
          },
          responses: { 201: { description: 'Uploaded' } },
        },
      },
      '/users': {
        get: { tags: ['Users'], summary: 'List users', security: [{ bearerAuth: [] }], responses: { 200: { description: 'User list' } } },
        post: { tags: ['Users'], summary: 'Create user', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
      },
      '/users/{id}': {
        get: { tags: ['Users'], summary: 'Get user', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'User details' } } },
        patch: { tags: ['Users'], summary: 'Update user', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Users'], summary: 'Delete user', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
      },
      '/users/{id}/status': {
        patch: { tags: ['Users'], summary: 'Update user status', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Status updated' } } },
      },
      '/users/{id}/password': {
        patch: { tags: ['Users'], summary: 'Reset user password', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Password reset' } } },
      },
      '/audit-logs': {
        get: {
          tags: ['Audit Logs'],
          summary: 'List audit logs',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
            { name: 'entity_type', in: 'query', schema: { type: 'string' } },
            { name: 'action', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Audit log list' } },
        },
      },
      '/audit-logs/{id}': {
        get: {
          tags: ['Audit Logs'],
          summary: 'Get audit log entry',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Audit log entry' } },
        },
      },
      '/dashboard/appointments/today': {
        get: { tags: ['Dashboard'], summary: "Get today's appointments", security: [{ bearerAuth: [] }], responses: { 200: { description: 'Today appointments' } } },
      },
      '/dashboard/recent-activity': {
        get: { tags: ['Dashboard'], summary: 'Get recent activity (audit logs)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Activity list' } } },
      },
      '/dashboard/patients/raw': {
        get: { tags: ['Dashboard'], summary: 'Raw patient data', security: [{ bearerAuth: [] }], parameters: [{ name: 'start_date', in: 'query', schema: { type: 'string' } }, { name: 'end_date', in: 'query', schema: { type: 'string' } }, { name: 'status_key', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Raw patients' } } },
      },
      '/dashboard/appointments/raw': {
        get: { tags: ['Dashboard'], summary: 'Raw appointment data', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Raw appointments' } } },
      },
      '/dashboard/treatments/raw': {
        get: { tags: ['Dashboard'], summary: 'Raw treatment data', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Raw treatments' } } },
      },
      '/dashboard/payments/raw': {
        get: { tags: ['Dashboard'], summary: 'Raw payment data', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Raw payments' } } },
      },
      '/reports/revenue/monthly': {
        get: { tags: ['Reports'], summary: 'Monthly revenue', security: [{ bearerAuth: [] }], parameters: [{ name: 'months', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'Revenue data' } } },
      },
      '/reports/revenue/by-method': {
        get: { tags: ['Reports'], summary: 'Revenue by payment method', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Revenue by method' } } },
      },
      '/reports/revenue/export': {
        get: { tags: ['Reports'], summary: 'Export revenue as CSV', security: [{ bearerAuth: [] }], responses: { 200: { description: 'CSV file download' } } },
      },
      '/reports/procedures/frequency': {
        get: { tags: ['Reports'], summary: 'Procedure frequency', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Procedure data' } } },
      },
      '/reports/patients/new': {
        get: { tags: ['Reports'], summary: 'New patients over time', security: [{ bearerAuth: [] }], responses: { 200: { description: 'New patient data' } } },
      },
      '/reports/appointments/stats': {
        get: { tags: ['Reports'], summary: 'Appointment statistics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Appointment stats' } } },
      },
      '/reports/plans/summary': {
        get: { tags: ['Reports'], summary: 'Treatment plan summary', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Plan summary' } } },
      },
      '/reports/dentist/stats': {
        get: { tags: ['Reports'], summary: 'Per-dentist statistics', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Dentist stats' } } },
      },
      '/notifications': {
        get: { tags: ['Notifications'], summary: 'List notifications', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Notification list' } } },
      },
      '/notifications/remind': {
        post: { tags: ['Notifications'], summary: 'Trigger reminder check', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Reminders sent' } } },
      },
      '/odontogram/{patientId}': {
        get: { tags: ['Odontogram'], summary: 'Get tooth status map for patient', security: [{ bearerAuth: [] }], parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Tooth status map' } } },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
