import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    'https://kqaoycehypzeqvxrewzl.supabase.co',
    'sb_publishable_27WgSEtNN1z2mo_Whh3n5Q__P6qDViT'
  )
}