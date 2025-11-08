-- Fix infinite recursion in RLS policies for shared_lists and list_collaborators
-- The issue was that shared_lists SELECT policy checked list_collaborators,
-- and list_collaborators SELECT policy checked shared_lists visibility, creating a circular dependency
-- Additionally, INSERT with WITH CHECK triggers SELECT policy evaluation, causing recursion

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Users can view collaborators of accessible lists" ON list_collaborators;
DROP POLICY IF EXISTS "Users can create shared lists for own lists" ON shared_lists;
DROP POLICY IF EXISTS "Users can update own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Users can delete own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "List owners can add collaborators" ON list_collaborators;
DROP POLICY IF EXISTS "List owners can update collaborators" ON list_collaborators;
DROP POLICY IF EXISTS "List owners can remove collaborators" ON list_collaborators;

-- Recreate shared_lists SELECT policy without recursive dependency
-- Key change: For 'participants' visibility, we check list_collaborators,
-- but this check is isolated and won't trigger recursion because
-- list_collaborators SELECT policy only checks ownership, not shared_lists visibility
CREATE POLICY "Users can view own shared lists"
  ON shared_lists
  FOR SELECT
  USING (
    -- Owner can always see their shared lists
    auth.uid() = owner_id
    -- Public lists are visible to everyone
    OR visibility = 'public'
    -- Friends can see lists with 'friends' visibility
    OR (
      visibility = 'friends' AND EXISTS (
        SELECT 1 FROM friendships
        WHERE (
          (friendships.requester_id = auth.uid() AND friendships.addressee_id = shared_lists.owner_id)
          OR (friendships.addressee_id = auth.uid() AND friendships.requester_id = shared_lists.owner_id)
        )
        AND friendships.status = 'accepted'
      )
    )
    -- Participants can see lists with 'participants' visibility
    -- This check uses a direct query to list_collaborators without triggering shared_lists policy
    OR (
      visibility = 'participants' AND EXISTS (
        SELECT 1 FROM list_collaborators
        WHERE list_collaborators.list_id = shared_lists.list_id
        AND list_collaborators.user_id = auth.uid()
      )
    )
  );

-- Recreate list_collaborators SELECT policy without recursive dependency
-- IMPORTANT: We only check ownership, NOT visibility, to avoid recursion
-- Visibility checks are handled in shared_lists SELECT policy
CREATE POLICY "Users can view collaborators of accessible lists"
  ON list_collaborators
  FOR SELECT
  USING (
    -- Users can see their own collaborator entries
    user_id = auth.uid()
    -- List owners can see all collaborators
    OR EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_collaborators.list_id
      AND lists.user_id = auth.uid()
    )
    -- Shared list owners can see all collaborators
    -- NOTE: We only check ownership here, NOT visibility, to prevent recursion
    OR EXISTS (
      SELECT 1 FROM shared_lists
      WHERE shared_lists.list_id = list_collaborators.list_id
      AND shared_lists.owner_id = auth.uid()
    )
  );

-- Recreate shared_lists INSERT policy
-- CRITICAL: WITH CHECK only validates the INSERT values, it should NOT trigger SELECT policy
-- We only check that user owns the list and is setting themselves as owner
CREATE POLICY "Users can create shared lists for own lists"
  ON shared_lists
  FOR INSERT
  WITH CHECK (
    -- User must be the owner
    auth.uid() = owner_id
    -- List must exist and belong to the user
    AND EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id 
      AND lists.user_id = auth.uid()
    )
    -- Do NOT check list_collaborators here - they don't exist yet during INSERT
    -- Do NOT check visibility conditions - that's for SELECT policy only
  );

-- Recreate UPDATE policy
CREATE POLICY "Users can update own shared lists"
  ON shared_lists
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Recreate DELETE policy
CREATE POLICY "Users can delete own shared lists"
  ON shared_lists
  FOR DELETE
  USING (auth.uid() = owner_id);

-- Recreate list_collaborators INSERT policy
CREATE POLICY "List owners can add collaborators"
  ON list_collaborators
  FOR INSERT
  WITH CHECK (
    -- User must be the list owner
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id 
      AND lists.user_id = auth.uid()
    )
    -- User must be the one adding the collaborator
    AND added_by = auth.uid()
  );

-- Recreate UPDATE policy
CREATE POLICY "List owners can update collaborators"
  ON list_collaborators
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id 
      AND lists.user_id = auth.uid()
    )
  );

-- Recreate DELETE policy
CREATE POLICY "List owners can remove collaborators"
  ON list_collaborators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id 
      AND lists.user_id = auth.uid()
    )
  );

