import { getClients, createClient, updateClient } from './clients'

const MONDAY_API_URL = 'https://api.monday.com/v2'

export interface MondaySyncResult extends Record<string, unknown> {
  created: number
  skipped: number
  total: number
}

interface MondayItem {
  id: string
  name: string
}

interface MondayItemsPage {
  items: MondayItem[]
  cursor: string | null
}

async function mondayGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN
  if (!token) throw new Error('MONDAY_API_TOKEN is not configured')

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Monday.com API error: ${res.status} ${res.statusText}`)
  }

  const json = (await res.json()) as { data: T; errors?: { message: string }[] }
  if (json.errors?.length) {
    throw new Error(`Monday.com GraphQL error: ${json.errors.map(e => e.message).join(', ')}`)
  }
  return json.data
}

/**
 * Fetches all item IDs + names from the configured Monday.com board,
 * handling pagination via cursor.
 */
export async function fetchMondayClients(): Promise<MondayItem[]> {
  const boardId = process.env.MONDAY_BOARD_ID
  if (!boardId) throw new Error('MONDAY_BOARD_ID is not configured')

  type PageData = { boards: { items_page: MondayItemsPage }[] }

  const items: MondayItem[] = []
  let cursor: string | null = null

  do {
    const result: PageData = await mondayGraphQL<PageData>(
      `query($boardId: [ID!]!, $limit: Int!, $cursor: String) {
        boards(ids: $boardId) {
          items_page(limit: $limit, cursor: $cursor) {
            items { id name }
            cursor
          }
        }
      }`,
      { boardId: [boardId], limit: 500, cursor: cursor ?? undefined },
    )

    const page: MondayItemsPage | undefined = result.boards[0]?.items_page
    if (!page) break

    items.push(...page.items)
    cursor = page.cursor ?? null
  } while (cursor)

  return items
}

/**
 * Syncs clients from Monday.com into the "Results Digital" workspace.
 * Adds new items; skips items that already exist (matched by monday_item_id
 * or by name, case-insensitive, as a fallback for pre-existing records).
 */
export async function syncClientsFromMonday(): Promise<MondaySyncResult> {
  const workspaceId = process.env.MONDAY_SYNC_WORKSPACE_ID
  if (!workspaceId) throw new Error('MONDAY_SYNC_WORKSPACE_ID is not configured')

  const [mondayItems, existingClients] = await Promise.all([
    fetchMondayClients(),
    getClients(workspaceId),
  ])

  const existingByMondayId = new Map(
    existingClients
      .filter(c => c.monday_item_id)
      .map(c => [c.monday_item_id!, c]),
  )
  const existingByNameLower = new Map(
    existingClients.map(c => [c.name.toLowerCase(), c]),
  )

  let created = 0
  let skipped = 0

  for (const item of mondayItems) {
    const nameTrimmed = item.name.trim()
    if (!nameTrimmed) { skipped++; continue }

    // Already linked by Monday item ID
    if (existingByMondayId.has(item.id)) { skipped++; continue }

    // Exists by name -- link the Monday ID retroactively
    const existingByName = existingByNameLower.get(nameTrimmed.toLowerCase())
    if (existingByName) {
      await updateClient(existingByName.id, { monday_item_id: item.id })
      skipped++
      continue
    }

    await createClient({
      name: nameTrimmed,
      workspace_id: workspaceId,
      monday_item_id: item.id,
    })
    created++
  }

  return { created, skipped, total: mondayItems.length }
}

/** Returns true when all required Monday env vars are present. */
export function isMondayConfigured(): boolean {
  return !!(
    process.env.MONDAY_API_TOKEN &&
    process.env.MONDAY_BOARD_ID &&
    process.env.MONDAY_SYNC_WORKSPACE_ID
  )
}
