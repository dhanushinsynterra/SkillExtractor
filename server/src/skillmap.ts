import type { Depth, TopicCoverage, TrackId } from '../../shared/types';

/**
 * The skill map drives the technical part of the interview. Each track has
 * core topics (covered first, breadth-first) and adjacent topics (explored
 * afterwards, e.g. Docker for a frontend engineer). Within a topic the
 * questions climb a depth ladder until the candidate reaches their ceiling.
 */

interface TopicDef {
  id: string;
  label: string;
  /** Lower-case keywords used to match the interviewer's skill names. */
  aliases: string[];
  /** What a question on this topic can explore. */
  focus: string;
}

const t = (id: string, label: string, aliases: string[], focus: string): TopicDef => ({ id, label, aliases, focus });

const MAP: Record<TrackId, { core: TopicDef[]; adjacent: TopicDef[] }> = {
  frontend: {
    core: [
      t('html_css', 'HTML and CSS layout', ['html', 'css', 'flexbox', 'grid', 'responsive', 'layout', 'semantic', 'tailwind', 'sass'], 'semantic markup, flexbox and grid, responsive layouts'),
      t('javascript', 'JavaScript fundamentals', ['javascript', 'js', 'closure', 'event loop', 'promise', 'async', 'es6', 'dom'], 'closures, the event loop, promises and async code, the DOM'),
      t('framework', 'UI framework', ['react', 'angular', 'vue', 'svelte', 'next', 'hooks', 'component', 'jsx'], 'components, props and state, hooks or lifecycle, re-rendering'),
      t('state_data', 'State and data fetching', ['state management', 'redux', 'zustand', 'context', 'fetch', 'data fetching', 'react query', 'api call', 'caching'], 'where state lives, loading and error states, caching server data'),
      t('performance', 'Web performance', ['performance', 'web vitals', 'lighthouse', 'lazy', 'bundle', 'memo', 'rendering'], 'measuring slowness, bundle size, rendering cost, Core Web Vitals'),
      t('accessibility', 'Accessibility', ['accessibility', 'a11y', 'aria', 'screen reader', 'keyboard', 'contrast', 'wcag'], 'keyboard use, screen readers, ARIA, contrast'),
      t('fe_testing', 'Frontend testing', ['testing', 'jest', 'vitest', 'testing library', 'cypress', 'playwright', 'unit test', 'e2e'], 'what to test, unit vs component vs end-to-end tests'),
      t('browser_http', 'Browser, HTTP and security', ['http', 'cors', 'cookie', 'xss', 'csrf', 'browser', 'security', 'local storage', 'cache'], 'HTTP caching, CORS, cookies and storage, XSS'),
    ],
    adjacent: [
      t('typescript', 'TypeScript', ['typescript', 'ts', 'types', 'generics'], 'types, interfaces, generics, strictness'),
      t('git', 'Git and collaboration', ['git', 'github', 'gitlab', 'merge', 'rebase', 'pull request', 'code review'], 'branching, merge conflicts, code review'),
      t('build_tools', 'Build tooling', ['vite', 'webpack', 'babel', 'bundler', 'npm', 'build'], 'what a bundler does, dev vs production builds'),
      t('docker', 'Docker', ['docker', 'container', 'dockerfile', 'compose'], 'containerising an app, images vs containers, multi-stage builds'),
      t('ci_cd', 'CI/CD and deployment', ['ci', 'cd', 'pipeline', 'github actions', 'jenkins', 'deploy', 'vercel', 'netlify'], 'automated checks, deploying a frontend, rollbacks'),
      t('backend_apis', 'Backend and APIs', ['node', 'express', 'backend', 'rest', 'graphql', 'api design', 'server'], 'designing an API the frontend consumes, REST vs GraphQL'),
      t('cloud', 'Cloud and hosting', ['aws', 'azure', 'gcp', 'cloud', 'cdn', 's3', 'firebase', 'hosting'], 'hosting static sites, CDNs, environment config'),
    ],
  },
  backend: {
    core: [
      t('api_design', 'API design and HTTP', ['api', 'rest', 'http', 'graphql', 'grpc', 'endpoint', 'status code'], 'resource design, status codes, versioning, idempotency'),
      t('databases', 'Databases and SQL', ['sql', 'database', 'postgres', 'mysql', 'mongodb', 'index', 'query', 'schema', 'orm'], 'schema design, indexes, query plans, SQL vs NoSQL'),
      t('transactions', 'Transactions and concurrency', ['transaction', 'concurrency', 'lock', 'race condition', 'isolation', 'thread', 'acid'], 'isolation levels, locking, race conditions'),
      t('language', 'Primary language and runtime', ['java', 'spring', 'node', 'python', 'django', 'flask', 'go', 'c#', '.net', 'runtime'], 'their main language, its concurrency model, memory and errors'),
      t('auth_security', 'Authentication and security', ['auth', 'jwt', 'oauth', 'session', 'password', 'security', 'injection', 'owasp'], 'sessions vs tokens, password storage, injection'),
      t('caching', 'Caching and performance', ['cache', 'redis', 'memcached', 'performance', 'latency', 'profiling'], 'what to cache, invalidation, finding slow endpoints'),
      t('be_testing', 'Backend testing', ['testing', 'unit test', 'integration test', 'junit', 'pytest', 'mock'], 'unit vs integration tests, testing with a database'),
      t('observability', 'Logging and error handling', ['logging', 'monitoring', 'observability', 'metrics', 'tracing', 'error handling', 'alert'], 'logs, metrics, tracing, handling failures'),
    ],
    adjacent: [
      t('docker', 'Docker', ['docker', 'container', 'dockerfile', 'compose'], 'images, containers, writing a Dockerfile'),
      t('kubernetes', 'Kubernetes', ['kubernetes', 'k8s', 'helm', 'pod', 'orchestration'], 'pods, deployments, scaling'),
      t('ci_cd', 'CI/CD', ['ci', 'cd', 'pipeline', 'github actions', 'jenkins', 'deploy'], 'pipelines, safe deploys, rollbacks'),
      t('cloud', 'Cloud services', ['aws', 'azure', 'gcp', 'cloud', 'lambda', 'ec2', 's3'], 'core cloud services, managed databases'),
      t('queues', 'Messaging and queues', ['kafka', 'rabbitmq', 'queue', 'pub sub', 'event', 'sqs'], 'async processing, retries, ordering'),
      t('linux', 'Linux and networking', ['linux', 'shell', 'bash', 'dns', 'tcp', 'nginx', 'network'], 'shell use, DNS, TCP, reverse proxies'),
      t('git', 'Git and collaboration', ['git', 'github', 'merge', 'rebase', 'pull request', 'code review'], 'branching, code review'),
    ],
  },
  data: {
    core: [
      t('python_data', 'Python for data', ['python', 'pandas', 'numpy', 'dataframe', 'jupyter'], 'pandas operations, vectorisation, notebooks'),
      t('sql', 'SQL', ['sql', 'join', 'group by', 'window function', 'query', 'postgres', 'bigquery'], 'joins, aggregation, window functions'),
      t('cleaning', 'Data cleaning', ['missing', 'cleaning', 'outlier', 'null', 'imputation', 'data quality', 'duplicate'], 'missing values, outliers, inconsistent data'),
      t('statistics', 'Statistics', ['statistics', 'distribution', 'hypothesis', 'p value', 'probability', 'regression', 'variance', 'a/b'], 'distributions, hypothesis tests, A/B tests'),
      t('modelling', 'Machine learning models', ['machine learning', 'ml', 'model', 'scikit', 'sklearn', 'xgboost', 'classification', 'feature'], 'choosing a model, feature engineering, overfitting'),
      t('evaluation', 'Model evaluation', ['evaluation', 'metric', 'accuracy', 'precision', 'recall', 'cross validation', 'auc', 'rmse'], 'metrics, validation strategy, data leakage'),
      t('communication', 'Visualisation and storytelling', ['visualisation', 'visualization', 'chart', 'matplotlib', 'seaborn', 'dashboard', 'stakeholder', 'insight'], 'choosing charts, explaining results to non-technical people'),
    ],
    adjacent: [
      t('big_data', 'Big data processing', ['spark', 'pyspark', 'hadoop', 'big data', 'databricks'], 'distributed processing, partitions'),
      t('pipelines', 'Data pipelines', ['airflow', 'etl', 'pipeline', 'dbt', 'orchestration', 'warehouse'], 'ETL, scheduling, data warehouses'),
      t('deep_learning', 'Deep learning and LLMs', ['deep learning', 'neural', 'pytorch', 'tensorflow', 'llm', 'transformer', 'nlp'], 'neural networks, LLM use cases'),
      t('bi_tools', 'BI tools', ['power bi', 'tableau', 'looker', 'excel', 'bi'], 'dashboards for business users'),
      t('cloud', 'Cloud and deployment', ['aws', 'azure', 'gcp', 'cloud', 'sagemaker', 'deploy', 'mlops'], 'deploying and monitoring models'),
      t('docker', 'Docker', ['docker', 'container'], 'packaging a model or notebook environment'),
      t('git', 'Git', ['git', 'github', 'version control'], 'versioning code and experiments'),
    ],
  },
  mobile: {
    core: [
      t('platform', 'Platform fundamentals', ['android', 'ios', 'kotlin', 'swift', 'flutter', 'dart', 'react native', 'lifecycle', 'activity'], 'their platform, app and screen lifecycle'),
      t('ui', 'Mobile UI and layouts', ['layout', 'ui', 'compose', 'swiftui', 'widget', 'recyclerview', 'list', 'navigation'], 'layouts for different screens, lists, navigation'),
      t('architecture', 'App architecture and state', ['mvvm', 'mvc', 'architecture', 'state', 'bloc', 'provider', 'redux', 'viewmodel'], 'MVVM or similar, where state lives'),
      t('networking', 'Networking and offline', ['network', 'api', 'retrofit', 'offline', 'sync', 'http', 'rest'], 'API calls, poor connectivity, offline sync'),
      t('storage', 'Local storage', ['storage', 'sqlite', 'room', 'core data', 'shared preferences', 'cache', 'database'], 'persisting data, migrations'),
      t('performance', 'Performance and battery', ['performance', 'battery', 'memory', 'jank', 'startup', 'leak', 'profil'], 'smooth scrolling, memory leaks, battery use'),
      t('mb_testing', 'Mobile testing', ['testing', 'unit test', 'espresso', 'xctest', 'widget test', 'ui test'], 'unit and UI tests on mobile'),
    ],
    adjacent: [
      t('backend', 'Backend services', ['firebase', 'backend', 'node', 'supabase', 'server'], 'auth and data backends for apps'),
      t('push', 'Push notifications', ['push', 'notification', 'fcm', 'apns'], 'how push works end to end'),
      t('release', 'Release and app stores', ['play store', 'app store', 'release', 'signing', 'testflight', 'publish'], 'signing, staged rollouts, store review'),
      t('ci_cd', 'CI/CD', ['ci', 'cd', 'fastlane', 'pipeline', 'github actions', 'codemagic'], 'automated builds and releases'),
      t('security', 'Mobile security', ['security', 'keychain', 'keystore', 'encryption', 'obfuscation'], 'storing secrets, securing traffic'),
      t('git', 'Git', ['git', 'github', 'version control'], 'branching and code review'),
    ],
  },
  qa: {
    core: [
      t('test_design', 'Test design techniques', ['test case', 'boundary', 'equivalence', 'test design', 'scenario', 'exploratory', 'edge case'], 'boundary values, equivalence classes, exploratory testing'),
      t('bugs', 'Bug reporting and triage', ['bug', 'defect', 'jira', 'severity', 'priority', 'triage', 'report'], 'reproducing bugs, severity vs priority, good reports'),
      t('automation', 'UI test automation', ['selenium', 'playwright', 'cypress', 'automation', 'appium', 'webdriver', 'page object'], 'frameworks, locators, flaky tests'),
      t('api_testing', 'API testing', ['api', 'postman', 'rest assured', 'rest', 'http', 'status code', 'contract'], 'testing endpoints, status codes, contracts'),
      t('strategy', 'Test strategy', ['strategy', 'test plan', 'pyramid', 'risk', 'coverage', 'regression'], 'what to automate, test pyramid, risk-based testing'),
      t('ci_testing', 'Tests in CI', ['ci', 'pipeline', 'jenkins', 'github actions', 'continuous'], 'running suites in pipelines, flaky test handling'),
      t('sql_testing', 'Data and SQL checks', ['sql', 'database', 'query', 'data validation'], 'verifying data in the database'),
    ],
    adjacent: [
      t('programming', 'Programming', ['java', 'python', 'javascript', 'typescript', 'c#', 'programming', 'code'], 'writing maintainable test code'),
      t('performance', 'Performance testing', ['performance', 'load', 'jmeter', 'k6', 'gatling', 'stress'], 'load vs stress tests, reading results'),
      t('security', 'Security testing', ['security', 'owasp', 'penetration', 'burp', 'xss', 'injection'], 'common vulnerabilities to check'),
      t('mobile', 'Mobile testing', ['mobile', 'android', 'ios', 'device', 'appium'], 'device coverage, mobile-specific risks'),
      t('docker', 'Docker', ['docker', 'container', 'compose'], 'test environments in containers'),
      t('git', 'Git', ['git', 'github', 'version control'], 'branching and reviews of test code'),
    ],
  },
};

