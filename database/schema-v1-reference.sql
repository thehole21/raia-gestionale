-- RAIA Workspace: schema PostgreSQL di progettazione per la futura fase server.
-- NON è utilizzato dal prototipo HTML: questo file documenta le relazioni previste.
-- Prima della produzione: migrazioni controllate, autenticazione, autorizzazioni
-- per tenant, RLS (se si accede direttamente a PostgreSQL tramite API), backup,
-- cifratura, audit e protezioni anti-doppia fatturazione lato server.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vat_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  auth_user_id UUID UNIQUE,  -- futuro collegamento al provider di autenticazione
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin','operator','billing')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id)
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  display_name TEXT NOT NULL,
  vat_number TEXT,
  tax_code TEXT,
  email TEXT,
  phone TEXT,
  pec TEXT,
  sdi_code TEXT,
  billing_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  fatture_in_cloud_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, fatture_in_cloud_id)
);

CREATE TABLE work_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color_name TEXT NOT NULL DEFAULT 'gray',
  closed BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, name)
);

-- La commessa è la 'cartella' cliccabile. Una commessa ha N lavorazioni.
-- Un cliente ha N commesse, anche nello stesso giorno.
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  number TEXT NOT NULL,
  client_id UUID NOT NULL,
  assigned_operator_id UUID,
  status_id UUID,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, number),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, client_id) REFERENCES clients(organization_id, id),
  FOREIGN KEY (organization_id, assigned_operator_id) REFERENCES operators(organization_id, id),
  FOREIGN KEY (organization_id, status_id) REFERENCES work_statuses(organization_id, id)
);

CREATE TABLE order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  order_id UUID NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'pz',
  unit_price NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
  vat_percent NUMERIC(5,2),
  vat_nature TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, order_id) REFERENCES orders(organization_id, id)
);

-- Bozze gestionali e documenti fiscali reali restano nettamente distinti.
CREATE TABLE billing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL,
  internal_reference TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice','quote','credit_note')),
  status TEXT NOT NULL DEFAULT 'local_draft'
    CHECK (status IN ('local_draft','provider_draft','issued','rejected','cancelled')),
  provider_document_id BIGINT,
  provider_status TEXT,
  idempotency_key UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, internal_reference),
  UNIQUE (organization_id, idempotency_key),
  UNIQUE (organization_id, provider_document_id),
  FOREIGN KEY (organization_id, client_id) REFERENCES clients(organization_id, id),
  FOREIGN KEY (organization_id, created_by) REFERENCES operators(organization_id, id)
);

-- La stessa fattura può contenere righe di commesse diverse dello stesso cliente.
-- Una singola riga non entra in due documenti attivi. Per la fatturazione parziale
-- servono quantità assegnate a più documenti e relativa logica transazionale.
CREATE TABLE billing_document_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  billing_document_id UUID NOT NULL,
  order_line_id UUID NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price_snapshot NUMERIC(14,4) NOT NULL,
  vat_percent_snapshot NUMERIC(5,2),
  description_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, order_line_id),
  FOREIGN KEY (organization_id, billing_document_id) REFERENCES billing_documents(organization_id, id),
  FOREIGN KEY (organization_id, order_line_id) REFERENCES order_lines(organization_id, id)
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  actor_operator_id UUID,
  order_id UUID,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (organization_id, actor_operator_id) REFERENCES operators(organization_id, id),
  FOREIGN KEY (organization_id, order_id) REFERENCES orders(organization_id, id)
);

CREATE TABLE attachment_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  order_id UUID NOT NULL,
  object_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT,
  bytes BIGINT CHECK (bytes >= 0),
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (organization_id, order_id) REFERENCES orders(organization_id, id),
  FOREIGN KEY (organization_id, uploaded_by) REFERENCES operators(organization_id, id)
);

-- Campi aggiuntivi per recepire l'Excel successivamente, senza alterare
-- le relazioni fondamentali (es. riferimento macchina, materiale, reparto).
CREATE TABLE custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client','order','order_line')),
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','number','date','boolean','select')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, entity_type, field_key)
);
CREATE TABLE custom_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  custom_field_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  value JSONB,
  UNIQUE (organization_id, custom_field_id, entity_id),
  FOREIGN KEY (organization_id, custom_field_id) REFERENCES custom_fields(organization_id, id)
);

CREATE INDEX idx_orders_client_date ON orders (organization_id, client_id, created_date DESC);
CREATE INDEX idx_orders_status_date ON orders (organization_id, status_id, created_date DESC);
CREATE INDEX idx_orders_due ON orders (organization_id, due_date);
CREATE INDEX idx_lines_order ON order_lines (organization_id, order_id);
CREATE INDEX idx_documents_client ON billing_documents (organization_id, client_id, created_at DESC);
CREATE INDEX idx_activity_order ON activity_log (organization_id, order_id, created_at DESC);
-- TODO: full-text search italiano su clienti, commesse e righe, con eventuale
-- trigram index per ricerche parziali (pg_trgm).
-- TODO: transazioni serializzabili/locking nella creazione fatture, riserve righe
-- e gestione di storni / annullamenti con tracciabilità non distruttiva.
