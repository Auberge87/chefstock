import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOrganization } from '../auth/useOrganization'
import type { SavedDraft } from '../../types/database'

export function useSavedDrafts() {
  const { data: org } = useOrganization()

  return useQuery({
    queryKey: ['savedDrafts', org?.id],
    enabled: !!org,
    queryFn: async (): Promise<SavedDraft[]> => {
      const { data, error } = await supabase
        .from('saved_drafts')
        .select('*')
        .eq('organization_id', org!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SavedDraft[]
    },
  })
}

export function useSavedDraftMutations() {
  const { data: org } = useOrganization()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['savedDrafts', org?.id] })

  const create = useMutation({
    mutationFn: async ({ name, cart }: { name: string; cart: SavedDraft['cart'] }) => {
      const { error } = await supabase.from('saved_drafts').insert({ organization_id: org!.id, name, cart })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_drafts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, remove }
}
