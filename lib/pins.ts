import { supabase } from './supabase'

/** A Figma-style pin comment placed on a creative image. */
export interface SlidePin {
  id: string
  campaign_id: string
  slide_key: string
  asset_id: string | null
  /** Relative coords on the image, 0..1. */
  x: number
  y: number
  comment: string | null
  author: string | null
  resolved: boolean
  created_at: string
  updated_at: string
}

export async function getPins(campaignId: string): Promise<SlidePin[]> {
  const { data, error } = await supabase
    .from('slide_pins')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) return []
  return (data || []) as SlidePin[]
}

export async function createPin(input: {
  campaign_id: string
  slide_key: string
  asset_id?: string | null
  x: number
  y: number
  comment?: string | null
  author?: string | null
}): Promise<SlidePin> {
  const { data, error } = await supabase
    .from('slide_pins')
    .insert({
      campaign_id: input.campaign_id,
      slide_key: input.slide_key,
      asset_id: input.asset_id ?? null,
      x: input.x,
      y: input.y,
      comment: input.comment ?? null,
      author: input.author ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as SlidePin
}

export async function setPinResolved(id: string, campaignId: string, resolved: boolean): Promise<void> {
  const { error } = await supabase
    .from('slide_pins')
    .update({ resolved, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('campaign_id', campaignId)
  if (error) throw error
}

export async function deletePin(id: string, campaignId: string): Promise<void> {
  const { error } = await supabase.from('slide_pins').delete().eq('id', id).eq('campaign_id', campaignId)
  if (error) throw error
}
