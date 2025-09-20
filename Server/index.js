import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";
import { z } from "zod";
import pino from "pino";

const log = pino({ transport: { target: "pino-pretty" } });

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const DEFAULT_API_VERSION = process.env.DEFAULT_API_VERSION || "v23.0";
const DEFAULT_LEVEL = process.env.DEFAULT_LEVEL || "campaign";
const DEFAULT_TIME_INCREMENT = process.env.DEFAULT_TIME_INCREMENT || "1";
const DEFAULT_FIELDS = (
  process.env.DEFAULT_FIELDS?.split(",").map((f) => f.trim()).filter(Boolean) ?? [
    "campaign_id",
    "campaign_name",
    "account_id",
    "account_name",
    "impressions",
    "reach",
    "spend",
    "clicks",
    "ctr",
    "cpc",
    "cpm",
    "date_start",
    "date_stop",
    "actions",
    "action_values",
    "purchase_roas",
    "outbound_clicks",
    "outbound_clicks_ctr",
  ]
);

const ALWAYS_INCLUDE_FIELDS = [
  "actions",
  "action_values",
  "purchase_roas",
  "outbound_clicks",
  "outbound_clicks_ctr",
  "campaign_name",
  "campaign_id",
  "account_name",
  "account_id",
];

const InsightsBody = z.object({
  accounts: z.array(z.string().regex(/^act_\d+$/, "Each account must start with act_")),
  level: z.enum(["campaign", "adset", "ad"]).default(DEFAULT_LEVEL),
  fields: z.array(z.string()).default(DEFAULT_FIELDS),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  datePreset: z.string().optional(),
  timeIncrement: z.union([z.literal("all_days"), z.string()]).default(DEFAULT_TIME_INCREMENT),
  breakdowns: z.array(z.string()).max(2).optional(),
  useUnifiedAttribution: z.boolean().default(true),
  actionReportTime: z.enum(["mixed", "impression", "conversion", "lifetime"]).default("mixed"),
  resultActionType: z.string().default("purchase"),
  apiVersion: z.string().default(DEFAULT_API_VERSION),
  token: z.string().optional(),
});

const META_HOST = "https://graph.facebook.com";

function toQuery(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
}

function flattenInsight(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v == null) return;
    if (Array.isArray(v)) return;
    if (typeof v === "object") return;
    out[k] = v;
  });
  if (Array.isArray(obj.actions)) {
    obj.actions.forEach((a) => {
      if (!a || !a.action_type) return;
      out[`actions_${a.action_type}`] = toNumber(a.value);
    });
  }
  if (Array.isArray(obj.action_values)) {
    obj.action_values.forEach((a) => {
      if (!a || !a.action_type) return;
      out[`action_values_${a.action_type}`] = toNumber(a.value);
    });
  }
  if (Array.isArray(obj.purchase_roas)) {
    obj.purchase_roas.forEach((a) => {
      if (!a || !a.action_type) return;
      out[`purchase_roas_${a.action_type}`] = toNumber(a.value);
    });
  }
  if (Array.isArray(obj.outbound_clicks)) {
    let total = 0;
    obj.outbound_clicks.forEach((x) => {
      total += toNumber(x.value);
    });
    out.outbound_clicks_total = total;
  }
  if (Array.isArray(obj.outbound_clicks_ctr)) {
    let total = 0;
    obj.outbound_clicks_ctr.forEach((x) => {
      total += toNumber(x.value);
    });
    out.outbound_clicks_ctr_total = total;
  }
  return out;
}

function addDerived(row, resultActionType = "purchase") {
  const spend = toNumber(row.spend);
  const results = toNumber(row[`actions_${resultActionType}`]);
  if (!Number.isNaN(results)) row.results = results;
  if (!Number.isNaN(spend) && results > 0) row.cost_per_result = spend / results;
  const imp = toNumber(row.impressions);
  if (imp > 0 && results > 0) row.result_rate = results / imp;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function metaFetch(url, token, attempt = 1) {
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 300) return res.data;
    const err = res.data && res.data.error ? res.data.error : { message: res.statusText, code: res.status };
    if ((res.status === 429 || (err && err.code === 4)) && attempt <= 6) {
      const backoff = Math.min(60000, 1000 * 2 ** attempt);
      log.warn({ attempt, backoff }, "Rate limited, backing off");
      await sleep(backoff);
      return metaFetch(url, token, attempt + 1);
    }
    throw new Error(`Meta API error [${res.status}]: ${JSON.stringify(err)}`);
  } catch (error) {
    if (attempt <= 3) {
      await sleep(500 * attempt);
      return metaFetch(url, token, attempt + 1);
    }
    throw error;
  }
}

