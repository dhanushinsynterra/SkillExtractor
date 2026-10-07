import type { TrackId } from '../lib/candidate';

/** Seeded data for the recruiter side until the backend exists. */

export type Verdict = 'strong' | 'promising' | 'hold' | 'review';
export type Depth = 0 | 1 | 2 | 3 | 4;

export const DEPTH_LABEL: Record<Depth, string> = {
  0: 'Not shown',
  1: 'Aware',
  2: 'Working',
  3: 'Proficient',
  4: 'Expert',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  strong: 'Strong yes',
  promising: 'Promising',
  hold: 'Not yet',
  review: 'Needs review',
};

export interface SkillScore {
  name: string;
  kind: 'core' | 'related' | 'tool';
  depth: Depth;
  evidence: string;
}

export interface IntegrityEvent {
  at: string;
  kind: 'gaze' | 'phone' | 'voice' | 'reconnect';
  note: string;
  severity: 'info' | 'warn';
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  track: TrackId;
  openingId: string;
  status: 'completed' | 'in_progress' | 'invited';
  verdict?: Verdict;
  score?: number;
  durationMin?: number;
  completedAt?: string;
  communication?: number;
  composure?: number;
  collaboration?: number;
  summary?: string;
  skills?: SkillScore[];
  integrity?: IntegrityEvent[];
  codeCard?: { attempts: number; solved: boolean; timeSec: number; explanation: string };
  highlights?: { who: 'ai' | 'you'; text: string }[];
  strengths?: string[];
  practise?: string[];
}

export interface Opening {
  id: string;
  title: string;
  team: string;
  location: string;
  opened: string;
  invited: number;
  completed: number;
  live: number;
}

export const OPENINGS: Opening[] = [
  { id: 'o1', title: 'Frontend Engineer', team: 'Web Platform', location: 'Hybrid', opened: '2026-09-28', invited: 64, completed: 41, live: 3 },
  { id: 'o2', title: 'Data Analyst', team: 'Insights', location: 'Remote', opened: '2026-09-21', invited: 30, completed: 27, live: 0 },
  { id: 'o3', title: 'Backend Engineer', team: 'Core Services', location: 'On-site', opened: '2026-10-02', invited: 25, completed: 9, live: 2 },
  { id: 'o4', title: 'QA Engineer', team: 'Quality', location: 'Hybrid', opened: '2026-10-05', invited: 18, completed: 6, live: 1 },
];

