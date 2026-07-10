


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_cleaning_request_checklist_template"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- If the property/profile changes and the caller did not explicitly set a
  -- different template, recompute the snapshot.
  if tg_op = 'UPDATE'
     and (
       new.property_id is distinct from old.property_id
       or new.cleaning_profile_id is distinct from old.cleaning_profile_id
     )
     and new.checklist_template_id is not distinct from old.checklist_template_id
  then
    new.checklist_template_id := null;
  end if;

  -- Preserve an explicit snapshot.
  if new.checklist_template_id is not null then
    return new;
  end if;

  -- Prefer an active template for the selected cleaning profile.
  -- If none exists, fall back only to a default property template.
  -- Do not fall back to another profile's template.
  select t.id
  into new.checklist_template_id
  from public.cleaning_checklist_templates t
  where t.property_id = new.property_id
    and t.active = true
    and (
      t.cleaning_profile_id = new.cleaning_profile_id
      or t.cleaning_profile_id is null
    )
  order by
    case
      when t.cleaning_profile_id = new.cleaning_profile_id then 0
      when t.cleaning_profile_id is null then 1
      else 2
    end,
    coalesce(t.version, 0) desc,
    t.created_at desc nulls last,
    t.id
  limit 1;

  return new;
end
$$;


ALTER FUNCTION "public"."set_cleaning_request_checklist_template"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."analytics_daily_calendar" (
    "row_key" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "portfolio_id" "text" NOT NULL,
    "portfolio_name" "text",
    "listing_id" "text" NOT NULL,
    "listing_name" "text",
    "property_id" "uuid",
    "source_system" "text",
    "source_property_id" "text",
    "source_room_id" "text",
    "source_booking_id" "text",
    "date" "date" NOT NULL,
    "year_month" "text" NOT NULL,
    "status" "text",
    "channel" "text",
    "is_booked" boolean,
    "num_adult" numeric,
    "num_child" numeric,
    "gross_booking_value_allocated" numeric,
    "accommodation_revenue_allocated" numeric,
    "cleaning_fee_allocated" numeric,
    "tourist_tax_allocated" numeric,
    "channel_commission_allocated" numeric,
    "host_payout_allocated" numeric,
    "host_payout_minus_cleaning_allocated" numeric,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_file" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_daily_calendar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_dashboard_kpis" (
    "row_key" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "portfolio_id" "text" NOT NULL,
    "year" integer NOT NULL,
    "current_month" "text",
    "current_month_host_payout" numeric,
    "current_month_target_host_payout" numeric,
    "current_month_vs_target" numeric,
    "current_month_target_pct" numeric,
    "current_month_operating_profit" numeric,
    "current_month_portfolio_cash_result" numeric,
    "ytd_host_payout" numeric,
    "target_host_payout" numeric,
    "host_payout_target_pct" numeric,
    "host_payout_remaining_to_target" numeric,
    "host_payout_required_per_remaining_month" numeric,
    "ytd_operating_profit" numeric,
    "ytd_portfolio_cash_result" numeric,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_file" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_dashboard_kpis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_data_quality_issues" (
    "row_key" "text" NOT NULL,
    "severity" "text",
    "category" "text",
    "issue" "text",
    "details" "text",
    "affected_count" integer,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_file" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_data_quality_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_expense_lines" (
    "row_key" "text" NOT NULL,
    "client_id" "text",
    "portfolio_id" "text" NOT NULL,
    "portfolio_name" "text",
    "listing_id" "text" NOT NULL,
    "listing_name" "text",
    "property_id" "uuid",
    "source_booking_id" "text",
    "expense_source" "text" NOT NULL,
    "expense_date" "date",
    "period_start" "date",
    "period_end" "date",
    "year_month" "text" NOT NULL,
    "rule_id" "text",
    "category" "text",
    "cost_family" "text",
    "calculation_type" "text",
    "occupied_days" numeric,
    "amount_per_day" numeric,
    "expense_amount" numeric,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_file" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_expense_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_listing_month_financials" (
    "row_key" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "portfolio_id" "text" NOT NULL,
    "portfolio_name" "text",
    "listing_id" "text" NOT NULL,
    "listing_name" "text",
    "property_id" "uuid",
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "year_month" "text" NOT NULL,
    "booked_nights" numeric,
    "available_nights" numeric,
    "occupancy_pct" numeric,
    "adr_accommodation" numeric,
    "gross_booking_value" numeric,
    "accommodation_revenue" numeric,
    "cleaning_fee_charged" numeric,
    "tourist_tax" numeric,
    "channel_commission" numeric,
    "host_payout" numeric,
    "host_payout_minus_cleaning" numeric,
    "actual_cleaning_cost" numeric,
    "cleaning_margin" numeric,
    "concierge_fee" numeric,
    "other_booking_costs" numeric,
    "booking_associated_costs_total" numeric,
    "booking_contribution" numeric,
    "energy_usage_cost" numeric,
    "water_usage_cost" numeric,
    "variable_period_costs_total" numeric,
    "rental_contribution" numeric,
    "attributable_fixed_costs_total" numeric,
    "attributed_profit" numeric,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_file" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_listing_month_financials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_listing_month_targets" (
    "row_key" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "portfolio_id" "text",
    "portfolio_name" "text",
    "listing_id" "text" NOT NULL,
    "listing_name" "text",
    "property_id" "uuid",
    "year_month" "text" NOT NULL,
    "target_gross_booking_value" numeric,
    "target_host_payout" numeric,
    "target_after_variables" numeric,
    "target_after_fixes" numeric,
    "occupancy_target_pct" numeric,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_file" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_listing_month_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_market_benchmark_windows" (
    "row_key" "text" NOT NULL,
    "run_id" "text",
    "retrieved_at" timestamp with time zone,
    "portfolio_id" "text",
    "market_set_id" "text",
    "listing_id" "text",
    "property_id" "uuid",
    "scenario_id" "text",
    "check_in" "date",
    "check_out" "date",
    "nights" integer,
    "adults" integer,
    "children" integer,
    "status" "text",
    "bookable" boolean,
    "own_total_amount" numeric,
    "own_nightly_amount" numeric,
    "competitors_checked" integer,
    "competitors_available" integer,
    "competitors_unavailable" integer,
    "competitors_failed" integer,
    "competitors_usable" integer,
    "market_availability_rate" numeric,
    "market_unavailable_rate" numeric,
    "market_tension" "text",
    "competitor_adjusted_median_nightly" numeric,
    "competitor_adjusted_p25_nightly" numeric,
    "competitor_adjusted_p75_nightly" numeric,
    "own_vs_adjusted_market_pct" numeric,
    "price_position" "text",
    "pricing_guidance" "text",
    "warning" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_file" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_market_benchmark_windows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "duration_seconds" numeric,
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "log_tail" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."automation_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaner_unavailability" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cleaner_unavailability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaner_unavailability_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "starts_on" "date" NOT NULL,
    "ends_on" "date" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaner_unavailability_periods_check" CHECK (("ends_on" >= "starts_on"))
);


ALTER TABLE "public"."cleaner_unavailability_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaner_weekly_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "weekday" integer NOT NULL,
    "available" boolean DEFAULT true NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaner_weekly_availability_weekday_check" CHECK ((("weekday" >= 1) AND ("weekday" <= 7)))
);


ALTER TABLE "public"."cleaner_weekly_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaners" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text",
    "phone" "text",
    "email" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "home_location_label" "text",
    "home_lat" numeric,
    "home_lng" numeric,
    "hourly_rate_eur" numeric DEFAULT 0 NOT NULL,
    "included_radius_km" numeric DEFAULT 0 NOT NULL,
    "travel_rate_per_km_eur" numeric DEFAULT 0 NOT NULL,
    "payment_method" "text",
    "payment_details" "text",
    "worker_type" "text" DEFAULT 'individual'::"text" NOT NULL,
    "legal_name" "text",
    "trading_name" "text",
    "siret" "text",
    "billing_address" "text",
    "vat_status" "text",
    "invoice_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_photo_bucket" "text",
    "profile_photo_path" "text",
    "address" "text",
    "latitude" numeric,
    "longitude" numeric,
    "services" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "urgency_bonus_percent" numeric DEFAULT 15 NOT NULL,
    "preferred_towns" "text",
    "max_travel_distance_km" numeric,
    "internal_rating" integer,
    "quality_notes" "text",
    "business_address" "text",
    "billing_email" "text",
    "payment_terms" "text",
    "iban" "text",
    "public_token" "text" DEFAULT "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text"),
    "preferred_language" "text" DEFAULT 'fr'::"text" NOT NULL,
    "app_invited_at" timestamp with time zone,
    "app_first_opened_at" timestamp with time zone,
    "app_onboarded_at" timestamp with time zone,
    CONSTRAINT "cleaners_preferred_language_check" CHECK (("preferred_language" = ANY (ARRAY['fr'::"text", 'en'::"text", 'ru'::"text"])))
);


ALTER TABLE "public"."cleaners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_checklist_section_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_id" "uuid" NOT NULL,
    "language" "text" NOT NULL,
    "title" "text",
    "high_level_check_label" "text",
    "detail_items" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaning_checklist_section_translations_language_check" CHECK (("language" = ANY (ARRAY['en'::"text", 'ru'::"text"])))
);


ALTER TABLE "public"."cleaning_checklist_section_translations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_checklist_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "section_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "high_level_check_label" "text" NOT NULL,
    "detail_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "photo_requirement" "text" DEFAULT 'optional'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "visible_to_cleaner" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."cleaning_checklist_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_checklist_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid",
    "cleaning_profile_id" "uuid",
    "name" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "estimated_minutes" integer,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cleaning_checklist_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_outbound_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaning_request_id" "uuid" NOT NULL,
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "message_type" "text" NOT NULL,
    "recipient_name" "text",
    "recipient_phone" "text",
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'drafted'::"text" NOT NULL,
    "provider" "text",
    "provider_message_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "error" "text"
);


ALTER TABLE "public"."cleaning_outbound_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_reminder_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "trigger_event" "text" DEFAULT 'accepted_cleaning'::"text" NOT NULL,
    "timing_type" "text" NOT NULL,
    "minutes_before" integer,
    "local_time" time without time zone,
    "channel" "text" DEFAULT 'sms'::"text" NOT NULL,
    "provider" "text" DEFAULT 'twilio'::"text" NOT NULL,
    "grace_minutes" integer DEFAULT 180 NOT NULL,
    "message_template" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaning_reminder_rules_timing_type_check" CHECK (("timing_type" = ANY (ARRAY['minutes_before'::"text", 'day_of_at_time'::"text"])))
);