function ensureFields(fields, level) {
  const wanted = new Set([...fields, ...ALWAYS_INCLUDE_FIELDS]);
  if (level === "adset" || level === "ad") {
    wanted.add("adset_name");
    wanted.add("adset_id");
  }
  if (level === "ad") {
    wanted.add("ad_name");
    wanted.add("ad_id");
  }
  return Array.from(wanted);
}

function parseAccounts(input) {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => ({
          id: entry.id ?? entry.account_id ?? entry,
          name: entry.name ?? entry.label ?? entry.id ?? "",
        }))
        .filter((acc) => acc.id && acc.name);
    }
  } catch (error) {
    // fall back to simple syntax
  }
  return input
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((segment) => {
      const [id, ...rest] = segment.split(":");
      const name = rest.join(":").trim();
      return { id: id.trim(), name: name || id.trim() };
    })
    .filter((acc) => acc.id);
}

const CONFIG_ACCOUNTS = parseAccounts(process.env.META_ACCOUNTS);

app.get("/api/ping", (req, res) => res.json({ ok: true }));

app.get("/api/config", (req, res) => {
  res.json({
    apiVersion: DEFAULT_API_VERSION,
    defaultLevel: DEFAULT_LEVEL,
    defaultTimeIncrement: DEFAULT_TIME_INCREMENT,
    defaultFields: ensureFields(DEFAULT_FIELDS, DEFAULT_LEVEL),
    accounts: CONFIG_ACCOUNTS,
    hasServerToken: Boolean(process.env.META_TOKEN),
  });
});

app.post("/api/insights", async (req, res) => {
  try {
    const body = InsightsBody.parse(req.body);
    const token = body.token || process.env.META_TOKEN;
    if (!token) {
      return res.status(400).json({ error: "No Meta token provided. Pass it in body.token or set META_TOKEN in .env" });
    }

    const invalid = new Set([
      "landing_page_views",
      "video_2_sec_continuous_watch_actions",
      "video_3_sec_watched_actions",
    ]);
    const requestedFields = body.fields.filter((f) => !invalid.has(f));
    const fields = ensureFields(requestedFields, body.level);

    const commonParams = {
      level: body.level,
      time_increment: body.timeIncrement,
      limit: 5000,
      fields: fields.join(","),
    };

    if (body.useUnifiedAttribution) commonParams.use_unified_attribution_setting = true;
    if (body.actionReportTime) commonParams.action_report_time = body.actionReportTime;
    if (body.breakdowns && body.breakdowns.length) {
      commonParams.breakdowns = body.breakdowns.join(",");
    }

    if (body.since && body.until) {
      commonParams.time_range = JSON.stringify({ since: body.since, until: body.until });
    } else if (body.datePreset) {
      commonParams.date_preset = body.datePreset;
    } else {
      commonParams.date_preset = "last_7d";
    }

    const rows = [];
    for (const acc of body.accounts) {
      let next = `${META_HOST}/${encodeURIComponent(body.apiVersion)}/${encodeURIComponent(acc)}/insights?${toQuery(commonParams)}`;
      while (next) {
        const payload = await metaFetch(next, token);
        (payload.data || []).forEach((obj) => {
          const flat = flattenInsight(obj);
          addDerived(flat, body.resultActionType);
          rows.push(flat);
        });
        next = payload.paging && payload.paging.next ? payload.paging.next : null;
      }
    }

    res.json({ count: rows.length, rows });
  } catch (error) {
    log.error(error);
    res.status(400).json({ error: error.message || String(error) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => log.info(`Server listening on http://localhost:${PORT}`));
