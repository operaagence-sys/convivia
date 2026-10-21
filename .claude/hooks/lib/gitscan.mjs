// Pure helpers for the pre-commit guard (importable in tests, no side effect).
import { findSecrets, protectedKind } from './common.mjs';

/**
 * Parse a unified diff (git diff / git log -p, ideally with -U0) and look for
 * secrets in added lines and forbidden files.
 * @returns {{secrets: {file:string,line:number,kind:string,commit:string}[], files: {file:string,commit:string}[]}}
 */
export function scanDiff(diffText) {
  const secrets = [];
  const files = [];
  let commit = '';
  let file = '';
  let deleted = false;
  let inHunk = false;
  let newLine = 0;
  const flush = () => {
    if (file && !deleted && protectedKind(file) === 'secret') files.push({ file, commit });
    file = '';
    deleted = false;
  };
  for (const line of String(diffText).split('\n')) {
    if (line.startsWith('commit:')) {
      inHunk = false;
      flush();
      commit = line.slice(7, 15);
      continue;
    }
    if (line.startsWith('diff --git ')) {
      flush();
      inHunk = false;
      const m = / b\/(.+)$/.exec(line);
      file = m ? m[1].replace(/^"|"$/g, '') : '';
      continue;
    }
    if (!inHunk) {
      if (line.startsWith('deleted file mode')) deleted = true;
      else if (line.startsWith('+++ b/')) file = line.slice(6);
      else if (line.startsWith('+++ /dev/null')) deleted = true;
    }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (h) {
      inHunk = true;
      newLine = parseInt(h[1], 10);
      continue;
    }
    if (inHunk) {
      if (line.startsWith('+')) {
        for (const s of findSecrets(line.slice(1))) secrets.push({ file, line: newLine, kind: s.kind, commit });
        newLine++;
      } else if (line.startsWith(' ')) newLine++;
    }
  }
  flush();
  return { secrets, files };
}

/** Parse `npm audit --json` output. */
export function parseAudit(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    return { status: 'unavailable', reason: 'sortie de npm audit illisible', list: [] };
  }
  if (j && j.error) {
    return { status: 'unavailable', reason: `${j.error.code || 'erreur'} ${j.error.summary || ''}`.trim(), list: [] };
  }
  const list = Object.entries((j && j.vulnerabilities) || {})
    .filter(([, v]) => v && (v.severity === 'high' || v.severity === 'critical'))
    .map(([name, v]) => ({
      name,
      severity: v.severity,
      title: (v.via || []).filter((x) => x && typeof x === 'object' && x.title).map((x) => x.title)[0] || '',
    }));
  if (!list.length) {
    const meta = (j && j.metadata && j.metadata.vulnerabilities) || {};
    if ((meta.high || 0) + (meta.critical || 0) > 0) {
      return { status: 'vulns', list: [{ name: '(détail indisponible)', severity: 'high', title: `${meta.high || 0} haute(s), ${meta.critical || 0} critique(s)` }] };
    }
    return { status: 'ok', list: [] };
  }
  return { status: 'vulns', list };
}
