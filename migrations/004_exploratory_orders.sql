-- Exploratory paper orders are observations, not fabricated AI research.
ALTER TABLE simulated_orders ALTER COLUMN research_id DROP NOT NULL;
ALTER TABLE simulated_orders ADD CONSTRAINT exploratory_without_research
CHECK (research_id IS NOT NULL OR COALESCE(decision->>'mode','') = 'exploratory');