ALTER TABLE "public"."cleaning_reminder_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_report_photos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cleaning_report_id" "uuid" NOT NULL,
    "photo_label" "text",
    "storage_path" "text" NOT NULL,
    "taken_at" timestamp with time zone,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gps_lat" numeric,
    "gps_lng" numeric,
    "section_key" "text",
    "photo_type" "text" DEFAULT 'proof'::"text" NOT NULL,
    "storage_bucket" "text",
    "original_filename" "text",
    "content_type" "text",
    "size_bytes" bigint,
    "caption" "text",
    "cleaning_request_id" "uuid"
);


ALTER TABLE "public"."cleaning_report_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_report_section_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaning_report_id" "uuid" NOT NULL,
    "section_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "high_level_check_label" "text" NOT NULL,
    "detail_items_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "details_viewed_at" timestamp with time zone,
    "checked" boolean DEFAULT false NOT NULL,
    "checked_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cleaning_report_section_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cleaning_request_id" "uuid" NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "ready_for_guest" boolean DEFAULT false NOT NULL,
    "problem_reported" boolean DEFAULT false NOT NULL,
    "comments" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checklist_template_id" "uuid",
    "checklist_version" integer,
    "checklist_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ready_for_guests" boolean DEFAULT false NOT NULL,
    "damage_found" boolean DEFAULT false NOT NULL,
    "damage_notes" "text",
    "missing_items" boolean DEFAULT false NOT NULL,
    "missing_items_notes" "text",
    "guest_left_items" boolean DEFAULT false NOT NULL,
    "guest_left_items_notes" "text",
    "linen_problem" boolean DEFAULT false NOT NULL,
    "linen_notes" "text",
    "consumables_problem" boolean DEFAULT false NOT NULL,
    "consumables_notes" "text",
    "general_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cleaning_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_request_change_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaning_request_id" "uuid" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "text",
    "change_type" "text" NOT NULL,
    "before_data" "jsonb",
    "after_data" "jsonb",
    "note" "text"
);


