import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from './AuthProvider'
import type { Organization } from '../../types/database'

export function useOrganization() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['organization', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Organization> => {
      const { data: membership, error: memberErr } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .single()
      if (memberErr) throw memberErr

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', membership.organization_id)
        .single()
      if (orgErr) throw orgErr

      return org as Organization
    },
  })
}
