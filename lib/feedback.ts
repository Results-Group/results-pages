import { supabase } from './supabase'

export type FeedbackStatus = 'approved' | 'rejected' | 'pending'

export interface SlideFeedback {
  id: string
  campaign_id: string
  slide_key: string
  status: FeedbackStatus
  comment: string | null
  author: string | null
  created_at: string
  updated_at: string
}

export async function getFeedback(campaignId: string): Promise<SlideFeedback[]> {
  const { data, error } = await supabase
    .from('slide_feedback')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('updated_at', { ascending: false })
  if (error) return []
  return (data || []) as SlideFeedback[]
}

export async function upsertFeedback(input: {
  campaign_id: string
  slide_key: string
  status: FeedbackStatus
  comment?: string | null
  author?: string | null
}): Promise<SlideFeedback> {
  const { data, error } = await supabase
    .from('slide_feedback')
    .upsert(
      {
        campaign_id: input.campaign_id,
        slide_key: input.slide_key,
        status: input.status,
        comment: input.comment ?? null,
        author: input.author ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'campaign_id,slide_key' },
    )
    .select()
    .single()
  if (error) throw error
  return data as SlideFeedback
}