ALTER TABLE "public"."cleaning_request_change_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_request_extras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaning_request_id" "uuid" NOT NULL,
    "cleaning_report_id" "uuid",
    "cleaner_id" "uuid",
    "property_id" "uuid",
    "amount_eur" numeric(10,2) DEFAULT 0 NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending_owner_review'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaning_request_extras_status_check" CHECK (("status" = ANY (ARRAY['pending_owner_review'::"text", 'approved'::"text", 'rejected'::"text", 'included'::"text"])))
);


ALTER TABLE "public"."cleaning_request_extras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_request_ready_day_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaning_request_id" "uuid" NOT NULL,
    "cleaner_id" "uuid",
    "ready_by_date" "date" NOT NULL,
    "ready_by_at" timestamp with time zone NOT NULL,
    "label" "text" NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "disabled_reason" "text",
    "selected_at" timestamp with time zone,
    "test_scenario_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cleaning_request_ready_day_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "reservation_id" "uuid",
    "cleaning_profile_id" "uuid" NOT NULL,
    "assigned_cleaner_id" "uuid",
    "scheduled_start_at" timestamp with time zone NOT NULL,
    "scheduled_end_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "urgent" boolean DEFAULT false NOT NULL,
    "response_deadline_at" timestamp with time zone,
    "number_of_guests" integer DEFAULT 1 NOT NULL,
    "linen_required" boolean DEFAULT true NOT NULL,
    "laundry_required" boolean DEFAULT true NOT NULL,
    "estimated_hours" numeric NOT NULL,
    "cleaning_cost_eur" numeric DEFAULT 0 NOT NULL,
    "travel_distance_km" numeric DEFAULT 0 NOT NULL,
    "billable_travel_km" numeric DEFAULT 0 NOT NULL,
    "travel_cost_eur" numeric DEFAULT 0 NOT NULL,
    "urgency_bonus_percent" numeric DEFAULT 0 NOT NULL,
    "urgency_bonus_eur" numeric DEFAULT 0 NOT NULL,
    "total_cost_eur" numeric DEFAULT 0 NOT NULL,
    "refusal_reason" "text",
    "accepted_at" timestamp with time zone,
    "refused_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "public_token" "text",
    "public_token_expires_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mission_origin" "text" DEFAULT 'turnover'::"text" NOT NULL,
    "service_type" "text" DEFAULT 'standard_cleaning'::"text" NOT NULL,
    "title" "text",
    "completion_deadline_at" timestamp with time zone,
    "admin_notes" "text",
    "test_scenario_id" "uuid",
    "work_window_start_at" timestamp with time zone,
    "work_window_end_at" timestamp with time zone,
    "ready_by_at" timestamp with time zone,
    "ready_by_date" "date",
    "schedule_status" "text" DEFAULT 'waiting_for_ready_day'::"text" NOT NULL,
    "planning_changed_at" timestamp with time zone,
    "ready_notification_sent_at" timestamp with time zone,
    "assignment_reason" "text",
    "checklist_template_id" "uuid",
    "mission_type" "text" DEFAULT 'cleaning'::"text" NOT NULL,
    "mission_category" "text",
    "mission_description" "text",
    "proof_photo_requirement" "text" DEFAULT 'optional'::"text" NOT NULL,
    "actual_hours" numeric,
    "hourly_rate_eur_snapshot" numeric,
    "material_expenses_total_eur" numeric DEFAULT 0 NOT NULL,
    "allow_actual_hours_edit" boolean DEFAULT false NOT NULL,
    "allow_material_expenses" boolean DEFAULT false NOT NULL,
    "no_backup_escalation" boolean DEFAULT false NOT NULL,
    "occupied_warning_acknowledged_at" timestamp with time zone,
    "intervention_refusal_reason" "text",
    "reference_photo_bucket" "text",
    "reference_photo_path" "text",
    "allow_occupied_intervention" boolean DEFAULT false NOT NULL,
    CONSTRAINT "cleaning_requests_mission_type_check" CHECK (("mission_type" = ANY (ARRAY['cleaning'::"text", 'intervention'::"text"]))),
    CONSTRAINT "cleaning_requests_proof_photo_requirement_check" CHECK (("proof_photo_requirement" = ANY (ARRAY['none'::"text", 'optional'::"text", 'required'::"text"])))
);


ALTER TABLE "public"."cleaning_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaning_request_id" "uuid" NOT NULL,
    "report_id" "uuid",
    "label" "text" NOT NULL,
    "amount_eur" numeric DEFAULT 0 NOT NULL,
    "receipt_bucket" "text",
    "receipt_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intervention_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_report_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "cleaning_request_id" "uuid" NOT NULL,
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "kind" "text" DEFAULT 'proof'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intervention_report_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaning_request_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "work_summary" "text",
    "issue_notes" "text",
    "actual_hours" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intervention_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_payment_request_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "monthly_payment_request_id" "uuid" NOT NULL,
    "cleaning_request_id" "uuid",
    "cleaning_report_id" "uuid",
    "extra_id" "uuid",
    "line_type" "text" DEFAULT 'mission'::"text" NOT NULL,
    "work_date" "date" NOT NULL,
    "property_id" "uuid",
    "property_name" "text",
    "service_type" "text",
    "description" "text" NOT NULL,
    "hours" numeric(8,2) DEFAULT 0 NOT NULL,
    "amount_eur" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'included'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "monthly_payment_request_lines_line_type_check" CHECK (("line_type" = ANY (ARRAY['mission'::"text", 'extra'::"text"]))),
    CONSTRAINT "monthly_payment_request_lines_status_check" CHECK (("status" = ANY (ARRAY['included'::"text", 'pending_owner_review'::"text", 'excluded'::"text", 'disputed'::"text"])))
);


