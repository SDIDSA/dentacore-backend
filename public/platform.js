/* Sera operator console — full rebuild: 9 tabs (overview, clinics, revenue,
   plans, invoices, analytics, health, audit, announcements).
   Lang/theme pre-paint + header switchers come from site.js. Auth token in
   sessionStorage; every API call carries it as a bearer token and the backend
   rejects anything that is not auth.role.platform_admin. */
(function () {
  'use strict';

  var TOKEN_KEY = 'platform-token';
  var STATUSES = ['active', 'trial', 'suspended', 'cancelled', 'expired'];
  var API = '/api/v1/platform';

  var T = {
    en: {
      doc_title: 'Sera Platform', kicker: 'Platform', title: 'Operator Console',
      login_lede: 'Operator access only.', email: 'Email', password: 'Password', signin: 'Sign in',
      logout: 'Log out', tab_overview: 'Overview', tab_clinics: 'Clinics',
      tab_revenue: 'Revenue', tab_plans: 'Plans', tab_invoices: 'Invoices',
      tab_analytics: 'Analytics', tab_health: 'Health', tab_audit: 'Audit', tab_announce: 'Announcements',
      stat_clinics: 'Clinics', stat_active: 'Active', stat_trial: 'Trial', stat_suspended: 'Suspended',
      stat_signups: 'Signups \u00b7 30d', stat_users: 'Users', stat_patients: 'Patients', stat_appts: 'Appointments',
      recent_signups: 'Recent signups', th_clinic: 'Clinic', th_address: 'Address', th_status: 'Status',
      th_plan: 'Plan', th_users: 'Users', th_patients: 'Patients', th_appts: 'Appts', th_created: 'Created',
      th_role: 'Role', th_lastlogin: 'Last login', search_ph: 'Search name or address\u2026',
      prev: '\u2039 Prev', next: 'Next \u203a', back: 'Back to clinics', subscription: 'Subscription',
      trial_ends: 'Trial / subscription ends', save: 'Save', saved: 'Saved \u2713', clinic_info: 'Clinic',
      team: 'Team', name: 'Name', footer: 'operator console \u00b7 internal use',
      never: 'never', no_results: 'No clinics match.', loading: 'Loading\u2026',
      err_generic: 'Something went wrong \u2014 please try again.',
      err_credentials: 'Invalid email or password.', err_forbidden: 'This account is not a platform operator.',
      err_session: 'Session expired \u2014 sign in again.', confirm: 'Confirm', aria_theme: 'Switch color theme',
      plan_tier: 'Plan tier', plan_label: 'Plan label', monthly_price: 'Monthly (DZD)', annual_price: 'Annual (DZD)',
      max_users: 'Max users', max_patients: 'Max patients', th_name: 'Name', th_label: 'Label',
      add_plan: '+ Add plan', cancel: 'Cancel', plan_form_title: 'Plan details',
      export_csv: 'Export CSV', bulk_activate: 'Activate', bulk_suspend: 'Suspend', bulk_deselect: 'Deselect',
      impersonate: 'Login as admin', mrr: 'MRR', total_revenue: 'Total collected', outstanding: 'Outstanding',
      monthly_revenue: 'Monthly Revenue', top_tenants: 'Top tenants by revenue',
      plan_tiers: 'Plan tiers', new_invoice: '+ New invoice', th_number: 'Number', th_amount: 'Amount (DZD)',
      th_period: 'Period', period_start: 'Period start', period_end: 'Period end', notes: 'Notes',
      invoice_form: 'New invoice', signup_trend: 'Signup trend', plan_distribution: 'Plan distribution',
      status_funnel: 'Status funnel', hourly_traffic: 'Hourly traffic (24h)', top_endpoints: 'Top endpoints',
      th_method: 'Method', th_path: 'Path', th_count: 'Requests', th_avg_ms: 'Avg (ms)',
      audit_search_ph: 'Filter by operator or action\u2026', th_time: 'Time', th_operator: 'Operator',
      th_action: 'Action', th_target: 'Target', th_details: 'Details',
      sent_announcements: 'Sent announcements', new_announcement: '+ New announcement', th_title: 'Title',
      th_body: 'Body', th_channel: 'Channel', th_sent_by: 'Sent by', compose_announcement: 'Compose announcement',
      send: 'Send', active_count: 'Active', trial_count: 'Trial', suspended_count: 'Suspended',
      cancelled_count: 'Cancelled', expired_count: 'Expired', requests_24h: 'Requests (24h)',
      avg_response: 'Avg response', error_rate: 'Error rate', total_requests: 'Total',
      churn_90d: 'Churn (90d)', total_patients: 'Total patients', read_count: 'Reads'
    },
    fr: {
      doc_title: 'Sera Plateforme', kicker: 'Plateforme', title: 'Console op\u00e9rateur',
      login_lede: 'Acc\u00e8s op\u00e9rateur uniquement.', email: 'E-mail', password: 'Mot de passe', signin: 'Se connecter',
      logout: 'D\u00e9connexion', tab_overview: 'Vue d\u2019ensemble', tab_clinics: 'Cabinets',
      tab_revenue: 'Revenus', tab_plans: 'Formules', tab_invoices: 'Factures',
      tab_analytics: 'Analytique', tab_health: 'Sant\u00e9', tab_audit: 'Audit', tab_announce: 'Annonces',
      stat_clinics: 'Cabinets', stat_active: 'Actifs', stat_trial: 'Essai', stat_suspended: 'Suspendus',
      stat_signups: 'Inscriptions \u00b7 30j', stat_users: 'Utilisateurs', stat_patients: 'Patients', stat_appts: 'Rendez-vous',
      recent_signups: 'Inscriptions r\u00e9centes', th_clinic: 'Cabinet', th_address: 'Adresse', th_status: 'Statut',
      th_plan: 'Formule', th_users: 'Utilisateurs', th_patients: 'Patients', th_appts: 'Rendez-vous', th_created: 'Cr\u00e9\u00e9 le',
      th_role: 'R\u00f4le', th_lastlogin: 'Derni\u00e8re connexion', search_ph: 'Rechercher nom ou adresse\u2026',
      prev: '\u2039 Pr\u00e9c.', next: 'Suiv. \u203a', back: 'Retour aux cabinets', subscription: 'Abonnement',
      trial_ends: 'Fin d\u2019essai / d\u2019abonnement', save: 'Enregistrer', saved: 'Enregistr\u00e9 \u2713', clinic_info: 'Cabinet',
      team: '\u00c9quipe', name: 'Nom', footer: 'console op\u00e9rateur \u00b7 usage interne',
      never: 'jamais', no_results: 'Aucun cabinet trouv\u00e9.', loading: 'Chargement\u2026',
      err_generic: 'Une erreur est survenue \u2014 r\u00e9essayez.',
      err_credentials: 'E-mail ou mot de passe invalide.', err_forbidden: 'Ce compte n\u2019est pas un op\u00e9rateur plateforme.',
      err_session: 'Session expir\u00e9e \u2014 reconnectez-vous.', confirm: 'Confirmer', aria_theme: 'Changer de th\u00e8me',
      plan_tier: 'Formule', plan_label: 'Libell\u00e9', monthly_price: 'Mensuel (DZD)', annual_price: 'Annuel (DZD)',
      max_users: 'Max utilisateurs', max_patients: 'Max patients', th_name: 'Nom', th_label: 'Libell\u00e9',
      add_plan: '+ Ajouter', cancel: 'Annuler', plan_form_title: 'D\u00e9tails de la formule',
      export_csv: 'Exporter CSV', bulk_activate: 'Activer', bulk_suspend: 'Suspendre', bulk_deselect: 'D\u00e9s\u00e9lectionner',
      impersonate: 'Se connecter en tant que', mrr: 'MRR', total_revenue: 'Total encaiss\u00e9', outstanding: 'En attente',
      monthly_revenue: 'Revenu mensuel', top_tenants: 'Top revenus par cabinet',
      plan_tiers: 'Formules', new_invoice: '+ Nouvelle facture', th_number: 'Num\u00e9ro', th_amount: 'Montant (DZD)',
      th_period: 'P\u00e9riode', period_start: 'D\u00e9but', period_end: 'Fin', notes: 'Notes',
      invoice_form: 'Nouvelle facture', signup_trend: 'Tendance inscriptions', plan_distribution: 'R\u00e9partition formules',
      status_funnel: 'Entonnoir statuts', hourly_traffic: 'Trafic horaire (24h)', top_endpoints: 'Top endpoints',
      th_method: 'M\u00e9thode', th_path: 'Chemin', th_count: 'Requ\u00eates', th_avg_ms: 'Moy (ms)',
      audit_search_ph: 'Filtrer par op\u00e9rateur ou action\u2026', th_time: 'Heure', th_operator: 'Op\u00e9rateur',
      th_action: 'Action', th_target: 'Cible', th_details: 'D\u00e9tails',
      sent_announcements: 'Annonces envoy\u00e9es', new_announcement: '+ Nouvelle annonce', th_title: 'Titre',
      th_body: 'Corps', th_channel: 'Canal', th_sent_by: 'Envoy\u00e9 par', compose_announcement: 'R\u00e9diger une annonce',
      send: 'Envoyer', active_count: 'Actifs', trial_count: 'Essai', suspended_count: 'Suspendus',
      cancelled_count: 'Annul\u00e9s', expired_count: 'Expir\u00e9s', requests_24h: 'Requ\u00eates (24h)',
      avg_response: 'Temps moy.', error_rate: 'Taux erreur', total_requests: 'Total',
      churn_90d: 'D\u00e9part (90j)', total_patients: 'Total patients', read_count: 'Lectures'
    },
    ar: {
      doc_title: '\u0645\u0646\u0635\u0629 Sera', kicker: '\u0627\u0644\u0645\u0646\u0635\u0629', title: '\u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u0634\u063a\u0644',
      login_lede: '\u0644\u0644\u0645\u0634\u063a\u0644\u064a\u0646 \u0641\u0642\u0637.', email: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a', password: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', signin: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
      logout: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c', tab_overview: '\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629', tab_clinics: '\u0627\u0644\u0639\u064a\u0627\u062f\u0627\u062a',
      tab_revenue: '\u0627\u0644\u0625\u0631\u0628\u0627\u062d', tab_plans: '\u0627\u0644\u062e\u0637\u0637', tab_invoices: '\u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631',
      tab_analytics: '\u0627\u0644\u062a\u062d\u0644\u064a\u0644', tab_health: '\u0627\u0644\u0635\u062d\u0629', tab_audit: '\u0627\u0644\u062a\u062f\u0642\u064a\u0642', tab_announce: '\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062a',
      stat_clinics: '\u0627\u0644\u0639\u064a\u0627\u062f\u0627\u062a', stat_active: '\u0646\u0634\u0637\u0629', stat_trial: '\u062a\u062c\u0631\u064a\u0628\u064a\u0629', stat_suspended: '\u0645\u0648\u0642\u0648\u0641\u0629',
      stat_signups: '\u062a\u0633\u062c\u064a\u0644\u0627\u062a \u00b7 30\u064a\u0648\u0645', stat_users: '\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646', stat_patients: '\u0627\u0644\u0645\u0631\u0636\u0649', stat_appts: '\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f',
      recent_signups: '\u062a\u0633\u062c\u064a\u0644\u0627\u062a \u062d\u062f\u064a\u062b\u0629', th_clinic: '\u0627\u0644\u0639\u064a\u0627\u062f\u0629', th_address: '\u0627\u0644\u0639\u0646\u0648\u0627\u0646', th_status: '\u0627\u0644\u062d\u0627\u0644\u0629',
      th_plan: '\u0627\u0644\u062e\u0637\u0637', th_users: '\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646', th_patients: '\u0627\u0644\u0645\u0631\u0636\u0649', th_appts: '\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f', th_created: '\u0623\u0646\u0634\u0626\u062a',
      th_role: '\u0627\u0644\u062f\u0648\u0631', th_lastlogin: '\u0622\u062e\u0631 \u062f\u062e\u0648\u0644', search_ph: '\u0627\u0628\u062d\u062b \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0639\u0646\u0648\u0627\u0646\u2026',
      prev: '\u0627\u0644\u0633\u0627\u0628\u0642 \u2039', next: '\u0627\u0644\u062a\u0627\u0644\u064a \u203a', back: '\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0639\u064a\u0627\u062f\u0627\u062a', subscription: '\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643',
      trial_ends: '\u0646\u0647\u0627\u064a\u0629 \u0627\u0644\u062a\u062c\u0631\u064a\u0628\u0629 / \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643', save: '\u062d\u0641\u0638', saved: '\u062a\u0645 \u0627\u0644\u062d\u0641\u0638 \u2713', clinic_info: '\u0627\u0644\u0639\u064a\u0627\u062f\u0629',
      team: '\u0627\u0644\u0641\u0631\u064a\u0642', name: '\u0627\u0644\u0627\u0633\u0645', footer: '\u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u0634\u063a\u0644 \u00b7 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u062f\u0627\u062e\u0644\u064a',
      never: '\u0623\u0628\u062f\u0627\u064b', no_results: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0639\u064a\u0627\u062f\u0627\u062a \u0645\u0637\u0627\u0628\u0642\u0629.', loading: '\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0645\u064a\u0644\u2026',
      err_generic: '\u062d\u062f\u062b \u062e\u0637\u0623 \u0645\u0627 \u2014 \u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u0627\u064b.',
      err_credentials: '\u0628\u0631\u064a\u062f \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0623\u0648 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d\u0629.', err_forbidden: '\u0647\u0630\u0627 \u0627\u0644\u062d\u0633\u0627\u0628 \u0644\u064a\u0633 \u0645\u0634\u063a\u0644 \u0645\u0646\u0635\u0629.',
      err_session: '\u0627\u0646\u062a\u0647\u062a \u0627\u0644\u062c\u0644\u0633\u0629 \u2014 \u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u062c\u062f\u062f\u0627\u064b.', confirm: '\u062a\u0623\u0643\u064a\u062f', aria_theme: '\u062a\u0628\u062f\u064a\u0644 \u0627\u0644\u0645\u0638\u0647\u0631',
      plan_tier: '\u0627\u0644\u062e\u0637\u0637', plan_label: '\u0627\u0644\u062a\u0633\u0645\u064a\u0629', monthly_price: '\u0634\u0647\u0631\u064a (DZD)', annual_price: '\u0633\u0646\u0648\u064a (DZD)',
      max_users: '\u062d\u062f \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646', max_patients: '\u062d\u062f \u0627\u0644\u0645\u0631\u0636\u0649', th_name: '\u0627\u0644\u0627\u0633\u0645', th_label: '\u0627\u0644\u062a\u0633\u0645\u064a\u0629',
      add_plan: '+ \u0625\u0636\u0627\u0641\u0629', cancel: '\u0625\u0644\u063a\u0627\u0621', plan_form_title: '\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u062e\u0637\u0637',
      export_csv: '\u062a\u0635\u062f\u064a\u0631 CSV', bulk_activate: '\u062a\u0641\u0639\u064a\u0644', bulk_suspend: '\u0625\u0639\u0644\u0627\u0642', bulk_deselect: '\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062a\u062d\u062f\u064a\u062f',
      impersonate: '\u062f\u062e\u0648\u0644 \u0643\u0645\u0633\u0627\u0639', mrr: 'MRR', total_revenue: '\u0627\u0644\u0625\u0631\u0628\u0627\u062d \u0627\u0644\u0643\u0627\u0645\u0644', outstanding: '\u0642\u064a\u062f \u0627\u0644\u0625\u0646\u062a\u0638\u0627\u0631',
      monthly_revenue: '\u0627\u0644\u0625\u0631\u0628\u0627\u062d \u0627\u0644\u0634\u0647\u0631\u064a', top_tenants: '\u0623\u0639\u0644\u0649 \u0627\u0644\u0625\u0631\u0628\u0627\u062d \u0628\u0639\u0644\u0649 \u0627\u0644\u0639\u064a\u0627\u062f\u0629',
      plan_tiers: '\u0627\u0644\u062e\u0637\u0637', new_invoice: '+ \u0641\u0627\u062a\u0648\u0631\u0629 \u062c\u062f\u064a\u062f\u0629', th_number: '\u0627\u0644\u0631\u0642\u0645', th_amount: '\u0627\u0644\u0645\u0628\u0644\u063a (DZD)',
      th_period: '\u0627\u0644\u0641\u062a\u0631\u0629', period_start: '\u0628\u062f\u0621', period_end: '\u0646\u0647\u0627\u0621', notes: '\u0645\u0644\u0627\u062d\u0638\u0627\u062a',
      invoice_form: '\u0641\u0627\u062a\u0648\u0631\u0629 \u062c\u062f\u064a\u062f\u0629', signup_trend: '\u062a\u0639\u0646\u064a \u0627\u0644\u062a\u0633\u062c\u064a\u0644\u0627\u062a', plan_distribution: '\u062a\u0642\u0633\u064a\u0645 \u0627\u0644\u062e\u0637\u0637',
      status_funnel: '\u0642\u0646\u0627\u0637\u0631 \u0627\u0644\u062d\u0627\u0644\u0629', hourly_traffic: '\u0627\u0644\u0632\u062d\u0645 (24\u0633\u0627\u0639\u0629)', top_endpoints: '\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0646\u0642\u0627\u0637',
      th_method: '\u0627\u0644\u0637\u0631\u064a\u0642\u0629', th_path: '\u0627\u0644\u0645\u0633\u0627\u0631', th_count: '\u0627\u0644\u0637\u0644\u0628\u0627\u062a', th_avg_ms: '\u0627\u0644\u0645\u062a\u0648\u0633\u0637 (ms)',
      audit_search_ph: '\u062a\u0635\u0641\u062d \u0628\u0627\u0644\u0645\u0634\u063a\u0644 \u0623\u0648 \u0627\u0644\u0639\u0645\u0644\u064a\u0629\u2026', th_time: '\u0627\u0644\u0648\u0642\u062a', th_operator: '\u0627\u0644\u0645\u0634\u063a\u0644',
      th_action: '\u0627\u0644\u0639\u0645\u0644\u064a\u0629', th_target: '\u0627\u0644\u0637\u0627\u0631\u062f', th_details: '\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644',
      sent_announcements: '\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0631\u0633\u0644\u0629', new_announcement: '+ \u0625\u0639\u0644\u0627\u0646 \u062c\u062f\u064a\u062f', th_title: '\u0627\u0644\u0639\u0646\u0648\u0627\u0646',
      th_body: '\u0627\u0644\u0645\u062d\u062a\u0648\u0627\u0646', th_channel: '\u0627\u0644\u0642\u0646\u0627\u0644', th_sent_by: '\u0623\u0631\u0633\u0644\u0647', compose_announcement: '\u062a\u0639\u062f\u064a\u062f \u0625\u0639\u0644\u0627\u0646',
      send: '\u0625\u0631\u0633\u0627\u0644', active_count: '\u0646\u0634\u0637\u0629', trial_count: '\u062a\u062c\u0631\u064a\u0628\u064a\u0629', suspended_count: '\u0645\u0648\u0642\u0648\u0641\u0629',
      cancelled_count: '\u0645\u0644\u063a\u0627\u0629', expired_count: '\u0645\u0646\u062a\u0647\u064a\u0629', requests_24h: '\u0627\u0644\u0637\u0644\u0628\u0627\u062a (24\u0633\u0627\u0639\u0629)',
      avg_response: '\u0627\u0644\u0645\u062a\u0648\u0633\u0637', error_rate: '\u0645\u0639\u0631\u0636 \u0627\u0644\u0623\u062e\u0637\u0627\u0621', total_requests: '\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a',
      churn_90d: '\u0627\u0644\u0645\u063a\u0627\u062f\u0631\u064a\u0646 (90\u064a\u0648\u0645)', total_patients: '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0631\u0636\u0649', read_count: '\u0627\u0644\u0642\u0631\u0627\u0621\u0629'
    }
  };

  var $ = function (id) { return document.getElementById(id); };
  function t(k) { var l = SITE.lang; return (T[l] && T[l][k]) || T.en[k] || k; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function locale() { return SITE.lang === 'ar' ? 'ar-DZ' : (SITE.lang === 'fr' ? 'fr-FR' : 'en-GB'); }
  function fmtDate(v) {
    if (!v) return t('never');
    return new Date(v).toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function fmtDZD(v) { return Number(v || 0).toLocaleString(locale()); }
  function statusKey(full) { return full ? full.replace('tenant.status.', '') : ''; }
  function statusLabel(full) {
    var s = statusKey(full);
    return { active: t('stat_active'), trial: t('stat_trial'), suspended: t('stat_suspended'),
             cancelled: s, expired: s }[s] || s;
  }
  function invoiceStatusKey(full) { return full ? full.replace('platform_invoice.', '') : ''; }

  var state = { view: 'overview', page: 1, limit: 20, total: 0, search: '', status: '', detailId: null,
                invPage: 1, invStatus: '', annPage: 1, auditPage: 1, auditTimer: null, selected: {} };

  // ---- api helper ----------------------------------------------------------
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    var token = sessionStorage.getItem(TOKEN_KEY);
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (r.status === 401 && token) { signOut(); throw { code: 'session' }; }
        return { ok: r.ok, status: r.status, body: body };
      });
    });
  }

  // ---- auth ----------------------------------------------------------------
  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    $('app').classList.add('hidden');
    $('login').classList.remove('hidden');
    $('logoutBtn').style.visibility = 'hidden';
  }

  function signIn() {
    var email = $('email').value.trim();
    var password = $('password').value;
    var err = $('loginErr');
    err.classList.add('hidden');
    if (!email || !password) return;
    fetch('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); })
      .then(function (res) {
        if (!res.ok) { err.textContent = t(res.status === 401 ? 'err_credentials' : 'err_generic'); err.classList.remove('hidden'); return; }
        if (res.body.roleKey !== 'auth.role.platform_admin') { err.textContent = t('err_forbidden'); err.classList.remove('hidden'); return; }
        sessionStorage.setItem(TOKEN_KEY, res.body.accessToken);
        enterApp();
      }).catch(function () { err.textContent = t('err_generic'); err.classList.remove('hidden'); });
  }

  function enterApp() {
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('logoutBtn').style.visibility = 'visible';
    switchView('overview');
  }

  // ---- rendering -----------------------------------------------------------
  function statCard(label, value, sm) {
    return '<div class="stat"><div class="k">' + esc(label) + '</div><div class="v' + (sm ? ' sm' : '') + '">' + esc(value) + '</div></div>';
  }

  function renderStats() {
    var grid = $('statGrid');
    grid.innerHTML = '<div class="stat"><div class="k">' + esc(t('loading')) + '</div></div>';
    api('/stats').then(function (res) {
      if (!res.ok) return;
      var s = res.body;
      grid.innerHTML =
        statCard(t('stat_clinics'), s.tenants.total) +
        statCard(t('stat_active'), s.tenants.active) +
        statCard(t('stat_trial'), s.tenants.trial) +
        statCard(t('stat_suspended'), s.tenants.suspended) +
        statCard(t('stat_signups'), s.tenants.signups_30d) +
        statCard(t('stat_users'), s.users) +
        statCard(t('stat_patients'), s.patients) +
        statCard(t('stat_appts'), s.appointments);
      renderRecent();
    }).catch(function () {});
  }

  function renderRecent() {
    var body = $('recentBody');
    api('/tenants?limit=5&page=1').then(function (res) {
      if (!res.ok) return;
      if (!res.body.tenants.length) { body.innerHTML = '<tr><td colspan="4" class="note">' + esc(t('no_results')) + '</td></tr>'; return; }
      body.innerHTML = res.body.tenants.map(function (tn) {
        return '<tr data-id="' + esc(tn.id) + '">' +
          '<td><b>' + esc(tn.name) + '</b></td>' +
          '<td class="num">' + esc(tn.subdomain) + '</td>' +
          '<td><span class="pill ' + esc(statusKey(tn.subscription_status)) + '">' + esc(statusLabel(tn.subscription_status)) + '</span></td>' +
          '<td class="num">' + esc(fmtDate(tn.created_at)) + '</td></tr>';
      }).join('');
      wireRows(body);
    }).catch(function () {});
  }

  // ---- clinics -------------------------------------------------------------
  function renderTenants() {
    var body = $('tenantsBody');
    body.innerHTML = '<tr><td colspan="9" class="note">' + esc(t('loading')) + '</td></tr>';
    state.selected = {};
    updateBulkBar();
    var qs = '?page=' + state.page + '&limit=' + state.limit;
    if (state.search) qs += '&search=' + encodeURIComponent(state.search);
    if (state.status) qs += '&status=' + encodeURIComponent(state.status);
    api('/tenants' + qs).then(function (res) {
      if (!res.ok) return;
      state.total = res.body.total;
      if (!res.body.tenants.length) {
        body.innerHTML = '<tr><td colspan="9" class="note">' + esc(t('no_results')) + '</td></tr>';
      } else {
        body.innerHTML = res.body.tenants.map(function (tn) {
          return '<tr data-id="' + esc(tn.id) + '">' +
            '<td><input type="checkbox" class="row-cb" data-id="' + esc(tn.id) + '"></td>' +
            '<td><b>' + esc(tn.name) + '</b></td>' +
            '<td class="num">' + esc(tn.subdomain) + '</td>' +
            '<td><span class="pill ' + esc(statusKey(tn.subscription_status)) + '">' + esc(statusLabel(tn.subscription_status)) + '</span></td>' +
            '<td class="num">' + esc(tn.subscription_plan || '\u2014') + '</td>' +
            '<td class="num">' + esc(tn.user_count) + '</td>' +
            '<td class="num">' + esc(tn.patient_count) + '</td>' +
            '<td class="num">' + esc(tn.appointment_count) + '</td>' +
            '<td class="num">' + esc(fmtDate(tn.created_at)) + '</td></tr>';
        }).join('');
      }
      var from = state.total === 0 ? 0 : (state.page - 1) * res.body.limit + 1;
      var to = Math.min(state.page * res.body.limit, state.total);
      $('pagerInfo').textContent = from + '\u2013' + to + ' / ' + state.total;
      $('prevBtn').disabled = state.page <= 1;
      $('nextBtn').disabled = to >= state.total;
      wireRows(body);
      wireCheckboxes();
    }).catch(function () {});
  }

  function wireCheckboxes() {
    var cbs = document.querySelectorAll('.row-cb');
    cbs.forEach(function (cb) {
      cb.addEventListener('click', function (e) { e.stopPropagation(); });
      cb.addEventListener('change', function () {
        if (cb.checked) state.selected[cb.getAttribute('data-id')] = true;
        else delete state.selected[cb.getAttribute('data-id')];
        updateBulkBar();
      });
    });
    var sel = $('selectAll');
    if (sel) sel.checked = false;
  }

  function updateBulkBar() {
    var count = Object.keys(state.selected).length;
    var bar = $('bulkBar');
    if (count === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    $('bulkCount').textContent = count + ' selected';
  }

  // ---- detail --------------------------------------------------------------
  function renderDetail() {
    var err = $('detailErr');
    err.classList.add('hidden');
    api('/tenants/' + state.detailId).then(function (res) {
      if (!res.ok) return;
      var tn = res.body.tenant;
      $('detailPill').textContent = statusLabel(tn.subscription_status);
      $('detailPill').className = 'pill ' + statusKey(tn.subscription_status);
      $('editStatus').value = tn.subscription_status;
      $('editPlan').value = tn.subscription_plan || '';
      $('editEnds').value = tn.subscription_ends_at ? tn.subscription_ends_at.slice(0, 10) : '';
      if (tn.plan_id) $('editPlanId').value = tn.plan_id;
      else $('editPlanId').value = '';
      $('detailInfo').innerHTML =
        '<dt>' + esc(t('th_clinic')) + '</dt><dd>' + esc(tn.name) + '</dd>' +
        '<dt>' + esc(t('th_address')) + '</dt><dd>sera.dz/book/' + esc(tn.subdomain) + '</dd>' +
        '<dt>' + esc(t('stat_users')) + '</dt><dd>' + esc(tn.user_count) + '</dd>' +
        '<dt>' + esc(t('stat_patients')) + '</dt><dd>' + esc(tn.patient_count) + '</dd>' +
        '<dt>' + esc(t('stat_appts')) + '</dt><dd>' + esc(tn.appointment_count) + '</dd>' +
        '<dt>' + esc(t('total_revenue')) + '</dt><dd>' + esc(fmtDZD(tn.total_billed)) + ' DZD</dd>' +
        '<dt>' + esc(t('th_created')) + '</dt><dd>' + esc(fmtDate(tn.created_at)) + '</dd>';
      $('usersBody').innerHTML = res.body.users.map(function (u) {
        return '<tr style="cursor:default">' +
          '<td>' + esc(u.full_name) + '</td>' +
          '<td class="num">' + esc(u.email) + '</td>' +
          '<td class="num">' + esc(u.role_key.replace('auth.role.', '')) + '</td>' +
          '<td class="num">' + esc(u.status_key.replace('user.status.', '')) + '</td>' +
          '<td class="num">' + esc(fmtDate(u.last_login_at)) + '</td></tr>';
      }).join('');
    }).catch(function () {});
  }

  function saveDetail() {
    var err = $('detailErr');
    var ok = $('saveOk');
    err.classList.add('hidden'); ok.classList.add('hidden');
    var body = {
      subscription_status: $('editStatus').value,
      subscription_plan: $('editPlan').value.trim() || null,
      plan_id: $('editPlanId').value || null,
      subscription_ends_at: $('editEnds').value ? new Date($('editEnds').value + 'T12:00:00Z').toISOString() : null,
    };
    api('/tenants/' + state.detailId, { method: 'PATCH', body: JSON.stringify(body) }).then(function (res) {
      if (!res.ok) { err.textContent = t('err_generic'); err.classList.remove('hidden'); return; }
      ok.classList.remove('hidden');
      $('detailPill').textContent = statusLabel(res.body.tenant.subscription_status);
      $('detailPill').className = 'pill ' + statusKey(res.body.tenant.subscription_status);
      setTimeout(function () { ok.classList.add('hidden'); }, 2500);
    }).catch(function () { err.textContent = t('err_generic'); err.classList.remove('hidden'); });
  }

  // ---- impersonation -------------------------------------------------------
  function impersonate() {
    if (!state.detailId) return;
    api('/impersonate/' + state.detailId, { method: 'POST', body: '{}' }).then(function (res) {
      if (!res.ok) { alert(t('err_generic')); return; }
      var w = window.open('/', '_blank');
      if (w) {
        w.addEventListener('load', function () {
          try { w.sessionStorage.setItem('access-token', res.body.token); } catch (e) {}
        });
      }
    }).catch(function () { alert(t('err_generic')); });
  }

  // ---- revenue -------------------------------------------------------------
  function renderRevenue() {
    var grid = $('revStats');
    grid.innerHTML = '<div class="stat"><div class="k">' + esc(t('loading')) + '</div></div>';
    api('/revenue').then(function (res) {
      if (!res.ok) return;
      var r = res.body;
      grid.innerHTML =
        statCard(t('mrr'), fmtDZD(r.mrr) + ' DZD') +
        statCard(t('total_revenue'), fmtDZD(r.total_revenue) + ' DZD') +
        statCard(t('outstanding'), fmtDZD(r.outstanding) + ' DZD');
      var chart = $('revChart');
      if (r.monthly.length) {
        var max = Math.max.apply(null, r.monthly.map(function (m) { return m.revenue; }));
        chart.innerHTML = r.monthly.map(function (m) {
          var h = max > 0 ? (m.revenue / max * 100) : 0;
          var label = new Date(m.month).toLocaleDateString(locale(), { month: 'short', year: '2-digit' });
          return '<div class="bar" style="height:' + Math.max(2, h) + '%"><div class="tip">' + label + '</div></div>';
        }).join('');
      } else { chart.innerHTML = '<span class="note">' + esc(t('no_results')) + '</span>'; }
      var pt = $('revPerTenant');
      if (r.per_tenant.length) {
        pt.innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>' + esc(t('th_clinic')) + '</th><th>' + esc(t('th_amount')) + '</th><th>' + esc(t('th_count')) + '</th></tr></thead><tbody>' +
          r.per_tenant.map(function (t) {
            return '<tr><td><b>' + esc(t.name) + '</b></td><td class="num">' + esc(fmtDZD(t.total)) + ' DZD</td><td class="num">' + esc(t.invoices) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else { pt.innerHTML = '<span class="note">' + esc(t('no_results')) + '</span>'; }
    }).catch(function () {});
  }

  // ---- plans ---------------------------------------------------------------
  function renderPlans() {
    var body = $('plansBody');
    body.innerHTML = '<tr><td colspan="8" class="note">' + esc(t('loading')) + '</td></tr>';
    api('/plans').then(function (res) {
      if (!res.ok) return;
      var plans = res.body;
      if (!plans.length) { body.innerHTML = '<tr><td colspan="8" class="note">' + esc(t('no_results')) + '</td></tr>'; return; }
      body.innerHTML = plans.map(function (p) {
        return '<tr data-id="' + esc(p.id) + '">' +
          '<td><b>' + esc(p.name) + '</b></td>' +
          '<td>' + esc(p.label) + '</td>' +
          '<td class="num">' + esc(fmtDZD(p.monthly_price_dzd)) + '</td>' +
          '<td class="num">' + esc(fmtDZD(p.annual_price_dzd)) + '</td>' +
          '<td class="num">' + esc(p.max_users) + '</td>' +
          '<td class="num">' + esc(p.max_patients) + '</td>' +
          '<td><span class="pill ' + (p.is_active ? 'active' : 'suspended') + '">' + (p.is_active ? t('stat_active') : 'off') + '</span></td>' +
          '<td><button class="btn sm outline plan-edit" data-id="' + esc(p.id) + '">' + esc(t('save')) + '</button></td></tr>';
      }).join('');
      // populate detail view plan selector
      var sel = $('editPlanId');
      sel.innerHTML = '<option value="">\u2014 none \u2014</option>' + plans.filter(function (p) { return p.is_active; }).map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.label) + ' (' + esc(fmtDZD(p.monthly_price_dzd)) + ' DZD/mo)</option>';
      }).join('');
    }).catch(function () {});
  }

  function savePlan() {
    var name = $('planName').value.trim();
    var label = $('planLabel').value.trim();
    var monthly = parseFloat($('planMonthly').value) || 0;
    var annual = parseFloat($('planAnnual').value) || 0;
    var maxUsers = parseInt($('planMaxUsers').value) || 5;
    var maxPatients = parseInt($('planMaxPatients').value) || 500;
    if (!name || !label) return;
    api('/plans', { method: 'POST', body: JSON.stringify({
      name: name, label: label, monthly_price_dzd: monthly, annual_price_dzd: annual,
      max_users: maxUsers, max_patients: maxPatients,
    })}).then(function (res) {
      if (res.ok) { $('planForm').classList.add('hidden'); renderPlans(); }
    }).catch(function () {});
  }

  // ---- invoices ------------------------------------------------------------
  function renderInvoices() {
    var body = $('invoicesBody');
    body.innerHTML = '<tr><td colspan="7" class="note">' + esc(t('loading')) + '</td></tr>';
    var qs = '?page=' + state.invPage + '&limit=20';
    if (state.invStatus) qs += '&status=' + encodeURIComponent(state.invStatus);
    api('/invoices' + qs).then(function (res) {
      if (!res.ok) return;
      var invs = res.body.invoices;
      state.invPage = res.body.page;
      if (!invs.length) { body.innerHTML = '<tr><td colspan="7" class="note">' + esc(t('no_results')) + '</td></tr>'; return; }
      body.innerHTML = invs.map(function (inv) {
        var sk = invoiceStatusKey(inv.status);
        return '<tr data-id="' + esc(inv.id) + '">' +
          '<td><b>' + esc(inv.invoice_number) + '</b></td>' +
          '<td>' + esc(inv.tenant_name) + '</td>' +
          '<td class="num">' + esc(fmtDZD(inv.amount_dzd)) + '</td>' +
          '<td><span class="pill ' + esc(sk) + '">' + esc(sk) + '</span></td>' +
          '<td class="num">' + esc(fmtDate(inv.period_start)) + ' \u2013 ' + esc(fmtDate(inv.period_end)) + '</td>' +
          '<td class="num">' + esc(fmtDate(inv.issued_at)) + '</td>' +
          '<td>' + (sk === 'draft' ? '<button class="btn sm inv-send" data-id="' + esc(inv.id) + '">Send</button>' :
                    sk === 'sent' ? '<button class="btn sm inv-pay" data-id="' + esc(inv.id) + '">Paid</button>' : '') + '</td></tr>';
      }).join('');
      var from = res.body.total === 0 ? 0 : (state.invPage - 1) * res.body.limit + 1;
      var to = Math.min(state.invPage * res.body.limit, res.body.total);
      $('invPagerInfo').textContent = from + '\u2013' + to + ' / ' + res.body.total;
      $('invPrevBtn').disabled = state.invPage <= 1;
      $('invNextBtn').disabled = to >= res.body.total;
      // wire send/pay buttons
      body.querySelectorAll('.inv-send').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          api('/invoices/' + btn.getAttribute('data-id'), { method: 'PATCH', body: JSON.stringify({ status: 'platform_invoice.sent' }) })
            .then(function () { renderInvoices(); });
        });
      });
      body.querySelectorAll('.inv-pay').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          api('/invoices/' + btn.getAttribute('data-id'), { method: 'PATCH', body: JSON.stringify({ status: 'platform_invoice.paid' }) })
            .then(function () { renderInvoices(); });
        });
      });
    }).catch(function () {});
  }

  function createInvoice() {
    var tenantId = $('invTenant').value;
    var amount = parseFloat($('invAmount').value) || 0;
    var start = $('invPeriodStart').value;
    var end = $('invPeriodEnd').value;
    if (!tenantId || !amount || !start || !end) return;
    api('/invoices', { method: 'POST', body: JSON.stringify({
      tenant_id: tenantId, amount_dzd: amount,
      period_start: start + 'T00:00:00Z', period_end: end + 'T23:59:59Z',
      notes: $('invNotes').value.trim() || null,
    })}).then(function (res) {
      if (res.ok) { $('invoiceForm').classList.add('hidden'); renderInvoices(); }
    }).catch(function () {});
  }

  // ---- analytics -----------------------------------------------------------
  function renderAnalytics() {
    var grid = $('analyticsStats');
    grid.innerHTML = '<div class="stat"><div class="k">' + esc(t('loading')) + '</div></div>';
    api('/analytics').then(function (res) {
      if (!res.ok) return;
      var a = res.body;
      grid.innerHTML =
        statCard(t('stat_clinics'), a.distribution.total) +
        statCard(t('stat_active'), a.distribution.active) +
        statCard(t('stat_trial'), a.distribution.trial) +
        statCard(t('stat_suspended'), a.distribution.suspended) +
        statCard(t('churn_90d'), a.churn_90d) +
        statCard(t('total_patients'), a.patient_growth.reduce(function (s, r) { return s + r.count; }, 0));
      // signup chart
      var chart = $('signupChart');
      if (a.signups.length) {
        var max = Math.max.apply(null, a.signups.map(function (m) { return m.count; }));
        chart.innerHTML = a.signups.map(function (m) {
          var h = max > 0 ? (m.count / max * 100) : 0;
          var label = new Date(m.month).toLocaleDateString(locale(), { month: 'short', year: '2-digit' });
          return '<div class="bar" style="height:' + Math.max(2, h) + '%"><div class="tip">' + label + ': ' + m.count + '</div></div>';
        }).join('');
      } else { chart.innerHTML = '<span class="note">' + esc(t('no_results')) + '</span>'; }
      // plan distribution
      var pd = $('planDistChart');
      var totalPlans = a.plans.reduce(function (s, r) { return s + r.count; }, 0);
      pd.innerHTML = a.plans.map(function (p) {
        var pct = totalPlans > 0 ? (p.count / totalPlans * 100).toFixed(1) : 0;
        return '<div class="chart-row"><span class="bar-label">' + esc(p.plan) + '</span><div class="bar-bg"><div class="bar-fill" style="width:' + pct + '%"></div></div><span class="bar-val">' + p.count + '</span></div>';
      }).join('');
      // status funnel
      var sf = $('statusFunnel');
      var dist = a.distribution;
      sf.innerHTML = ['active', 'trial', 'suspended', 'cancelled', 'expired'].map(function (s) {
        var pct = dist.total > 0 ? (dist[s] / dist.total * 100).toFixed(1) : 0;
        return '<div class="chart-row"><span class="bar-label">' + esc(t(s + '_count')) + '</span><div class="bar-bg"><div class="bar-fill" style="width:' + pct + '%"></div></div><span class="bar-val">' + dist[s] + '</span></div>';
      }).join('');
    }).catch(function () {});
  }

  // ---- health --------------------------------------------------------------
  function renderHealth() {
    var grid = $('healthStats');
    grid.innerHTML = '<div class="stat"><div class="k">' + esc(t('loading')) + '</div></div>';
    api('/usage').then(function (res) {
      if (!res.ok) return;
      var h = res.body;
      grid.innerHTML =
        statCard(t('requests_24h'), fmtDZD(h.total_requests)) +
        statCard(t('avg_response'), h.avg_duration + ' ms') +
        statCard(t('error_rate'), h.error_rate + '%') +
        statCard(t('th_count'), fmtDZD(h.total_requests));
      // hourly chart
      var chart = $('healthChart');
      if (h.hourly.length) {
        var max = Math.max.apply(null, h.hourly.map(function (r) { return r.count; }));
        chart.innerHTML = h.hourly.map(function (r) {
          var pct = max > 0 ? (r.count / max * 100) : 0;
          var label = new Date(r.hour).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
          return '<div class="bar" style="height:' + Math.max(2, pct) + '%"><div class="tip">' + label + '</div></div>';
        }).join('');
      } else { chart.innerHTML = '<span class="note">No data yet</span>'; }
      // top endpoints
      var ep = $('healthEndpoints');
      ep.innerHTML = h.top_endpoints.map(function (e) {
        return '<tr><td>' + esc(e.method) + '</td><td>' + esc(e.path) + '</td><td class="num">' + esc(e.count) + '</td><td class="num">' + esc(e.avg_ms) + '</td></tr>';
      }).join('');
    }).catch(function () {});
  }

  // ---- audit ---------------------------------------------------------------
  function renderAudit() {
    var body = $('auditBody');
    body.innerHTML = '<tr><td colspan="5" class="note">' + esc(t('loading')) + '</td></tr>';
    var qs = '?page=' + state.auditPage + '&limit=50';
    var searchVal = $('auditSearch') ? $('auditSearch').value.trim() : '';
    if (searchVal) qs += '&operator=' + encodeURIComponent(searchVal);
    api('/audit' + qs).then(function (res) {
      if (!res.ok) return;
      var entries = res.body.entries;
      if (!entries.length) { body.innerHTML = '<tr><td colspan="5" class="note">' + esc(t('no_results')) + '</td></tr>'; return; }
      body.innerHTML = entries.map(function (e) {
        return '<tr style="cursor:default">' +
          '<td class="num">' + esc(fmtDate(e.created_at)) + '</td>' +
          '<td>' + esc(e.operator_email) + '</td>' +
          '<td><span class="pill">' + esc(e.action) + '</span></td>' +
          '<td>' + esc(e.target_tenant_name || '\u2014') + '</td>' +
          '<td class="num">' + esc(JSON.stringify(e.details || {})) + '</td></tr>';
      }).join('');
      var from = res.body.total === 0 ? 0 : (state.auditPage - 1) * res.body.limit + 1;
      var to = Math.min(state.auditPage * res.body.limit, res.body.total);
      $('auditPagerInfo').textContent = from + '\u2013' + to + ' / ' + res.body.total;
      $('auditPrevBtn').disabled = state.auditPage <= 1;
      $('auditNextBtn').disabled = to >= res.body.total;
    }).catch(function () {});
  }

  // ---- announcements -------------------------------------------------------
  function renderAnnouncements() {
    var body = $('announceBody');
    body.innerHTML = '<tr><td colspan="5" class="note">' + esc(t('loading')) + '</td></tr>';
    var qs = '?page=' + state.annPage + '&limit=20';
    api('/announcements' + qs).then(function (res) {
      if (!res.ok) return;
      var anns = res.body.announcements;
      if (!anns.length) { body.innerHTML = '<tr><td colspan="5" class="note">' + esc(t('no_results')) + '</td></tr>'; return; }
      body.innerHTML = anns.map(function (a) {
        var tgt = a.target === 'announcement.target.all' ? 'All' : a.target === 'announcement.target.selected' ? 'Selected' : 'Plan';
        var ch = a.channel === 'announcement.channel.in_app' ? 'In-app' : a.channel === 'announcement.channel.email' ? 'Email' : 'Both';
        return '<tr style="cursor:default"><td class="num">' + esc(fmtDate(a.sent_at)) + '</td>' +
          '<td><b>' + esc(a.title) + '</b></td>' +
          '<td>' + esc(tgt) + '</td>' +
          '<td>' + esc(ch) + '</td>' +
          '<td>' + esc(a.sent_by_email) + '</td></tr>';
      }).join('');
      var from = res.body.total === 0 ? 0 : (state.annPage - 1) * res.body.limit + 1;
      var to = Math.min(state.annPage * res.body.limit, res.body.total);
      $('annPagerInfo').textContent = from + '\u2013' + to + ' / ' + res.body.total;
      $('annPrevBtn').disabled = state.annPage <= 1;
      $('annNextBtn').disabled = to >= res.body.total;
    }).catch(function () {});
  }

  function createAnnouncement() {
    var title = $('annTitle').value.trim();
    var body = $('annBody').value.trim();
    if (!title || !body) return;
    api('/announcements', { method: 'POST', body: JSON.stringify({
      title: title, body: body,
      target: $('annTarget').value,
      channel: $('annChannel').value,
    })}).then(function (res) {
      if (res.ok) { $('announceForm').classList.add('hidden'); renderAnnouncements(); }
    }).catch(function () {});
  }

  // ---- navigation ----------------------------------------------------------
  var VIEWS = ['overview', 'clinics', 'detail', 'revenue', 'plans', 'invoices', 'analytics', 'health', 'audit', 'announce'];
  var VIEW_IDS = { overview: 'viewOverview', clinics: 'viewClinics', detail: 'viewDetail', revenue: 'viewRevenue',
    plans: 'viewPlans', invoices: 'viewInvoices', analytics: 'viewAnalytics', health: 'viewHealth',
    audit: 'viewAudit', announce: 'viewAnnounce' };

  function switchView(view, detailId) {
    state.view = view;
    state.detailId = detailId || null;
    VIEWS.forEach(function (v) { var el = $(VIEW_IDS[v]); if (el) el.classList.toggle('hidden', v !== view); });
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.classList.remove('on');
    });
    var tabMap = { overview: 'tabOverview', clinics: 'tabClinics', revenue: 'tabRevenue', plans: 'tabPlans',
      invoices: 'tabInvoices', analytics: 'tabAnalytics', health: 'tabHealth', audit: 'tabAudit', announce: 'tabAnnounce' };
    if (tabMap[view]) $(tabMap[view]).classList.add('on');
    if (view === 'overview') renderStats();
    if (view === 'clinics') renderTenants();
    if (view === 'detail') renderDetail();
    if (view === 'revenue') renderRevenue();
    if (view === 'plans') renderPlans();
    if (view === 'invoices') renderInvoices();
    if (view === 'analytics') renderAnalytics();
    if (view === 'health') renderHealth();
    if (view === 'audit') renderAudit();
    if (view === 'announce') renderAnnouncements();
  }

  function wireRows(container) {
    Array.prototype.forEach.call(container.querySelectorAll('tr[data-id]'), function (row) {
      if (row.querySelector('.row-cb')) return; // don't override checkbox rows
      row.addEventListener('click', function () { switchView('detail', row.getAttribute('data-id')); });
    });
  }

  function applyLang() {
    document.title = t('doc_title');
    document.querySelectorAll('[data-i]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i')); });
    document.querySelectorAll('[data-i-ph]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i-ph')); });
    document.querySelectorAll('.lang-btn').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-l') === SITE.lang); });
    $('themeBtn').setAttribute('aria-label', t('aria_theme'));
    if (!$('app').classList.contains('hidden')) switchView(state.view);
  }

  // ---- boot ----------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    applyLang();
    SITE.wireControls(applyLang);

    // status filter chips
    var chips = $('statusChips');
    [''].concat(STATUSES).forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (s === '' ? ' on' : ''); b.setAttribute('data-s', s);
      b.textContent = s === '' ? 'All' : statusLabel('tenant.status.' + s);
      b.addEventListener('click', function () {
        state.status = s; state.page = 1;
        chips.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c === b); });
        renderTenants();
      });
      chips.appendChild(b);
    });

    // invoice status chips
    var invChips = $('invStatusChips');
    [''].concat(['platform_invoice.draft', 'platform_invoice.sent', 'platform_invoice.paid', 'platform_invoice.void']).forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (s === '' ? ' on' : '');
      b.textContent = s === '' ? 'All' : invoiceStatusKey(s);
      b.addEventListener('click', function () {
        state.invStatus = s; state.invPage = 1;
        invChips.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c === b); });
        renderInvoices();
      });
      invChips.appendChild(b);
    });

    // subscription status select
    var sel = $('editStatus');
    STATUSES.forEach(function (s) {
      var o = document.createElement('option'); o.value = 'tenant.status.' + s; o.textContent = statusLabel('tenant.status.' + s);
      sel.appendChild(o);
    });

    // event listeners
    $('loginBtn').addEventListener('click', signIn);
    $('password').addEventListener('keydown', function (e) { if (e.key === 'Enter') signIn(); });
    $('email').addEventListener('keydown', function (e) { if (e.key === 'Enter') signIn(); });
    $('logoutBtn').addEventListener('click', signOut);

    $('tabOverview').addEventListener('click', function () { switchView('overview'); });
    $('tabClinics').addEventListener('click', function () { switchView('clinics'); });
    $('tabRevenue').addEventListener('click', function () { switchView('revenue'); });
    $('tabPlans').addEventListener('click', function () { switchView('plans'); });
    $('tabInvoices').addEventListener('click', function () { switchView('invoices'); });
    $('tabAnalytics').addEventListener('click', function () { switchView('analytics'); });
    $('tabHealth').addEventListener('click', function () { switchView('health'); });
    $('tabAudit').addEventListener('click', function () { switchView('audit'); });
    $('tabAnnounce').addEventListener('click', function () { switchView('announce'); });
    $('backBtn').addEventListener('click', function () { switchView('clinics'); });
    $('saveBtn').addEventListener('click', saveDetail);
    $('impersonateBtn').addEventListener('click', impersonate);

    // clinics pagination + search
    $('prevBtn').addEventListener('click', function () { state.page--; renderTenants(); });
    $('nextBtn').addEventListener('click', function () { state.page++; renderTenants(); });
    var searchTimer = null;
    $('search').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { state.search = $('search').value.trim(); state.page = 1; renderTenants(); }, 250);
    });

    // select all checkbox
    $('selectAll').addEventListener('change', function () {
      var checked = $('selectAll').checked;
      document.querySelectorAll('.row-cb').forEach(function (cb) {
        cb.checked = checked;
        if (checked) state.selected[cb.getAttribute('data-id')] = true;
        else delete state.selected[cb.getAttribute('data-id')];
      });
      updateBulkBar();
    });

    // bulk actions
    $('bulkActivate').addEventListener('click', function () {
      api('/tenants/bulk', { method: 'POST', body: JSON.stringify({ ids: Object.keys(state.selected), action: 'activate' }) })
        .then(function () { renderTenants(); });
    });
    $('bulkSuspend').addEventListener('click', function () {
      api('/tenants/bulk', { method: 'POST', body: JSON.stringify({ ids: Object.keys(state.selected), action: 'suspend' }) })
        .then(function () { renderTenants(); });
    });
    $('bulkDeselect').addEventListener('click', function () { state.selected = {}; updateBulkBar();
      document.querySelectorAll('.row-cb').forEach(function (cb) { cb.checked = false; });
    });

    // CSV export
    $('exportBtn').addEventListener('click', function () {
      var qs = '';
      if (state.search) qs += '?search=' + encodeURIComponent(state.search);
      if (state.status) qs += (qs ? '&' : '?') + 'status=' + encodeURIComponent(state.status);
      window.open(API + '/tenants/export' + qs, '_blank');
    });

    // plans
    $('addPlanBtn').addEventListener('click', function () { $('planForm').classList.toggle('hidden'); });
    $('planSaveBtn').addEventListener('click', savePlan);
    $('planCancelBtn').addEventListener('click', function () { $('planForm').classList.add('hidden'); });

    // invoices
    $('newInvoiceBtn').addEventListener('click', function () {
      $('invoiceForm').classList.toggle('hidden');
      // populate tenant select
      api('/tenants?limit=100').then(function (res) {
        if (!res.ok) return;
        $('invTenant').innerHTML = res.body.tenants.map(function (tn) {
          return '<option value="' + esc(tn.id) + '">' + esc(tn.name) + '</option>';
        }).join('');
      });
    });
    $('invSaveBtn').addEventListener('click', createInvoice);
    $('invCancelBtn').addEventListener('click', function () { $('invoiceForm').classList.add('hidden'); });
    $('invPrevBtn').addEventListener('click', function () { state.invPage--; renderInvoices(); });
    $('invNextBtn').addEventListener('click', function () { state.invPage++; renderInvoices(); });

    // audit
    $('auditSearch').addEventListener('input', function () {
      clearTimeout(state.auditTimer);
      state.auditTimer = setTimeout(function () { state.auditPage = 1; renderAudit(); }, 300);
    });
    $('auditPrevBtn').addEventListener('click', function () { state.auditPage--; renderAudit(); });
    $('auditNextBtn').addEventListener('click', function () { state.auditPage++; renderAudit(); });

    // announcements
    $('newAnnounceBtn').addEventListener('click', function () { $('announceForm').classList.toggle('hidden'); });
    $('annSaveBtn').addEventListener('click', createAnnouncement);
    $('annCancelBtn').addEventListener('click', function () { $('announceForm').classList.add('hidden'); });
    $('annPrevBtn').addEventListener('click', function () { state.annPage--; renderAnnouncements(); });
    $('annNextBtn').addEventListener('click', function () { state.annPage++; renderAnnouncements(); });

    // restore session
    if (sessionStorage.getItem(TOKEN_KEY)) {
      api('/stats').then(function (res) {
        if (res.status === 403) { signOut(); return; }
        enterApp();
      }).catch(function () {});
    }
  });
})();
