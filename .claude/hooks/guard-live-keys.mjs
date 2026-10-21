// Hook 3 — PreToolUse (Bash). Nothing real leaves production: no live mode
// forced by hand, no live key, no direct call to the live payment/WhatsApp APIs.
import { runHook, deny, isShellTool, shellCommand } from './lib/common.mjs';

const REF = ' Voir CLAUDE.md § 5 : aucun paiement ni envoi WhatsApp réel hors production ; seul Vercel (VERCEL_ENV=production) active les clés live.';
// "=" assignment but not "==" / "===" / "!=" comparisons.
const ASSIGN = String.raw`["']?\s*(?<![=!<>])=(?!=)\s*["']*\s*`;

const RULES = [
  ['WHATSAPP_MODE=live posé à la main', new RegExp(String.raw`\bWHATSAPP_MODE${ASSIGN}live\b`, 'i')],
  ['FEDAPAY_ENV=live posé à la main', new RegExp(String.raw`\bFEDAPAY_ENV${ASSIGN}live\b`, 'i')],
  ['VERCEL_ENV=production posé à la main (contournement du garde-fou)', new RegExp(String.raw`\bVERCEL_ENV${ASSIGN}production\b`, 'i')],
  ['clé FedaPay live (sk_live_ / pk_live_)', /\b(?:sk|pk)_live_/i],
  ['appel direct à l\'API messages de Meta (WhatsApp)', /graph\.facebook\.com\/(?:[^\s'"]*\/)?messages/i],
  ['appel direct à l\'API FedaPay live (api.fedapay.com ; sandbox-api.fedapay.com reste permis)', /(?<!sandbox-)\bapi\.fedapay\.com/i],
  ['récupération des variables de production (vercel env pull … production)', /\bvercel(?:\.cmd|\.exe)?\b[^|;&\n]*\benv\s+pull\b[^|;&\n]*\b(?:production|prod)\b/i],
  ['cible production de Vercel (--environment=production|prod)', /\bvercel(?:\.cmd|\.exe)?\b[^|;&\n]*--environment(?:=|\s+)["']?(?:production|prod)\b/i],
];

runHook({ name: 'guard-live-keys', event: 'PreToolUse', failMode: 'closed' }, (input) => {
  if (!isShellTool(input.tool_name)) return undefined;
  const cmd = shellCommand(input);
  const hits = RULES.filter(([, re]) => re.test(cmd)).map(([label]) => label);
  if (!hits.length) return undefined;
  return deny(`Commande refusée : ${hits.join(' ; ')}.${REF}`);
});