export const CANDIDATES: Candidate[] = [
  {
    id: 'c101',
    name: 'Ananya Rao',
    email: 'ananya.rao@example.com',
    track: 'frontend',
    openingId: 'o1',
    status: 'completed',
    verdict: 'strong',
    score: 86,
    durationMin: 22,
    completedAt: '2026-10-07T10:42:00',
    communication: 4,
    composure: 4,
    collaboration: 5,
    summary:
      'Built and shipped an event registration site used by ~3,000 people. Explains trade-offs clearly, reaches for debouncing and idempotency keys unprompted in the double-submit problem, and fixed the code card first try with a precise instruction.',
    skills: [
      { name: 'JavaScript', kind: 'core', depth: 4, evidence: '"The loop runs one past the end, so items[length] is undefined and .price throws."' },
      { name: 'React', kind: 'core', depth: 3, evidence: 'Described lifting state and memoising a filter list on the event schedule page.' },
      { name: 'CSS / responsive', kind: 'core', depth: 3, evidence: 'Used container queries for event cards; debugged a 320px overflow in DevTools.' },
      { name: 'Web performance', kind: 'related', depth: 3, evidence: 'Compressed hero images and lazy-loaded the gallery after Lighthouse flagged LCP.' },
      { name: 'HTTP & APIs', kind: 'related', depth: 2, evidence: 'Suggested a unique request ID so the server rejects duplicate registrations.' },
      { name: 'Accessibility', kind: 'related', depth: 2, evidence: 'Mentioned labels and focus states, less sure about screen-reader testing.' },
      { name: 'Git', kind: 'tool', depth: 3, evidence: 'Works on feature branches with PR reviews in a 4-person team.' },
      { name: 'Chrome DevTools', kind: 'tool', depth: 3, evidence: 'Network throttling to reproduce the slow-submit case.' },
    ],
    integrity: [{ at: '06:12', kind: 'gaze', note: 'Looked away ~4s while thinking (within adaptive threshold)', severity: 'info' }],
    codeCard: { attempts: 1, solved: true, timeSec: 38, explanation: 'Off-by-one: <= reads past the array end.' },
    highlights: [
      { who: 'ai', text: 'How would we stop double registrations on a slow network?' },
      { who: 'you', text: 'First disable the button and show a spinner, but that alone isn’t safe, so I’d send an idempotency key and have the server ignore repeats.' },
      { who: 'you', text: 'Line 3, change less than or equal to, to less than.' },
    ],
    strengths: ['Explaining trade-offs out loud', 'Debugging with DevTools', 'Precise instructions on the code card'],
    practise: ['Screen-reader testing with NVDA or TalkBack', 'Writing unit tests for UI logic'],
  },
  {
    id: 'c102',
    name: 'Daniel Mensah',
    email: 'daniel.mensah@example.com',
    track: 'backend',
    openingId: 'o3',
    status: 'completed',
    verdict: 'promising',
    score: 74,
    durationMin: 25,
    completedAt: '2026-10-07T10:15:00',
    communication: 3,
    composure: 3,
    collaboration: 4,
    summary:
      'Solid Spring Boot fundamentals from a food-ordering side project. Reached transactions and row locks for the last-seat problem with a nudge. Took time to structure answers; reasoning was sound.',
    skills: [
      { name: 'Java', kind: 'core', depth: 3, evidence: 'Explained checked vs unchecked exceptions with an example from their own project.' },
      { name: 'Spring Boot', kind: 'core', depth: 3, evidence: 'Controllers, services, JPA repositories; knows where @Transactional goes.' },
      { name: 'SQL', kind: 'core', depth: 3, evidence: 'SELECT … FOR UPDATE to lock the last seat.' },
      { name: 'Concurrency', kind: 'related', depth: 2, evidence: 'Got to locking after a hint, didn’t mention optimistic versioning.' },
      { name: 'REST design', kind: 'related', depth: 2, evidence: 'Status codes mostly right; would return 200 on a failed booking.' },
      { name: 'Caching', kind: 'related', depth: 1, evidence: 'Has heard of Redis, not used it.' },
      { name: 'Postman', kind: 'tool', depth: 3, evidence: 'Collections with environment variables.' },
      { name: 'Docker', kind: 'tool', depth: 1, evidence: 'Ran a MySQL container from a tutorial.' },
    ],
    integrity: [
      { at: '03:40', kind: 'reconnect', note: 'Network dropped 18s, session resumed automatically', severity: 'info' },
      { at: '14:05', kind: 'gaze', note: 'Looked down repeatedly for ~12s', severity: 'warn' },
    ],
    codeCard: { attempts: 2, solved: true, timeSec: 95, explanation: 'Single = assigns; needs == to compare.' },
    highlights: [
      { who: 'you', text: 'Two people same time… we can lock that row in the DB, so second one waits and then sees it is booked.' },
      { who: 'ai', text: 'Nice. What would the second person see?' },
    ],
    strengths: ['Database fundamentals', 'Calm under a network drop'],
    practise: ['Optimistic locking with version columns', 'HTTP status codes for failures'],
  },
  {
    id: 'c103',
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    track: 'data',
    openingId: 'o2',
    status: 'completed',
    verdict: 'strong',
    score: 89,
    durationMin: 24,
    completedAt: '2026-10-04T15:20:00',
    communication: 5,
    composure: 4,
    collaboration: 4,
    summary:
      'Thoughtful analyst. For the demand-forecasting problem they raised seasonality and promotions as structural breaks before being asked. Strong pandas and SQL; ML evaluation is textbook but correct.',
    skills: [
      { name: 'Python', kind: 'core', depth: 4, evidence: 'Fixed the average bug and added a guard for empty lists unprompted.' },
      { name: 'pandas', kind: 'core', depth: 4, evidence: 'groupby + resample for weekly sales; handles NaN with domain logic.' },
      { name: 'SQL', kind: 'core', depth: 3, evidence: 'Window functions for running totals.' },
      { name: 'Statistics', kind: 'related', depth: 3, evidence: 'Explained why MAPE misleads when prices are near zero.' },
      { name: 'Time series', kind: 'related', depth: 3, evidence: 'Seasonality and promotions as breaks.' },
      { name: 'ML evaluation', kind: 'related', depth: 2, evidence: 'Train/test split, knows to avoid shuffling time series.' },
      { name: 'Power BI', kind: 'tool', depth: 3, evidence: 'Built an operations dashboard during an internship.' },
      { name: 'Jupyter', kind: 'tool', depth: 4, evidence: 'Daily use.' },
    ],
    integrity: [],
    codeCard: { attempts: 1, solved: true, timeSec: 31, explanation: 'total = m overwrites; it should accumulate with +=.' },
    highlights: [{ who: 'you', text: 'I’d watch out for promotion weeks, the demand there is basically a different regime.' }],
    strengths: ['Domain intuition', 'Clean data handling', 'Clear explanations'],
    practise: ['Cross-validation for time series', 'Explaining model uncertainty to non-technical people'],
  },
  {
    id: 'c104',
    name: 'Lucas Ferreira',
    email: 'lucas.ferreira@example.com',
    track: 'qa',
    openingId: 'o4',
    status: 'completed',
    verdict: 'review',
    score: 58,
    durationMin: 19,
    completedAt: '2026-10-07T09:58:00',
    communication: 3,
    composure: 2,
    collaboration: 3,
    summary:
      'Good instincts for reproducing the payment failure (network toggling, timeouts). Seemed nervous early, then warmed up after reassurance. Flagged for a phone detection, so worth a human look before deciding.',
    skills: [
      { name: 'Manual testing', kind: 'core', depth: 3, evidence: 'Boundary values and negative cases for the payment flow.' },
      { name: 'Selenium', kind: 'core', depth: 2, evidence: 'Basic locators, explicit waits.' },
      { name: 'Bug reporting', kind: 'related', depth: 3, evidence: 'Steps, expected vs actual, logs, device and network info.' },
      { name: 'API testing', kind: 'related', depth: 1, evidence: 'Knows Postman exists.' },
      { name: 'JIRA', kind: 'tool', depth: 2, evidence: 'Used in an internship.' },
    ],
    integrity: [
      { at: '08:30', kind: 'phone', note: 'Phone-like object detected; gentle warning given', severity: 'warn' },
      { at: '08:31', kind: 'gaze', note: 'Returned to screen after warning', severity: 'info' },
    ],
    codeCard: { attempts: 3, solved: true, timeSec: 140, explanation: '10% off 500 is 450.' },
    highlights: [{ who: 'ai', text: 'No rush at all. Even a rough example is perfect.' }],
    strengths: ['Thinking about real-world failure modes', 'Structured bug reports'],
    practise: ['API testing with Postman', 'Writing assertions from requirements'],
  },
  {
    id: 'c105',
    name: 'Sara Kim',
    email: 'sara.kim@example.com',
    track: 'frontend',
    openingId: 'o1',
    status: 'completed',
    verdict: 'hold',
    score: 47,
    durationMin: 17,
    completedAt: '2026-10-07T09:31:00',
    communication: 3,
    composure: 3,
    collaboration: 3,
    summary: 'Knows HTML/CSS basics from tutorial projects; JavaScript reasoning is still shaky. Could not locate the off-by-one without the hint.',
    skills: [
      { name: 'HTML/CSS', kind: 'core', depth: 2, evidence: 'Flexbox layouts for a portfolio.' },
      { name: 'JavaScript', kind: 'core', depth: 1, evidence: 'Unsure what undefined.price would do.' },
      { name: 'React', kind: 'core', depth: 1, evidence: 'Followed a tutorial.' },
      { name: 'Git', kind: 'tool', depth: 2, evidence: 'Push and pull on GitHub.' },
    ],
    integrity: [],
    codeCard: { attempts: 4, solved: false, timeSec: 240, explanation: '—' },
    strengths: ['Neat layouts', 'Honest about gaps in knowledge'],
    practise: ['JavaScript loops and arrays', 'Reading error messages in the console'],
  },
  {
    id: 'c106',
    name: 'Omar Haddad',
    email: 'omar.haddad@example.com',
    track: 'backend',
    openingId: 'o3',
    status: 'in_progress',
  },
  {
    id: 'c107',
    name: 'Meera Iyer',
    email: 'meera.iyer@example.com',
    track: 'data',
    openingId: 'o2',
    status: 'completed',
    verdict: 'promising',
    score: 71,
    durationMin: 23,
    completedAt: '2026-10-04T14:02:00',
    communication: 4,
    composure: 4,
    collaboration: 4,
    summary: 'Good SQL and Excel; solid business sense. Python is newer. Explained the forecasting approach clearly with a simple baseline first.',
    skills: [
      { name: 'SQL', kind: 'core', depth: 3, evidence: 'Joins and GROUP BY confidently.' },
      { name: 'Python', kind: 'core', depth: 2, evidence: 'Fixed the bug after the hint.' },
      { name: 'Excel', kind: 'tool', depth: 4, evidence: 'Pivot tables and XLOOKUP for monthly reporting.' },
      { name: 'Statistics', kind: 'related', depth: 2, evidence: 'Baseline vs model comparison.' },
    ],
    integrity: [],
    codeCard: { attempts: 2, solved: true, timeSec: 88, explanation: 'Total should add up, not replace.' },
    strengths: ['Starting with a simple baseline', 'Business framing'],
    practise: ['pandas groupby and merge', 'Plotting with matplotlib'],
  },
  {
    id: 'c108',
    name: 'Tom Becker',
    email: 'tom.becker@example.com',
    track: 'qa',
    openingId: 'o4',
    status: 'in_progress',
  },
  {
    id: 'c109',
    name: 'Aisha Khan',
    email: 'aisha.khan@example.com',
    track: 'backend',
    openingId: 'o3',
    status: 'invited',
  },
];

export const TRACK_LABEL: Record<TrackId, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  data: 'Data & AI',
  mobile: 'Mobile',
  qa: 'Testing & QA',
};
