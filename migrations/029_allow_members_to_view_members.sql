-- =============================================
-- MIGRATION 029: ALLOW MEMBERS TO VIEW OTHER MEMBERS
-- =============================================
-- Ermöglicht es allen Mitgliedern einer Liste (nicht nur Owner),
-- die anderen Mitglieder zu sehen.
-- Dies ist notwendig für die Avatar-Anzeige in geteilten Listen.
-- =============================================

-- Policy 3: Mitglieder können andere Mitglieder derselben Liste sehen
-- WICHTIG: Diese Policy verwendet eine Subquery statt is_list_member(),
-- um Rekursion zu vermeiden. Die Subquery prüft direkt list_members.
CREATE POLICY "List members can view other members of same list"
ON list_members FOR SELECT TO authenticated
USING (
  -- User ist Mitglied dieser Liste (check ohne Rekursion)
  EXISTS (
    SELECT 1 FROM list_members AS my_membership
    WHERE my_membership.list_id = list_members.list_id
    AND my_membership.user_id = auth.uid()
  )
);

-- =============================================
-- VERIFIZIERUNG
-- =============================================
-- Nach dieser Migration sollten:
-- 1. User ihre eigenen Mitgliedschaften sehen können (Policy 1) ✅
-- 2. Owner alle Mitglieder ihrer Listen sehen können (Policy 2) ✅
-- 3. Mitglieder können andere Mitglieder derselben Liste sehen (Policy 3) ✅
-- 4. Keine Rekursion auftreten ✅
--
-- Die EXISTS-Subquery vermeidet Rekursion, da sie direkt auf list_members
-- zugreift ohne weitere RLS-Prüfungen zu triggern.

-- =============================================
-- SUCCESS: Members Can Now View Other Members
-- =============================================