ALTER TABLE "public"."monthly_payment_request_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_payment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "public_token" "text" DEFAULT "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") NOT NULL,
    "total_base_eur" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_extras_eur" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_eur" numeric(10,2) DEFAULT 0 NOT NULL,
    "cleaner_message" "text",
    "owner_recipient_name" "text",
    "owner_recipient_phone" "text",
    "owner_recipient_email" "text",
    "payment_method_snapshot" "text",
    "payment_details_snapshot" "text",
    "iban_snapshot" "text",
    "invoice_status" "text" DEFAULT 'not_required'::"text" NOT NULL,
    "invoice_number" "text",
    "invoice_pdf_path" "text",
    "sent_at" timestamp with time zone,
    "due_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_id" "uuid",
    "owner_refusal_reason" "text",
    "cleaner_name_snapshot" "text",
    "cleaner_legal_name_snapshot" "text",
    "cleaner_address_snapshot" "text",
    "cleaner_siret_snapshot" "text",
    "cleaner_vat_status_snapshot" "text",
    "refused_at" timestamp with time zone,
    "withdrawn_at" timestamp with time zone,
    CONSTRAINT "monthly_payment_requests_invoice_status_check" CHECK (("invoice_status" = ANY (ARRAY['not_required'::"text", 'draft_needed'::"text", 'attached'::"text", 'sent'::"text"]))),
    CONSTRAINT "monthly_payment_requests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent_to_owner'::"text", 'paid'::"text", 'refused'::"text", 'overdue'::"text", 'cancelled'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."monthly_payment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operational_event_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "source" "text" DEFAULT 'system'::"text" NOT NULL,
    "actor_type" "text",
    "actor_id" "text",
    "job_name" "text",
    "run_id" "text",
    "property_id" "text",
    "reservation_id" "text",
    "cleaning_request_id" "text",
    "cleaner_id" "text",
    "owner_id" "text",
    "cleaning_profile_id" "text",
    "status_before" "text",
    "status_after" "text",
    "reason_code" "text",
    "reason" "text",
    "title" "text",
    "summary" "text",
    "event_key" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "context" "jsonb",
    CONSTRAINT "operational_event_log_severity_check" CHECK (("severity" = ANY (ARRAY['debug'::"text", 'info'::"text", 'warning'::"text", 'error'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."operational_event_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outbound_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaning_request_id" "uuid",
    "channel" "text" NOT NULL,
    "message_type" "text" NOT NULL,
    "recipient_phone" "text",
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider" "text",
    "provider_message_id" "text",
    "provider_to" "text",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_key" "text",
    "monthly_payment_request_id" "uuid",
    "owner_id" "uuid",
    "is_test" boolean DEFAULT false NOT NULL,
    "test_scenario_id" "uuid",
    "cleaner_id" "uuid",
    CONSTRAINT "outbound_messages_channel_check" CHECK (("channel" = ANY (ARRAY['sms'::"text", 'whatsapp'::"text", 'email'::"text"]))),
    CONSTRAINT "outbound_messages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."outbound_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owners" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "legal_name" "text",
    "billing_email" "text",
    "phone" "text",
    "billing_address" "text",
    "siren" "text",
    "siret" "text",
    "vat_number" "text",
    "vat_status" "text",
    "e_invoicing_platform" "text",
    "payment_request_channel" "text" DEFAULT 'sms'::"text" NOT NULL,
    "payment_due_days" integer DEFAULT 5 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_photo_bucket" "text",
    "profile_photo_path" "text",
    "public_token" "text" NOT NULL
);


ALTER TABLE "public"."owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid",
    "name" "text" NOT NULL,
    "address" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "preferred_cleaner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_cleaner_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "priority" integer DEFAULT 1 NOT NULL,
    "familiar" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "travel_distance_km" numeric,
    CONSTRAINT "property_cleaner_assignments_role_check" CHECK (("role" = ANY (ARRAY['primary'::"text", 'backup'::"text"])))
);


ALTER TABLE "public"."property_cleaner_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_cleaning_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "estimated_hours" numeric NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_type" "text" DEFAULT 'standard_cleaning'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "default_linen_required" boolean DEFAULT true NOT NULL,
    "default_laundry_required" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL
);


ALTER TABLE "public"."property_cleaning_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_notification_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text",
    "phone" "text",
    "email" "text",
    "channel" "text" DEFAULT 'sms'::"text" NOT NULL,
    "alert_type" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_notification_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_reference_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "section_key" "text",
    "title" "text",
    "storage_bucket" "text" DEFAULT 'cleaning-reference-photos'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "original_storage_bucket" "text",
    "original_storage_path" "text",
    "optimized_at" timestamp with time zone,
    "original_size_bytes" integer,
    "optimized_size_bytes" integer
);


ALTER TABLE "public"."property_reference_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_source_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "source_system" "text" NOT NULL,
    "source_property_id" "text" NOT NULL,
    "source_room_id" "text" DEFAULT ''::"text" NOT NULL,
    "source_listing_id" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_source_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservation_financials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_system" "text" NOT NULL,
    "source_booking_id" "text" NOT NULL,
    "client_id" "text",
    "portfolio_id" "text",
    "portfolio_name" "text",
    "property_key" "text",
    "property_name" "text",
    "listing_name" "text",
    "booking_channel" "text",
    "reservation_status" "text",
    "checkin_date" "date",
    "checkout_date" "date",
    "nights" integer,
    "number_of_guests" integer,
    "gross_booking_value_eur" numeric,
    "accommodation_revenue_eur" numeric,
    "host_payout_eur" numeric,
    "cleaning_fee_charged_eur" numeric,
    "adr_eur" numeric,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reservation_financials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "source_system" "text",
    "source_booking_id" "text",
    "guest_name" "text",
    "checkin_at" timestamp with time zone,
    "checkout_at" timestamp with time zone NOT NULL,
    "next_checkin_at" timestamp with time zone,
    "number_of_guests" integer DEFAULT 1 NOT NULL,
    "nights" integer,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "linen_required" boolean DEFAULT true NOT NULL,
    "laundry_required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "test_scenario_id" "uuid"
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_pageviews" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "site" "text" NOT NULL,
    "path" "text",
    "page_title" "text",
    "referrer" "text",
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_content" "text",
    "utm_term" "text",
    "language" "text",
    "viewport_width" integer,
    CONSTRAINT "site_pageviews_path_length_check" CHECK (("char_length"("path") <= 300)),
    CONSTRAINT "site_pageviews_referrer_length_check" CHECK ((("referrer" IS NULL) OR ("char_length"("referrer") <= 500))),
    CONSTRAINT "site_pageviews_site_check" CHECK (("site" = ANY (ARRAY['leclosdelavoilerie'::"text", 'lapeskerezh'::"text"]))),
    CONSTRAINT "site_pageviews_utm_length_check" CHECK (((("utm_source" IS NULL) OR ("char_length"("utm_source") <= 100)) AND (("utm_medium" IS NULL) OR ("char_length"("utm_medium") <= 100)) AND (("utm_campaign" IS NULL) OR ("char_length"("utm_campaign") <= 150))))
);


