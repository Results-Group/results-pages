-- ============================================================================
-- DME migration — 0003_rls
-- Row-level security policies. Run AFTER 0002_tables.sql.
--
-- This file is the security boundary. On Base44 four entities shipped with
-- `read: true` / `update: true`, which meant "any caller, including anonymous".
-- That is what leaked login tokens, lead PII and visitor IPs, and what let any
-- logged-in user promote themselves inside someone else's team. Those holes are
-- closed here — they were deliberately left for the migration because the fix
-- belongs in the database, not in application checks that can be bypassed by
-- talking to the data API directly.
--
-- Model:
--   anon           -> only what the public card page genuinely needs
--   authenticated  -> strictly own rows, ownership derived from real relations
--   admin          -> everything, via public.is_admin()
--   service_role   -> bypasses RLS entirely; server-side functions use it
--
-- A table with RLS enabled and NO policy denies all client access. That is the
-- intended state for secrets (card_login_tokens, rate_limits, webhook_logs).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Helper: is the current user on this card's team (any role)?
-- SECURITY DEFINER so the policy on digital_cards can consult team_members
-- without the caller needing select on it — and so the two tables' policies
-- can't recurse into each other.
-- ---------------------------------------------------------------------------
create or replace function public.is_team_member_of(card uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
    select exists (
        select 1 from public.team_members tm
        where tm.card_id = card
          and tm.user_id = auth.uid()
          and tm.status = 'active'
    );
$$;

-- Can the current user edit this card? Owner, an editing team role, or admin.
create or replace function public.can_edit_card(card uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
    select public.is_admin()
        or public.owns_card(card)
        or exists (
            select 1 from public.team_members tm
            where tm.card_id = card
              and tm.user_id = auth.uid()
              and tm.status = 'active'
              and tm.role in ('owner','admin','editor')
        );
$$;


-- ===========================================================================
-- digital_cards
--
-- The public card page must work for anonymous visitors, but the row holds
-- private data (contact email, shipping address, tracking pixels, embed codes).
-- RLS is row-level, not column-level, so anonymous access is served by a
-- dedicated VIEW exposing only display fields. The base table stays private.
-- ===========================================================================

drop policy if exists digital_cards_select on public.digital_cards;
create policy digital_cards_select on public.digital_cards
    for select to authenticated
    using (user_id = auth.uid() or public.is_admin() or public.is_team_member_of(id));

drop policy if exists digital_cards_insert on public.digital_cards;
create policy digital_cards_insert on public.digital_cards
    for insert to authenticated
    with check (user_id = auth.uid() or public.is_admin());

drop policy if exists digital_cards_update on public.digital_cards;
create policy digital_cards_update on public.digital_cards
    for update to authenticated
    using (public.can_edit_card(id))
    with check (public.can_edit_card(id));

drop policy if exists digital_cards_delete on public.digital_cards;
create policy digital_cards_delete on public.digital_cards
    for delete to authenticated
    using (user_id = auth.uid() or public.is_admin());

-- The anonymous surface: display fields only, and only for cards that are
-- actually live. `account_status` is checked alongside `status` because a
-- removed team member's card is frozen via account_status — checking only
-- `status` was a real hole (a frozen card kept serving publicly).
create or replace view public.public_cards as
select
    c.id,
    c.slug,
    c.full_name,
    c.job_title,
    c.company_name,
    c.bio,
    c.logo_image_url,
    c.cover_image_url,
    c.contact_info,
    c.action_buttons,
    c.design_settings,
    c.qr_style,
    c.business_hours,
    c.gallery_image_urls,
    c.faq,
    c.documents,
    c.video_embeds,
    c.tracking_pixels,
    c.exchange_contact_enabled,
    c.custom_status_definitions,
    c.custom_source_definitions
from public.digital_cards c
where c.account_status = 'active'
  and c.status not in ('frozen','pending_deletion','on_hold');

-- The view is owned by the migration role, so it reads the base table without
-- triggering its RLS — that is exactly why only safe columns are listed above.
grant select on public.public_cards to anon, authenticated;


-- ===========================================================================
-- card_login_tokens — NO policies on purpose.
-- Reachable only via service_role, i.e. server-side auth code. On Base44 this
-- data lived on the card under `read: true`; harvesting it was account
-- takeover. Nothing client-side should ever select it again.
-- ===========================================================================


-- ===========================================================================
-- contact_exchanges (lead PII)
-- Was create/read/update/delete = true: every lead in the system was readable
-- and deletable by anyone. Ownership now comes from the card relation, NOT from
-- card_owner_id — in 5 of 13 live rows that column disagreed with the card's
-- real owner, so trusting it would have hidden leads from their actual owner.
-- ===========================================================================

drop policy if exists contact_exchanges_select on public.contact_exchanges;
create policy contact_exchanges_select on public.contact_exchanges
    for select to authenticated
    using (public.owns_card(card_id) or public.is_admin() or public.is_team_member_of(card_id));

-- The public "exchange contact" form posts as an anonymous visitor, so insert
-- stays open — but only onto a card that is actually live and has the feature
-- enabled, which the subquery enforces.
drop policy if exists contact_exchanges_insert on public.contact_exchanges;
create policy contact_exchanges_insert on public.contact_exchanges
    for insert to anon, authenticated
    with check (
        exists (
            select 1 from public.digital_cards c
            where c.id = card_id
              and c.account_status = 'active'
              and c.exchange_contact_enabled = true
        )
    );

drop policy if exists contact_exchanges_update on public.contact_exchanges;
create policy contact_exchanges_update on public.contact_exchanges
    for update to authenticated
    using (public.owns_card(card_id) or public.is_admin() or public.is_team_member_of(card_id))
    with check (public.owns_card(card_id) or public.is_admin() or public.is_team_member_of(card_id));

drop policy if exists contact_exchanges_delete on public.contact_exchanges;
create policy contact_exchanges_delete on public.contact_exchanges
    for delete to authenticated
    using (public.owns_card(card_id) or public.is_admin());


-- ===========================================================================
-- card_analytics
-- Was read: true — which exposed every visitor's IP address. Writes stay open
-- (the tracker runs on the public page); reads are owner/admin only.
-- ===========================================================================

drop policy if exists card_analytics_insert on public.card_analytics;
create policy card_analytics_insert on public.card_analytics
    for insert to anon, authenticated
    with check (exists (select 1 from public.digital_cards c where c.id = card_id));

drop policy if exists card_analytics_select on public.card_analytics;
create policy card_analytics_select on public.card_analytics
    for select to authenticated
    using (public.owns_card(card_id) or public.is_admin() or public.is_team_member_of(card_id));


-- ===========================================================================
-- team_members
-- Was create/read/update = true. Any logged-in user could set role='owner' on
-- their own row, rewrite `permissions`, or insert themselves onto a stranger's
-- card — and invite tokens were world-readable. Everything is now scoped to the
-- card's owner; members may read their own row only.
-- ===========================================================================

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
    for select to authenticated
    using (public.owns_card(card_id) or public.is_admin() or user_id = auth.uid());

drop policy if exists team_members_insert on public.team_members;
create policy team_members_insert on public.team_members
    for insert to authenticated
    with check (public.owns_card(card_id) or public.is_admin());

-- Only the card owner may change a membership. Accepting an invitation is NOT
-- done here — it runs server-side (service_role) after the token is verified,
-- so a user can never self-activate or self-promote by writing this row.
drop policy if exists team_members_update on public.team_members;
create policy team_members_update on public.team_members
    for update to authenticated
    using (public.owns_card(card_id) or public.is_admin())
    with check (public.owns_card(card_id) or public.is_admin());

drop policy if exists team_members_delete on public.team_members;
create policy team_members_delete on public.team_members
    for delete to authenticated
    using (public.owns_card(card_id) or public.is_admin());


-- ===========================================================================
-- subscriptions — own rows only. Writes are server-side (Stripe webhook), so
-- clients get read access only; letting a client write here would let them
-- grant themselves a plan.
-- ===========================================================================

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
    for select to authenticated
    using (user_id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_admin_write on public.subscriptions;
create policy subscriptions_admin_write on public.subscriptions
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());


-- ===========================================================================
-- support
-- ===========================================================================

drop policy if exists support_conversations_own on public.support_conversations;
create policy support_conversations_own on public.support_conversations
    for all to authenticated
    using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());

-- Message access follows the parent conversation, so a message can never be
-- read by anyone who can't read the thread it belongs to.
drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
    for select to authenticated
    using (
        public.is_admin()
        or exists (
            select 1 from public.support_conversations sc
            where sc.id = conversation_id and sc.user_id = auth.uid()
        )
    );

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
    for insert to authenticated
    with check (
        public.is_admin()
        or exists (
            select 1 from public.support_conversations sc
            where sc.id = conversation_id and sc.user_id = auth.uid()
        )
    );

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
    for select to authenticated
    using (public.owns_card(card_id) or public.is_admin());

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
    for insert to authenticated
    with check (public.owns_card(card_id) or public.is_admin());

drop policy if exists support_tickets_admin on public.support_tickets;
create policy support_tickets_admin on public.support_tickets
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());


