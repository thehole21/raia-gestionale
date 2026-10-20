-- RAIA WORKSPACE V3 - PROPOSTA FUTURA, NON COLLEGATA AL FRONTEND
-- PostgreSQL 16+; struttura orientativa da adattare all'Excel reale e alle regole contabili.
-- I prezzi sono decimali NUMERIC, mai float nella versione server.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS clients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 vat text,
 fiscal_code text,
 recipient_code text,
 pec text,
 email text,
 phone text,
 city text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS operators (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 auth_user_id uuid UNIQUE,
 display_name text NOT NULL,
 role text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin','operator','billing')),
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS work_statuses (
 code text PRIMARY KEY,
 label text NOT NULL,
 sort_order integer NOT NULL DEFAULT 0,
 is_closed boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 client_id uuid NOT NULL REFERENCES clients(id),
 received_on date NOT NULL DEFAULT CURRENT_DATE,
 notes text NOT NULL DEFAULT '',
 created_by uuid REFERENCES operators(id),
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES orders(id),
 description text NOT NULL,
 quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
 unit text NOT NULL DEFAULT 'pz',
 unit_price numeric(14,4) NOT NULL CHECK (unit_price >= 0),
 vat_rate numeric(5,2),
 status_code text NOT NULL REFERENCES work_statuses(code),
 operator_id uuid REFERENCES operators(id),
 notes text NOT NULL DEFAULT '',
 imported_source_key text UNIQUE,
 imported_extras jsonb NOT NULL DEFAULT '{}'::jsonb,
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS billing_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id uuid NOT NULL REFERENCES clients(id),
 status text NOT NULL DEFAULT 'internal_draft' CHECK (status IN ('internal_draft','approved','remote_created','cancelled')),
 fic_document_id bigint UNIQUE,
 fic_document_type text,
 created_by uuid REFERENCES operators(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS billing_draft_lines (
 draft_id uuid NOT NULL REFERENCES billing_drafts(id) ON DELETE CASCADE,
 order_line_id uuid NOT NULL REFERENCES order_lines(id),
 quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
 PRIMARY KEY (draft_id,order_line_id)
);
-- In produzione serve una policy transazionale che impedisca sovra-fatturazione
-- attraverso diverse bozze e consenta futuri acconti/fatture parziali.
CREATE TABLE IF NOT EXISTS audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid REFERENCES operators(id),
 table_name text NOT NULL,
 record_id uuid NOT NULL,
 action text NOT NULL,
 before_data jsonb,
 after_data jsonb,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_orders_client ON orders(client_id,received_on DESC);
CREATE INDEX IF NOT EXISTS ix_lines_order ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS ix_lines_status_operator ON order_lines(status_code,operator_id);
CREATE INDEX IF NOT EXISTS ix_events_record ON audit_events(table_name,record_id,recorded_at DESC);
-- Sicurezza da implementare: login, restrizione ruoli, RLS o API server con autorizzazioni.

-- Per uno stesso cliente/data possono esistere eccezionalmente più ordini: non applicare UNIQUE(client_id,received_on).
-- La proposta di riutilizzare un ordine esistente è logica applicativa, non vincolo di DB.