export const LEVEL_GUIDE: Record<Depth, string> = {
  0: 'not shown',
  1: 'aware: ask what it is or whether they have used it',
  2: 'working: ask how they used it in real work, or to walk through a concrete example',
  3: 'proficient: ask why, trade-offs, what goes wrong and how they would debug it',
  4: 'expert: ask about internals, edge cases, scale or a design decision they would defend',
};

/** Questions per topic in the first (breadth) pass, and in total once revisited for depth. */
const PASS_Q: Record<TopicCoverage['kind'], number> = { core: 4, adjacent: 3, extra: 3 };
const MAX_Q: Record<TopicCoverage['kind'], number> = { core: 9, adjacent: 5, extra: 5 };
/** Skills outside the built-in map that may be added as extra topics. */
const MAX_EXTRA = 12;
const EXTRA_SUBTOPICS = ['how they have used it', 'how it works under the hood', 'trade-offs and alternatives'];

/** Interview length limits. The skill map gets most of the hour. */
export const INTERVIEW_MAX_MS = 60 * 60_000;
export const WRAP_UP_AT_MS = 56 * 60_000;
export const MAP_BUDGET_MS = 44 * 60_000;
/** Share of the skill budget after which no new role / related topics start. */
const CORE_UNTIL = 0.7;
const ADJACENT_UNTIL = 0.9;

