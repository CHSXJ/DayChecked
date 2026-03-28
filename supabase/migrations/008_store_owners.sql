-- Co-ownership: stores can have multiple owners beyond the primary owner_id
CREATE TABLE IF NOT EXISTS store_owners (
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, user_id)
);

-- RLS
ALTER TABLE store_owners ENABLE ROW LEVEL SECURITY;

-- Primary owner of a store can see all co-owners of their stores
-- Co-owner can see their own rows
CREATE POLICY "store_owners_select" ON store_owners
  FOR SELECT USING (
    user_id = auth.uid()
    OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- Insert / Delete via service role only (handled by API routes)
