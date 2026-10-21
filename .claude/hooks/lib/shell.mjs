// Minimal shell tokenizer shared by the Bash hooks (POSIX-ish, Windows-tolerant).
// It is NOT a full shell parser: it splits compound commands, strips quotes,
// extracts redirections, unwraps `$(...)`, backticks and `bash -c "..."` style
// wrappers so that hooks can reason on simple commands.

const OP_CHARS = new Set([';', '&', '|', '<', '>', '(', ')']);

function isSpace(c) {
  return c === ' ' || c === '\t' || c === '\r';
}

/**
 * Tokenize a command line into simple-command segments.
 * @returns {{words: string[], redirs: {op: string, target: string}[], raw: string}[]}
 */
export function tokenize(cmd) {
  const src = String(cmd ?? '');
  const n = src.length;
  const segs = [];
  let words = [];
  let redirs = [];
  let start = 0;
  let i = 0;
  const pendingHeredocs = [];

  const endSeg = (idx) => {
    if (words.length || redirs.length) {
      segs.push({ words, redirs, raw: src.slice(start, idx).trim() });
    }
    words = [];
    redirs = [];
    start = idx + 1;
  };

  // Reads one word starting at j. Returns [word, nextIndex].
  const readWord = (j) => {
    let out = '';
    while (j < n) {
      const c = src[j];
      if (isSpace(c) || c === '\n' || OP_CHARS.has(c)) break;
      if (c === '$' && src[j + 1] === "'") {
        // ANSI-C quoting $'\x2eenv' : decode the escapes the way bash does.
        let k = j + 2;
        let body = '';
        while (k < n && src[k] !== "'") {
          if (src[k] === '\\' && k + 1 < n) {
            const m = /^\\(?:x([0-9a-fA-F]{1,2})|u([0-9a-fA-F]{1,4})|U([0-9a-fA-F]{1,8})|([0-7]{1,3})|(.))/s.exec(src.slice(k, k + 12));
            if (m) {
              if (m[1] !== undefined) body += String.fromCharCode(parseInt(m[1], 16));
              else if (m[2] !== undefined) body += String.fromCodePoint(parseInt(m[2], 16));
              else if (m[3] !== undefined) body += String.fromCodePoint(Math.min(parseInt(m[3], 16), 0x10ffff));
              else if (m[4] !== undefined) body += String.fromCharCode(parseInt(m[4], 8));
              else body += { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', e: '\x1b', f: '\f', v: '\v' }[m[5]] ?? m[5];
              k += m[0].length;
              continue;
            }
          }
          body += src[k];
          k++;
        }
        out += body;
        j = k + 1;
        continue;
      }
      if (c === "'") {
        const e = src.indexOf("'", j + 1);
        const end = e < 0 ? n : e;
        out += src.slice(j + 1, end);
        j = e < 0 ? n : e + 1;
        continue;
      }
      if (c === '"') {
        j++;
        while (j < n && src[j] !== '"') {
          if (src[j] === '\\' && j + 1 < n && '"$`'.includes(src[j + 1])) {
            out += src[j + 1];
            j += 2;
            continue;
          }
          out += src[j];
          j++;
        }
        j++;
        continue;
      }
      if (c === '\\') {
        const nx = src[j + 1];
        if (nx === '\n') {
          j += 2;
          continue;
        }
        if (nx !== undefined && (isSpace(nx) || '"\'$`;&|<>()'.includes(nx))) {
          out += nx;
          j += 2;
          continue;
        }
        out += c;
        j++;
        continue;
      }
      out += c;
      j++;
    }
    return [out, j];
  };

  while (i < n) {
    const c = src[i];
    if (isSpace(c)) {
      i++;
      continue;
    }
    if (c === '\n') {
      endSeg(i);
      i++;
      // consume heredoc bodies
      while (pendingHeredocs.length) {
        const h = pendingHeredocs.shift();
        const body = [];
        while (i < n) {
          let e = src.indexOf('\n', i);
          if (e < 0) e = n;
          const line = src.slice(i, e);
          i = Math.min(e + 1, n);
          if (line.trim() === h.delim) break;
          body.push(line);
        }
        h.redir.body = body.join('\n');
      }
      start = i;
      continue;
    }
    if (c === '#' && (i === 0 || isSpace(src[i - 1]) || src[i - 1] === '\n' || src[i - 1] === ';')) {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === ';' || c === '(' || c === ')') {
      endSeg(i);
      i++;
      continue;
    }
    if (c === '|') {
      endSeg(i);
      i++;
      if (src[i] === '|' || src[i] === '&') i++;
      continue;
    }
    if (c === '&') {
      if (src[i + 1] === '>') {
        // &> file
        let j = i + 2;
        if (src[j] === '>') j++;
        while (j < n && isSpace(src[j])) j++;
        const [t, k] = readWord(j);
        redirs.push({ op: '>', target: t });
        i = k;
        continue;
      }
      endSeg(i);
      i++;
      if (src[i] === '&') i++;
      continue;
    }
    if (c === '>' || c === '<') {
      // fd prefix such as 2> already pushed as a word
      const prev = words[words.length - 1];
      if (prev !== undefined && /^\d$/.test(prev) && src[i - 1] === prev) words.pop();
      let op = c;
      let j = i + 1;
      if (c === '>' && src[j] === '>') {
        op = '>>';
        j++;
      } else if (c === '>' && src[j] === '|') {
        j++;
      } else if (c === '<' && src[j] === '<') {
        op = '<<';
        j++;
        if (src[j] === '<') {
          op = '<<<';
          j++;
        } else if (src[j] === '-') {
          op = '<<-';
          j++;
        }
      } else if (src[j] === '&') {
        op += '&';
        j++;
      } else if (src[j] === '(') {
        // process substitution <( ... ) / >( ... )
        i = j;
        continue;
      }
      while (j < n && isSpace(src[j])) j++;
      const [t, k] = readWord(j);
      const redir = { op, target: t };
      if (op === '<<' || op === '<<-') pendingHeredocs.push({ delim: t, redir });
      redirs.push(redir);
      i = k;
      continue;
    }
    const [w, k] = readWord(i);
    words.push(w);
    i = k > i ? k : i + 1;
  }
  endSeg(n);
  return segs;
}

/** Substitutions `$(...)` and backticks (not inside single quotes). */
export function extractSubstitutions(cmd) {
  const src = String(cmd ?? '');
  const n = src.length;
  const out = [];
  let inS = false;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (inS) {
      if (c === "'") inS = false;
      i++;
      continue;
    }
    if (c === "'") {
      inS = true;
      i++;
      continue;
    }
    if (c === '\\') {
      i += 2;
      continue;
    }
    if ((c === '$' || c === '<' || c === '>') && src[i + 1] === '(') {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')') depth--;
        j++;
      }
      out.push(src.slice(i + 2, depth ? j : j - 1));
      i = j;
      continue;
    }
    if (c === '`') {
      const j = src.indexOf('`', i + 1);
      if (j < 0) break;
      out.push(src.slice(i + 1, j));
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

export function baseProgram(word) {
  const w = String(word ?? '').replace(/\\/g, '/');
  const b = w.slice(w.lastIndexOf('/') + 1).toLowerCase();
  return b.replace(/\.(exe|cmd|bat|ps1|com)$/, '');
}

const WRAPPERS_SIMPLE = new Set(['sudo', 'doas', 'command', 'builtin', 'exec', 'time', 'nohup', 'nice', 'ionice', 'setsid', 'stdbuf', 'unbuffer', 'call', 'start', 'timeout']);
const XARGS_VALUE_FLAGS = new Set(['-I', '-n', '-P', '-d', '-L', '-s', '-E', '-a', '--max-args', '--max-procs', '--delimiter', '--arg-file', '--replace', '--max-lines', '--eof']);
const ENV_VALUE_FLAGS = new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']);
// Options that take a separate value in npx / npm exec / pnpm dlx / yarn dlx / bunx.
const RUNNER_VALUE_FLAGS = new Set(['--shell', '--registry', '--cache', '--userconfig', '--globalconfig', '--prefix', '-w', '--workspace', '--node-options', '--loglevel', '--script-shell', '--npmrc', '--cwd', '--filter', '-C']);

const ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Parse the options of a package runner (npx, npm exec, pnpm dlx, yarn dlx, bunx).
 * Fills runner.specs (explicit -p/--package), runner.inline (-c/--call) and
 * runner.flags (every option seen). Returns the index of the command word.
 */
function parseRunner(w, i0, runner) {
  let i = i0;
  while (i < w.length && w[i].startsWith('-')) {
    const t = w[i];
    if (t === '--') {
      i++;
      break;
    }
    const eq = t.indexOf('=');
    const name = (eq > 0 ? t.slice(0, eq) : t).toLowerCase();
    const inlineVal = eq > 0 ? t.slice(eq + 1) : null;
    runner.flags.push(t);
    if (name === '-p' || name === '--package') {
      const v = inlineVal !== null ? inlineVal : w[++i];
      if (v) runner.specs.push(v);
    } else if (name === '-c' || name === '--call') {
      const v = inlineVal !== null ? inlineVal : w[++i];
      if (v) runner.inline.push(v);
    } else if (inlineVal === null && RUNNER_VALUE_FLAGS.has(name)) {
      i++;
    }
    i++;
  }
  return i;
}

/** `npm init foo` runs the package `create-foo` (scoped: `@s` -> `@s/create`, `@s/foo` -> `@s/create-foo`). */
export function initializerPackage(name) {
  const n = String(name ?? '');
  if (n.startsWith('@')) {
    const [scope, rest] = n.split('/');
    return rest ? `${scope}/create-${rest.replace(/^create-/, '')}` : `${scope}/create`;
  }
  return n.startsWith('create-') ? n : `create-${n}`;
}

/**
 * Resolve the real command of a simple command: skips VAR=x assignments,
 * `sudo`, `env`, `xargs`, `npx`, `pnpm dlx`, `npm exec --`...
 * `runners` lists the package runners crossed on the way (they may download
 * and execute a package that is not installed).
 * @returns {{prog: string, args: string[], assigns: string[], words: string[], runners: object[]} | null}
 */
export function commandOf(words) {
  const w = words.slice();
  const assigns = [];
  const runners = [];
  const newRunner = (via) => ({ via, specs: [], inline: [], flags: [], cmd: null, create: false });
  for (let guard = 0; guard < 10 && w.length; guard++) {
    while (w.length && ASSIGN_RE.test(w[0])) assigns.push(w.shift());
    if (!w.length) break;
    const p = baseProgram(w[0]);
    if (p === 'timeout') {
      w.shift();
      while (w.length && w[0].startsWith('-')) w.shift();
      if (w.length && /^d/.test(w[0])) w.shift();
      continue;
    }
    if (WRAPPERS_SIMPLE.has(p)) {
      w.shift();
      while (w.length && w[0].startsWith('-')) w.shift();
      continue;
    }
    if (p === 'xargs') {
      w.shift();
      while (w.length && w[0].startsWith('-')) {
        const t = w.shift();
        if (XARGS_VALUE_FLAGS.has(t) && w.length) w.shift();
      }
      continue;
    }
    if (p === 'env' && w.length > 1) {
      w.shift();
      while (w.length && (w[0].startsWith('-') || ASSIGN_RE.test(w[0]))) {
        const t = w.shift();
        if (ASSIGN_RE.test(t)) assigns.push(t);
        else if (ENV_VALUE_FLAGS.has(t) && w.length) w.shift();
      }
      continue;
    }
    const sub = (w[1] || '').toLowerCase();
    if (p === 'npx' || p === 'bunx' || ((p === 'pnpm' || p === 'yarn') && sub === 'dlx') || (p === 'npm' && (sub === 'exec' || sub === 'x')) || (p === 'bun' && sub === 'x')) {
      const r = newRunner(p === 'npx' || p === 'bunx' ? p : `${p} ${sub}`);
      const start = p === 'npx' || p === 'bunx' ? 1 : 2;
      const i = parseRunner(w, start, r);
      r.cmd = w[i] !== undefined ? w[i] : null;
      runners.push(r);
      w.splice(0, i);
      continue;
    }
    if ((p === 'pnpm' || p === 'yarn') && sub === 'exec') {
      w.splice(0, 2);
      while (w.length && w[0].startsWith('-')) w.shift();
      continue;
    }
    if (['npm', 'pnpm', 'yarn', 'bun'].includes(p) && ['init', 'create', 'innit'].includes(sub)) {
      const rest = w.slice(2);
      const pos = rest.find((x) => !x.startsWith('-'));
      if (pos) {
        const r = newRunner(`${p} ${sub}`);
        r.create = true;
        r.specs.push(initializerPackage(pos.replace(/@[^/@]*$/, '')));
        runners.push(r);
      }
    }
    break;
  }
  if (!w.length) return null;
  return { prog: baseProgram(w[0]), args: w.slice(1), assigns, words: w, runners };
}

const SH_WRAPPERS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish']);
export const PS_PROGRAMS = new Set(['pwsh', 'powershell', 'powershell_ise', 'pwsh-preview']);
const PS_WRAPPERS = PS_PROGRAMS;

function unwrapInner(seg) {
  const c = commandOf(seg.words);
  if (!c) return [];
  const { prog, args } = c;
  const inner = [];
  if (SH_WRAPPERS.has(prog)) {
    const idx = args.findIndex((a) => /^-[a-zA-Z]*c$/.test(a));
    if (idx >= 0 && args[idx + 1] !== undefined) inner.push(args[idx + 1]);
  } else if (PS_WRAPPERS.has(prog)) {
    let found = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i].toLowerCase();
      if (/^[-/]c(o(m(m(a(n(d)?)?)?)?)?)?$/.test(a) && args[i + 1] !== undefined) {
        inner.push(args.slice(i + 1).join(' '));
        found = true;
        break;
      }
      if (/^[-/]e(n(c(o(d(e(d(c(o(m(m(a(n(d)?)?)?)?)?)?)?)?)?)?)?)?)?$/.test(a) && args[i + 1]) {
        try {
          inner.push(Buffer.from(args[i + 1], 'base64').toString('utf16le'));
        } catch {
          /* ignore */
        }
        found = true;
        break;
      }
    }
    // `powershell "Remove-Item ..."`: a bare positional string is a command as well.
    if (!found) {
      const bare = args.filter((a) => !a.startsWith('-'));
      if (bare.length) inner.push(bare.join(' '));
    }
  } else if (prog === 'cmd') {
    // Git Bash turns `/c` into a path unless written `//c`: accept both.
    const idx = args.findIndex((a) => /^\/{1,2}[ck]$/i.test(a));
    if (idx >= 0) inner.push(args.slice(idx + 1).join(' '));
  } else if (prog === 'eval') {
    inner.push(args.join(' '));
  }
  return inner;
}

