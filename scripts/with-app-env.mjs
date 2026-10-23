#!/usr/bin/env node
/**
 * Run a command with `.grok/app-env.json` merged into its environment.
 *
 * `dev`, `build` and `preview` all route through this wrapper, so the dev
 * server, the built bundle and the preview server can never disagree about
 * `VITE_AUTH_ENABLED` — a divergence that only shows up as a built-output
 * mismatch long after the fact. Anything that starts Vite directly bypasses it.
 *
 * Only `VITE_`-prefixed keys are honored: the file is a build flag carrier, not
 * a secret store, and only `VITE_` vars reach the browser anyway. A real
 * `process.env` entry always wins, so an explicit override still works.
 *
 * That precedence also means the file governs this workspace only. A deployed
 * build runs with the provider's project env, where the deployer sets
 * `VITE_AUTH_ENABLED` itself (today unconditionally `"true"`), so the deployed
 * flag is the platform's, not this file's.
 *
 * Vite picks the values up because `loadEnv` prefix-matches entries already in
 * `process.env`, which is why the merge has to happen before Vite starts.
 */
import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ENV_REL_PATH = ".grok/app-env.json";

const VITE_PREFIX = "VITE_";

/**
 * Parse an app-env document, keeping only `VITE_`-prefixed string entries.
 * Anything unparseable is an empty environment — a workspace without the file
 * must behave exactly like today (auth on, no overrides).
 */
export function parseAppEnv(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const env = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith(VITE_PREFIX)) continue;
    if (typeof value !== "string") continue;
    env[key] = value;
  }
  return env;
}

/** The app env recorded under `root`, or `{}` when the file is absent. */
export function readAppEnv(root) {
  try {
    return parseAppEnv(readFileSync(join(root, APP_ENV_REL_PATH), "utf8"));
  } catch {
    return {};
  }
}

/**
 * Parse a `.env`-style document (`KEY=VALUE` per line, `#` comments, optional
 * quotes). Non-string/empty lines are skipped — same lenient behavior as the
 * app-env parser.
 */
export function parseDotEnv(text) {
  const env = {};
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) continue;
    env[key] = value;
  }
  return env;
}

/** The local dev env (`<root>/.env.local`), or `{}` when the file is absent. */
export function readDotEnvLocal(root) {
  try {
    return parseDotEnv(readFileSync(join(root, ".env.local"), "utf8"));
  } catch {
    return {};
  }
}

/** File values under the process environment: an explicit override wins. */
export function mergeAppEnv(appEnv, processEnv) {
  return { ...appEnv, ...processEnv };
}

/**
 * Translate a child's `exit` `(code, signal)` into this process's exit status.
 *
 * Do not re-raise the signal with `process.kill(process.pid, signal)`: under
 * qemu-user (amd64 image builds on an arm host) a self-directed signal is
 * routinely delivered as SIGSEGV to the wrong process, which takes down the
 * test worker and fails the image build. `128 + signo` is what a shell reports
 * for a signal-killed command, so a cancelled `vite build` is still a failure.
 */
export function exitStatusFromChild(code, signal) {
  if (signal) {
    const signo = osConstants.signals[signal];
    return 128 + (typeof signo === "number" ? signo : 1);
  }
  return code ?? 1;
}

/** The workspace root (this file lives in `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * Resolve bare commands on Windows by invoking the shell directly.
 *
 * `spawn(command, args)` cannot resolve `.cmd` / `.bat` shims from PATH on
 * Windows without a shell, so `vite` fails with ENOENT even though the local
 * package bin exists. The fix keeps POSIX behavior unchanged while making the
 * wrapper work on the project's Windows sandbox as well as Linux/macOS.
 */
export function normalizeCommandForSpawn(command, args, platform = process.platform) {
  if (platform !== "win32") {
    return { command, args };
  }

  const shellArgs = ["/d", "/s", "/c", command, ...args];
  return { command: "cmd.exe", args: shellArgs };
}

/**
 * Whether `moduleUrl` is the script node was asked to run.
 *
 * Both sides are resolved through symlinks: node realpaths `import.meta.url`
 * but leaves `process.argv[1]` as typed, so comparing them raw makes a CLI
 * launched through a symlinked path (`/tmp` on macOS) a silent no-op.
 */
export function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

function readPackageVersion() {
  try {
    const pkgPath = join(projectRoot(), "package.json");
    const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (typeof version === "string" && /^(\d+\.)?(\d+\.)?(\d+)$/.test(version)) {
      return version;
    }
  } catch {
    return "0.0.0";
  }
  return "0.0.0";
}

function main(argv) {
  const [command, ...args] = argv;
  if (!command) {
    console.error("usage: node scripts/with-app-env.mjs <command> [args…]");
    process.exit(2);
  }
  // GĐ 228a (25/09 — test local): merge thêm .env.local (server vars KHÔNG có
  // prefix VITE_ — TUNNEL_API_BASE_URL / API_TOKEN / APP_CON_URL…) vào env của
  // tiến trình con. Vite chỉ tự load .env.local vào import.meta.env (client);
  // SSR process.env KHÔNG nhận — dev server thiếu env server-side → tunnel 401
  // + SSO trỏ production thay vì localhost. File tồn tại = local run; explicit
  // process.env vẫn thắng (mảng processEnv merge sau).
  const localEnv = readDotEnvLocal(projectRoot());
  const appEnv = mergeAppEnv(readAppEnv(projectRoot()), process.env);
  // Inject VITE_APP_VERSION from package.json — makes version available to client via
  // import.meta.env.VITE_APP_VERSION.
  const env = {
    ...localEnv,
    ...appEnv,
    VITE_APP_VERSION: readPackageVersion(),
  };
  const { command: resolvedCommand, args: resolvedArgs } = normalizeCommandForSpawn(command, args);
  const child = spawn(resolvedCommand, resolvedArgs, { stdio: "inherit", env });
  // The dev server is long-running and is stopped by signalling this wrapper.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (err) => {
    console.error(`[with-app-env] failed to run ${command}:`, err?.message || err);
    process.exit(127);
  });
  child.on("exit", (code, signal) => {
    process.exit(exitStatusFromChild(code, signal));
  });
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