ALTER TABLE "public"."site_pageviews" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."site_pageviews_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."site_pageviews_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."site_pageviews_id_seq" OWNED BY "public"."site_pageviews"."id";



CREATE TABLE IF NOT EXISTS "public"."test_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "scenario_type" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."test_scenarios" OWNER TO "postgres";


ALTER TABLE ONLY "public"."site_pageviews" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."site_pageviews_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."analytics_daily_calendar"
    ADD CONSTRAINT "analytics_daily_calendar_pkey" PRIMARY KEY ("row_key");



ALTER TABLE ONLY "public"."analytics_dashboard_kpis"
    ADD CONSTRAINT "analytics_dashboard_kpis_pkey" PRIMARY KEY ("row_key");



ALTER TABLE ONLY "public"."analytics_data_quality_issues"
    ADD CONSTRAINT "analytics_data_quality_issues_pkey" PRIMARY KEY ("row_key");



ALTER TABLE ONLY "public"."analytics_expense_lines"
    ADD CONSTRAINT "analytics_expense_lines_pkey" PRIMARY KEY ("row_key");



ALTER TABLE ONLY "public"."analytics_listing_month_financials"
    ADD CONSTRAINT "analytics_listing_month_financials_pkey" PRIMARY KEY ("row_key");



ALTER TABLE ONLY "public"."analytics_listing_month_targets"
    ADD CONSTRAINT "analytics_listing_month_targets_pkey" PRIMARY KEY ("row_key");



ALTER TABLE ONLY "public"."analytics_market_benchmark_windows"
    ADD CONSTRAINT "analytics_market_benchmark_windows_pkey" PRIMARY KEY ("row_key");



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaner_unavailability_periods"
    ADD CONSTRAINT "cleaner_unavailability_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaner_unavailability"
    ADD CONSTRAINT "cleaner_unavailability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaner_weekly_availability"
    ADD CONSTRAINT "cleaner_weekly_availability_cleaner_id_weekday_key" UNIQUE ("cleaner_id", "weekday");



ALTER TABLE ONLY "public"."cleaner_weekly_availability"
    ADD CONSTRAINT "cleaner_weekly_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaners"
    ADD CONSTRAINT "cleaners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_checklist_section_translations"
    ADD CONSTRAINT "cleaning_checklist_section_translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_checklist_section_translations"
    ADD CONSTRAINT "cleaning_checklist_section_translations_section_id_language_key" UNIQUE ("section_id", "language");



ALTER TABLE ONLY "public"."cleaning_checklist_sections"
    ADD CONSTRAINT "cleaning_checklist_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_checklist_sections"
    ADD CONSTRAINT "cleaning_checklist_sections_template_id_section_key_key" UNIQUE ("template_id", "section_key");



ALTER TABLE ONLY "public"."cleaning_checklist_templates"
    ADD CONSTRAINT "cleaning_checklist_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_checklist_templates"
    ADD CONSTRAINT "cleaning_checklist_templates_property_id_cleaning_profile_i_key" UNIQUE ("property_id", "cleaning_profile_id", "version");



ALTER TABLE ONLY "public"."cleaning_outbound_messages"
    ADD CONSTRAINT "cleaning_outbound_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_reminder_rules"
    ADD CONSTRAINT "cleaning_reminder_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_reminder_rules"
    ADD CONSTRAINT "cleaning_reminder_rules_rule_key_key" UNIQUE ("rule_key");



ALTER TABLE ONLY "public"."cleaning_report_photos"
    ADD CONSTRAINT "cleaning_report_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_report_section_checks"
    ADD CONSTRAINT "cleaning_report_section_check_cleaning_report_id_section_ke_key" UNIQUE ("cleaning_report_id", "section_key");



ALTER TABLE ONLY "public"."cleaning_report_section_checks"
    ADD CONSTRAINT "cleaning_report_section_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_reports"
    ADD CONSTRAINT "cleaning_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_request_change_log"
    ADD CONSTRAINT "cleaning_request_change_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_request_extras"
    ADD CONSTRAINT "cleaning_request_extras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_request_ready_day_options"
    ADD CONSTRAINT "cleaning_request_ready_day_op_cleaning_request_id_cleaner_i_key" UNIQUE ("cleaning_request_id", "cleaner_id", "ready_by_date");



ALTER TABLE ONLY "public"."cleaning_request_ready_day_options"
    ADD CONSTRAINT "cleaning_request_ready_day_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_requests"
    ADD CONSTRAINT "cleaning_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_requests"
    ADD CONSTRAINT "cleaning_requests_public_token_key" UNIQUE ("public_token");



ALTER TABLE ONLY "public"."intervention_expenses"
    ADD CONSTRAINT "intervention_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intervention_report_photos"
    ADD CONSTRAINT "intervention_report_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intervention_reports"
    ADD CONSTRAINT "intervention_reports_cleaning_request_id_key" UNIQUE ("cleaning_request_id");



ALTER TABLE ONLY "public"."intervention_reports"
    ADD CONSTRAINT "intervention_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_payment_request_lines"
    ADD CONSTRAINT "monthly_payment_request_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_payment_requests"
    ADD CONSTRAINT "monthly_payment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operational_event_log"
    ADD CONSTRAINT "operational_event_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_cleaner_assignments"
    ADD CONSTRAINT "property_cleaner_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_cleaner_assignments"
    ADD CONSTRAINT "property_cleaner_assignments_property_id_cleaner_id_key" UNIQUE ("property_id", "cleaner_id");



ALTER TABLE ONLY "public"."property_cleaning_profiles"
    ADD CONSTRAINT "property_cleaning_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_cleaning_profiles"
    ADD CONSTRAINT "property_cleaning_profiles_property_id_code_key" UNIQUE ("property_id", "code");



ALTER TABLE ONLY "public"."property_notification_recipients"
    ADD CONSTRAINT "property_notification_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_reference_photos"
    ADD CONSTRAINT "property_reference_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_source_links"
    ADD CONSTRAINT "property_source_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_source_links"
    ADD CONSTRAINT "property_source_links_source_system_source_property_id_sour_key" UNIQUE ("source_system", "source_property_id", "source_room_id");