function defs(track: TrackId) {
  const m = MAP[track];
  return [...m.core.map((d) => ({ ...d, kind: 'core' as const })), ...m.adjacent.map((d) => ({ ...d, kind: 'adjacent' as const }))];
}

const split = (focus: string) =>
  focus
    .split(/,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);

function topic(id: string, label: string, kind: TopicCoverage['kind'], subtopics: string[]): TopicCoverage {
  return { id, label, kind, claimed: false, asked: 0, history: [], asks: [], depth: null, status: 'pending', level: kind === 'core' ? 2 : 1, subtopics, sub: 0 };
}

export function initCoverage(track: TrackId): TopicCoverage[] {
  return defs(track).map((d) => topic(d.id, d.label, d.kind, split(d.focus)));
}

const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9#.+/ ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

/** Finds the topic a free-form skill name belongs to. */
export function matchTopic(track: TrackId, cov: TopicCoverage[], name: string): TopicCoverage | undefined {
  const w = words(name);
  const byId = cov.find((c) => c.id === name || words(c.label) === w);
  if (byId) return byId;
  // Best alias overlap wins; core topics come first, so they win ties.
  let best: TopicDef | undefined;
  let score = 0;
  for (const d of defs(track)) {
    const n = d.aliases.filter((a) => w.includes(` ${a} `) || (a.length > 4 && w.includes(a))).length;
    if (n > score) [best, score] = [d, n];
  }
  return best ? cov.find((c) => c.id === best.id) : undefined;
}

