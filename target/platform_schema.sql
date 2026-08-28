-- 20. PLATFORM PLANS (Global â€” SaaS subscription tiers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    monthly_price_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0,
    annual_price_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_patients INTEGER NOT NULL DEFAULT 500,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_plans IS 'SaaS subscription tiers managed by the platform operator';

INSERT INTO platform_plans (name, label, monthly_price_dzd, annual_price_dzd, max_users, max_patients, features, sort_order) VALUES
    ('free',       'Free',       0,      0,      2,    50,   '["basic appointments","patient records"]', 0),
    ('starter',    'Starter',    15000,  150000, 5,    500,  '["appointments","patients","prescriptions","basic reports"]', 1),
    ('clinic',     'Clinic',     35000,  350000, 15,   5000, '["all starter","billing","inventory","x-rays","treatment plans","advanced reports"]', 2),
    ('enterprise', 'Enterprise', 75000,  750000, 999,  99999,'["all clinic","audit logs","multi-branch","priority support"]', 3)
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_platform_plans_active ON platform_plans(is_active);

-- ============================================================================
-- 21. PLATFORM INVOICES (SaaS billing sent to clinics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES platform_plans(id) ON DELETE SET NULL,
    invoice_number VARCHAR(30) NOT NULL UNIQUE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount_dzd DECIMAL(12, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'platform_invoice.draft',
    notes TEXT,
    issued_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_platform_invoice_status CHECK (status IN (
        'platform_invoice.draft', 'platform_invoice.sent',
        'platform_invoice.paid', 'platform_invoice.void'
    )),
    CONSTRAINT chk_platform_invoice_amount CHECK (amount_dzd >= 0)
);

COMMENT ON TABLE platform_invoices IS 'SaaS subscription invoices issued by the platform operator to clinics';

CREATE INDEX IF NOT EXISTS idx_platform_inv_tenant ON platform_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_inv_status ON platform_invoices(status);
CREATE INDEX IF NOT EXISTS idx_platform_inv_period ON platform_invoices(period_start, period_end);

-- ============================================================================
-- 22. PLATFORM AUDIT LOG (cross-tenant operator actions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator_id UUID NOT NULL,
    operator_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_tenant_id UUID,
    target_tenant_name VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_audit_log IS 'Immutable audit trail for platform operator actions';

CREATE INDEX IF NOT EXISTS idx_platform_audit_operator ON platform_audit_log(operator_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_action ON platform_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_platform_audit_tenant ON platform_audit_log(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_log(created_at DESC);

-- ============================================================================
-- 23. API USAGE LOGS (request counting for health dashboard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_usage_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code SMALLINT NOT NULL,
    duration_ms INTEGER NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE api_usage_logs IS 'Per-request logs for API health and usage analytics';

CREATE INDEX IF NOT EXISTS idx_api_usage_tenant ON api_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_status ON api_usage_logs(status_code);

-- Partition-style auto-prune: keep 30 days
CREATE OR REPLACE FUNCTION fn_prune_api_usage() RETURNS trigger AS $$
BEGIN
    DELETE FROM api_usage_logs WHERE created_at < NOW() - INTERVAL '30 days';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prune_api_usage ON api_usage_logs;
CREATE TRIGGER trg_prune_api_usage AFTER INSERT ON api_usage_logs
    FOR EACH STATEMENT EXECUTE FUNCTION fn_prune_api_usage();

-- ============================================================================
-- 24. PLATFORM ANNOUNCEMENTS (operator â†’ clinic notifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    target VARCHAR(30) NOT NULL DEFAULT 'announcement.target.all',
    target_tenant_ids UUID[] DEFAULT '{}',
    channel VARCHAR(20) NOT NULL DEFAULT 'announcement.channel.in_app',
    sent_by UUID NOT NULL,
    sent_by_email VARCHAR(255) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_announcement_target CHECK (target IN (
        'announcement.target.all', 'announcement.target.selected', 'announcement.target.plan'
    )),
    CONSTRAINT chk_announcement_channel CHECK (channel IN (
        'announcement.channel.in_app', 'announcement.channel.email', 'announcement.channel.both'
    ))
);

COMMENT ON TABLE platform_announcements IS 'Platform-wide or targeted announcements sent to clinics';

CREATE INDEX IF NOT EXISTS idx_announcement_sent ON platform_announcements(sent_at DESC);

-- Clinic-side read tracking
CREATE TABLE IF NOT EXISTS announcement_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_announcement_read UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announce_reads_tenant ON announcement_reads(tenant_id);

-- Add plan FK to tenants (nullable â€” existing tenants have no plan assigned yet)
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN plan_id UUID REFERENCES platform_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================================