ALTER TABLE ONLY "public"."reservation_financials"
    ADD CONSTRAINT "reservation_financials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservation_financials"
    ADD CONSTRAINT "reservation_financials_source_system_source_booking_id_key" UNIQUE ("source_system", "source_booking_id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_pageviews"
    ADD CONSTRAINT "site_pageviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_scenarios"
    ADD CONSTRAINT "test_scenarios_pkey" PRIMARY KEY ("id");



CREATE INDEX "cleaner_unavailability_periods_cleaner_idx" ON "public"."cleaner_unavailability_periods" USING "btree" ("cleaner_id", "starts_on", "ends_on");



CREATE INDEX "cleaner_weekly_availability_cleaner_idx" ON "public"."cleaner_weekly_availability" USING "btree" ("cleaner_id", "weekday");



CREATE UNIQUE INDEX "cleaners_public_token_idx" ON "public"."cleaners" USING "btree" ("public_token");



CREATE INDEX "cleaning_checklist_templates_profile_idx" ON "public"."cleaning_checklist_templates" USING "btree" ("property_id", "cleaning_profile_id", "active");



CREATE UNIQUE INDEX "cleaning_reports_cleaning_request_id_unique" ON "public"."cleaning_reports" USING "btree" ("cleaning_request_id");



CREATE INDEX "cleaning_request_change_log_request_idx" ON "public"."cleaning_request_change_log" USING "btree" ("cleaning_request_id");



CREATE INDEX "cleaning_request_extras_cleaner_idx" ON "public"."cleaning_request_extras" USING "btree" ("cleaner_id", "created_at");



CREATE INDEX "cleaning_request_extras_request_idx" ON "public"."cleaning_request_extras" USING "btree" ("cleaning_request_id");



CREATE INDEX "cleaning_requests_checklist_template_id_idx" ON "public"."cleaning_requests" USING "btree" ("checklist_template_id");



CREATE INDEX "idx_analytics_daily_calendar_portfolio_date" ON "public"."analytics_daily_calendar" USING "btree" ("portfolio_id", "date");



CREATE INDEX "idx_analytics_daily_calendar_property_date" ON "public"."analytics_daily_calendar" USING "btree" ("property_id", "date");



CREATE INDEX "idx_analytics_dashboard_kpis_portfolio_year" ON "public"."analytics_dashboard_kpis" USING "btree" ("portfolio_id", "year");



CREATE INDEX "idx_analytics_data_quality_issues_severity" ON "public"."analytics_data_quality_issues" USING "btree" ("severity", "category");



CREATE INDEX "idx_analytics_expense_lines_portfolio_month" ON "public"."analytics_expense_lines" USING "btree" ("portfolio_id", "year_month");



CREATE INDEX "idx_analytics_expense_lines_property_date" ON "public"."analytics_expense_lines" USING "btree" ("property_id", "expense_date");



CREATE INDEX "idx_analytics_expense_lines_property_month" ON "public"."analytics_expense_lines" USING "btree" ("property_id", "year_month");



CREATE INDEX "idx_analytics_expense_lines_source" ON "public"."analytics_expense_lines" USING "btree" ("expense_source", "category", "cost_family");



CREATE INDEX "idx_analytics_listing_month_financials_portfolio_month" ON "public"."analytics_listing_month_financials" USING "btree" ("portfolio_id", "year_month");



CREATE INDEX "idx_analytics_listing_month_financials_property_month" ON "public"."analytics_listing_month_financials" USING "btree" ("property_id", "year_month");



CREATE INDEX "idx_analytics_listing_month_targets_listing_month" ON "public"."analytics_listing_month_targets" USING "btree" ("listing_id", "year_month");



CREATE INDEX "idx_analytics_listing_month_targets_portfolio_month" ON "public"."analytics_listing_month_targets" USING "btree" ("portfolio_id", "year_month");



CREATE INDEX "idx_analytics_listing_month_targets_property_month" ON "public"."analytics_listing_month_targets" USING "btree" ("property_id", "year_month");



CREATE INDEX "idx_analytics_market_benchmark_portfolio_dates" ON "public"."analytics_market_benchmark_windows" USING "btree" ("portfolio_id", "check_in", "check_out");



CREATE INDEX "idx_analytics_market_benchmark_property_dates" ON "public"."analytics_market_benchmark_windows" USING "btree" ("property_id", "check_in", "check_out");



CREATE INDEX "idx_cleaning_checklist_section_translations_section_language" ON "public"."cleaning_checklist_section_translations" USING "btree" ("section_id", "language");



CREATE INDEX "idx_operational_event_log_cleaner" ON "public"."operational_event_log" USING "btree" ("cleaner_id", "created_at" DESC);



CREATE INDEX "idx_operational_event_log_context_gin" ON "public"."operational_event_log" USING "gin" ("context" "jsonb_path_ops");



CREATE INDEX "idx_operational_event_log_created_at" ON "public"."operational_event_log" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "idx_operational_event_log_event_key_unique" ON "public"."operational_event_log" USING "btree" ("event_key") WHERE ("event_key" IS NOT NULL);



CREATE INDEX "idx_operational_event_log_property" ON "public"."operational_event_log" USING "btree" ("property_id", "created_at" DESC);



CREATE INDEX "idx_operational_event_log_request" ON "public"."operational_event_log" USING "btree" ("cleaning_request_id", "created_at" DESC);



CREATE INDEX "idx_operational_event_log_reservation" ON "public"."operational_event_log" USING "btree" ("reservation_id", "created_at" DESC);



CREATE INDEX "monthly_payment_request_lines_cleaning_request_idx" ON "public"."monthly_payment_request_lines" USING "btree" ("cleaning_request_id");



CREATE INDEX "monthly_payment_request_lines_request_idx" ON "public"."monthly_payment_request_lines" USING "btree" ("monthly_payment_request_id");



CREATE UNIQUE INDEX "monthly_payment_requests_cleaner_owner_period_idx" ON "public"."monthly_payment_requests" USING "btree" ("cleaner_id", "owner_id", "period_start", "period_end") WHERE ("owner_id" IS NOT NULL);



CREATE INDEX "monthly_payment_requests_cleaner_period_idx" ON "public"."monthly_payment_requests" USING "btree" ("cleaner_id", "period_start", "period_end");



CREATE INDEX "monthly_payment_requests_owner_status_idx" ON "public"."monthly_payment_requests" USING "btree" ("owner_id", "status");



CREATE UNIQUE INDEX "monthly_payment_requests_public_token_idx" ON "public"."monthly_payment_requests" USING "btree" ("public_token");



CREATE UNIQUE INDEX "outbound_messages_event_key_idx" ON "public"."outbound_messages" USING "btree" ("event_key") WHERE ("event_key" IS NOT NULL);



CREATE INDEX "outbound_messages_status_idx" ON "public"."outbound_messages" USING "btree" ("status", "created_at");



CREATE UNIQUE INDEX "owners_public_token_unique_idx" ON "public"."owners" USING "btree" ("public_token") WHERE ("public_token" IS NOT NULL);



CREATE INDEX "properties_owner_id_idx" ON "public"."properties" USING "btree" ("owner_id");



CREATE UNIQUE INDEX "property_cleaner_assignments_one_primary" ON "public"."property_cleaner_assignments" USING "btree" ("property_id") WHERE (("role" = 'primary'::"text") AND ("active" = true));



CREATE INDEX "property_cleaner_assignments_property_idx" ON "public"."property_cleaner_assignments" USING "btree" ("property_id", "active", "role", "priority");



CREATE UNIQUE INDEX "property_cleaning_profiles_one_default_per_property" ON "public"."property_cleaning_profiles" USING "btree" ("property_id") WHERE ("is_default" = true);



CREATE INDEX "property_notification_recipients_alert_idx" ON "public"."property_notification_recipients" USING "btree" ("property_id", "alert_type", "enabled");



CREATE INDEX "property_notification_recipients_property_idx" ON "public"."property_notification_recipients" USING "btree" ("property_id");



CREATE UNIQUE INDEX "property_notification_recipients_unique_sms" ON "public"."property_notification_recipients" USING "btree" ("property_id", "alert_type", "channel", "phone") WHERE (("enabled" = true) AND ("phone" IS NOT NULL));



CREATE UNIQUE INDEX "property_reference_photos_one_cover_per_property" ON "public"."property_reference_photos" USING "btree" ("property_id") WHERE ("is_cover" = true);



CREATE INDEX "property_reference_photos_property_id_idx" ON "public"."property_reference_photos" USING "btree" ("property_id");



CREATE INDEX "property_reference_photos_section_key_idx" ON "public"."property_reference_photos" USING "btree" ("section_key");



CREATE INDEX "ready_day_options_request_idx" ON "public"."cleaning_request_ready_day_options" USING "btree" ("cleaning_request_id");



CREATE INDEX "reservation_financials_booking_idx" ON "public"."reservation_financials" USING "btree" ("source_system", "source_booking_id");



CREATE UNIQUE INDEX "reservations_unique_source_booking" ON "public"."reservations" USING "btree" ("property_id", "source_system", "source_booking_id");



CREATE OR REPLACE TRIGGER "trg_set_cleaning_request_checklist_template" BEFORE INSERT OR UPDATE OF "property_id", "cleaning_profile_id", "checklist_template_id" ON "public"."cleaning_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_cleaning_request_checklist_template"();



ALTER TABLE ONLY "public"."analytics_daily_calendar"
    ADD CONSTRAINT "analytics_daily_calendar_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_expense_lines"
    ADD CONSTRAINT "analytics_expense_lines_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_listing_month_financials"
    ADD CONSTRAINT "analytics_listing_month_financials_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_listing_month_targets"
    ADD CONSTRAINT "analytics_listing_month_targets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_market_benchmark_windows"
    ADD CONSTRAINT "analytics_market_benchmark_windows_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaner_unavailability"
    ADD CONSTRAINT "cleaner_unavailability_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaner_unavailability_periods"
    ADD CONSTRAINT "cleaner_unavailability_periods_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaner_weekly_availability"
    ADD CONSTRAINT "cleaner_weekly_availability_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_checklist_section_translations"
    ADD CONSTRAINT "cleaning_checklist_section_translations_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."cleaning_checklist_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_checklist_sections"
    ADD CONSTRAINT "cleaning_checklist_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."cleaning_checklist_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_checklist_templates"
    ADD CONSTRAINT "cleaning_checklist_templates_cleaning_profile_id_fkey" FOREIGN KEY ("cleaning_profile_id") REFERENCES "public"."property_cleaning_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_checklist_templates"
    ADD CONSTRAINT "cleaning_checklist_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_outbound_messages"
    ADD CONSTRAINT "cleaning_outbound_messages_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_report_photos"
    ADD CONSTRAINT "cleaning_report_photos_cleaning_report_id_fkey" FOREIGN KEY ("cleaning_report_id") REFERENCES "public"."cleaning_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_report_photos"
    ADD CONSTRAINT "cleaning_report_photos_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_report_section_checks"
    ADD CONSTRAINT "cleaning_report_section_checks_cleaning_report_id_fkey" FOREIGN KEY ("cleaning_report_id") REFERENCES "public"."cleaning_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_reports"
    ADD CONSTRAINT "cleaning_reports_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "public"."cleaning_checklist_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_reports"
    ADD CONSTRAINT "cleaning_reports_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id");



