-- Prisma does not model PostgreSQL expression indexes. Keep this idempotent
-- SQL alongside the schema and apply it after database provisioning.
CREATE INDEX IF NOT EXISTS products_search_vector_idx
ON products
USING GIN (
  to_tsvector(
    'simple',
    coalesce(name, '') || ' ' || coalesce(barcode, '') || ' ' || coalesce(category, '')
  )
);
