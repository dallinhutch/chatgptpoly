CREATE TABLE research_budget_reservations(id bigserial PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),reserved_usd numeric(12,4) NOT NULL CHECK(reserved_usd>0),market_id text NOT NULL REFERENCES markets);
CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON research_budget_reservations FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
