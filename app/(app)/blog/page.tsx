import { createClient } from '@/lib/supabase/server'
import { getSettings, tzOf } from '@/lib/data'
import { todayIn } from '@/lib/time'
import { BlogPipeline } from '@/components/blog/blog-pipeline'

export default async function BlogPage() {
  const s = await createClient()
  const settings = await getSettings(s)
  const { data, error } = await s.from('blog_posts').select('*').order('sort_order').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return <BlogPipeline today={todayIn(tzOf(settings))} posts={data ?? []} />
}
