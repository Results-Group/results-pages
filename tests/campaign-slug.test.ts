import { describe, it, expect } from 'vitest'
import { slugBaseFor, slugForName, urlFollowsName } from '@/lib/campaign-slug'

const tail = () => 'zzzzzz'

describe('slugForName', () => {
  it('moves a duplicate off its source address when it is renamed', () => {
    // The production case: "Billboards" lived at rosh-hashana-2026-89c9f5.
    expect(slugForName('rosh-hashana-2026-89c9f5', 'Billboards', tail)).toBe('billboards-89c9f5')
  })

  it('keeps the random tail, so only the part that came from the name changes', () => {
    expect(slugForName('sukkot-5a1d99', 'Hanukkah - B2B', tail)).toBe('hanukkah-b2b-5a1d99')
  })

  it('leaves the URL alone while the name still produces it', () => {
    expect(slugForName('billboards-89c9f5', 'Billboards', tail)).toBeNull()
  })

  it('ignores the copy suffix the duplicate route adds', () => {
    // A fresh copy is "<name> (עותק)" at <source base>-<tail>: nothing to move yet.
    expect(slugForName('sukkot-5a1d99', 'Sukkot (עותק)', tail)).toBeNull()
    expect(slugForName('sukkot-5a1d99', 'Sukkot (תבנית)', tail)).toBeNull()
  })

  it('transliterates a Hebrew name, as a new campaign does', () => {
    expect(slugForName('kmpyyn-923a6b', 'פוסט כיפור', tail)).toBe('pvst-kypvr-923a6b')
  })

  it('keeps the URL when the name has nothing a URL can carry', () => {
    expect(slugForName('sukkot-5a1d99', '!!!', tail)).toBeNull()
  })

  it('treats a tail-only slug as all tail', () => {
    // The create route makes "<tail>" alone when the name slugifies to nothing.
    expect(slugForName('a1b2c3', 'Spring', tail)).toBe('spring-a1b2c3')
  })
})

describe('slugBaseFor', () => {
  it('is the name without the copy suffix', () => {
    expect(slugBaseFor('Rosh Ha\'Shana 2026 (עותק)')).toBe('rosh-hashana-2026')
  })
})

describe('urlFollowsName', () => {
  const draft = { slug_auto: true, status: 'draft' }

  it('follows the name on an automatic draft', () => {
    expect(urlFollowsName(draft, { campaign_name: 'Billboards' })).toBe(true)
  })

  it('never moves a URL someone typed', () => {
    expect(urlFollowsName({ ...draft, slug_auto: false }, { campaign_name: 'Billboards' })).toBe(false)
    // Campaigns from before the column existed read as null.
    expect(urlFollowsName({ ...draft, slug_auto: null }, { campaign_name: 'Billboards' })).toBe(false)
  })

  it('never moves a published or archived campaign: the link may be with the client', () => {
    expect(urlFollowsName({ ...draft, status: 'published' }, { campaign_name: 'Billboards' })).toBe(false)
    expect(urlFollowsName({ ...draft, status: 'archived' }, { campaign_name: 'Billboards' })).toBe(false)
  })

  it('lets a URL typed in the same save win', () => {
    expect(urlFollowsName(draft, { campaign_name: 'Billboards', slug: 'my-url' })).toBe(false)
  })

  it('does nothing when the save carries no name', () => {
    expect(urlFollowsName(draft, {})).toBe(false)
  })
})