/** All simple-command segments of a command line, including nested ones. */
export function allSegments(cmd, depth = 0) {
  const segs = tokenize(cmd);
  if (depth > 3) return segs;
  const extra = [];
  for (const sub of extractSubstitutions(cmd)) extra.push(...allSegments(sub, depth + 1));
  for (const seg of segs) {
    for (const inner of unwrapInner(seg)) extra.push(...allSegments(inner, depth + 1));
    const c = commandOf(seg.words);
    // `bash <<EOF ... EOF` : the body is a script made of commands.
    if (c && (SH_WRAPPERS.has(c.prog) || c.prog === 'source' || c.prog === '.')) {
      for (const r of seg.redirs) if (r.body) extra.push(...allSegments(r.body, depth + 1));
    }
  }
  return segs.concat(extra);
}

/**
 * Text of the code given inline to a command: its arguments, here-documents and
 * here-strings (`node - <<EOF`, `python - <<<"..."`). Used by the hooks to look
 * for secrets, protected files or deletions inside interpreter code.
 */
export function inlineCodeOf(seg, c) {
  const parts = [c ? c.args.join(' ') : seg.words.join(' ')];
  for (const r of seg.redirs) {
    if (r.body) parts.push(r.body);
    if (r.op === '<<<' && r.target) parts.push(r.target);
  }
  return parts.join('\n');
}

/** Split `-abc` style flag clusters: true if short flag `ch` is present. */
export function hasShortFlag(args, ch) {
  return args.some((a) => /^-[A-Za-z]+$/.test(a) && a.includes(ch));
}