ALTER TABLE ONLY "public"."cleaning_reports"
    ADD CONSTRAINT "cleaning_reports_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_request_change_log"
    ADD CONSTRAINT "cleaning_request_change_log_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_request_extras"
    ADD CONSTRAINT "cleaning_request_extras_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_request_extras"
    ADD CONSTRAINT "cleaning_request_extras_cleaning_report_id_fkey" FOREIGN KEY ("cleaning_report_id") REFERENCES "public"."cleaning_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_request_extras"
    ADD CONSTRAINT "cleaning_request_extras_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_request_extras"
    ADD CONSTRAINT "cleaning_request_extras_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_request_ready_day_options"
    ADD CONSTRAINT "cleaning_request_ready_day_options_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_request_ready_day_options"
    ADD CONSTRAINT "cleaning_request_ready_day_options_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_request_ready_day_options"
    ADD CONSTRAINT "cleaning_request_ready_day_options_test_scenario_id_fkey" FOREIGN KEY ("test_scenario_id") REFERENCES "public"."test_scenarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_requests"
    ADD CONSTRAINT "cleaning_requests_assigned_cleaner_id_fkey" FOREIGN KEY ("assigned_cleaner_id") REFERENCES "public"."cleaners"("id");



ALTER TABLE ONLY "public"."cleaning_requests"
    ADD CONSTRAINT "cleaning_requests_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "public"."cleaning_checklist_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_requests"
    ADD CONSTRAINT "cleaning_requests_cleaning_profile_id_fkey" FOREIGN KEY ("cleaning_profile_id") REFERENCES "public"."property_cleaning_profiles"("id");



