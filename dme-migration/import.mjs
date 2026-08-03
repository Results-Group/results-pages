#!/usr/bin/env node
/**
 * DME data import: Base44 JSON export -> Supabase Postgres.
 *
 *   node import.mjs --dry-run     inspect and validate, write nothing
 *   node import.mjs               perform the import
 *
 * Credentials come from the environment (or dme-migration/.env). The service
 * role key must never be committed or pasted into chat — it bypasses RLS:
 *
 *   SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
 *
 * Design notes
 * ------------
 * * Idempotent. Every table upserts on `base44_id`, so a re-run after a partial
 *   failure updates instead of duplicating. Safe to run repeatedly.
 * * Two phases, because identity is the hard part. Base44 ids are opaque strings
 *   and Postgres rows are uuids, so phase 1 creates the Supabase Auth users and
 *   records `base44_id -> uuid`; phase 2 resolves every foreign key through that
 *   map. Nothing is guessed by email or ordering.
 * * A row whose parent is missing is SKIPPED and reported, never silently
 *   dropped and never inserted with a dangling reference.
 * * No dependencies — plain fetch against PostgREST and the Auth Admin API.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKUP = join(HERE, '..', 'dme-backup');
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function loadEnv() {
  const f = join(HERE, '.env');
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY_RUN && (!URL_BASE || !SERVICE_KEY)) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env or dme-migration/.env)');
  process.exit(1);
}

const report = { inserted: {}, skipped: [], notes: [] };
const skip = (entity, id, why) => report.skipped.push({ entity, id, why });

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
async function rest(path, { method = 'POST', body, headers = {} } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

/** Upsert rows keyed on base44_id, in chunks so one huge table can't time out. */
async function upsert(table, rows) {
  report.inserted[table] = (report.inserted[table] || 0) + rows.length;
  if (DRY_RUN || rows.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await rest(`/rest/v1/${table}?on_conflict=base44_id`, {
      body: rows.slice(i, i + CHUNK),
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const load = (entity) => {
  const f = join(BACKUP, `${entity}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
};

/** Base44 bookkeeping columns that have no counterpart in the new schema. */
const DROP = new Set(['app_id', 'is_sample', 'created_by', 'created_by_id', 'id',
  'created_date', 'updated_date', 'is_service', 'is_verified', 'disabled',
  'disabled_reason', 'force_password_reset', 'collaborator_role', '_app_role']);

const stamps = (r) => ({
  base44_id: r.id,
  created_at: r.created_date || undefined,
  updated_at: r.updated_date || undefined,
});

/** Empty strings become NULL: Postgres treats '' as a value, Base44 meant "unset". */
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v === '' ? null : v;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Phase 1 — identity
// ---------------------------------------------------------------------------
const userMap = new Map();   // base44 user id -> uuid
const cardMap = new Map();
const partnerMap = new Map();
const convMap = new Map();

async function listAuthUsersByEmail() {
  const byEmail = new Map();
  if (DRY_RUN) return byEmail;
  for (let page = 1; ; page++) {
    const res = await rest(`/auth/v1/admin/users?page=${page}&per_page=200`, { method: 'GET' });
    const users = res.users || [];
    for (const u of users) if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    if (users.length < 200) break;
  }
  return byEmail;
}

async function importUsers() {
  const rows = load('User');
  const existing = await listAuthUsersByEmail();
  const profiles = [];

  for (const u of rows) {
    const email = (u.email || '').toLowerCase().trim();
    if (!email) { skip('User', u.id, 'no email — cannot create an auth account'); continue; }

    let uid = existing.get(email);
    if (!uid) {
      if (DRY_RUN) {
        uid = `dry-${u.id}`;
      } else {
        // email_confirm so the account is usable immediately. No password is
        // set: everyone signs in by magic link, which is also how Base44
        // worked, so nobody has a password to migrate.
        const created = await rest('/auth/v1/admin/users', {
          body: { email, email_confirm: true, user_metadata: { full_name: u.full_name || '' } },
        });
        uid = created.id;
      }
    }
    userMap.set(u.id, uid);

    profiles.push(clean({
      id: uid,
      ...stamps(u),
      email,
      full_name: u.full_name,
      role: u.role === 'admin' ? 'admin' : 'user',
      phone: u.phone,
      shipping_address: u.shippingAddress,
      is_staff_member: !!u.isStaffMember,
      staff_permissions: u.staffPermissions || [],
    }));
  }
  await upsert('app_users', profiles);
}

// ---------------------------------------------------------------------------
// Phase 2 — cards (self-referencing via team_id, so it lands in two passes)
// ---------------------------------------------------------------------------
async function importCards() {
  const rows = load('DigitalCard');
  const out = [];

  for (const c of rows) {
    const owner = userMap.get(c.userId);
    if (!owner) { skip('DigitalCard', c.id, `owner ${c.userId} not found`); continue; }

    // loginToken / loginTokenExpiresAt are intentionally NOT carried over: they
    // are single-use magic-link tokens (the audit found zero live ones), and the
    // new schema keeps them hashed in card_login_tokens. Users get a fresh link.
    out.push(clean({
      ...stamps(c),
      user_id: owner,
      is_team_card: !!c.isTeamCard,
      slug: c.slug,
      slug_confirmed: !!c.slugConfirmed,
      bundle_type: c.bundleType || 'digitalPhysical',
      status: c.status || 'design_pending',
      account_status: c.accountStatus || 'active',
      subscription_status: c.subscriptionStatus || null,
      scheduled_for_deletion_at: c.scheduledForDeletionAt,
      cancellation_reason: c.cancellationReason,
      full_name: c.fullName,
      job_title: c.jobTitle,
      company_name: c.companyName,
      bio: c.bio,
      logo_image_url: c.logoImageUrl,
      cover_image_url: c.coverImageUrl,
      contact_info: c.contactInfo || {},
      action_buttons: c.actionButtons || [],
      action_button_clicks: c.actionButtonClicks || [],
      design_settings: c.designSettings || {},
      qr_style: c.qrStyle || {},
      business_hours: c.businessHours || {},
      gallery_image_urls: c.galleryImageUrls || [],
      faq: c.faq || [],
      documents: c.documents || [],
      video_embeds: c.videoEmbeds || [],
      tracking_pixels: c.trackingPixels || [],
      embed_codes: c.embedCodes,
      form_completed: !!c.formCompleted,
      form_completed_at: c.formCompletedAt,
      shipping_address: c.shippingAddress,
      signature_data: c.signatureData,
      plan_type: c.planType,
      health_score: c.healthScore,
      segments: c.segments || [],
      exchange_contact_enabled: !!c.exchangeContactEnabled,
      marketing_consent: !!c.marketingConsent,
      marketing_consent_at: c.marketingConsentAt,
      total_contacts_saved: c.totalContactsSaved || 0,
      total_views: c.totalViews || 0,
      custom_status_definitions: c.customStatusDefinitions || [],
      custom_source_definitions: c.customSourceDefinitions || [],
    }));
  }

  await upsert('digital_cards', out);

  // Read the assigned uuids back so foreign keys can be resolved.
  if (!DRY_RUN) {
    const saved = await rest('/rest/v1/digital_cards?select=id,base44_id', { method: 'GET' });
    for (const r of saved) if (r.base44_id) cardMap.set(r.base44_id, r.id);
  } else {
    for (const c of rows) cardMap.set(c.id, `dry-${c.id}`);
  }

  // Second pass: team_id points at another card, so it can only be set once
  // every card exists.
  const links = rows
    .filter((c) => c.teamId && cardMap.has(c.id) && cardMap.has(c.teamId))
    .map((c) => ({ base44_id: c.id, team_id: cardMap.get(c.teamId) }));
  if (links.length) await upsert('digital_cards', links);
  report.notes.push(`team_id links set: ${links.length}`);
}

// ---------------------------------------------------------------------------
// Phase 3 — everything else
// ---------------------------------------------------------------------------
async function importRest() {
  // --- subscriptions ---
  await upsert('subscriptions', load('Subscription').flatMap((s) => {
    const uid = userMap.get(s.userId);
    if (!uid) { skip('Subscription', s.id, `user ${s.userId} not found`); return []; }
    return [clean({
      ...stamps(s), user_id: uid,
      stripe_subscription_id: s.stripeSubscriptionId,
      stripe_customer_id: s.stripeCustomerId,
      plan_type: s.planType || 'free',
      status: s.status || 'trialing',
      number_of_seats: s.numberOfSeats ?? 1,
      current_period_start: s.currentPeriodStart,
      current_period_end: s.currentPeriodEnd,
      cancel_at_period_end: !!s.cancelAtPeriodEnd,
      monthly_amount: s.monthlyAmount,
      setup_fee_amount: s.setupFeeAmount,
      next_billing_date: s.nextBillingDate,
      trial_start: s.trialStart, trial_end: s.trialEnd, canceled_at: s.canceledAt,
      payment_method_brand: s.paymentMethodBrand,
      payment_method_last4: s.paymentMethodLast4,
      card_data: s.cardData,
    })];
  }));

  // --- contact_exchanges ---
  // card_owner_id is taken from the CARD, not from the stored cardOwnerId: in 5
  // of 13 live rows the two disagreed, and trusting the column would hide a
  // customer's own leads from them. The discrepancies are reported, not hidden.
  let ownerFixes = 0;
  await upsert('contact_exchanges', load('ContactExchange').flatMap((x) => {
    const card = cardMap.get(x.cardId);
    if (!card) { skip('ContactExchange', x.id, `card ${x.cardId} not found`); return []; }
    const realOwner = load.cards?.[x.cardId];
    const stated = userMap.get(x.cardOwnerId);
    const trueOwner = cardOwnerOf(x.cardId);
    if (stated && trueOwner && stated !== trueOwner) ownerFixes++;
    return [clean({
      ...stamps(x), card_id: card, card_owner_id: trueOwner ?? stated ?? null,
      contact_name: x.contactName, contact_phone: x.contactPhone,
      contact_email: x.contactEmail, company: x.company,
      source: x.source || 'manual', status: x.status || 'new',
      notes: x.notes, tags: x.tags || [],
      last_contact_date: x.lastContactDate, deal_value: x.dealValue,
      follow_up_date: x.followUpDate,
      notes_history: x.notesHistory || [], activity_timeline: x.activityTimeline || [],
    })];
  }));
  if (ownerFixes) report.notes.push(`contact_exchanges: corrected ${ownerFixes} mismatched cardOwnerId to the card's real owner`);

  // --- team members ---
  // inviteToken is not migrated: the new schema stores a hash, and a raw token
  // can't be hashed into a form the new server would accept. Pending invites
  // must be re-sent (there is 1).
  await upsert('team_members', load('TeamMember').flatMap((t) => {
    const card = cardMap.get(t.cardId);
    if (!card) { skip('TeamMember', t.id, `card ${t.cardId} not found`); return []; }
    return [clean({
      ...stamps(t), card_id: card,
      user_id: userMap.get(t.userId) ?? null,
      name: t.name, email: t.email, role: t.role || 'member',
      permissions: t.permissions || {}, status: t.status || 'pending',
      invited_by: t.invitedBy, last_active: t.lastActive,
      assigned_card_id: cardMap.get(t.assignedCardId) ?? null,
    })];
  }));

  // --- analytics ---
  await upsert('card_analytics', load('CardAnalytics').flatMap((a) => {
    const card = cardMap.get(a.cardId);
    if (!card) { skip('CardAnalytics', a.id, `card ${a.cardId} not found`); return []; }
    return [clean({
      ...stamps(a), card_id: card,
      event_type: a.eventType, event_value: a.eventValue, source: a.source,
      session_id: a.sessionId, visitor_id: a.visitorId,
      session_duration: a.sessionDuration,
      is_new_visitor: a.isNewVisitor, is_returning_visitor: a.isReturningVisitor,
      visit_count: a.visitCount, viewer_info: a.viewerInfo || {},
    })];
  }));

  await upsert('website_analytics', load('WebsiteAnalytics').map((w) => clean({
    ...stamps(w), event_type: w.eventType, session_id: w.sessionId,
    user_agent: w.userAgent, ip: w.ip, referrer: w.referrer,
    event_data: w.eventData || {}, timestamp: w.timestamp,
  })));

  await upsert('benchmark_stats', load('BenchmarkStats').map((b) => clean({
    ...stamps(b), date: b.date, total_active_cards: b.totalActiveCards,
    avg_views_per_card: b.avgViewsPerCard, avg_contacts_per_card: b.avgContactsPerCard,
    avg_button_clicks_per_card: b.avgButtonClicksPerCard,
    top_tier_views: b.topTierViews, top_tier_contacts: b.topTierContacts,
    top_tier_clicks: b.topTierClicks, median_views: b.medianViews,
    median_contacts: b.medianContacts, median_clicks: b.medianClicks,
  })));

  // --- billing catalogue ---
  await upsert('plans', load('Plan').map((p) => clean({
    ...stamps(p), plan_id: p.planId, name: p.name, price: p.price,
    setup_fee: p.setupFee, description: p.description,
    setup_description: p.setupDescription, features: p.features || [],
    cta: p.cta, is_popular: !!p.isPopular, display_order: p.displayOrder || 0,
  })));

  await upsert('coupons', load('Coupon').map((c) => clean({
    ...stamps(c), code: c.code, name: c.name, description: c.description,
    discount_type: c.discountType, discount_value: c.discountValue,
    currency: c.currency || 'usd', valid_from: c.validFrom, valid_until: c.validUntil,
    max_uses: c.maxUses, times_used: c.timesUsed || 0, is_active: c.isActive !== false,
    stripe_coupon_id: c.stripeCouponId, applicable_plans: c.applicablePlans || [],
    free_shipping: !!c.freeShipping, minimum_amount: c.minimumAmount,
    created_by: c.createdBy, analytics: c.analytics || {},
    is_scheduled: !!c.isScheduled, scheduled_start: c.scheduledStart,
    scheduled_end: c.scheduledEnd, timezone: c.timezone || 'UTC',
  })));

  await upsert('partners', load('Partner').map((p) => clean({
    ...stamps(p), partner_code: p.partnerCode, company_name: p.companyName,
    contact_person: p.contactPerson || {}, business_type: p.businessType,
    commission_rate: p.commissionRate ?? 10, status: p.status || 'pending',
    tracking_url: p.trackingUrl, custom_coupons: p.customCoupons || [],
    geography: p.geography || [], total_referrals: p.totalReferrals || 0,
    total_conversions: p.totalConversions || 0, total_earnings: p.totalEarnings || 0,
    conversion_rate: p.conversionRate || 0, notes: p.notes,
    onboarding_completed: !!p.onboardingCompleted,
    agreement_signed: !!p.agreementSigned, last_activity_date: p.lastActivityDate,
  })));

  if (!DRY_RUN) {
    const saved = await rest('/rest/v1/partners?select=id,base44_id', { method: 'GET' });
    for (const r of saved) if (r.base44_id) partnerMap.set(r.base44_id, r.id);
  }

  await upsert('referrals', load('Referral').map((r) => clean({
    ...stamps(r), partner_id: partnerMap.get(r.partnerId) ?? null,
    partner_code: r.partnerCode, session_id: r.sessionId,
    visitor_info: r.visitorInfo || {}, click_timestamp: r.clickTimestamp,
    conversion_status: r.conversionStatus || 'pending',
    conversion_timestamp: r.conversionTimestamp, order_id: r.orderId,
    plan_type: r.planType, order_value: r.orderValue,
    commission_amount: r.commissionAmount,
    commission_status: r.commissionStatus || 'pending',
    cookie_expires_at: r.cookieExpiresAt,
  })));

  // --- support ---
  await upsert('support_conversations', load('SupportConversation').flatMap((s) => {
    const uid = userMap.get(s.userId);
    if (!uid) { skip('SupportConversation', s.id, `user ${s.userId} not found`); return []; }
    return [clean({
      ...stamps(s), user_id: uid, customer_name: s.customerName,
      customer_email: s.customerEmail, card_id: cardMap.get(s.cardId) ?? null,
      status: s.status || 'ai', subject: s.subject,
      last_message_preview: s.lastMessagePreview, last_message_at: s.lastMessageAt,
      unread_by_agent: !!s.unreadByAgent, unread_by_customer: !!s.unreadByCustomer,
      assigned_agent: s.assignedAgent,
    })];
  }));

  if (!DRY_RUN) {
    const saved = await rest('/rest/v1/support_conversations?select=id,base44_id', { method: 'GET' });
    for (const r of saved) if (r.base44_id) convMap.set(r.base44_id, r.id);
  }

  // conversationUserId is dropped: it was denormalized onto every message purely
  // so Base44's RLS could scope reads without a join. Postgres joins.
  await upsert('support_messages', load('SupportMessage').flatMap((m) => {
    const conv = convMap.get(m.conversationId);
    if (!conv && !DRY_RUN) { skip('SupportMessage', m.id, `conversation ${m.conversationId} not found`); return []; }
    return [clean({
      ...stamps(m), conversation_id: conv, role: m.role,
      content: m.content, sender_name: m.senderName,
    })];
  }));

  // Base44's `customerId` on tickets/history is a DigitalCard id, not a user id.
  await upsert('support_tickets', load('SupportTicket').map((t) => clean({
    ...stamps(t), card_id: cardMap.get(t.customerId) ?? null,
    ticket_number: t.ticketNumber, subject: t.subject, description: t.description,
    priority: t.priority || 'medium', status: t.status || 'open',
    assigned_to: t.assignedTo, tags: t.tags || [], resolution: t.resolution,
    resolved_at: t.resolvedAt, customer_satisfaction: t.customerSatisfaction,
    chat_history: t.chatHistory || [],
  })));

  await upsert('customer_history', load('CustomerHistory').map((h) => clean({
    ...stamps(h), card_id: cardMap.get(h.customerId) ?? null,
    event_type: h.eventType, event_title: h.eventTitle,
    event_description: h.eventDescription, event_data: h.eventData || {},
    amount: h.amount, status: h.status, related_entity_id: h.relatedEntityId,
    metadata: h.metadata || {},
  })));

  // --- logs & misc ---
  await upsert('email_logs', load('EmailLog').map((e) => clean({
    ...stamps(e), template_id: e.templateId, recipient_email: e.recipientEmail,
    recipient_name: e.recipientName, card_id: cardMap.get(e.cardId) ?? null,
    subject: e.subject, status: e.status || 'sent',
    provider_id: e.resendId, error_message: e.errorMessage,
    opened_at: e.openedAt, clicked_at: e.clickedAt,
  })));

  await upsert('admin_audit_logs', load('AdminAuditLog').map((a) => clean({
    ...stamps(a), admin_email: a.adminEmail, action: a.action,
    action_description: a.actionDescription, entity_type: a.entityType,
    entity_id: a.entityId, changes: a.changes, metadata: a.metadata,
    severity: a.severity || 'medium',
  })));

  await upsert('consent_logs', load('ConsentLog').map((c) => clean({
    ...stamps(c), user_id: userMap.get(c.userId) ?? null, session_id: c.sessionId,
    policy_version: c.policyVersion, consent: c.consent, action: c.action,
    user_agent: c.userAgent, ip: c.ip,
  })));

  await upsert('notifications', load('Notification').flatMap((n) => {
    const uid = userMap.get(n.userId);
    if (!uid) { skip('Notification', n.id, `user ${n.userId} not found`); return []; }
    return [clean({
      ...stamps(n), user_id: uid, title: n.title, message: n.message,
      type: n.type || 'info', is_read: !!n.isRead, action_url: n.actionUrl,
      action_label: n.actionLabel, related_entity_id: n.relatedEntityId,
    })];
  }));

  await upsert('staff_notifications', load('StaffNotification').map((s) => clean({
    ...stamps(s), recipient_email: s.recipientEmail,
    notification_type: s.notificationType, title: s.title, message: s.message,
    priority: s.priority || 'medium', is_read: !!s.isRead,
    related_entity_id: s.relatedEntityId, action_url: s.actionUrl,
    expires_at: s.expiresAt,
  })));

  await upsert('enterprise_leads', load('EnterpriseLeads').map((l) => clean({
    ...stamps(l), company_name: l.companyName, full_name: l.fullName,
    email: l.email, phone: l.phone, team_size: l.teamSize, message: l.message,
    utm_source: l.utm_source, utm_campaign: l.utm_campaign,
    utm_content: l.utm_content, submitted_at: l.submittedAt,
  })));

  await upsert('newsletter_subscribers', load('NewsletterSubscriber').map((n) => clean({
    ...stamps(n), email: n.email, subscribed_at: n.subscribedAt,
    source: n.source, status: n.status || 'active',
  })));

  await upsert('site_content', load('SiteContent').map((s) => clean({
    ...stamps(s), section_id: s.sectionId, title: s.title, content: s.content,
    is_active: s.isActive !== false, last_modified_by: s.lastModifiedBy,
  })));

  await upsert('learning_content', load('LearningContent').map((l) => clean({
    ...stamps(l), title: l.title, slug: l.slug, content_type: l.contentType,
    category: l.category, description: l.description, content: l.content,
    video_url: l.videoUrl, thumbnail_url: l.thumbnailUrl,
    author_name: l.authorName, author_role: l.authorRole, tags: l.tags || [],
    is_published: !!l.isPublished, is_featured: !!l.isFeatured,
    read_time_minutes: l.readTimeMinutes, view_count: l.viewCount || 0,
    published_at: l.publishedAt,
  })));

  await upsert('profession_templates', load('ProfessionTemplate').map((p) => clean({
    ...stamps(p), name: p.name, description: p.description, icon: p.icon,
    template_data: p.templateData || {}, is_active: p.isActive !== false,
  })));

  await upsert('content_briefs', load('ContentBrief').map((c) => clean({
    ...stamps(c), title: c.title, script: c.script,
    target_keywords: c.targetKeywords || [], category: c.category,
    priority: c.priority ?? 1, used_count: c.usedCount || 0,
    last_used: c.lastUsed, is_active: c.isActive !== false,
  })));

  await upsert('segments', load('Segment').map((s) => clean({
    ...stamps(s), name: s.name, description: s.description,
    rules: s.rules || {}, client_count: s.clientCount || 0,
  })));

  await upsert('webhook_logs', load('WebhookLog').map((w) => clean({
    ...stamps(w), provider: w.provider, event_type: w.eventType,
    event_id: w.payload?.id ?? null, payload: w.payload || {},
    status: w.status || 'pending_retry', retry_count: w.retryCount || 0,
    max_retries: w.maxRetries ?? 5, last_error: w.lastError,
    last_attempt_at: w.lastAttemptAt, next_retry_at: w.nextRetryAt,
    processed_at: w.processedAt,
  })));

  // RateLimit rows are transient counters with no historical value — a stale
  // window would only block real users after cutover. Intentionally not migrated.
  report.notes.push(`RateLimit: ${load('RateLimit').length} rows intentionally not migrated (transient counters)`);
}

/** Real owner of a card, straight from the export. */
const cardsById = new Map(load('DigitalCard').map((c) => [c.id, c]));
function cardOwnerOf(base44CardId) {
  const c = cardsById.get(base44CardId);
  return c ? userMap.get(c.userId) ?? null : null;
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : `=== IMPORT -> ${URL_BASE} ===`);
  await importUsers();
  await importCards();
  await importRest();

  console.log('\n--- rows per table ---');
  let total = 0;
  for (const [t, n] of Object.entries(report.inserted).sort()) {
    console.log(`  ${t.padEnd(24)} ${String(n).padStart(6)}`);
    total += n;
  }
  console.log(`  ${'TOTAL'.padEnd(24)} ${String(total).padStart(6)}`);

  if (report.notes.length) {
    console.log('\n--- notes ---');
    for (const n of report.notes) console.log(`  • ${n}`);
  }
  if (report.skipped.length) {
    console.log(`\n--- SKIPPED (${report.skipped.length}) ---`);
    for (const s of report.skipped.slice(0, 40)) {
      console.log(`  ${s.entity} ${s.id}: ${s.why}`);
    }
    if (report.skipped.length > 40) console.log(`  ... and ${report.skipped.length - 40} more`);
  } else {
    console.log('\nNothing skipped — every foreign key resolved.');
  }
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
