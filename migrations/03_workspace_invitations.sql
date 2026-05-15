-- Migration: Workspace invitations for Sprint 3
-- Execute after 01_sprint_3_4_schema.sql and 02_rls_policies.sql.

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_invitations_token_idx
ON public.workspace_invitations(token);

CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_idx
ON public.workspace_invitations(workspace_id);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_invitations_insert" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_select_invited" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_update_invited" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_select_workspace" ON public.workspace_invitations;

CREATE POLICY "workspace_invitations_insert"
ON public.workspace_invitations FOR INSERT
TO authenticated
WITH CHECK (
    invited_by = auth.uid()
    AND workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "workspace_invitations_select_invited"
ON public.workspace_invitations FOR SELECT
TO authenticated
USING (
    lower(invited_email) = lower(auth.jwt() ->> 'email')
    OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "workspace_invitations_update_invited"
ON public.workspace_invitations FOR UPDATE
TO authenticated
USING (lower(invited_email) = lower(auth.jwt() ->> 'email'))
WITH CHECK (lower(invited_email) = lower(auth.jwt() ->> 'email'));