ALTER TABLE ONLY "public"."cleaning_requests"
    ADD CONSTRAINT "cleaning_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_requests"
    ADD CONSTRAINT "cleaning_requests_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_requests"
    ADD CONSTRAINT "cleaning_requests_test_scenario_id_fkey" FOREIGN KEY ("test_scenario_id") REFERENCES "public"."test_scenarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_expenses"
    ADD CONSTRAINT "intervention_expenses_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_expenses"
    ADD CONSTRAINT "intervention_expenses_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."intervention_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_report_photos"
    ADD CONSTRAINT "intervention_report_photos_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_report_photos"
    ADD CONSTRAINT "intervention_report_photos_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."intervention_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_reports"
    ADD CONSTRAINT "intervention_reports_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_payment_request_lines"
    ADD CONSTRAINT "monthly_payment_request_lines_cleaning_report_id_fkey" FOREIGN KEY ("cleaning_report_id") REFERENCES "public"."cleaning_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_payment_request_lines"
    ADD CONSTRAINT "monthly_payment_request_lines_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_payment_request_lines"
    ADD CONSTRAINT "monthly_payment_request_lines_extra_id_fkey" FOREIGN KEY ("extra_id") REFERENCES "public"."cleaning_request_extras"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_payment_request_lines"
    ADD CONSTRAINT "monthly_payment_request_lines_monthly_payment_request_id_fkey" FOREIGN KEY ("monthly_payment_request_id") REFERENCES "public"."monthly_payment_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_payment_request_lines"
    ADD CONSTRAINT "monthly_payment_request_lines_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_payment_requests"
    ADD CONSTRAINT "monthly_payment_requests_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_payment_requests"
    ADD CONSTRAINT "monthly_payment_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_cleaning_request_id_fkey" FOREIGN KEY ("cleaning_request_id") REFERENCES "public"."cleaning_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_monthly_payment_request_id_fkey" FOREIGN KEY ("monthly_payment_request_id") REFERENCES "public"."monthly_payment_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_test_scenario_id_fkey" FOREIGN KEY ("test_scenario_id") REFERENCES "public"."test_scenarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_preferred_cleaner_fk" FOREIGN KEY ("preferred_cleaner_id") REFERENCES "public"."cleaners"("id");



ALTER TABLE ONLY "public"."property_cleaner_assignments"
    ADD CONSTRAINT "property_cleaner_assignments_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_cleaner_assignments"
    ADD CONSTRAINT "property_cleaner_assignments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_cleaning_profiles"
    ADD CONSTRAINT "property_cleaning_profiles_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_notification_recipients"
    ADD CONSTRAINT "property_notification_recipients_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_reference_photos"
    ADD CONSTRAINT "property_reference_photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_source_links"
    ADD CONSTRAINT "property_source_links_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_test_scenario_id_fkey" FOREIGN KEY ("test_scenario_id") REFERENCES "public"."test_scenarios"("id") ON DELETE CASCADE;



CREATE POLICY "Allow anonymous pageview inserts" ON "public"."site_pageviews" FOR INSERT TO "anon" WITH CHECK (("site" = 'leclosdelavoilerie'::"text"));



ALTER TABLE "public"."analytics_daily_calendar" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_dashboard_kpis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_data_quality_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_expense_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_listing_month_financials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_listing_month_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_market_benchmark_windows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaner_unavailability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaner_unavailability_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaner_weekly_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_checklist_section_translations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_checklist_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_checklist_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_outbound_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_reminder_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_report_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_report_section_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_request_change_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_request_extras" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_request_ready_day_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_report_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_payment_request_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_payment_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operational_event_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outbound_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_cleaner_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_cleaning_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_notification_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_reference_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_source_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservation_financials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_pageviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_scenarios" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_daily_calendar" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_daily_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_daily_calendar" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_dashboard_kpis" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_dashboard_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_dashboard_kpis" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_data_quality_issues" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_data_quality_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_data_quality_issues" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_expense_lines" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_expense_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_expense_lines" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_listing_month_financials" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_listing_month_financials" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_listing_month_financials" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_listing_month_targets" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_listing_month_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_listing_month_targets" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_market_benchmark_windows" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_market_benchmark_windows" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_market_benchmark_windows" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."automation_runs" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."automation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_runs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaner_unavailability" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaner_unavailability" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaner_unavailability" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaner_unavailability_periods" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaner_unavailability_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaner_unavailability_periods" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaner_weekly_availability" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaner_weekly_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaner_weekly_availability" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaners" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaners" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaners" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_checklist_section_translations" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_checklist_section_translations" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_checklist_section_translations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_checklist_sections" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_checklist_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_checklist_sections" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_checklist_templates" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_checklist_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_checklist_templates" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_outbound_messages" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_outbound_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_outbound_messages" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_reminder_rules" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_reminder_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_reminder_rules" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_report_photos" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_report_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_report_photos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_report_section_checks" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_report_section_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_report_section_checks" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_reports" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_request_change_log" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_request_change_log" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_request_change_log" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_request_extras" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_request_extras" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_request_extras" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_request_ready_day_options" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_request_ready_day_options" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_request_ready_day_options" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_requests" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cleaning_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_expenses" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."intervention_expenses" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_report_photos" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_report_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."intervention_report_photos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_reports" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."intervention_reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."monthly_payment_request_lines" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."monthly_payment_request_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_payment_request_lines" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."monthly_payment_requests" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."monthly_payment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_payment_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."operational_event_log" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."operational_event_log" TO "authenticated";
GRANT ALL ON TABLE "public"."operational_event_log" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."outbound_messages" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."outbound_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."outbound_messages" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."owners" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."owners" TO "authenticated";
GRANT ALL ON TABLE "public"."owners" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."properties" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_cleaner_assignments" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_cleaner_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."property_cleaner_assignments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_cleaning_profiles" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_cleaning_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."property_cleaning_profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_notification_recipients" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_notification_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."property_notification_recipients" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_reference_photos" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_reference_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."property_reference_photos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_source_links" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."property_source_links" TO "authenticated";
GRANT ALL ON TABLE "public"."property_source_links" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reservation_financials" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reservation_financials" TO "authenticated";
GRANT ALL ON TABLE "public"."reservation_financials" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reservations" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."site_pageviews" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."site_pageviews" TO "authenticated";
GRANT ALL ON TABLE "public"."site_pageviews" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."site_pageviews_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."site_pageviews_id_seq" TO "anon";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."test_scenarios" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."test_scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."test_scenarios" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







