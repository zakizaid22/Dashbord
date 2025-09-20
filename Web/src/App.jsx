import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const toUSD = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pct = (n) => `${((n || 0) * 100).toFixed(2)}%`;
const classNames = (...c) => c.filter(Boolean).join(" ");
const safeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const isSafeMetricKey = (key) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);

const toFiniteNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getMetricValue = (row, key) => {
  if (!row) return 0;
  const direct = row[key];
  const directNum = toFiniteNumber(direct);
  if (directNum !== null) return directNum;
  const raw = row.raw?.[key];
  const rawNum = toFiniteNumber(raw);
  if (rawNum !== null) return rawNum;
  return 0;
};

const parseISODate = (value) => {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatISODate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date, amount) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
};

const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1);

const startOfWeek = (date) => {
  const result = startOfDay(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
};

const endOfWeek = (date) => addDays(startOfWeek(date), 6);

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const isSameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isBefore = (a, b) => a && b && a.getTime() < b.getTime();

const isAfter = (a, b) => a && b && a.getTime() > b.getTime();

const formatDisplayDate = (value) => {
  const parsed = parseISODate(value);
  if (!parsed) return "";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const monthLabel = (date) => date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const buildCalendarMonth = (baseDate) => {
  const start = startOfMonth(baseDate);
  const offset = start.getDay();
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const current = addDays(start, i - offset);
    days.push({
      date: current,
      inMonth: current.getMonth() === start.getMonth(),
      iso: formatISODate(current),
    });
  }
  return { month: start, days };
};

const colorPalette = ["#4f46e5", "#22c55e", "#a855f7", "#06b6d4", "#f97316", "#facc15", "#f472b6", "#8b5cf6"];

const settingsStorageKey = "metricHubSettings";

const facebookMetricCatalog = [
  { field: "delivery", label: "Ad Set Delivery", numeric: false },
  { field: "spend", label: "Amount spent" },
  { field: "attribution_setting", label: "Attribution setting", numeric: false },
  { field: "impressions_auto_refresh", label: "Auto-refresh impressions" },
  { field: "purchase_conversion_value", label: "Average purchases conversion value" },
  { field: "clicks", label: "Clicks (all)" },
  { field: "cpc", label: "CPC (all)" },
  { field: "ctr", label: "CTR (all)" },
  { field: "frequency", label: "Frequency" },
  { field: "impressions_gross", label: "Gross impressions (includes invalid impressions from non-human traffic)" },
  { field: "impressions", label: "Impressions" },
  { field: "reach", label: "Reach" },
  { field: "result_rate", label: "Result rate" },
  { field: "results", label: "Results" },
  { field: "purchase_roas", label: "Results ROAS" },
  { field: "action_values_purchase", label: "Results value" },
  { field: "actions_video_view", label: "Views" },
  { field: "conversion_rate_ranking", label: "Conversion rate ranking" },
  { field: "engagement_rate_ranking", label: "Engagement rate ranking" },
  { field: "quality_ranking", label: "Quality ranking" },
  { field: "cost_per_1_000_accounts_center_accounts_reached", label: "Cost per 1,000 Accounts Center accounts reached" },
  { field: "cost_per_result", label: "Cost per result" },
  { field: "cpm", label: "CPM (cost per 1000 impressions)" },
  { field: "video_play_3s_impressions_rate", label: "3-second video plays rate per impressions" },
  { field: "landing_page_views_per_link_click", label: "Landing page views rate per link clicks" },
  { field: "purchase_rate_per_landing_page_view", label: "Purchases rate per landing page views" },
  { field: "purchase_rate_per_link_click", label: "Purchases rate per link clicks" },
  { field: "result_rate_per_link_click", label: "Results rate per link clicks" },
  { field: "actions_check_in", label: "Check-ins" },
  { field: "cost_per_action_type_event_response", label: "Cost per Event Response" },
  { field: "cost_per_action_type_join_group_request", label: "Cost per join group request" },
  { field: "cost_per_action_type_like", label: "Cost per Like" },
  { field: "cost_per_action_type_page_engagement", label: "Cost per Page engagement" },
  { field: "effect_share", label: "Effect share", numeric: false },
  { field: "actions_event_response", label: "Event responses", numeric: false },
  { field: "actions_like", label: "Facebook likes", numeric: false },
  { field: "actions_join_group_request", label: "Join group requests", numeric: false },
  { field: "actions_page_engagement", label: "Page engagement", numeric: false },
  { field: "actions_photo_view", label: "Photo views", numeric: false },
  { field: "actions_post_comment", label: "Post comments", numeric: false },
  { field: "actions_post_save", label: "Post saves", numeric: false },
  { field: "actions_post_reaction", label: "Post reactions", numeric: false },
  { field: "actions_post_engagement", label: "Post engagements", numeric: false },
  { field: "actions_post_share", label: "Post shares", numeric: false },
  { field: "cost_per_action_type_messaging_conversation_started", label: "Cost per messaging conversation started" },
  { field: "video_2_sec_continuous_watched_actions", label: "2-second continuous video plays" },
  { field: "video_3_sec_watched_actions", label: "3-second video plays" },
  { field: "cost_per_2_sec_continuous_video_view", label: "Cost per 2-second continuous video play" },
  { field: "cost_per_3_sec_video_play", label: "Cost per 3-second video play" },
  { field: "cost_per_thruplay", label: "Cost per ThruPlay" },
  { field: "instant_experience_impressions", label: "Instant experience impressions", numeric: false },
  { field: "instant_experience_reach", label: "Instant experience reach", numeric: false },
  { field: "canvas_avg_view_percent", label: "Instant experience view percentage" },
  { field: "canvas_avg_view_time", label: "Instant experience view time" },
  { field: "thruplay", label: "ThruPlays" },
  { field: "video_2_sec_continuous_watched_actions_unique", label: "Unique 2-Second Continuous Video Views" },
  { field: "video_avg_time_watched_actions", label: "Video average play time" },
  { field: "video_play_actions", label: "Video plays" },
  { field: "video_p100_watched_actions", label: "Video plays at 100%" },
  { field: "video_p25_watched_actions", label: "Video plays at 25%" },
  { field: "video_p50_watched_actions", label: "Video plays at 50%" },
  { field: "video_p75_watched_actions", label: "Video plays at 75%" },
  { field: "video_p95_watched_actions", label: "Video plays at 95%" },
  { field: "cost_per_outbound_click", label: "Cost per outbound click" },
  { field: "cost_per_unique_click", label: "Cost per unique click (all)" },
  { field: "cost_per_unique_inline_link_click", label: "Cost per unique link click" },
  { field: "cost_per_unique_outbound_click", label: "Cost per unique outbound click" },
  { field: "cost_per_inline_link_click", label: "CPC (cost per link click)" },
  { field: "inline_link_click_ctr", label: "CTR (link click-through rate)" },
  { field: "instagram_profile_visits", label: "Instagram profile visits" },
  { field: "instant_experience_clicks_to_open", label: "Instant experience clicks to open", numeric: false },
  { field: "instant_experience_clicks_to_start", label: "Instant experience clicks to start", numeric: false },
  { field: "instant_experience_outbound_clicks", label: "Instant experience outbound clicks", numeric: false },
  { field: "inline_link_clicks", label: "Link clicks" },
  { field: "net_reminders_on", label: "Net Reminders on", numeric: false },
  { field: "outbound_clicks", label: "Outbound clicks" },
  { field: "outbound_clicks_ctr", label: "Outbound CTR (click-through rate)" },
  { field: "actions_shop_visit", label: "Shop clicks" },
  { field: "unique_clicks", label: "Unique clicks (all)" },
  { field: "unique_ctr", label: "Unique CTR (all)" },
  { field: "unique_inline_link_click_ctr", label: "Unique CTR (link click-through rate)" },
  { field: "unique_inline_link_clicks", label: "Unique link clicks" },
  { field: "unique_outbound_clicks", label: "Unique outbound clicks" },
  { field: "unique_outbound_clicks_ctr", label: "Unique outbound CTR (click-through rate)" },
  { field: "cost_per_estimated_ad_recallers", label: "Cost per estimated ad recall lift (people)" },
  { field: "estimated_ad_recallers", label: "Estimated ad recall lift (people)" },
  { field: "estimated_ad_recall_rate", label: "Estimated ad recall lift rate" },
  { field: "actions_landing_page_view", label: "Landing page views" },
  { field: "actions_lead", label: "Leads" },
  { field: "actions_purchase", label: "Purchases" },
  { field: "account_id", label: "Account ID", numeric: false },
  { field: "account_name", label: "Account name", numeric: false },
  { field: "ad_id", label: "Ad ID", numeric: false },
  { field: "ad_name", label: "Ad name", numeric: false },
  { field: "adset_id", label: "Ad set ID", numeric: false },
  { field: "adset_name", label: "Ad Set Name", numeric: false },
  { field: "campaign_id", label: "Campaign ID", numeric: false },
  { field: "campaign_name", label: "Campaign name", numeric: false },
  { field: "ad_labels", label: "Tags", numeric: false },
  { field: "created_time", label: "Date created", numeric: false },
  { field: "updated_time", label: "Date last edited", numeric: false },
  { field: "stop_time", label: "Ends", numeric: false },
  { field: "reporting_end", label: "Reporting ends", numeric: false },
  { field: "reporting_start", label: "Reporting starts", numeric: false },
  { field: "start_time", label: "Starts", numeric: false },
  { field: "time_elapsed", label: "Time elapsed percentage" },
  { field: "adset_schedule", label: "Ad schedule", numeric: false },
  { field: "spend_pct", label: "Amount spent percentage" },
  { field: "bid_strategy", label: "Bid strategy", numeric: false },
  { field: "budget", label: "Budget", numeric: false },
  { field: "budget_remaining", label: "Budget remaining", numeric: false },
  { field: "buying_type", label: "Buying type", numeric: false },
  { field: "campaign_spend_limit", label: "Campaign spending limit", numeric: false },
  { field: "conversion_location", label: "Conversion location", numeric: false },
  { field: "objective", label: "Objective", numeric: false },
  { field: "promoted_object", label: "Performance goal", numeric: false },
  { field: "targeting_age", label: "Audience age (Ad set settings)", numeric: false },
  { field: "targeting_gender", label: "Audience gender (Ad set settings)", numeric: false },
  { field: "targeting_geo_locations", label: "Audience location (Ad set settings)", numeric: false },
  { field: "targeting_excluded_custom_audiences", label: "Excluded custom audiences", numeric: false },
  { field: "targeting_custom_audiences", label: "Included custom audiences", numeric: false },
];

const facebookMetricLabelMap = facebookMetricCatalog.reduce((acc, item) => {
  acc[item.field] = item.label;
  return acc;
}, {});

const facebookMetricNumericFields = facebookMetricCatalog
  .filter((item) => item.numeric !== false)
  .map((item) => item.field);

const facebookMetricNumericFieldSet = new Set(facebookMetricNumericFields);

const facebookMetricFieldsAll = facebookMetricCatalog.map((item) => item.field);

const baseMetricSeed = ["impressions", "clicks", "spend", "results", "ctr", "cpc", "cpm", "cost_per_result", "roas", "value"];
const baseMetricFields = Array.from(new Set([...baseMetricSeed, ...facebookMetricNumericFields]));

const defaultInsightFields = Array.from(
  new Set([
    "account_id",
    "account_name",
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "delivery",
    "effective_status",
    "status",
    "buying_type",
    "objective",
    "bid_strategy",
    "budget",
    "budget_remaining",
    "campaign_spend_limit",
    "promoted_object",
    "conversion_location",
    "attribution_setting",
    "created_time",
    "updated_time",
    "start_time",
    "stop_time",
    "reporting_start",
    "reporting_end",
    "time_elapsed",
    ...facebookMetricFieldsAll,
    "actions",
    "action_values",
    "cost_per_action_type",
    "cost_per_unique_action_type",
    "unique_actions",
    "unique_conversions",
    "outbound_clicks",
    "outbound_clicks_ctr",
    "unique_outbound_clicks",
    "unique_outbound_clicks_ctr",
    "website_ctr",
    "video_play_actions",
    "video_10_sec_watched_actions",
    "video_15_sec_watched_actions",
    "video_30_sec_watched_actions",
    "video_plays",
    "video_avg_time_watched_actions",
    "video_p25_watched_actions",
    "video_p50_watched_actions",
    "video_p75_watched_actions",
    "video_p95_watched_actions",
    "video_p100_watched_actions",
  ])
);

const kpiDefs = [
  { key: "ctr", label: "CTR (Link)", fmt: (v) => pct(v) },
  { key: "cpm", label: "CPM", fmt: (v) => v.toFixed(2) },
  { key: "cpr", label: "Cost / Result", fmt: (v) => v.toFixed(2) },
  { key: "spend", label: "Amount Spent", fmt: toUSD },
];

const Icon = {
  Refresh: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classNames("w-5 h-5", props.className)}>
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 0 1 15.5-6.36M21 12a9 9 0 0 1-15.5 6.36" />
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M3 4v4h4M17 16h4v4" />
    </svg>
  ),
  Cog: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classNames("w-5 h-5", props.className)}>
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317a1.5 1.5 0 0 1 3.35 0 1.5 1.5 0 0 0 2.254 1.027 1.5 1.5 0 0 1 2.061.566l.012.023a1.5 1.5 0 0 1-.566 2.06 1.5 1.5 0 0 0 0 2.648 1.5 1.5 0 0 1 .566 2.061l-.012.022a1.5 1.5 0 0 1-2.06.566 1.5 1.5 0 0 0-2.255 1.027 1.5 1.5 0 0 1-3.35 0 1.5 1.5 0 0 0-2.254-1.027 1.5 1.5 0 0 1-2.061-.566l-.012-.022a1.5 1.5 0 0 1 .566-2.061 1.5 1.5 0 0 0 0-2.648 1.5 1.5 0 0 1-.566-2.06l.012-.023a1.5 1.5 0 0 1 2.06-.566 1.5 1.5 0 0 0 2.255-1.027Z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Download: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classNames("w-5 h-5", props.className)}>
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
    </svg>
  ),
  Bell: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classNames("w-5 h-5", props.className)}>
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M6 8a6 6 0 1 1 12 0v5l2 3H4l2-3Z" />
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  Plus: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classNames("w-5 h-5", props.className)}>
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  ),
  Calendar: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classNames("w-5 h-5", props.className)}>
      <rect x="3" y="4" width="18" height="17" rx="2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  ArrowDown: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classNames("w-4 h-4", props.className)}>
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  ),
};
function Pie({ data, size = 160, inner = 56 }) {
  const total = data.reduce((acc, cur) => acc + cur.value, 0);
  let acc = 0;
  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  const arcs = data.map((d, i) => {
    const start = (acc / (total || 1)) * Math.PI * 2;
    acc += d.value;
    const end = (acc / (total || 1)) * Math.PI * 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    return (
      <path key={i} d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`} fill={d.color} opacity={0.9} />
    );
  });

  return (
    <svg width={size} height={size} className="mx-auto">
      {total === 0 ? <circle cx={cx} cy={cy} r={radius} fill="#1e293b" /> : arcs}
      <circle cx={cx} cy={cy} r={inner} fill="#0f172a" />
    </svg>
  );
}

function MiniTrend({ points = [] }) {
  const w = 110;
  const h = 36;
  if (!points || points.length <= 1) return <div className="h-9" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const norm = (v, i) => [
    (i / (points.length - 1 || 1)) * w,
    h - ((v - min) / (max - min || 1)) * h,
  ];
  const path = points.map((p, i) => norm(p, i).join(",")).join(" L ");
  return (
    <svg width={w} height={h}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={`M ${path}`} />
    </svg>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  allowSelectAll = false,
  emptyLabel = "No options available",
  className,
  renderOption,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const toggleOption = (id) => {
    const nextSelection = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    const nextSet = new Set(nextSelection);
    const ordered = options.map((opt) => opt.id).filter((item) => nextSet.has(item));
    onChange(ordered);
  };

  const clearAll = () => {
    onChange([]);
  };

  const totalOptions = options.length;
  const totalSelected = selectedIds.length;
  const isAllSelected = !totalOptions || !totalSelected || totalSelected === totalOptions;
  const selectedSet = new Set(selectedIds);
  const selectedLabels = options
    .filter((opt) => selectedSet.has(opt.id))
    .map((opt) => opt.name || opt.id);

  let display = placeholder || label;
  if (!isAllSelected && selectedLabels.length) {
    const preview = selectedLabels.slice(0, 2).join(", ");
    const extra = selectedLabels.length > 2 ? ` +${selectedLabels.length - 2}` : "";
    display = `${preview}${extra}`;
  }

  return (
    <div ref={containerRef} className={classNames("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={classNames(
          "w-full flex items-center justify-between gap-2 bg-slate-900/80 text-slate-100 border border-slate-700 rounded-2xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500",
          open && "border-indigo-500/60"
        )}
      >
        <span className="truncate text-sm">{display}</span>
        <Icon.ArrowDown className={classNames("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="max-h-60 overflow-y-auto py-2">
            {allowSelectAll && (
              <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-indigo-500"
                  checked={isAllSelected}
                  onChange={clearAll}
                />
                <span className="truncate">{label}</span>
              </label>
            )}
            {options.length ? (
              options.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/80 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    className="accent-indigo-500"
                    checked={selectedSet.has(opt.id)}
                    onChange={() => toggleOption(opt.id)}
                  />
                  <div className="flex-1 min-w-0">
                    {renderOption ? renderOption(opt) : <span className="truncate">{opt.name || opt.id}</span>}
                  </div>
                </label>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400">{emptyLabel}</div>
            )}
          </div>
          {totalSelected > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800 bg-slate-900/80 text-xs text-slate-400">
              <span>{totalSelected} selected</span>
              <button type="button" className="text-indigo-400 hover:text-indigo-300" onClick={clearAll}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function DateRangePicker({ value, onChange, className }) {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState({ from: null, to: null });
  const [hoveredDate, setHoveredDate] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseISODate(value?.to || value?.from) || new Date()));
  const containerRef = useRef(null);
  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const from = parseISODate(value?.from);
    const to = parseISODate(value?.to);
    setTempRange({ from, to });
    setHoveredDate(null);
    const anchor = to || from || today;
    setViewMonth(startOfMonth(anchor));
  }, [open, value?.from, value?.to, today]);

  const monthOne = useMemo(() => buildCalendarMonth(viewMonth), [viewMonth]);
  const monthTwo = useMemo(() => buildCalendarMonth(addMonths(viewMonth, 1)), [viewMonth]);

  const previewEnd = tempRange.to || (!tempRange.to && tempRange.from && hoveredDate ? hoveredDate : null);
  let rangeStart = tempRange.from;
  let rangeEnd = previewEnd;
  if (rangeStart && rangeEnd && isAfter(rangeStart, rangeEnd)) {
    const swap = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = swap;
  }

  const hasCompleteRange = Boolean(tempRange.from && tempRange.to);
  const totalSelectedDays = hasCompleteRange
    ? Math.abs(Math.round((tempRange.to.getTime() - tempRange.from.getTime()) / 86400000)) + 1
    : 0;

  const displayLabel =
    value?.from && value?.to
      ? `${formatDisplayDate(value.from)} - ${formatDisplayDate(value.to)}`
      : "Select date range";

  const describeDate = (date) => (date ? formatDisplayDate(formatISODate(date)) : "");

  const handleDayClick = (date) => {
    if (!tempRange.from || (tempRange.from && tempRange.to)) {
      setTempRange({ from: date, to: null });
      setHoveredDate(null);
      return;
    }
    if (tempRange.from && !tempRange.to) {
      if (isBefore(date, tempRange.from)) {
        setTempRange({ from: date, to: tempRange.from });
      } else {
        setTempRange({ from: tempRange.from, to: date });
      }
      setHoveredDate(null);
    }
  };

  const handleDayMouseEnter = (date) => {
    if (tempRange.from && !tempRange.to) setHoveredDate(date);
  };

  const handleDayMouseLeave = () => {
    if (tempRange.from && !tempRange.to) setHoveredDate(null);
  };

  const handleApply = () => {
    if (!tempRange.from || !tempRange.to) return;
    const start = isAfter(tempRange.from, tempRange.to) ? tempRange.to : tempRange.from;
    const end = isAfter(tempRange.from, tempRange.to) ? tempRange.from : tempRange.to;
    onChange({ from: formatISODate(start), to: formatISODate(end) });
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
    setTempRange({ from: parseISODate(value?.from), to: parseISODate(value?.to) });
    setHoveredDate(null);
  };

  const applyQuickRange = (rangeValue) => {
    if (!rangeValue?.from || !rangeValue?.to) return;
    const clonedFrom = addDays(rangeValue.from, 0);
    const clonedTo = addDays(rangeValue.to, 0);
    setTempRange({ from: clonedFrom, to: clonedTo });
    setHoveredDate(null);
    setViewMonth(startOfMonth(clonedTo));
    onChange({ from: formatISODate(clonedFrom), to: formatISODate(clonedTo) });
    setOpen(false);
  };

  const quickRanges = useMemo(() => {
    const todayStart = today;
    const yesterday = addDays(todayStart, -1);
    const last7 = addDays(todayStart, -6);
    const last14 = addDays(todayStart, -13);
    const last30 = addDays(todayStart, -29);
    const weekStart = startOfWeek(todayStart);
    const weekEnd = endOfWeek(todayStart);
    const lastWeekEnd = addDays(weekStart, -1);
    const lastWeekStart = startOfWeek(lastWeekEnd);
    const thisMonthStart = startOfMonth(todayStart);
    const thisMonthEnd = endOfMonth(todayStart);
    const prevMonthEnd = addDays(thisMonthStart, -1);
    const prevMonthStart = startOfMonth(prevMonthEnd);
    const range = (from, to) => ({ from, to });
    return [
      { key: "today", label: "Today", range: range(todayStart, todayStart) },
      { key: "yesterday", label: "Yesterday", range: range(yesterday, yesterday) },
      { key: "last7", label: "Last 7 days", range: range(last7, todayStart) },
      { key: "last14", label: "Last 14 days", range: range(last14, todayStart) },
      { key: "last30", label: "Last 30 days", range: range(last30, todayStart) },
      { key: "thisWeek", label: "This week", range: range(weekStart, weekEnd) },
      { key: "lastWeek", label: "Last week", range: range(lastWeekStart, lastWeekEnd) },
      { key: "thisMonth", label: "This month", range: range(thisMonthStart, thisMonthEnd) },
      { key: "lastMonth", label: "Last month", range: range(prevMonthStart, prevMonthEnd) },
    ];
  }, [today]);

  return (
    <div ref={containerRef} className={classNames("relative w-full", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={classNames(
          "w-full flex items-center justify-between gap-4 bg-white/10 hover:bg-white/20 rounded-2xl px-3 py-2 text-left text-white",
          open && "ring-1 ring-indigo-300/60"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Icon.Calendar />
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-white/70">Date range</span>
            <span className="text-sm font-medium text-white/90">{displayLabel}</span>
          </div>
        </div>
        <Icon.ArrowDown className={classNames("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-3 w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-48 border-b border-slate-800 md:border-b-0 md:border-r overflow-hidden">
              <div className="p-3 space-y-1">
                {quickRanges.map((entry) => {
                  const { range, label, key } = entry;
                  const isSelected =
                    tempRange.from &&
                    tempRange.to &&
                    isSameDay(tempRange.from, range.from) &&
                    isSameDay(tempRange.to, range.to);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyQuickRange(range)}
                      className={classNames(
                        "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                        isSelected ? "bg-indigo-500/20 text-indigo-200" : "text-slate-200 hover:bg-slate-800/80"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 p-4">
              <div className="flex items-center justify-between mb-4 text-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                  className="p-2 rounded-full hover:bg-slate-800/80"
                >
                  <Icon.ArrowDown className="-rotate-90" />
                </button>
                <div className="flex items-center gap-6 text-sm font-medium">
                  <span>{monthLabel(monthOne.month)}</span>
                  <span className="hidden md:inline">{monthLabel(monthTwo.month)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                  className="p-2 rounded-full hover:bg-slate-800/80"
                >
                  <Icon.ArrowDown className="rotate-90" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[monthOne, monthTwo].map((monthData, idx) => (
                  <div key={`${monthData.month.getFullYear()}-${monthData.month.getMonth()}-${idx}`} className="space-y-2">
                    <div className="text-sm font-medium text-white/90 text-center md:hidden">
                      {monthLabel(monthData.month)}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-slate-500">
                      {weekdayLabels.map((day) => (
                        <div key={day} className="text-center py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {monthData.days.map((day, dayIndex) => {
                        const isStart = rangeStart && isSameDay(day.date, rangeStart);
                        const isEnd = rangeEnd && isSameDay(day.date, rangeEnd);
                        const isBetween = rangeStart && rangeEnd && isAfter(day.date, rangeStart) && isBefore(day.date, rangeEnd);
                        const highlightHover = tempRange.from && !tempRange.to && hoveredDate && isSameDay(day.date, hoveredDate);
                        const isTodayCell = isSameDay(day.date, today);
                        return (
                          <button
                            key={`${day.iso}-${dayIndex}`}
                            type="button"
                            onClick={() => handleDayClick(day.date)}
                            onMouseEnter={() => handleDayMouseEnter(day.date)}
                            onMouseLeave={handleDayMouseLeave}
                            className={classNames(
                              "flex items-center justify-center h-9 w-9 rounded-full text-sm transition-colors",
                              day.inMonth ? "" : "text-slate-600",
                              isStart || isEnd
                                ? "bg-indigo-500 text-white"
                                : isBetween
                                ? "bg-indigo-500/20 text-indigo-100"
                                : highlightHover
                                ? "bg-indigo-500/30 text-white"
                                : "hover:bg-slate-800/80 text-slate-200",
                              isTodayCell && !isStart && !isEnd && !isBetween && !highlightHover ? "border border-indigo-400/60" : ""
                            )}
                          >
                            {day.date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-slate-800 pt-3">
                <div className="text-xs text-slate-400">
                  {rangeStart ? (
                    <span>
                      {describeDate(rangeStart)}
                      {rangeEnd ? ` to ${describeDate(rangeEnd)}` : ""}
                      {totalSelectedDays > 0 ? ` | ${totalSelectedDays} day${totalSelectedDays > 1 ? "s" : ""}` : ""}
                    </span>
                  ) : (
                    <span>Select a start date</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={!tempRange.from || !tempRange.to}
                    className={classNames(
                      "px-3 py-2 text-xs font-semibold rounded-xl",
                      tempRange.from && tempRange.to
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                    )}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function CustomMetricBuilder({ baseFields = [], fieldCatalog = [], initialMetric, onSubmit, onCancel }) {
  const defaultFormula = "(results * 15) / spend";
  const isEditing = Boolean(initialMetric);
  const [name, setName] = useState(initialMetric?.name || "");
  const [formula, setFormula] = useState(initialMetric?.formula || defaultFormula);
  const [error, setError] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");

  useEffect(() => {
    setName(initialMetric?.name || "");
    setFormula(initialMetric?.formula || defaultFormula);
    setError("");
  }, [initialMetric]);

  const normalizedCatalog = useMemo(() => {
    const catalog = fieldCatalog.length
      ? fieldCatalog
      : baseFields.map((field) => ({ field, label: field }));
    const dedup = new Map();
    catalog.forEach((item) => {
      if (!item || !item.field) return;
      if (!dedup.has(item.field)) {
        dedup.set(item.field, {
          field: item.field,
          label: item.label || item.field,
          numeric: item.numeric !== false,
        });
      }
    });
    return Array.from(dedup.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [fieldCatalog, baseFields]);

  const filteredCatalog = useMemo(() => {
    const term = fieldSearch.trim().toLowerCase();
    if (!term) return normalizedCatalog;
    return normalizedCatalog.filter(
      (item) =>
        item.field.toLowerCase().includes(term) ||
        item.label.toLowerCase().includes(term)
    );
  }, [normalizedCatalog, fieldSearch]);

  const availableOptions = useMemo(
    () => filteredCatalog.filter((item) => item.numeric !== false),
    [filteredCatalog]
  );

  const evaluatorFields = useMemo(() => {
    if (availableOptions.length) return availableOptions.map((item) => item.field);
    if (baseFields.length) return baseFields;
    return normalizedCatalog.map((item) => item.field);
  }, [availableOptions, baseFields, normalizedCatalog]);

  const insertField = (field) => {
    setFormula((prev) => {
      const base = prev || "";
      const needsSpace = base && !base.endsWith(" ");
      return `${base}${needsSpace ? " " : ""}${field}`;
    });
  };

  const handleSubmit = () => {
    const evaluationFields = evaluatorFields.length ? evaluatorFields : baseFields;
    try {
      const evaluator = createMetricEvaluator(formula, evaluationFields);
      if (!evaluator) {
        setError("Invalid formula. Use available fields and operators.");
        return;
      }
      const sampleRow = Object.fromEntries(evaluationFields.map((key) => [key, 1]));
      const result = evaluator(sampleRow);
      if (!Number.isFinite(result)) {
        setError("Formula did not evaluate to a number.");
        return;
      }
      const payload = {
        name: (name || "").trim() || "Custom Metric",
        formula: formula.trim() || defaultFormula,
      };
      const outcome = onSubmit?.(payload);
      if (outcome !== false && !isEditing) {
        setName("");
        setFormula(defaultFormula);
      }
      setError("");
    } catch (e) {
      setError("Invalid formula. Use available fields and operators.");
    }
  };

  const handleCancel = () => {
    onCancel?.();
    setName("");
    setFormula(defaultFormula);
    setError("");
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-100">{isEditing ? "Edit Custom Metric" : "Create Custom Metric"}</div>
          <div className="text-xs text-slate-400">Click a field to insert it into your formula.</div>
        </div>
        {isEditing && (
          <button type="button" onClick={handleCancel} className="text-xs text-indigo-300 hover:text-indigo-200">
            New metric
          </button>
        )}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Metric name (e.g. Blended ROAS)"
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Available fields</div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="search"
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            placeholder="Search fields..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {fieldSearch && (
            <button type="button" onClick={() => setFieldSearch("")} className="text-xs text-indigo-300 hover:text-indigo-200">
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
          {availableOptions.length ? (
            availableOptions.map((option) => (
              <button
                key={option.field}
                type="button"
                onClick={() => insertField(option.field)}
                className="px-2 py-1 text-xs rounded-full bg-slate-800/80 text-slate-200 hover:bg-indigo-500/20 hover:text-indigo-200"
                title={option.field}
              >
                <span>{option.label}</span>
                {option.label !== option.field && (
                  <span className="ml-1 text-[10px] text-slate-400">({option.field})</span>
                )}
              </button>
            ))
          ) : (
            <div className="text-xs text-slate-400">
              {normalizedCatalog.length
                ? "No numeric fields match that search."
                : "No numeric fields available yet."}
            </div>
          )}
        </div>
      </div>
      <textarea
        value={formula}
        onChange={(e) => setFormula(e.target.value)}
        placeholder={defaultFormula}
        rows={3}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <div className="text-xs text-rose-300">{error}</div>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
        >
          {isEditing ? "Update Metric" : "Save Metric"}
        </button>
      </div>
    </div>
  );
}

function CustomMetricManager({ baseFields = [], fieldCatalog = [], metrics, onCreate, onUpdate, onDelete, onToggleEnabled, onClose }) {
  const [editingId, setEditingId] = useState(null);
  const [metricSearch, setMetricSearch] = useState("");
  const editingMetric = useMemo(() => metrics.find((metric) => metric.id === editingId) || null, [metrics, editingId]);

  const handleSubmit = (metric) => {
    if (editingMetric) {
      onUpdate?.(editingMetric.id, metric);
      setEditingId(null);
    } else {
      onCreate?.(metric);
    }
    return true;
  };

  const handleDelete = (id) => {
    onDelete?.(id);
    if (editingId === id) setEditingId(null);
  };

  const closeManager = () => {
    setEditingId(null);
    onClose?.();
  };

  const filteredMetrics = useMemo(() => {
    const term = metricSearch.trim().toLowerCase();
    if (!term) return metrics;
    return metrics.filter((metric) => {
      const name = (metric.name || "").toLowerCase();
      const formula = (metric.formula || "").toLowerCase();
      return name.includes(term) || formula.includes(term);
    });
  }, [metrics, metricSearch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Custom Metrics</h2>
            <p className="text-xs text-slate-400">Build, edit, and choose which custom KPIs are visible.</p>
          </div>
          <button type="button" onClick={closeManager} className="text-2xl leading-none text-slate-400 hover:text-slate-200">&times;</button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <CustomMetricBuilder
            baseFields={baseFields}
            fieldCatalog={fieldCatalog}
            initialMetric={editingMetric}
            onSubmit={handleSubmit}
            onCancel={() => setEditingId(null)}
          />
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={metricSearch}
                onChange={(e) => setMetricSearch(e.target.value)}
                placeholder="Search metrics..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {metricSearch && (
                <button type="button" onClick={() => setMetricSearch("")} className="text-xs text-indigo-300 hover:text-indigo-200">
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-3 max-h-[24rem] overflow-y-auto mt-3">
              {filteredMetrics.length ? (
                filteredMetrics.map((metric) => {
                  const enabled = metric.enabled !== false;
                  return (
                    <div key={metric.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-100 truncate">{metric.name}</div>
                          <code className="block text-xs text-slate-300 mt-1 break-words">{metric.formula}</code>
                        </div>
                        <div className="flex items-start gap-2">
                          <label className="flex items-center gap-1 text-xs text-slate-400">
                            <input
                              type="checkbox"
                              className="accent-indigo-500"
                              checked={enabled}
                              onChange={() => onToggleEnabled?.(metric.id, !enabled)}
                            />
                            Show
                          </label>
                          <button
                            type="button"
                            onClick={() => setEditingId(metric.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(metric.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : metrics.length ? (
                <div className="text-sm text-slate-400">No custom metrics match that search.</div>
              ) : (
                <div className="text-sm text-slate-400">No custom metrics yet. Create one on the left.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, trailing, children }) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          {description && <p className="text-sm text-slate-400">{description}</p>}
        </div>
        {trailing}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function computeDelta(series) {
  if (!series || series.length < 2) return undefined;
  const first = series[0];
  const last = series[series.length - 1];
  if (!Number.isFinite(first) || Math.abs(first) < 1e-9) return undefined;
  return (last - first) / Math.abs(first);
}

function buildDistribution(rows, key) {
  const totals = new Map();
  rows.forEach((row) => {
    const bucketRaw = row[key];
    const bucket = bucketRaw ? bucketRaw.toString() : "Unknown";
    const spend = safeNumber(row.spend);
    const value = safeNumber(row.value);
    const results = safeNumber(row.results);
    const clicks = safeNumber(row.clicks);
    const impressions = safeNumber(row.impressions);
    let amount = spend;
    if (amount <= 0 && value > 0) amount = value;
    if (amount <= 0 && results > 0) amount = results;
    if (amount <= 0 && clicks > 0) amount = clicks;
    if (amount <= 0 && impressions > 0) amount = impressions;
    const entry = totals.get(bucket) || { spend: 0, value: 0, results: 0, clicks: 0, impressions: 0, amount: 0 };
    entry.spend += spend;
    entry.value += value;
    entry.results += results;
    entry.clicks += clicks;
    entry.impressions += impressions;
    entry.amount += amount;
    totals.set(bucket, entry);
  });
  let grandTotal = 0;
  totals.forEach((entry) => { grandTotal += entry.amount; });
  if (grandTotal <= 0) {
    grandTotal = 0;
    totals.forEach((entry) => {
      entry.amount = entry.spend || entry.value || entry.results || entry.clicks || entry.impressions;
      grandTotal += entry.amount;
    });
  }
  const sorted = Array.from(totals.entries())
    .map(([name, stats]) => ({ name, stats }))
    .sort((a, b) => b.stats.amount - a.stats.amount);
  return sorted.map(({ name, stats }, index) => ({
    name,
    amount: stats.amount,
    percent: grandTotal > 0 ? (stats.amount / grandTotal) * 100 : 0,
    spend: stats.spend,
    impressions: stats.impressions,
    clicks: stats.clicks,
    results: stats.results,
    color: colorPalette[index % colorPalette.length],
  }));
}

function normalizeMainRow(row) {
  const impressions = safeNumber(row.impressions);
  const clicks = safeNumber(row.clicks ?? row.outbound_clicks_total);
  const spend = safeNumber(row.spend);
  const results = safeNumber(row.results ?? row.actions_purchase);
  const valuesPurchase = safeNumber(row["action_values_purchase"]);
  const roasPurchase = safeNumber(row["purchase_roas_purchase"]);
  const name = row.campaign_name || row.adset_name || row.ad_name || row.account_name || "Unnamed";
  const id = row.campaign_id || row.adset_id || row.ad_id || `${name}-${row.date_start || ""}-${row.date_stop || ""}`;

  const normalized = {
    id,
    campaign_id: row.campaign_id || row.adset_id || row.ad_id || id,
    name,
    impressions,
    clicks,
    spend,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    results,
    cost_per_result: results > 0 ? spend / results : 0,
    roas: roasPurchase > 0 ? roasPurchase : spend > 0 && valuesPurchase > 0 ? valuesPurchase / spend : 0,
    value: valuesPurchase,
    date_start: row.date_start,
    date_stop: row.date_stop,
    account_name: row.account_name || "",
    raw: row,
  };

  const mergeNumeric = (key, value) => {
    if (!isSafeMetricKey(key)) return;
    const numeric = toFiniteNumber(value);
    if (numeric === null) return;
    const current = normalized[key];
    if (typeof current === "number" && Number.isFinite(current)) {
      normalized[key] = current + numeric;
    } else if (!Object.prototype.hasOwnProperty.call(normalized, key)) {
      normalized[key] = numeric;
    } else if (Number.isFinite(numeric)) {
      normalized[key] = numeric;
    }
  };

  Object.entries(row || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) return;
    mergeNumeric(key, value);
  });

  const flattenMetricArray = (source, prefix) => {
    if (!Array.isArray(source)) return;
    source.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const rawType = (entry.action_type || entry.name || entry.label || entry.metric || entry.type || "").toString();
      if (!rawType) return;
      const numeric = toFiniteNumber(entry.value ?? entry.metric_value ?? entry.score ?? entry.count);
      if (numeric === null) return;
      const sanitized = rawType.replace(/[^a-z0-9]+/gi, "_").toLowerCase().replace(/^_+|_+$/g, "");
      if (!sanitized) return;
      const key = prefix ? `${prefix}_${sanitized}` : sanitized;
      mergeNumeric(key, numeric);
    });
  };

  const arraySources = [
    ["actions", "actions"],
    ["action_values", "action_values"],
    ["cost_per_action_type", "cost_per_action_type"],
    ["cost_per_unique_action_type", "cost_per_unique_action_type"],
    ["cost_per_outbound_click", "cost_per_outbound_click"],
    ["cost_per_unique_outbound_click", "cost_per_unique_outbound_click"],
    ["unique_actions", "unique_actions"],
    ["unique_conversions", "unique_conversions"],
    ["outbound_clicks", "outbound_clicks"],
    ["outbound_clicks_ctr", "outbound_clicks_ctr"],
    ["unique_outbound_clicks", "unique_outbound_clicks"],
    ["unique_outbound_clicks_ctr", "unique_outbound_clicks_ctr"],
    ["website_ctr", "website_ctr"],
    ["website_clicks", "website_clicks"],
    ["instant_experience_clicks_to_open", "instant_experience_clicks_to_open"],
    ["instant_experience_clicks_to_start", "instant_experience_clicks_to_start"],
    ["instant_experience_outbound_clicks", "instant_experience_outbound_clicks"],
    ["video_play_actions", "video_play_actions"],
    ["video_2_sec_continuous_watched_actions", "video_2_sec_continuous_watched_actions"],
    ["video_3_sec_watched_actions", "video_3_sec_watched_actions"],
    ["video_10_sec_watched_actions", "video_10_sec_watched_actions"],
    ["video_15_sec_watched_actions", "video_15_sec_watched_actions"],
    ["video_30_sec_watched_actions", "video_30_sec_watched_actions"],
    ["video_p25_watched_actions", "video_p25_watched_actions"],
    ["video_p50_watched_actions", "video_p50_watched_actions"],
    ["video_p75_watched_actions", "video_p75_watched_actions"],
    ["video_p95_watched_actions", "video_p95_watched_actions"],
    ["video_p100_watched_actions", "video_p100_watched_actions"],
  ];

  arraySources.forEach(([key, prefix]) => flattenMetricArray(row?.[key], prefix));

  return normalized;
}

function computeKpis(rows) {
  if (!rows.length) {
    return {
      ctr: 0,
      cpm: 0,
      cpr: 0,
      spend: 0,
      trends: { ctr: [], cpm: [], cpr: [], spend: [] },
      deltas: {},
    };
  }
  const totalSpend = rows.reduce((acc, row) => acc + row.spend, 0);
  const totalImpressions = rows.reduce((acc, row) => acc + row.impressions, 0);
  const totalClicks = rows.reduce((acc, row) => acc + row.clicks, 0);
  const totalResults = rows.reduce((acc, row) => acc + row.results, 0);

  const buckets = new Map();
  rows.forEach((row) => {
    const label = row.date_start || row.date_stop;
    if (!label) return;
    if (!buckets.has(label)) {
      buckets.set(label, { spend: 0, clicks: 0, impressions: 0, results: 0 });
    }
    const bucket = buckets.get(label);
    bucket.spend += row.spend;
    bucket.clicks += row.clicks;
    bucket.impressions += row.impressions;
    bucket.results += row.results;
  });
  const ordered = Array.from(buckets.entries())
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([, value]) => value);
  const ctrTrend = ordered.map((item) => (item.impressions > 0 ? item.clicks / item.impressions : 0));
  const cpmTrend = ordered.map((item) => (item.impressions > 0 ? (item.spend / item.impressions) * 1000 : 0));
  const cprTrend = ordered.map((item) => (item.results > 0 ? item.spend / item.results : 0));
  const spendTrend = ordered.map((item) => item.spend);

  return {
    ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    cpr: totalResults > 0 ? totalSpend / totalResults : 0,
    spend: totalSpend,
    trends: { ctr: ctrTrend, cpm: cpmTrend, cpr: cprTrend, spend: spendTrend },
    deltas: {
      ctr: computeDelta(ctrTrend),
      cpm: computeDelta(cpmTrend),
      cpr: computeDelta(cprTrend),
      spend: computeDelta(spendTrend),
    },
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error || res.statusText || "Request failed";
    throw new Error(message);
  }
  return data;
}

function parseManualAccountInput(input) {
  if (!input) return [];
  const map = new Map();
  input
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [idPart, ...nameParts] = entry.split(":");
      const id = idPart.trim();
      if (!id) return;
      const name = nameParts.join(":").trim();
      if (!map.has(id)) {
        map.set(id, { id, name: name || id });
      } else if (name) {
        map.set(id, { id, name });
      }
    });
  return Array.from(map.values());
}

function normalizeBreakdownRows(rows = [], key) {
  return rows.map((row) => ({
    [key]: row[key] ?? row.breakdown_value ?? "Unknown",
    spend: safeNumber(row.spend),
    value: safeNumber(row.value ?? row.action_values_purchase),
    results: safeNumber(row.results ?? row.actions_purchase),
    clicks: safeNumber(row.clicks ?? row.total_unique_clicks),
    impressions: safeNumber(row.impressions),
  }));
}


function sanitizeStoredMetrics(list = []) {
  const sanitized = [];
  list.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const formula = typeof entry.formula === "string" ? entry.formula.trim() : "";
    if (!formula) return;
    const name = typeof entry.name === "string" ? entry.name : `Custom Metric ${sanitized.length + 1}`;
    const id = entry.id || `metric_${Date.now()}_${index}`;
    sanitized.push({
      ...entry,
      id,
      name,
      formula,
      enabled: entry.enabled !== false,
    });
  });
  return sanitized;
}

function aggregateByCampaign(rows) {
  const groups = new Map();
  const skipKeys = new Set([
    "id",
    "campaign_id",
    "name",
    "account_name",
    "date_start",
    "date_stop",
    "raw",
    "impressions",
    "clicks",
    "spend",
    "results",
    "value",
    "ctr",
    "cpm",
    "cpc",
    "cost_per_result",
    "roas",
  ]);

  rows.forEach((row) => {
    const id = row.campaign_id || row.id || row.raw?.campaign_id || row.name;
    if (!id) return;
    if (groups.has(id)) {
      const existing = groups.get(id);
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.spend += row.spend;
      existing.results += row.results;
      existing.value += row.value || 0;
      Object.entries(row).forEach(([key, value]) => {
        if (skipKeys.has(key)) return;
        if (typeof value !== "number" || !Number.isFinite(value)) return;
        existing[key] = (existing[key] || 0) + value;
      });
      if (row.date_start && (!existing.date_start || row.date_start < existing.date_start)) {
        existing.date_start = row.date_start;
      }
      if (row.date_stop && (!existing.date_stop || row.date_stop > existing.date_stop)) {
        existing.date_stop = row.date_stop;
      }
    } else {
      const initial = {
        ...row,
        impressions: row.impressions,
        clicks: row.clicks,
        spend: row.spend,
        results: row.results,
        value: row.value || 0,
        date_start: row.date_start,
        date_stop: row.date_stop,
      };
      groups.set(id, initial);
    }
  });
  return Array.from(groups.values()).map((row) => ({
    ...row,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
    cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0,
    cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
    cost_per_result: row.results > 0 ? row.spend / row.results : 0,
    roas: row.value > 0 && row.spend > 0 ? row.value / row.spend : row.roas || 0,
  }));
}

function createMetricEvaluator(formula, fields = baseMetricFields) {
  try {
    const args = Array.from(new Set(fields));
    const fn = new Function(...args, `return ${formula}`);
    return (row) => {
      const values = args.map((key) => getMetricValue(row, key));
      const result = fn(...values);
      return Number.isFinite(result) ? Number(result) : NaN;
    };
  } catch (error) {
    console.warn('Invalid metric formula', error);
    return null;
  }
}

export default function App() {
  const [dateRange, setDateRange] = useState({ from: "2025-02-27", to: "2025-03-26" });
  const [accountFilter, setAccountFilter] = useState([]);
  const [campaignFilter, setCampaignFilter] = useState([]);
  const [configAccounts, setConfigAccounts] = useState([]);
  const [manualAccounts, setManualAccounts] = useState([]);
  const accounts = useMemo(() => {
    const map = new Map();
    configAccounts.forEach((acc) => acc?.id && map.set(acc.id, acc));
    manualAccounts.forEach((acc) => acc?.id && map.set(acc.id, acc));
    return Array.from(map.values());
  }, [configAccounts, manualAccounts]);
  const [fields, setFields] = useState(defaultInsightFields);
  const [excludedInsightFields, setExcludedInsightFields] = useState([]);
  const activeInsightFields = useMemo(
    () => fields.filter((field) => !excludedInsightFields.includes(field)),
    [fields, excludedInsightFields]
  );
  const [timeIncrement, setTimeIncrement] = useState("1");

  const [rawRows, setRawRows] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const availableMetricFields = useMemo(() => {
    const fieldSet = new Set(baseMetricFields);
    detailRows.forEach((row) => {
      Object.entries(row || {}).forEach(([key, value]) => {
        if (!isSafeMetricKey(key)) return;
        if (typeof value === "number" && Number.isFinite(value)) fieldSet.add(key);
      });
      if (row?.raw && typeof row.raw === "object") {
        Object.entries(row.raw).forEach(([key, value]) => {
          if (!isSafeMetricKey(key)) return;
          const numeric = toFiniteNumber(value);
          if (numeric === null) return;
          fieldSet.add(key);
        });
      }
    });
    return Array.from(fieldSet).sort((a, b) => a.localeCompare(b));
  }, [detailRows]);
  const availableMetricCatalog = useMemo(() =>
    availableMetricFields.map((field) => ({
      field,
      label: facebookMetricLabelMap[field] || field,
      numeric: facebookMetricNumericFieldSet.has(field) || !facebookMetricLabelMap[field],
    })),
  [availableMetricFields]
  );

  const [platformRows, setPlatformRows] = useState([]);
  const [placementRows, setPlacementRows] = useState([]);
  const [genderRows, setGenderRows] = useState([]);
  const [regionRows, setRegionRows] = useState([]);

  const [customMetrics, setCustomMetrics] = useState([]);
  const [showMetricManager, setShowMetricManager] = useState(false);
  const [alertsOn, setAlertsOn] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [tokenOverride, setTokenOverride] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "spend", dir: "desc" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const autoRemovedFieldsRef = useRef([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [draftToken, setDraftToken] = useState("");
  const [draftSelectedAccounts, setDraftSelectedAccounts] = useState([]);
  const [draftManualAccounts, setDraftManualAccounts] = useState("");

  const updateStoredSettings = useCallback((updates) => {
    try {
      const raw = localStorage.getItem(settingsStorageKey);
      const current = raw ? JSON.parse(raw) : {};
      localStorage.setItem(settingsStorageKey, JSON.stringify({ ...current, ...updates }));
    } catch (err) {
      console.warn("Unable to persist settings", err);
    }
  }, []);

  useEffect(() => {
    setExcludedInsightFields((prev) => prev.filter((field) => fields.includes(field)));
  }, [fields]);

  useEffect(() => {
    let active = true;
    const loadConfig = async () => {
      try {
        const config = await fetchJson(`${API_BASE_URL}/api/config`).catch(() => null);
        if (!active || !config) return;
        if (config.defaultFields?.length) setFields(config.defaultFields);
        if (config.defaultTimeIncrement) setTimeIncrement(config.defaultTimeIncrement);
        setConfigAccounts(config.accounts || []);
      } catch (e) {
        // keep defaults
      } finally {
        if (active) setConfigLoaded(true);
      }
    };
    loadConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!configLoaded) return;
    const savedRaw = localStorage.getItem(settingsStorageKey);
    if (!savedRaw) return;
    try {
      const saved = JSON.parse(savedRaw);
      if (Array.isArray(saved.manualAccounts)) {
        setManualAccounts(saved.manualAccounts.filter((entry) => entry && entry.id));
      }
      if (Array.isArray(saved.accounts)) {
        setSelectedAccountIds(saved.accounts.filter(Boolean));
      }
      if (typeof saved.token === "string") {
        setTokenOverride(saved.token);
      }
      if (Array.isArray(saved.customMetrics)) {
        const restored = sanitizeStoredMetrics(saved.customMetrics);
        if (restored.length) {
          setCustomMetrics(restored);
          updateStoredSettings({ customMetrics: restored });
        }
      }
    } catch (e) {
      console.warn("Unable to parse saved settings", e);
    }
  }, [configLoaded]);

  useEffect(() => {
    if (!accounts.length || !selectedAccountIds.length) return;
    const known = new Set(accounts.map((acc) => acc.id));
    const filtered = selectedAccountIds.filter((id) => known.has(id));
    if (filtered.length !== selectedAccountIds.length) {
      setSelectedAccountIds(filtered);
    }
  }, [accounts, selectedAccountIds]);

  const displayAccounts = useMemo(() => {
    if (!selectedAccountIds.length) return accounts;
    const selectedSet = new Set(selectedAccountIds);
    const filtered = accounts.filter((acc) => selectedSet.has(acc.id));
    return filtered.length ? filtered : accounts;
  }, [accounts, selectedAccountIds]);

  useEffect(() => {
    if (!accountFilter.length) return;
    const allowed = new Set(displayAccounts.map((acc) => acc.id));
    const filtered = accountFilter.filter((id) => allowed.has(id));
    if (filtered.length !== accountFilter.length) {
      setAccountFilter(filtered);
    }
  }, [accountFilter, displayAccounts]);

  const effectiveAccountIds = useMemo(() => {
    const base = selectedAccountIds.length
      ? selectedAccountIds.filter((id) => accounts.some((acc) => acc.id === id))
      : accounts.map((acc) => acc.id);
    if (!base.length) return [];
    if (!accountFilter.length) return base;
    const allowed = new Set(base);
    const filtered = accountFilter.filter((id) => allowed.has(id));
    return filtered.length ? filtered : base;
  }, [accountFilter, accounts, selectedAccountIds]);

  useEffect(() => {
    if (!showSettings) return;
    const defaultSelected = selectedAccountIds.length ? selectedAccountIds : accounts.map((acc) => acc.id);
    setDraftToken(tokenOverride);
    setDraftSelectedAccounts(defaultSelected);
    const manualText = manualAccounts
      .map((acc) => (acc.name && acc.name !== acc.id ? `${acc.id}:${acc.name}` : acc.id))
      .join("\n");
    setDraftManualAccounts(manualText);
  }, [showSettings, tokenOverride, selectedAccountIds, accounts, manualAccounts]);

  const loadData = useCallback(async () => {
    if (!effectiveAccountIds.length || !activeInsightFields.length) {
      setDetailRows([]);
      setRawRows([]);
      setPlatformRows([]);
      setPlacementRows([]);
      setGenderRows([]);
      setRegionRows([]);
      setLastUpdated(null);
      return;
    }
    setIsLoading(true);
    if (!autoRemovedFieldsRef.current.length) {
      setError("");
    }
    try {
      const basePayload = {
        accounts: effectiveAccountIds,
        level: "campaign",
        since: dateRange.from,
        until: dateRange.to,
        timeIncrement,
        fields: activeInsightFields,
        resultActionType: "purchase",
      };
      const breakdownPayload = { ...basePayload, level: "adset" };
      if (tokenOverride) {
        basePayload.token = tokenOverride;
        breakdownPayload.token = tokenOverride;
      }
      const buildBody = (payload, extra) => JSON.stringify({ ...payload, ...extra });
      const [main, platform, placements, gender, region] = await Promise.all([
        fetchJson(`${API_BASE_URL}/api/insights`, { method: "POST", body: buildBody(basePayload, {}) }),
        fetchJson(`${API_BASE_URL}/api/insights`, { method: "POST", body: buildBody(breakdownPayload, { breakdowns: ["publisher_platform"] }) }),
        fetchJson(`${API_BASE_URL}/api/insights`, { method: "POST", body: buildBody(breakdownPayload, { breakdowns: ["platform_position"] }) }),
        fetchJson(`${API_BASE_URL}/api/insights`, { method: "POST", body: buildBody(breakdownPayload, { breakdowns: ["gender"] }) }),
        fetchJson(`${API_BASE_URL}/api/insights`, { method: "POST", body: buildBody(breakdownPayload, { breakdowns: ["region"] }) }),
      ]);

      const removedFields = Array.isArray(main?.removedFields)
        ? main.removedFields.filter((field) => typeof field === "string" && field)
        : [];
      if (removedFields.length) {
        const newFields = removedFields.filter((field) => !excludedInsightFields.includes(field));
        if (newFields.length) {
          autoRemovedFieldsRef.current = newFields;
          setError(`Removed unsupported insight fields: ${newFields.join(", ")} (retrying...)`);
          setExcludedInsightFields((prev) => {
            const merged = new Set(prev);
            newFields.forEach((field) => merged.add(field));
            return Array.from(merged);
          });
          return;
        }
      }

      const normalized = (main.rows || []).map(normalizeMainRow);
      setDetailRows(normalized);
      setRawRows(aggregateByCampaign(normalized));
      setPlatformRows(normalizeBreakdownRows(platform.rows || [], "publisher_platform"));
      setPlacementRows(normalizeBreakdownRows(placements.rows || [], "platform_position"));
      setGenderRows(normalizeBreakdownRows(gender.rows || [], "gender"));
      setRegionRows(normalizeBreakdownRows(region.rows || [], "region"));
      setLastUpdated(new Date().toISOString());
      if (autoRemovedFieldsRef.current.length) {
        setError(`Removed unsupported insight fields: ${autoRemovedFieldsRef.current.join(", ")}`);
        autoRemovedFieldsRef.current = [];
      } else {
        setError("");
      }
    } catch (e) {
      const message = e?.message || "Unable to load insights";
      const match = typeof message === "string" && message.match(/(?:field|parameter) ['"]?([A-Za-z0-9_]+)['"]?/i);
      if (match) {
        const invalidField = match[1];
        let didExclude = false;
        setExcludedInsightFields((prev) => {
          if (prev.includes(invalidField)) {
            return prev;
          }
          didExclude = true;
          return [...prev, invalidField];
        });
        if (didExclude) {
          setError(`Removed unsupported field "${invalidField}" and retrying...`);
        } else {
          setError(message);
        }
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [effectiveAccountIds, dateRange.from, dateRange.to, activeInsightFields, timeIncrement, tokenOverride, excludedInsightFields]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  const campaignOptions = useMemo(() => {
    const map = new Map();
    rawRows.forEach((row) => {
      map.set(row.campaign_id, { id: row.campaign_id, name: row.name });
    });
    const values = Array.from(map.values()).filter((v) => v.id);
    values.sort((a, b) => a.name.localeCompare(b.name));
    return values;
  }, [rawRows]);

  useEffect(() => {
    if (!campaignFilter.length) return;
    const allowed = new Set(campaignOptions.map((opt) => opt.id));
    const filtered = campaignFilter.filter((id) => allowed.has(id));
    if (filtered.length !== campaignFilter.length) {
      setCampaignFilter(filtered);
    }
  }, [campaignFilter, campaignOptions]);

  const filteredRows = useMemo(() => {
    let rows = rawRows;
    if (campaignFilter.length) {
      const selected = new Set(campaignFilter);
      rows = rows.filter((row) => selected.has(row.campaign_id));
    }
    if (search) {
      const term = search.toLowerCase();
      rows = rows.filter((row) => row.name.toLowerCase().includes(term));
    }
    return rows;
  }, [rawRows, campaignFilter, search]);

  const tableRows = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      const direction = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.name.localeCompare(b.name) * direction;
      const left = a[sort.key] || 0;
      const right = b[sort.key] || 0;
      if (left > right) return direction;
      if (left < right) return -direction;
      return 0;
    });
    return sorted;
  }, [filteredRows, sort]);


  const activeCustomMetrics = useMemo(() => customMetrics.filter((metric) => metric.enabled !== false), [customMetrics]);
  const compiledMetrics = useMemo(() =>
    activeCustomMetrics
      .map((metric) => ({ ...metric, fn: createMetricEvaluator(metric.formula, availableMetricFields) }))
      .filter((metric) => typeof metric.fn === "function"),
    [activeCustomMetrics, availableMetricFields]
  );

  const tableRowsWithCustom = useMemo(() =>
    tableRows.map((row) => {
      const customValues = {};
      compiledMetrics.forEach((metric) => {
        const value = metric.fn(row);
        customValues[metric.id] = Number.isFinite(value) ? value : null;
      });
      return { ...row, customValues };
    }),
    [tableRows, compiledMetrics]
  );

  const kpis = useMemo(() => computeKpis(filteredRows), [filteredRows]);
  const platformDistribution = useMemo(() => buildDistribution(platformRows, "publisher_platform"), [platformRows]);
  const placementDistribution = useMemo(() => buildDistribution(placementRows, "platform_position"), [placementRows]);
  const genderDistribution = useMemo(() => buildDistribution(genderRows, "gender"), [genderRows]);
  const locationDistribution = useMemo(() => buildDistribution(regionRows, "region"), [regionRows]);
  const topLocations = locationDistribution.slice(0, 6);

  const exportCSV = () => {
    if (!tableRowsWithCustom.length) return;
    const headers = ["Campaign", "Impressions", "Clicks", "CTR", "CPC", "CPM", "Spend", "Results", "Cost/Result", "ROAS", ...compiledMetrics.map((metric) => metric.name)];
    const lines = tableRowsWithCustom.map((row) => {
      const base = [
        row.name,
        row.impressions,
        row.clicks,
        (row.ctr * 100).toFixed(2),
        row.cpc.toFixed(2),
        row.cpm.toFixed(2),
        row.spend.toFixed(2),
        row.results,
        row.cost_per_result.toFixed(2),
        row.roas.toFixed(2),
      ];
      compiledMetrics.forEach((metric) => {
        const value = row.customValues?.[metric.id];
        const formatted = Number.isFinite(value) ? Number(value).toFixed(2) : "";
        base.push(formatted);
      });
      return base.join(",");
    });
    const blob = new Blob([[headers.join(",")].concat(lines).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metrichub_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addCustomMetric = (metric) => {
    setCustomMetrics((prev) => {
      const name = (metric.name || '').trim() || `Custom Metric ${prev.length + 1}`;
      const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `metric_${Date.now()}`;
      const existing = new Set(prev.map((m) => m.id));
      let id = baseId;
      let i = 1;
      while (existing.has(id)) {
        id = `${baseId}_${i++}`;
      }
      const nextMetric = { ...metric, id, name, enabled: true };
      const next = [...prev, nextMetric];
      updateStoredSettings({ customMetrics: next });
      return next;
    });
  };

  const updateCustomMetric = (id, updates) => {
    setCustomMetrics((prev) => {
      const next = prev.map((metric) => {
        if (metric.id !== id) return metric;
        const nextName = (updates.name ?? metric.name) || metric.name;
        const nextFormula = updates.formula ?? metric.formula;
        return {
          ...metric,
          ...updates,
          name: nextName.trim() || metric.name,
          formula: (nextFormula || metric.formula).trim(),
        };
      });
      updateStoredSettings({ customMetrics: next });
      return next;
    });
  };

  const removeCustomMetric = (id) => {
    setCustomMetrics((prev) => {
      const next = prev.filter((metric) => metric.id !== id);
      updateStoredSettings({ customMetrics: next });
      return next;
    });
  };

  const setMetricEnabled = (id, enabled) => {
    setCustomMetrics((prev) => {
      const next = prev.map((metric) => (metric.id === id ? { ...metric, enabled } : metric));
      updateStoredSettings({ customMetrics: next });
      return next;
    });
  };

  const statuses = useMemo(() => ({ loading: isLoading, hasData: rawRows.length > 0 }), [isLoading, rawRows.length]);
  const settingsActive = Boolean(tokenOverride || selectedAccountIds.length || manualAccounts.length);

  const handleToggleDraftAccount = (id) => {
    setDraftSelectedAccounts((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleSaveSettings = () => {
    const trimmedToken = draftToken.trim();
    const parsedManual = parseManualAccountInput(draftManualAccounts);
    setManualAccounts(parsedManual);
    const manualIds = parsedManual.map((acc) => acc.id);
    const allowed = new Set([...accounts.map((acc) => acc.id), ...manualIds]);
    const selected = draftSelectedAccounts.filter((id) => allowed.has(id));
    manualIds.forEach((id) => {
      if (!selected.includes(id)) selected.push(id);
    });
    setSelectedAccountIds(selected);
    setTokenOverride(trimmedToken);
    setAccountFilter([]);
    updateStoredSettings({
      token: trimmedToken,
      accounts: selected,
      manualAccounts: parsedManual,
      customMetrics,
    });
    setShowSettings(false);
  };

  const handleResetSettings = () => {
    setManualAccounts([]);
    setSelectedAccountIds([]);
    setTokenOverride("");
    setAccountFilter([]);
    setExcludedInsightFields([]);
    updateStoredSettings({ token: "", accounts: [], manualAccounts: [] });
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-wrap gap-4 items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Meta Business Dashboard</h1>
              <p className="text-slate-100/80 text-sm">Real-time Facebook Ads Performance</p>
              {lastUpdated && <p className="text-xs text-slate-100/70 mt-1">Last updated {new Date(lastUpdated).toLocaleString()}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={loadData} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 text-white">
                <Icon.Refresh /> Refresh
              </button>
              <button onClick={() => setShowMetricManager(true)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 text-white">
                <Icon.Plus /> Custom Metrics
              </button>
              <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white text-slate-900 font-medium">
                <Icon.Download className="text-slate-900" /> Export
              </button>
              <button
                className={classNames(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-white/20",
                  alertsOn ? "bg-emerald-400/20 text-emerald-100" : "bg-white/10 text-white/70"
                )}
                onClick={() => setAlertsOn((val) => !val)}
              >
                <Icon.Bell /> {alertsOn ? "Alerts On" : "Alerts Off"}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className={classNames(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 text-white",
                  settingsActive && "ring-1 ring-emerald-300/50"
                )}
              >
                <Icon.Cog /> Settings
                {settingsActive && <span className="ml-1 h-2 w-2 rounded-full bg-emerald-300" />}
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} className="lg:col-span-2" />
            <MultiSelectDropdown
              label="All Accounts"
              options={displayAccounts}
              selectedIds={accountFilter}
              onChange={setAccountFilter}
              allowSelectAll
              placeholder="All Accounts"
              emptyLabel="No accounts available"
              className="w-full"
              renderOption={(opt) => (
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{opt.name || opt.id}</span>
                  {opt.name && opt.name !== opt.id && (
                    <span className="text-xs text-slate-400">{opt.id}</span>
                  )}
                </div>
              )}
            />
            <MultiSelectDropdown
              label="All Campaigns"
              options={campaignOptions}
              selectedIds={campaignFilter}
              onChange={setCampaignFilter}
              allowSelectAll
              placeholder="All Campaigns"
              emptyLabel="No campaigns available"
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-14 -mt-6">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {!error && !statuses.hasData && !statuses.loading && (
          <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            No insights yet. Configure META_TOKEN and META_ACCOUNTS on the server or supply a token in Settings, then refresh.
          </div>
        )}
        {statuses.loading && (
          <div className="mb-4 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
            Fetching fresh data...
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiDefs.map((def) => (
            <div key={def.key} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>{def.label}</span>
                <MiniTrend points={kpis.trends?.[def.key] || []} />
              </div>
              <div className="mt-2 text-2xl font-semibold">{def.fmt(kpis[def.key])}</div>
              {kpis.deltas?.[def.key] !== undefined && (
                <div
                  className={classNames(
                    "mt-1 inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5",
                    (kpis.deltas[def.key] || 0) >= 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
                  )}
                >
                  {(kpis.deltas[def.key] >= 0 ? "+" : "") + ((Math.abs(kpis.deltas[def.key] || 0)) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-300 mb-2">Platform Distribution</div>
            <div className="flex items-center gap-4">
              <Pie data={platformDistribution.map((item) => ({ name: item.name, value: item.amount, color: item.color }))} />
              <div className="space-y-2">
                {platformDistribution.slice(0, 6).map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
                    <span className="w-36 text-slate-200 truncate">{item.name}</span>
                    <span className="ml-auto text-slate-400">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
                {!platformDistribution.length && <div className="text-xs text-slate-500">No platform breakdown</div>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-300 mb-2">Placement Distribution</div>
            <div className="flex items-center gap-4">
              <Pie data={placementDistribution.map((item) => ({ name: item.name, value: item.amount, color: item.color }))} />
              <div className="space-y-2">
                {placementDistribution.slice(0, 6).map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
                    <span className="w-36 text-slate-200 truncate">{item.name}</span>
                    <span className="ml-auto text-slate-400">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
                {!placementDistribution.length && <div className="text-xs text-slate-500">No placement breakdown</div>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-300 mb-2">Top Locations</div>
            <div className="mt-3 space-y-3">
              {topLocations.length ? topLocations.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="text-slate-400 w-6">{index + 1}.</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-slate-200 text-sm w-28 truncate">{item.name}</div>
                      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.max(item.percent, 5)}%` }} />
                      </div>
                      <div className="text-slate-400 text-sm w-12 text-right">{item.percent.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              )) : <div className="text-xs text-slate-500">No region data</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-300 mb-2">Gender Distribution</div>
            <div className="flex items-center gap-4">
              <Pie data={genderDistribution.map((item) => ({ name: item.name, value: item.amount, color: item.color }))} />
              <div className="space-y-2">
                {genderDistribution.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
                    <span className="w-24 text-slate-200 truncate">{item.name}</span>
                    <span className="ml-auto text-slate-400">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
                {!genderDistribution.length && <div className="text-xs text-slate-500">No gender breakdown</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="text-lg font-semibold">Campaign Performance</div>
            <div className="flex-1" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700">
              <Icon.Download /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-300/80">
                <tr className="border-t border-b border-slate-800/80 bg-slate-900/40">
                  {[
                    ["name", "Campaign"],
                    ["impressions", "Impressions"],
                    ["clicks", "Clicks"],
                    ["ctr", "CTR"],
                    ["cpc", "CPC"],
                    ["cpm", "CPM"],
                    ["spend", "Spend"],
                    ["results", "Results"],
                    ["cost_per_result", "Cost/Result"],
                    ["roas", "ROAS"],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      className="text-left px-4 py-2 select-none cursor-pointer"
                      onClick={() =>
                        setSort((prev) => ({
                          key,
                          dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
                        }))
                      }
                    >
                      <div className="inline-flex items-center gap-1">
                        {label}
                        {sort.key === key && <Icon.ArrowDown className={sort.dir === "asc" ? "rotate-180" : undefined} />}
                      </div>
                    </th>
                  ))}
                  {compiledMetrics.map((metric) => (
                    <th key={metric.id} className="text-left px-4 py-2 text-slate-300">{metric.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRowsWithCustom.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                    <td className="px-4 py-2 font-medium text-slate-200">{row.name}</td>
                    <td className="px-4 py-2">{row.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2">{row.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2">{pct(row.ctr)}</td>
                    <td className="px-4 py-2">{toUSD(row.cpc)}</td>
                    <td className="px-4 py-2">{row.cpm.toFixed(2)}</td>
                    <td className="px-4 py-2">{toUSD(row.spend)}</td>
                    <td className="px-4 py-2">{row.results.toLocaleString()}</td>
                    <td className="px-4 py-2">{row.results > 0 ? toUSD(row.cost_per_result) : "-"}</td>
                    <td className="px-4 py-2">{row.roas > 0 ? row.roas.toFixed(2) : "-"}</td>
                    {compiledMetrics.map((metric) => {
                      const value = row.customValues?.[metric.id];
                      const formatted = Number.isFinite(value) ? Number(value) : null;
                      return (
                        <td key={metric.id} className="px-4 py-2">
                          {formatted == null ? "-" : formatted.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!tableRowsWithCustom.length && (
                  <tr>
                    <td colSpan={10 + compiledMetrics.length} className="px-4 py-6 text-center text-slate-500">
                      No rows for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-lg font-semibold mb-2">Account Overview</div>
            <div className="space-y-3">
              {accounts.slice(0, 4).map((acc, index) => {
                const spendForAccount = detailRows
                  .filter((row) => row.raw?.account_id === acc.id)
                  .reduce((sum, row) => sum + row.spend, 0);
                return (
                  <div key={acc.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-slate-200 text-sm">{acc.name || acc.id}</div>
                      <div className="text-slate-400 text-xs">Spend {toUSD(spendForAccount)}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-400/30">
                      Active
                    </span>
                  </div>
                );
              })}
              {!accounts.length && (
                <div className="text-xs text-slate-500">Add accounts in Settings or configure META_ACCOUNTS on the server.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-lg font-semibold mb-2">Spend Pace vs Budget</div>
            <div className="text-sm text-slate-400">
              Projected to reach <span className="text-slate-200">{toUSD(kpis.spend * 1.1)}</span> by period end. Keep CPA {"<="} <span className="text-slate-200">{toUSD(kpis.cpr || 0)}</span>.
            </div>
            <div className="mt-4 h-3 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, kpis.spend / (kpis.spend * 1.2 || 1) * 100)}%` }} />
            </div>
            <div className="mt-2 text-xs text-slate-400 flex justify-between">
              <span>Budget: {toUSD(kpis.spend * 1.2)}</span>
              <span>Spent: {toUSD(kpis.spend)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-xs text-slate-500 flex items-center justify-between">
          <div>&copy; {new Date().getFullYear()} MetricHub Pro</div>
          <div className="text-slate-400">UI v1.0 � Connected to Meta Graph API</div>
        </div>
      </div>

      {showMetricManager && (
        <CustomMetricManager
          baseFields={availableMetricFields}
          fieldCatalog={availableMetricCatalog}
          metrics={customMetrics}
          onCreate={addCustomMetric}
          onUpdate={updateCustomMetric}
          onDelete={removeCustomMetric}
          onToggleEnabled={setMetricEnabled}
          onClose={() => setShowMetricManager(false)}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">API & Account Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-200">
                &times;
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-200">
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Meta Access Token</label>
                <input
                  type="password"
                  value={draftToken}
                  onChange={(e) => setDraftToken(e.target.value)}
                  placeholder="EAAB..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-400">Stored locally in your browser. Leave empty to use the server token.</p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs uppercase tracking-wide text-slate-400">Linked Ad Accounts</label>
                  <span className="text-xs text-slate-400">
                    {draftSelectedAccounts.length ? `${draftSelectedAccounts.length} selected` : "All selected"}
                  </span>
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto space-y-2 pr-1">
                  {accounts.length ? (
                    accounts.map((acc) => (
                      <label key={acc.id} className="flex items-center gap-2 text-xs bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2">
                        <input
                          type="checkbox"
                          className="accent-indigo-500"
                          checked={draftSelectedAccounts.includes(acc.id)}
                          onChange={() => handleToggleDraftAccount(acc.id)}
                        />
                        <span className="truncate">{acc.name || acc.id}</span>
                      </label>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No accounts available yet from the API.</div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Additional account IDs</label>
                <textarea
                  value={draftManualAccounts}
                  onChange={(e) => setDraftManualAccounts(e.target.value)}
                  placeholder={'act_123456789012345:My Store\nact_987654321098765'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[90px]"
                />
                <p className="mt-1 text-xs text-slate-400">One per line. Optional display name after ":" (id:name).</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={handleResetSettings} className="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700">
                Reset
              </button>
              <button onClick={() => setShowSettings(false)} className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white">
                Cancel
              </button>
              <button onClick={handleSaveSettings} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm">
                <Icon.Cog className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