function slug(s: string) {
  return 'x_' + s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

function addExtra(cov: TopicCoverage[], name: string): TopicCoverage | undefined {
  const label = name.trim().slice(0, 60);
  if (!label) return;
  const existing = cov.find((x) => x.id === slug(label));
  if (existing) return existing;
  if (cov.filter((c) => c.kind === 'extra').length >= MAX_EXTRA) return;
  const c = topic(slug(label), label, 'extra', EXTRA_SUBTOPICS);
  cov.push(c);
  return c;
}

/** The candidate mentioned these technologies: mark or add them so they are prioritised. */
export function claim(track: TrackId, cov: TopicCoverage[], names: string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const c = matchTopic(track, cov, n) ?? addExtra(cov, n);
    if (!c) continue;
    c.claimed = true;
    if (c.kind !== 'core' && c.status === 'pending' && c.asked === 0) c.level = Math.max(c.level, 2) as Depth;
    out.push(c.label);
  }
  return [...new Set(out)];
}

/** The aspect of the topic the next question should cover. */
export const currentSub = (c: TopicCoverage) => c.subtopics[c.sub] ?? c.label;

/** Records one answer's depth and moves the topic along its ladder. */
export function recordAnswer(track: TrackId, cov: TopicCoverage[], skill: string, depth: Depth): TopicCoverage | undefined {
  const c = matchTopic(track, cov, skill) ?? addExtra(cov, skill);
  if (!c) return;
  c.history.push(depth);
  c.asks.push(c.status === 'active' ? currentSub(c) : 'mentioned in passing');
  c.depth = c.depth == null ? depth : (Math.max(c.depth, depth) as Depth);

  if (c.status === 'pending') {
    // Shown incidentally while discussing something else: start higher later.
    c.level = Math.min(4, Math.max(c.level, depth + 1)) as Depth;
    return c;
  }
  if (c.status !== 'active') return c;

  c.asked++;
  const cap = c.asked > PASS_Q[c.kind] || c.revisit ? MAX_Q[c.kind] : PASS_Q[c.kind];
  if (c.asked >= cap) {
    c.status = 'done';
  } else if (depth >= c.level && c.level < 4) {
    c.level = (c.level + 1) as Depth; // they handled it: go deeper on the same aspect
  } else if (depth <= 1 && c.level >= 2 && c.asked === 1 && c.kind === 'core') {
    c.level = 1; // struggled at the first rung: one easier question to find the floor
  } else if (c.depth === 0 && (c.kind !== 'core' || c.asked >= 2)) {
    c.status = 'done'; // they have not used it: don't keep testing
  } else {
    // Ceiling for this aspect found: move on to the topic's next aspect.
    c.sub++;
    if (c.sub >= c.subtopics.length) c.status = 'done';
    else c.level = Math.max(c.kind === 'core' ? 2 : 1, Math.min(3, depth)) as Depth;
  }
  return c;
}

