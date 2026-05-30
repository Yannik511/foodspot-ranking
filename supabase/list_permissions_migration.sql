-- Migration: Berechtigungssystem für geteilte Listen
-- Alle drei Toggles DEFAULT false → Mitglieder dürfen standardmäßig nur bewerten

ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS members_can_add_spots  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS members_can_edit_spots boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS members_can_edit_list  boolean NOT NULL DEFAULT false;