-- ===========================================================================
-- notifications — strictly personal
-- ===========================================================================

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
    for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
    for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_own_delete on public.notifications;
create policy notifications_own_delete on public.notifications
    for delete to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists staff_notifications_read on public.staff_notifications;
create policy staff_notifications_read on public.staff_notifications
    for select to authenticated
    using (
        public.is_admin()
        or recipient_email = (select email from public.app_users where id = auth.uid())
    );


-- ===========================================================================
-- customer_history — the card's own timeline
-- ===========================================================================

drop policy if exists customer_history_select on public.customer_history;
create policy customer_history_select on public.customer_history
    for select to authenticated
    using (public.owns_card(card_id) or public.is_admin());

drop policy if exists customer_history_admin on public.customer_history;
create policy customer_history_admin on public.customer_history
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());


-- ===========================================================================
-- Public catalogue data: readable by everyone, writable by admins only.
-- ===========================================================================

do $$
declare t text;
begin
    foreach t in array array['plans','site_content','learning_content',
                             'profession_templates','benchmark_stats'] loop
        execute format('drop policy if exists %I_public_read on public.%I', t, t);
        execute format(
            'create policy %I_public_read on public.%I for select to anon, authenticated using (true)', t, t);
        execute format('drop policy if exists %I_admin_write on public.%I', t, t);
        execute format(
            'create policy %I_admin_write on public.%I for all to authenticated
             using (public.is_admin()) with check (public.is_admin())', t, t);
    end loop;
end $$;

-- Coupons: only ACTIVE ones are visible, and only to signed-in users. Base44
-- exposed the whole row anonymously, including stripeCouponId — an oracle that
-- let anyone enumerate valid discounts. Validation belongs server-side.
drop policy if exists coupons_read_active on public.coupons;
create policy coupons_read_active on public.coupons
    for select to authenticated
    using (is_active = true or public.is_admin());

drop policy if exists coupons_admin_write on public.coupons;
create policy coupons_admin_write on public.coupons
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());


