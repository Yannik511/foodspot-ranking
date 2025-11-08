-- Fix infinite recursion in RLS policies for shared_lists and list_collaborators
-- V2: Use SECURITY DEFINER function to bypass RLS during INSERT operations

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Users can view collaborators of accessible lists" ON list_collaborators;
DROP POLICY IF EXISTS "Users can create shared lists for own lists" ON shared_lists;
DROP POLICY IF EXISTS "Users can update own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Users can delete own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "List owners can add collaborators" ON list_collaborators;
DROP POLICY IF EXISTS "List owners can update collaborators" ON list_collaborators;
DROP POLICY IF EXISTS "List owners can remove collaborators" ON list_collaborators;

-- Create a SECURITY DEFINER function to create shared lists
-- This bypasses RLS and prevents recursion during INSERT
CREATE OR REPLACE FUNCTION create_shared_list(
  p_list_id UUID,
  p_owner_id UUID,
  p_visibility VARCHAR(20) DEFAULT 'participants'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shared_list_id UUID;
BEGIN
  -- Verify that the user owns the list
  IF NOT EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id AND user_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'User does not own this list';
  END IF;

  -- Verify that the owner_id matches the authenticated user
  IF p_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Owner ID must match authenticated user';
  END IF;

  -- Insert the shared_list (bypasses RLS)
  INSERT INTO shared_lists (list_id, owner_id, visibility)
  VALUES (p_list_id, p_owner_id, p_visibility)
  RETURNING id INTO v_shared_list_id;

  RETURN v_shared_list_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_shared_list(UUID, UUID, VARCHAR) TO authenticated;

-- Recreate shared_lists SELECT policy (simplified, no recursion)
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
    -- This is safe because list_collaborators SELECT policy doesn't check shared_lists visibility
    OR (
      visibility = 'participants' AND EXISTS (
        SELECT 1 FROM list_collaborators
        WHERE list_collaborators.list_id = shared_lists.list_id
        AND list_collaborators.user_id = auth.uid()
      )
    )
  );

-- Remove the INSERT policy - we'll use the function instead
-- But keep a simple one for backward compatibility (won't cause recursion)
CREATE POLICY "Users can create shared lists for own lists"
  ON shared_lists
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id 
      AND lists.user_id = auth.uid()
    )
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

-- Recreate list_collaborators SELECT policy (NO shared_lists visibility check!)
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
    -- Shared list owners can see all collaborators (ownership only, NO visibility check!)
    OR EXISTS (
      SELECT 1 FROM shared_lists
      WHERE shared_lists.list_id = list_collaborators.list_id
      AND shared_lists.owner_id = auth.uid()
    )
  );

-- Recreate list_collaborators INSERT policy
CREATE POLICY "List owners can add collaborators"
  ON list_collaborators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id 
      AND lists.user_id = auth.uid()
    )
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