export type Next =
  | { action: 'ask'; topic: TopicCoverage; same: boolean; first: TopicCoverage['kind'] | null }
  | { action: 'empty' }
  | { action: 'move_on' };

/**
 * Picks what to ask next: the active topic, then role skills, related skills
 * and finally the candidate's extra skills. Earlier tiers stop starting new
 * topics late in the budget so the later tiers always get time.
 */
export function nextTopic(cov: TopicCoverage[], elapsedMs: number, budgetMs: number, revisit = false): Next {
  const active = cov.find((c) => c.status === 'active');
  if (active) {
    if (elapsedMs < budgetMs) return { action: 'ask', topic: active, same: active.asked > 0, first: null };
    active.status = 'done';
  }
  if (elapsedMs >= budgetMs) return { action: 'move_on' };

  const pending = (k: TopicCoverage['kind']) => cov.filter((c) => c.kind === k && c.status === 'pending');
  const started = (k: TopicCoverage['kind']) => cov.some((c) => c.kind === k && c.status !== 'pending');
  const later = (k: TopicCoverage['kind']) => (k === 'core' ? [...pending('adjacent'), ...pending('extra')] : k === 'adjacent' ? pending('extra') : []);
  const open = (k: TopicCoverage['kind']) => k === 'extra' || !later(k).length || elapsedMs < budgetMs * (k === 'core' ? CORE_UNTIL : ADJACENT_UNTIL);

  for (const k of ['core', 'adjacent', 'extra'] as const) {
    if (!open(k)) continue;
    const list = pending(k);
    // Within a tier, what the candidate says they use comes first.
    const pick = list.find((c) => c.claimed) ?? list[0];
    if (!pick) continue;
    const first = started(k) ? null : k;
    pick.status = 'active';
    return { action: 'ask', topic: pick, same: false, first };
  }
  if (revisit) {
    // Second pass: go back to topics where the candidate showed working
    // knowledge or better and aspects remain, in tier order.
    const again = (['core', 'adjacent', 'extra'] as const)
      .flatMap((k) => cov.filter((c) => c.kind === k))
      .find((c) => c.status === 'done' && !c.revisit && (c.depth ?? 0) >= 2 && c.sub + 1 < c.subtopics.length && c.asked < MAX_Q[c.kind]);
    if (again) {
      again.status = 'active';
      again.revisit = true;
      again.sub++;
      again.level = Math.max(2, Math.min(3, again.depth ?? 2)) as Depth;
      return { action: 'ask', topic: again, same: false, first: null };
    }
  }
  return { action: 'empty' };
}

export function focusOf(track: TrackId, id: string): string | undefined {
  return defs(track).find((d) => d.id === id)?.focus;
}

/** One-line progress note for the interviewer. */
export function progress(cov: TopicCoverage[], elapsedMs: number, budgetMs: number) {
  const core = cov.filter((c) => c.kind === 'core');
  const done = core.filter((c) => c.status === 'done').length;
  const left = Math.max(0, Math.round((budgetMs - elapsedMs) / 60_000));
  return `${done} of ${core.length} role areas done, about ${left} min left for skill questions`;
}