-- ===========================================================================
-- Public write-only intake: a visitor may submit, but never read back.
-- ===========================================================================

drop policy if exists enterprise_leads_insert on public.enterprise_leads;
create policy enterprise_leads_insert on public.enterprise_leads
    for insert to anon, authenticated with check (true);

drop policy if exists enterprise_leads_admin on public.enterprise_leads;
create policy enterprise_leads_admin on public.enterprise_leads
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

drop policy if exists newsletter_insert on public.newsletter_subscribers;
create policy newsletter_insert on public.newsletter_subscribers
    for insert to anon, authenticated with check (true);

drop policy if exists newsletter_admin on public.newsletter_subscribers;
create policy newsletter_admin on public.newsletter_subscribers
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

drop policy if exists consent_logs_insert on public.consent_logs;
create policy consent_logs_insert on public.consent_logs
    for insert to anon, authenticated with check (true);

drop policy if exists consent_logs_admin on public.consent_logs;
create policy consent_logs_admin on public.consent_logs
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

drop policy if exists website_analytics_insert on public.website_analytics;
create policy website_analytics_insert on public.website_analytics
    for insert to anon, authenticated with check (true);

drop policy if exists website_analytics_admin on public.website_analytics;
create policy website_analytics_admin on public.website_analytics
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());


-- ===========================================================================
-- Admin-only surfaces.
-- ===========================================================================

do $$
declare t text;
begin
    foreach t in array array['partners','referrals','segments','content_briefs',
                             'admin_audit_logs','email_logs'] loop
        execute format('drop policy if exists %I_admin_only on public.%I', t, t);
        execute format(
            'create policy %I_admin_only on public.%I for all to authenticated
             using (public.is_admin()) with check (public.is_admin())', t, t);
    end loop;
end $$;

-- admin_audit_logs deliberately has no INSERT path for clients beyond the admin
-- policy above: on Base44 the log was client-writable, so entries could be
-- forged. Real entries are written by server-side code under service_role.


-- ===========================================================================
-- rate_limits and webhook_logs get NO policies: infrastructure tables that only
-- server-side code (service_role) may touch. A client-writable rate-limit table
-- defeats the point of rate limiting.
-- ===========================================================================
