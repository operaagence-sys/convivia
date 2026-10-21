// Hook 11 — PreToolUse (Edit|Write|MultiEdit). Two rules:
//  1. Analytics / tracking tools are allowed ONLY in the marketing site and the
//     analytics library; refused everywhere else (shared components included,
//     since /i/* imports them). CLAUDE.md § 5: no tracker on guest pages.
//  2. No guest personal data in logs, Sentry, PostHog or analytics_events.
import { runHook, deny, toolPath, addedContent, isCodeFile, isTestFile } from './lib/common.mjs';

const TRACKERS = [
  ['PostHog', /posthog/i],
  ['@vercel/analytics', /@vercel\/analytics/i],
  ['@vercel/speed-insights', /@vercel\/speed-insights/i],
  ['Google Tag / gtag', /\bgtag\b|googletagmanager|google-tag-manager|\bdataLayer\b/i],
  ['pixel Meta', /\bfbq\s*\(|connect\.facebook\.net|fbevents\.js/i],
  ['Hotjar', /hotjar/i],
  ['Microsoft Clarity', /clarity\.ms|@microsoft\/clarity|\bclarity\s*\(/i],
  ['Sentry Session Replay', /replayIntegration|replaysSessionSampleRate|replaysOnErrorSampleRate|Sentry\.replay/i],
];

/** Paths (normalized: relative, lowercase, forward slashes) where trackers are permitted. */
export const TRACKER_ALLOWED = [
  /^(src\/)?app\/\(marketing\)\//,
  /^(src\/)?lib\/analytics\//,
];

const FIELD_NAMES = 'phone_e164|phoneE164|guest_contacts|guestContacts|full_name|fullName|first_name|last_name|lastName|companion_name|phoneNumber|phone';
const GUEST_FIELDS = new RegExp(`\\b(${FIELD_NAMES})\\b`);
const FIELD_ONLY = new RegExp(`^(${FIELD_NAMES})$`);
// A whole guest object passed to a sink: `console.log(guest)`, `{ contact }`, `${invitee}`.
const WHOLE_OBJECT = /(?:^|[\s,(\[{])(guest|contact|guestContact|invitee)(?=\s*(?:,|\)|\}|\]|$))/;
const SINKS = /\b(console\s*\.\s*\w+|logger\s*\.\s*\w+|log\s*\.\s*(?:info|warn|error|debug|trace)|Sentry\s*\.\s*(?:capture\w*|addBreadcrumb|setUser|setContext|setExtra|setTag)|posthog\s*\.\s*(?:capture|identify))\s*\(/g;

/** Keep identifiers and `${}` expressions; blank string literals unless they are exactly a guest field name. */
function sanitize(args) {
  let out = '';
  let i = 0;
  const n = args.length;
  while (i < n) {
    const c = args[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      let body = '';
      let exprs = '';
      while (j < n && args[j] !== c) {
        if (args[j] === '\\') {
          j += 2;
          continue;
        }
        if (c === '`' && args[j] === '$' && args[j + 1] === '{') {
          let d = 1;
          let k = j + 2;
          while (k < n && d) {
            if (args[k] === '{') d++;
            else if (args[k] === '}') d--;
            k++;
          }
          exprs += ' ' + args.slice(j + 2, k - 1) + ' ';
          j = k;
          continue;
        }
        body += args[j];
        j++;
      }
      out += FIELD_ONLY.test(body.trim()) ? ` ${body.trim()} ` : ' "" ';
      out += exprs;
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function balancedArgs(text, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  return text.slice(openIdx + 1);
}

function leakIn(text) {
  const s = sanitize(text);
  const f = GUEST_FIELDS.exec(s);
  if (f) return f[1];
  const w = WHOLE_OBJECT.exec(s);
  return w ? `${w[1]} (objet entier)` : '';
}

export function guestDataLeaks(content) {
  const leaks = [];
  for (const m of content.matchAll(SINKS)) {
    const args = balancedArgs(content, m.index + m[0].length - 1);
    const hit = leakIn(args);
    if (hit) leaks.push(`${m[1].replace(/\s+/g, '')}(… ${hit} …)`);
  }
  for (const m of content.matchAll(/analytics_events/g)) {
    const after = m.index + m[0].length;
    const win = content.slice(after, after + 800).replace(/^['"`]/, '').split(/;\s*\n/)[0];
    const hit = GUEST_FIELDS.exec(sanitize(win));
    if (hit) leaks.push(`analytics_events (… ${hit[1]} …)`);
  }
  return leaks;
}

/** Tracker labels found in content. SCREAMING_SNAKE names (env variable names such as NEXT_PUBLIC_POSTHOG_KEY) are not usage. */
export function trackersIn(content) {
  const text = content.replace(/\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b/g, ' ');
  return TRACKERS.filter(([, re]) => re.test(text)).map(([label]) => label);
}

runHook({ name: 'guest-privacy', event: 'PreToolUse', failMode: 'closed' }, (input, ctx) => {
  if (!['Edit', 'Write', 'MultiEdit'].includes(input.tool_name)) return undefined;
  const fp = toolPath(input.tool_input);
  if (!fp) return undefined;
  const rel = ctx.rel(fp);
  if (!isCodeFile(rel) || isTestFile(rel)) return undefined;
  const content = addedContent(input.tool_name, input.tool_input);

  if (!TRACKER_ALLOWED.some((re) => re.test(rel))) {
    const hits = trackersIn(content);
    if (hits.length) {
      return deny(`Outil d'analyse ou traceur interdit ici : ${hits.join(', ')}. Ils ne sont autorisés que dans la vitrine (src/app/(marketing)/**, app/(marketing)/**) et la bibliothèque d'analyse (src/lib/analytics/**, lib/analytics/**) ; partout ailleurs, y compris les composants partagés importés par /i/*, c'est refusé. CLAUDE.md § 5 : aucun outil d'analyse ni traceur tiers sur les pages invités (poids < 1 Mo, vie privée des invités).`);
    }
  }
  const leaks = guestDataLeaks(content);
  if (leaks.length) {
    return deny(`Donnée d'invité envoyée vers un journal ou un outil d'analyse : ${[...new Set(leaks)].join(' ; ')}. CLAUDE.md § 5 : nom et numéro des invités (guest_contacts) jamais dans les journaux, Sentry ni PostHog. Journalise un identifiant (guestId, eventId) à la place.`);
  }
  return undefined;
});
