-- ============================================================================
-- DME migration — 0002_tables
-- The 30 Base44 entities as Postgres tables. Run AFTER 0001_foundation.sql.
--
-- Translation rules applied throughout:
--   * Base44's opaque string id           -> uuid primary key + base64_id text
--     (`base44_id` keeps the original so the data import can re-point foreign
--      keys deterministically instead of guessing, and gives a trail back.)
--   * created_date / updated_date         -> created_at / updated_at timestamptz
--   * nested objects and arrays-of-objects -> jsonb (mechanical, lossless)
--   * enums                                -> text + CHECK constraint
--     (CHECK over a Postgres ENUM type on purpose: adding a value later is a
--      one-line ALTER instead of a type migration, and Base44 data already
--      contains values outside the declared enums — see planType 'complete'.)
--   * relations that were bare id strings  -> real foreign keys
--
-- Every table is created IF NOT EXISTS so the file is safe to re-run.
-- RLS is enabled per-table here; the policies themselves live in 0003_rls.sql.
-- ============================================================================


-- ===========================================================================
-- CORE: cards
-- ===========================================================================

create table if not exists public.digital_cards (
    id                    uuid primary key default gen_random_uuid(),
    base44_id             text unique,
    user_id               uuid references public.app_users(id) on delete cascade,

    -- Team cards: a member's card points at the owning account's card.
    team_id               uuid references public.digital_cards(id) on delete set null,
    is_team_card          boolean not null default false,

    slug                  text not null unique,
    slug_confirmed        boolean not null default false,

    bundle_type           text not null default 'digitalPhysical'
                          check (bundle_type in ('digitalOnly','digitalPhysical')),
    status                text not null default 'design_pending'
                          check (status in ('design_pending','in_design','production',
                                            'shipping_pending','shipped','arrived','active',
                                            'on_hold','frozen','pending_deletion')),
    account_status        text not null default 'active'
                          check (account_status in ('active','frozen','pending_deletion')),
    subscription_status   text check (subscription_status in ('active','trialing','past_due',
                                            'unpaid','canceled','incomplete',
                                            'incomplete_expired','paused')),

    scheduled_for_deletion_at timestamptz,
    cancellation_reason   text,

    -- Identity / content
    full_name             text not null,
    job_title             text,
    company_name          text,
    bio                   text,
    logo_image_url        text,
    cover_image_url       text,
    contact_info          jsonb not null default '{}'::jsonb,
    action_buttons        jsonb not null default '[]'::jsonb,
    action_button_clicks  jsonb not null default '[]'::jsonb,
    design_settings       jsonb not null default '{}'::jsonb,
    qr_style              jsonb not null default '{}'::jsonb,
    business_hours        jsonb not null default '{}'::jsonb,
    gallery_image_urls    jsonb not null default '[]'::jsonb,
    faq                   jsonb not null default '[]'::jsonb,
    documents             jsonb not null default '[]'::jsonb,
    video_embeds          jsonb not null default '[]'::jsonb,
    tracking_pixels       jsonb not null default '[]'::jsonb,
    embed_codes           text,

    -- Funnel / commercial
    form_completed        boolean not null default false,
    form_completed_at     timestamptz,
    shipping_address      jsonb,
    signature_data        text,
    plan_type             text,
    health_score          numeric,
    segments              jsonb not null default '[]'::jsonb,
    exchange_contact_enabled boolean not null default false,
    marketing_consent     boolean not null default false,
    marketing_consent_at  timestamptz,

    -- Counters. Incremented with `set x = x + 1` in SQL, never read-then-write:
    -- the Base44 version lost concurrent events (this is a fixed bug, not a port).
    total_contacts_saved  integer not null default 0,
    total_views           integer not null default 0,

    custom_status_definitions jsonb not null default '[]'::jsonb,
    custom_source_definitions jsonb not null default '[]'::jsonb,

    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index if not exists digital_cards_user_idx   on public.digital_cards (user_id);
create index if not exists digital_cards_team_idx   on public.digital_cards (team_id);
create index if not exists digital_cards_status_idx on public.digital_cards (status);
create index if not exists digital_cards_slug_trgm  on public.digital_cards using gin (slug gin_trgm_ops);

drop trigger if exists trg_digital_cards_updated on public.digital_cards;
create trigger trg_digital_cards_updated before update on public.digital_cards
    for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Magic-link tokens live in their OWN table, not on digital_cards.
-- On Base44 `loginToken` sat on the card, whose RLS was read:true — meaning any
-- anonymous reader could harvest live login tokens and take over accounts. That
-- was the single worst finding of the audit and could not be fixed there.
-- Here the client never has any policy granting select, so tokens are reachable
-- only through the service role (i.e. server-side functions).
-- ---------------------------------------------------------------------------
create table if not exists public.card_login_tokens (
    id          uuid primary key default gen_random_uuid(),
    card_id     uuid not null references public.digital_cards(id) on delete cascade,
    token_hash  text not null,            -- store a hash, never the raw token
    expires_at  timestamptz not null,
    used_at     timestamptz,
    created_at  timestamptz not null default now()
);

create index if not exists card_login_tokens_card_idx on public.card_login_tokens (card_id);
create unique index if not exists card_login_tokens_hash_idx on public.card_login_tokens (token_hash);


-- ===========================================================================
-- BILLING
-- ===========================================================================

create table if not exists public.plans (
    id                uuid primary key default gen_random_uuid(),
    base44_id         text unique,
    plan_id           text not null unique,      -- 'basic' | 'pro' | 'all-included' ...
    name              text not null,
    price             numeric not null,          -- monthly, dollars
    setup_fee         numeric not null,          -- one-time, dollars
    description       text,
    setup_description text,
    features          jsonb not null default '[]'::jsonb,
    cta               text not null,
    is_popular        boolean not null default false,
    display_order     integer not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create table if not exists public.subscriptions (
    id                       uuid primary key default gen_random_uuid(),
    base44_id                text unique,
    user_id                  uuid not null references public.app_users(id) on delete cascade,
    stripe_subscription_id   text unique,
    stripe_customer_id       text,
    -- No CHECK on plan_type: live data already holds values outside the Base44
    -- enum (e.g. 'complete'). A constraint here would reject real rows on import.
    plan_type                text not null,
    status                   text not null default 'trialing'
                             check (status in ('active','trialing','canceled','past_due',
                                               'unpaid','incomplete','incomplete_expired','paused')),
    number_of_seats          integer not null default 1,
    current_period_start     timestamptz,
    current_period_end       timestamptz,
    cancel_at_period_end     boolean not null default false,
    monthly_amount           integer,   -- cents
    setup_fee_amount         integer,   -- cents
    next_billing_date        timestamptz,
    trial_start              timestamptz,
    trial_end                timestamptz,
    canceled_at              timestamptz,
    payment_method_brand     text,
    payment_method_last4     text,
    card_data                jsonb,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_user_idx   on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated before update on public.subscriptions
    for each row execute function public.touch_updated_at();

create table if not exists public.coupons (
    id                uuid primary key default gen_random_uuid(),
    base44_id         text unique,
    code              text not null unique,
    name              text not null,
    description       text,
    discount_type     text not null check (discount_type in ('percentage','fixed_amount','free_shipping')),
    discount_value    numeric,
    currency          text not null default 'usd',
    valid_from        timestamptz,
    valid_until       timestamptz,
    max_uses          integer,
    times_used        integer not null default 0,
    is_active         boolean not null default true,
    stripe_coupon_id  text,
    applicable_plans  jsonb not null default '[]'::jsonb,
    free_shipping     boolean not null default false,
    minimum_amount    integer,
    created_by        text,
    analytics         jsonb not null default '{}'::jsonb,
    is_scheduled      boolean not null default false,
    scheduled_start   timestamptz,
    scheduled_end     timestamptz,
    timezone          text not null default 'UTC',
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

drop trigger if exists trg_coupons_updated on public.coupons;
create trigger trg_coupons_updated before update on public.coupons
    for each row execute function public.touch_updated_at();

create table if not exists public.partners (
    id                    uuid primary key default gen_random_uuid(),
    base44_id             text unique,
    partner_code          text not null unique,
    company_name          text not null,
    contact_person        jsonb not null default '{}'::jsonb,
    business_type         text check (business_type in ('networking_events','sales_agency',
                                                        'marketing_firm','consulting','other')),
    commission_rate       numeric not null default 10,
    status                text not null default 'pending'
                          check (status in ('active','pending','suspended','inactive')),
    tracking_url          text,
    custom_coupons        jsonb not null default '[]'::jsonb,
    geography             jsonb not null default '[]'::jsonb,
    total_referrals       integer not null default 0,
    total_conversions     integer not null default 0,
    total_earnings        integer not null default 0,   -- cents
    conversion_rate       numeric not null default 0,
    notes                 text,
    onboarding_completed  boolean not null default false,
    agreement_signed      boolean not null default false,
    last_activity_date    timestamptz,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

drop trigger if exists trg_partners_updated on public.partners;
create trigger trg_partners_updated before update on public.partners
    for each row execute function public.touch_updated_at();

create table if not exists public.referrals (
    id                     uuid primary key default gen_random_uuid(),
    base44_id              text unique,
    partner_id             uuid references public.partners(id) on delete cascade,
    partner_code           text not null,
    session_id             text not null,
    visitor_info           jsonb not null default '{}'::jsonb,
    click_timestamp        timestamptz,
    conversion_status      text not null default 'pending'
                           check (conversion_status in ('pending','converted','abandoned')),
    conversion_timestamp   timestamptz,
    order_id               text,
    plan_type              text,
    order_value            integer,   -- cents
    commission_amount      integer,   -- cents
    commission_status      text not null default 'pending'
                           check (commission_status in ('pending','approved','paid','cancelled')),
    cookie_expires_at      timestamptz,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

create index if not exists referrals_partner_idx on public.referrals (partner_id);


-- ===========================================================================
-- LEADS / CRM
-- ===========================================================================

-- Base44 stored BOTH cardId and cardOwnerId here, and in 5 of 13 live rows the
-- two disagreed. Ownership is therefore derived from the card relation only
-- (card_id -> digital_cards.user_id); card_owner_id is kept for reference but
-- is never the basis for access control. See 0003_rls.sql.
create table if not exists public.contact_exchanges (
    id                 uuid primary key default gen_random_uuid(),
    base44_id          text unique,
    card_id            uuid not null references public.digital_cards(id) on delete cascade,
    card_owner_id      uuid references public.app_users(id) on delete set null,
    contact_name       text not null,
    contact_phone      text not null,
    contact_email      text,
    company            text,
    source             text not null default 'manual' check (source in ('manual','card_form')),
    status             text not null default 'new'
                       check (status in ('new','contacted','qualified','proposal',
                                         'negotiation','won','lost')),
    notes              text,
    tags               jsonb not null default '[]'::jsonb,
    last_contact_date  timestamptz,
    deal_value         numeric,
    follow_up_date     timestamptz,
    notes_history      jsonb not null default '[]'::jsonb,
    activity_timeline  jsonb not null default '[]'::jsonb,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index if not exists contact_exchanges_card_idx   on public.contact_exchanges (card_id);
create index if not exists contact_exchanges_status_idx on public.contact_exchanges (status);

drop trigger if exists trg_contact_exchanges_updated on public.contact_exchanges;
create trigger trg_contact_exchanges_updated before update on public.contact_exchanges
    for each row execute function public.touch_updated_at();

create table if not exists public.enterprise_leads (
    id            uuid primary key default gen_random_uuid(),
    base44_id     text unique,
    company_name  text not null,
    full_name     text not null,
    email         text not null,
    phone         text not null,
    team_size     text,
    message       text,
    utm_source    text,
    utm_campaign  text,
    utm_content   text,
    submitted_at  timestamptz,
    created_at    timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
    id             uuid primary key default gen_random_uuid(),
    base44_id      text unique,
    email          text not null unique,
    subscribed_at  timestamptz,
    source         text,
    status         text not null default 'active' check (status in ('active','unsubscribed')),
    created_at     timestamptz not null default now()
);


-- ===========================================================================
-- TEAM
-- ===========================================================================

-- Base44 RLS was {create:true, read:true, update:true} — any logged-in user
-- could promote themselves to owner, overwrite `permissions`, or insert
-- themselves as admin on someone else's card, and invite tokens were world
-- readable. 0003_rls.sql scopes every operation to the owning card.
create table if not exists public.team_members (
    id                uuid primary key default gen_random_uuid(),
    base44_id         text unique,
    card_id           uuid not null references public.digital_cards(id) on delete cascade,
    user_id           uuid references public.app_users(id) on delete set null,
    name              text,
    email             text not null,
    role              text not null default 'member'
                      check (role in ('owner','admin','editor','viewer','member')),
    permissions       jsonb not null default '{}'::jsonb,
    status            text not null default 'pending'
                      check (status in ('pending','active','inactive')),
    invited_by        text,
    invite_token_hash text,          -- hashed, and never selectable by clients
    invite_expires_at timestamptz,
    last_active       timestamptz,
    assigned_card_id  uuid references public.digital_cards(id) on delete set null,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists team_members_card_idx on public.team_members (card_id);
create index if not exists team_members_user_idx on public.team_members (user_id);

drop trigger if exists trg_team_members_updated on public.team_members;
create trigger trg_team_members_updated before update on public.team_members
    for each row execute function public.touch_updated_at();


-- ===========================================================================
-- ANALYTICS
-- ===========================================================================

-- Highest-volume table. The composite index matches the dashboard's actual
-- query shape (one card, a date window, grouped by event type) so aggregation
-- happens in SQL instead of pulling up to 50k rows into JS as Base44 required.
create table if not exists public.card_analytics (
    id                    uuid primary key default gen_random_uuid(),
    base44_id             text unique,
    card_id               uuid not null references public.digital_cards(id) on delete cascade,
    event_type            text not null check (event_type in ('page_view','vcard_download','action_button_click')),
    event_value           text,
    source                text,
    session_id            text not null,
    visitor_id            text not null,
    session_duration      integer,
    is_new_visitor        boolean,
    is_returning_visitor  boolean,
    visit_count           integer,
    viewer_info           jsonb not null default '{}'::jsonb,
    created_at            timestamptz not null default now()
);

create index if not exists card_analytics_card_time_idx
    on public.card_analytics (card_id, created_at desc, event_type);
create index if not exists card_analytics_visitor_idx on public.card_analytics (visitor_id);

create table if not exists public.website_analytics (
    id          uuid primary key default gen_random_uuid(),
    base44_id   text unique,
    event_type  text not null check (event_type in ('page_visit','pricing_click','checkout_start',
                                                    'checkout_abandon','purchase_complete')),
    session_id  text not null,
    user_agent  text,
    ip          text,
    referrer    text,
    event_data  jsonb not null default '{}'::jsonb,
    timestamp   timestamptz,
    created_at  timestamptz not null default now()
);

create index if not exists website_analytics_type_time_idx
    on public.website_analytics (event_type, created_at desc);
create index if not exists website_analytics_session_idx on public.website_analytics (session_id);

create table if not exists public.benchmark_stats (
    id                        uuid primary key default gen_random_uuid(),
    base44_id                 text unique,
    date                      date not null,
    total_active_cards        integer not null,
    avg_views_per_card        numeric,
    avg_contacts_per_card     numeric,
    avg_button_clicks_per_card numeric,
    top_tier_views            numeric,
    top_tier_contacts         numeric,
    top_tier_clicks           numeric,
    median_views              numeric,
    median_contacts           numeric,
    median_clicks             numeric,
    created_at                timestamptz not null default now()
);

create unique index if not exists benchmark_stats_date_idx on public.benchmark_stats (date);


-- ===========================================================================
-- SUPPORT
-- ===========================================================================

create table if not exists public.support_conversations (
    id                   uuid primary key default gen_random_uuid(),
    base44_id            text unique,
    user_id              uuid not null references public.app_users(id) on delete cascade,
    customer_name        text,
    customer_email       text,
    card_id              uuid references public.digital_cards(id) on delete set null,
    status               text not null default 'ai'
                         check (status in ('ai','waiting_agent','agent_active','resolved')),
    subject              text,
    last_message_preview text,
    last_message_at      timestamptz,
    unread_by_agent      boolean not null default false,
    unread_by_customer   boolean not null default false,
    assigned_agent       text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create index if not exists support_conversations_user_idx on public.support_conversations (user_id);

drop trigger if exists trg_support_conversations_updated on public.support_conversations;
create trigger trg_support_conversations_updated before update on public.support_conversations
    for each row execute function public.touch_updated_at();

create table if not exists public.support_messages (
    id               uuid primary key default gen_random_uuid(),
    base44_id        text unique,
    conversation_id  uuid not null references public.support_conversations(id) on delete cascade,
    role             text not null check (role in ('customer','ai','agent','system')),
    content          text not null,
    sender_name      text,
    created_at       timestamptz not null default now()
);

create index if not exists support_messages_conv_idx on public.support_messages (conversation_id, created_at);

create table if not exists public.support_tickets (
    id                     uuid primary key default gen_random_uuid(),
    base44_id              text unique,
    card_id                uuid references public.digital_cards(id) on delete cascade,
    ticket_number          text unique,
    subject                text not null,
    description            text not null,
    priority               text not null default 'medium' check (priority in ('low','medium','high','urgent')),
    status                 text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
    assigned_to            text,
    tags                   jsonb not null default '[]'::jsonb,
    resolution             text,
    resolved_at            timestamptz,
    customer_satisfaction  integer check (customer_satisfaction between 1 and 5),
    chat_history           jsonb not null default '[]'::jsonb,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

create index if not exists support_tickets_card_idx on public.support_tickets (card_id);


-- ===========================================================================
-- NOTIFICATIONS / LOGS
-- ===========================================================================

create table if not exists public.notifications (
    id                 uuid primary key default gen_random_uuid(),
    base44_id          text unique,
    user_id            uuid not null references public.app_users(id) on delete cascade,
    title              text not null,
    message            text not null,
    type               text not null default 'info'
                       check (type in ('info','success','warning','error','contact','system')),
    is_read            boolean not null default false,
    action_url         text,
    action_label       text,
    related_entity_id  text,
    created_at         timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, is_read);

create table if not exists public.staff_notifications (
    id                 uuid primary key default gen_random_uuid(),
    base44_id          text unique,
    recipient_email    text not null,
    notification_type  text not null check (notification_type in ('new_production_item','shipping_reminder',
                                                                  'urgent_order','system_alert')),
    title              text not null,
    message            text not null,
    priority           text not null default 'medium' check (priority in ('low','medium','high','urgent')),
    is_read            boolean not null default false,
    related_entity_id  text,
    action_url         text,
    expires_at         timestamptz,
    created_at         timestamptz not null default now()
);

create table if not exists public.customer_history (
    id                 uuid primary key default gen_random_uuid(),
    base44_id          text unique,
    card_id            uuid references public.digital_cards(id) on delete cascade,
    event_type         text not null,
    event_title        text not null,
    event_description  text,
    event_data         jsonb not null default '{}'::jsonb,
    amount             numeric,
    status             text check (status in ('completed','pending','failed','cancelled')),
    related_entity_id  text,
    metadata           jsonb not null default '{}'::jsonb,
    created_at         timestamptz not null default now()
);

create index if not exists customer_history_card_idx on public.customer_history (card_id, created_at desc);

create table if not exists public.email_logs (
    id               uuid primary key default gen_random_uuid(),
    base44_id        text unique,
    template_id      text not null,
    recipient_email  text not null,
    recipient_name   text,
    card_id          uuid references public.digital_cards(id) on delete set null,
    subject          text,
    status           text not null default 'sent'
                     check (status in ('sent','failed','opened','clicked','bounced')),
    provider_id      text,          -- was resendId; provider-agnostic (Klaviyo now)
    error_message    text,
    opened_at        timestamptz,
    clicked_at       timestamptz,
    created_at       timestamptz not null default now()
);

create index if not exists email_logs_recipient_idx on public.email_logs (lower(recipient_email));
create index if not exists email_logs_created_idx   on public.email_logs (created_at desc);

create table if not exists public.admin_audit_logs (
    id                  uuid primary key default gen_random_uuid(),
    base44_id           text unique,
    admin_email         text not null,
    action              text not null,
    action_description  text not null,
    entity_type         text,
    entity_id           text,
    changes             jsonb,
    metadata            jsonb,
    severity            text not null default 'medium' check (severity in ('low','medium','high','critical')),
    created_at          timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

create table if not exists public.consent_logs (
    id              uuid primary key default gen_random_uuid(),
    base44_id       text unique,
    user_id         uuid references public.app_users(id) on delete set null,
    session_id      text not null,
    policy_version  integer,
    consent         jsonb not null,
    action          text not null check (action in ('accept_all','reject_all','custom','updated')),
    user_agent      text,
    ip              text,
    created_at      timestamptz not null default now()
);

create table if not exists public.webhook_logs (
    id               uuid primary key default gen_random_uuid(),
    base44_id        text unique,
    provider         text not null check (provider in ('stripe','google_wallet','apple_wallet','other')),
    event_type       text not null,
    -- Stripe redelivers events; this makes double-processing impossible at the
    -- database level rather than relying on application-side bookkeeping.
    event_id         text unique,
    payload          jsonb not null,
    status           text not null default 'pending_retry'
                     check (status in ('success','pending_retry','failed')),
    retry_count      integer not null default 0,
    max_retries      integer not null default 5,
    last_error       text,
    last_attempt_at  timestamptz,
    next_retry_at    timestamptz,
    processed_at     timestamptz,
    created_at       timestamptz not null default now()
);

create index if not exists webhook_logs_status_idx on public.webhook_logs (status, next_retry_at);

create table if not exists public.rate_limits (
    id             uuid primary key default gen_random_uuid(),
    key            text not null unique,
    count          integer not null default 1,
    window_start   timestamptz,
    last_attempt   timestamptz,
    blocked_until  timestamptz,
    created_at     timestamptz not null default now()
);


-- ===========================================================================
-- CONTENT / CONFIG
-- ===========================================================================

create table if not exists public.site_content (
    id                uuid primary key default gen_random_uuid(),
    base44_id         text unique,
    section_id        text not null unique,
    title             text not null,
    content           jsonb not null,
    is_active         boolean not null default true,
    last_modified_by  text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

drop trigger if exists trg_site_content_updated on public.site_content;
create trigger trg_site_content_updated before update on public.site_content
    for each row execute function public.touch_updated_at();

create table if not exists public.learning_content (
    id                 uuid primary key default gen_random_uuid(),
    base44_id          text unique,
    title              text not null,
    slug               text not null unique,
    content_type       text not null check (content_type in ('article','video','guide')),
    category           text not null,
    description        text,
    content            text,
    video_url          text,
    thumbnail_url      text,
    author_name        text,
    author_role        text,
    tags               jsonb not null default '[]'::jsonb,
    is_published       boolean not null default false,
    is_featured        boolean not null default false,
    read_time_minutes  integer,
    view_count         integer not null default 0,
    published_at       timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create table if not exists public.profession_templates (
    id             uuid primary key default gen_random_uuid(),
    base44_id      text unique,
    name           text not null,
    description    text,
    icon           text,
    template_data  jsonb not null,
    is_active      boolean not null default true,
    created_at     timestamptz not null default now()
);

create table if not exists public.content_briefs (
    id                uuid primary key default gen_random_uuid(),
    base44_id         text unique,
    title             text not null,
    script            text not null,
    target_keywords   jsonb not null default '[]'::jsonb,
    category          text,
    priority          integer not null default 1,
    used_count        integer not null default 0,
    last_used         timestamptz,
    is_active         boolean not null default true,
    created_at        timestamptz not null default now()
);

create table if not exists public.segments (
    id            uuid primary key default gen_random_uuid(),
    base44_id     text unique,
    name          text not null,
    description   text,
    rules         jsonb not null,
    client_count  integer not null default 0,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);


-- ===========================================================================
-- Enable RLS everywhere. With RLS on and no policy, a table denies all client
-- access by default — so a table accidentally left out of 0003_rls.sql fails
-- closed (invisible) rather than open (world-readable, the Base44 failure mode).
-- The service role bypasses RLS and is what server-side functions use.
-- ===========================================================================
do $$
declare t text;
begin
    foreach t in array array[
        'digital_cards','card_login_tokens','plans','subscriptions','coupons','partners',
        'referrals','contact_exchanges','enterprise_leads','newsletter_subscribers',
        'team_members','card_analytics','website_analytics','benchmark_stats',
        'support_conversations','support_messages','support_tickets','notifications',
        'staff_notifications','customer_history','email_logs','admin_audit_logs',
        'consent_logs','webhook_logs','rate_limits','site_content','learning_content',
        'profession_templates','content_briefs','segments'
    ] loop
        execute format('alter table public.%I enable row level security', t);
    end loop;
end $$;
