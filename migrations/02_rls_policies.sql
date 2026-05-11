-- Migration: RLS Policies for financeiro and configuracoes tables
-- Execute este SQL no SQL Editor do Supabase Dashboard

-- Drop existing policies first (safe to re-run)
DROP POLICY IF EXISTS "Users can select their own workspace transactions" ON public.financeiro;
DROP POLICY IF EXISTS "Users can insert into their own workspace" ON public.financeiro;
DROP POLICY IF EXISTS "Users can update their own workspace transactions" ON public.financeiro;
DROP POLICY IF EXISTS "Users can delete their own workspace transactions" ON public.financeiro;
DROP POLICY IF EXISTS "Users can select their own workspace config" ON public.configuracoes;
DROP POLICY IF EXISTS "Users can insert into their own workspace config" ON public.configuracoes;
DROP POLICY IF EXISTS "Users can update their own workspace config" ON public.configuracoes;
DROP POLICY IF EXISTS "Users can select workspaces they are members of" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can see their own memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can insert their own membership" ON public.workspace_members;

-- 1. Policies for financeiro table (transactions)
CREATE POLICY "Users can select their own workspace transactions"
ON public.financeiro FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert into their own workspace"
ON public.financeiro FOR INSERT
TO authenticated
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own workspace transactions"
ON public.financeiro FOR UPDATE
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their own workspace transactions"
ON public.financeiro FOR DELETE
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

-- 2. Policies for configuracoes table (config)
CREATE POLICY "Users can select their own workspace config"
ON public.configuracoes FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert into their own workspace config"
ON public.configuracoes FOR INSERT
TO authenticated
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own workspace config"
ON public.configuracoes FOR UPDATE
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

-- 3. Policies for workspaces table
CREATE POLICY "Users can select workspaces they are members of"
ON public.workspaces FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can create workspaces"
ON public.workspaces FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- 4. Policies for workspace_members table
-- IMPORTANT: These must NOT query workspace_members itself (causes recursion)
CREATE POLICY "Users can see their own memberships"
ON public.workspace_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own membership"
ON public.workspace_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Note: DELETE policy omitted to avoid recursion.
-- Owners can manage members via application logic if needed.

-- 5. Enable RLS on financeiro and configuracoes (se ainda não estiver habilitado)
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
