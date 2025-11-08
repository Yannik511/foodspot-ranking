-- Social Features Schema for Rankify
-- Run this in Supabase SQL Editor

-- 1. Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- Indexes for friendships
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_pair ON friendships(requester_id, addressee_id);

-- 2. Shared lists table
CREATE TABLE IF NOT EXISTS shared_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'link', 'public')),
  share_link UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(list_id)
);

-- Indexes for shared_lists
CREATE INDEX IF NOT EXISTS idx_shared_lists_list_id ON shared_lists(list_id);
CREATE INDEX IF NOT EXISTS idx_shared_lists_owner_id ON shared_lists(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_lists_visibility ON shared_lists(visibility);
CREATE INDEX IF NOT EXISTS idx_shared_lists_share_link ON shared_lists(share_link);

-- 3. List collaborators table
CREATE TABLE IF NOT EXISTS list_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(list_id, user_id)
);

-- Indexes for list_collaborators
CREATE INDEX IF NOT EXISTS idx_list_collaborators_list_id ON list_collaborators(list_id);
CREATE INDEX IF NOT EXISTS idx_list_collaborators_user_id ON list_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_list_collaborators_pair ON list_collaborators(list_id, user_id);

-- 4. Activity table
CREATE TABLE IF NOT EXISTS activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  ref_id UUID,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for activity
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity(type);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_ref_id ON activity(ref_id);

-- RLS Policies

-- Friendships: Users can view their own friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON friendships
  FOR SELECT
  USING (
    auth.uid() = requester_id OR auth.uid() = addressee_id
  );

CREATE POLICY "Users can create friendship requests"
  ON friendships
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update received friendship requests"
  ON friendships
  FOR UPDATE
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "Users can delete own friendships"
  ON friendships
  FOR DELETE
  USING (
    auth.uid() = requester_id OR auth.uid() = addressee_id
  );

-- Shared lists: Owners can manage, public lists visible to all
ALTER TABLE shared_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shared lists"
  ON shared_lists
  FOR SELECT
  USING (
    auth.uid() = owner_id
    OR visibility = 'public'
    OR (
      visibility = 'friends' AND EXISTS (
        SELECT 1 FROM friendships
        WHERE (friendships.requester_id = auth.uid() AND friendships.addressee_id = shared_lists.owner_id)
        OR (friendships.addressee_id = auth.uid() AND friendships.requester_id = shared_lists.owner_id)
        AND friendships.status = 'accepted'
      )
    )
    OR (
      visibility = 'participants' AND EXISTS (
        SELECT 1 FROM list_collaborators
        WHERE list_collaborators.list_id = shared_lists.list_id
        AND list_collaborators.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create shared lists for own lists"
  ON shared_lists
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id AND lists.user_id = auth.uid()
    )
    -- Note: We don't check list_collaborators here to avoid recursion
    -- Collaborators will be added after shared_list is created
  );

CREATE POLICY "Users can update own shared lists"
  ON shared_lists
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own shared lists"
  ON shared_lists
  FOR DELETE
  USING (auth.uid() = owner_id);

-- List collaborators: Collaborators can view, owners can manage
ALTER TABLE list_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view collaborators of accessible lists"
  ON list_collaborators
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_collaborators.list_id
      AND lists.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM shared_lists
      WHERE shared_lists.list_id = list_collaborators.list_id
      AND shared_lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "List owners can add collaborators"
  ON list_collaborators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id AND lists.user_id = auth.uid()
    )
    AND added_by = auth.uid()
  );

CREATE POLICY "List owners can update collaborators"
  ON list_collaborators
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "List owners can remove collaborators"
  ON list_collaborators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id AND lists.user_id = auth.uid()
    )
  );

-- Activity: Users can view their own activity and friends' public activity
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity"
  ON activity
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends' activity"
  ON activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE (
        (friendships.requester_id = auth.uid() AND friendships.addressee_id = activity.user_id)
        OR (friendships.addressee_id = auth.uid() AND friendships.requester_id = activity.user_id)
      )
      AND friendships.status = 'accepted'
    )
    AND (payload->>'visibility' = 'friends' OR payload->>'visibility' = 'public' OR payload->>'visibility' IS NULL)
  );

CREATE POLICY "Users can create own activity"
  ON activity
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_friendships
  BEFORE UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at_shared_lists
  BEFORE UPDATE ON shared_lists
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Helper function to get friendship status between two users
CREATE OR REPLACE FUNCTION get_friendship_status(user1_id UUID, user2_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  friendship_status VARCHAR;
BEGIN
  SELECT status INTO friendship_status
  FROM friendships
  WHERE (requester_id = user1_id AND addressee_id = user2_id)
     OR (requester_id = user2_id AND addressee_id = user1_id)
  LIMIT 1;
  
  RETURN COALESCE(friendship_status, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to search users by username (SECURITY DEFINER allows access to auth.users)
-- This function is used as a fallback if the view doesn't work
CREATE OR REPLACE FUNCTION search_users_by_username(search_query TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  profile_image_url TEXT,
  profile_visibility TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))::TEXT as username,
    (u.raw_user_meta_data->>'profileImageUrl')::TEXT as profile_image_url,
    COALESCE(u.raw_user_meta_data->>'profile_visibility', 'private')::TEXT as profile_visibility,
    u.created_at
  FROM auth.users u
  WHERE LOWER(COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))) LIKE LOWER('%' || search_query || '%')
  ORDER BY u.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the search function
GRANT EXECUTE ON FUNCTION search_users_by_username(TEXT) TO authenticated;

-- Create user_profiles view
-- Note: This view accesses auth.users which requires the postgres role to have access
-- If this fails, the application will use the search_users_by_username function instead
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT 
  u.id,
  u.email::TEXT as email,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))::TEXT as username,
  (u.raw_user_meta_data->>'profileImageUrl')::TEXT as profile_image_url,
  COALESCE(u.raw_user_meta_data->>'profile_visibility', 'private')::TEXT as profile_visibility,
  u.created_at
FROM auth.users u;

-- Grant SELECT permission on the view to authenticated users
GRANT SELECT ON public.user_profiles TO authenticated;

-- Create a function to get user profile by ID
CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  profile_image_url TEXT,
  profile_visibility TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.email,
    up.username,
    up.profile_image_url,
    up.profile_visibility,
    up.created_at
  FROM public.user_profiles up
  WHERE up.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

