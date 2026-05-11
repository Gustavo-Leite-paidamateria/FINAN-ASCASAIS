-- Migration: RLS Policies (versão final - sem recursão)
-- Execute este SQL completo no SQL Editor do Supabase Dashboard

-- ============================================================
-- 0. DROP ALL EXISTING POLICIES ON ALL TABLES
-- ============================================================
DO $$ DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('financeiro', 'configuracoes', 'workspaces', 'workspace_members', 'managed_profiles')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ============================================================
-- 1. DISABLE RLS ON workspace_members (queries filter by user_id in code, RLS causes recursion)
-- ============================================================
ALTER TABLE public.workspace_members DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Policies for financeiro table (transactions)
-- ============================================================
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro_select"
ON public.financeiro FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "financeiro_insert"
ON public.financeiro FOR INSERT
TO authenticated
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "financeiro_update"
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

CREATE POLICY "financeiro_delete"
ON public.financeiro FOR DELETE
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

-- ============================================================
-- 3. Policies for configuracoes table (config)
-- ============================================================
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracoes_select"
ON public.configuracoes FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "configuracoes_insert"
ON public.configuracoes FOR INSERT
TO authenticated
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "configuracoes_update"
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

-- ============================================================
-- 4. Policies for workspaces table
-- ============================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_select"
ON public.workspaces FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "workspaces_insert"
ON public.workspaces FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 5. Policies for managed_profiles table
-- ============================================================
ALTER TABLE public.managed_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managed_profiles_select"
ON public.managed_profiles FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "managed_profiles_insert"
ON public.managed_profiles FOR INSERT
TO authenticated
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);
