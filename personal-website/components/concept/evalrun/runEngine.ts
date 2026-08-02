import {
  companyRun,
  experiments,
  featuredProjects,
  gitEras,
  personalNotes,
  type ConceptViewId,
} from '../conceptData';

export type CaseState = 'pending' | 'running' | 'pass';

export type Artifact = {
  image: string;
  label: string;
  url: string;
};

export type CaseDefinition = {
  id: string;
  name: string;
  assertion: string;
  evidence: string;
  duration: number;
  terminalState: CaseState;
  artifact?: Artifact;
  commit?: string;
  date?: string;
  swatches?: string[];
};

export type SuiteDefinition = {
  id:
    | 'identity.suite'
    | 'shipped.suite'
    | 'inflight.suite'
    | 'regression.suite';
  target: ConceptViewId;
  cases: CaseDefinition[];
  environment?: typeof companyRun;
};

export type ResolvedCase = CaseDefinition & {
  state: CaseState;
  elapsed: number;
};

export type RunSnapshot = {
  suite: SuiteDefinition;
  cases: ResolvedCase[];
  completed: number;
  elapsed: number;
  settled: boolean;
};

const PROFILE_ASSERTIONS = [
  'expect(origin).toBe("San Diego")',
  'expect(education).toBe("Computer Science at UCLA")',
  'expect(background).toContain("cross-country and track")',
  'expect(cities).toHaveLength(4)',
] as const;

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
}

export function deterministicDuration(name: string) {
  let hash = 2166136261;

  for (const character of name) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return 650 + (Math.abs(hash) % 251);
}

function compileProfile(): SuiteDefinition {
  return {
    id: 'identity.suite',
    target: 'profile',
    environment: companyRun,
    cases: personalNotes.map((note, index) => {
      const name = slug(note);

      return {
        id: `identity.${String(index + 1).padStart(2, '0')}`,
        name,
        assertion: PROFILE_ASSERTIONS[index],
        evidence: note,
        duration: deterministicDuration(name),
        terminalState: 'pass',
      };
    }),
  };
}

function compileWork(): SuiteDefinition {
  return {
    id: 'shipped.suite',
    target: 'work',
    cases: featuredProjects.map((project, index) => ({
      id: `shipped.${String(index + 1).padStart(2, '0')}`,
      name: project.title,
      assertion: `${project.role}: ${project.description}`,
      evidence: project.description,
      duration: deterministicDuration(project.title),
      terminalState: 'pass',
      artifact: {
        image: project.image,
        label: project.accent,
        url: project.link,
      },
    })),
  };
}

function compileSignals(): SuiteDefinition {
  const stateByStatus: Record<string, CaseState> = {
    Shipping: 'pass',
    Measuring: 'running',
    Collecting: 'pending',
  };

  return {
    id: 'inflight.suite',
    target: 'signals',
    cases: experiments.map((experiment) => ({
      id: `inflight.${experiment.number.toLowerCase()}`,
      name: experiment.title,
      assertion: experiment.status,
      evidence: experiment.description,
      duration: deterministicDuration(experiment.title),
      terminalState: stateByStatus[experiment.status],
    })),
  };
}

function compileHistory(): SuiteDefinition {
  return {
    id: 'regression.suite',
    target: 'history',
    cases: gitEras.map((era, index) => {
      const name = `era("${era.label}") @ ${era.commit}`;

      return {
        id: `regression.${String(index + 1).padStart(2, '0')}`,
        name,
        assertion: era.description,
        evidence: `${era.title} · ${era.visualLanguage}`,
        duration: deterministicDuration(name),
        terminalState: 'pass',
        commit: era.commit,
        date: era.date,
        swatches: era.palette.split(' / '),
      };
    }),
  };
}

export function compileSuite(view: ConceptViewId): SuiteDefinition {
  switch (view) {
    case 'profile':
      return compileProfile();
    case 'work':
      return compileWork();
    case 'signals':
      return compileSignals();
    case 'history':
      return compileHistory();
  }
}

function resolveFiniteCase(
  caseDefinition: CaseDefinition,
  offset: number,
  elapsed: number,
  instant: boolean,
): ResolvedCase {
  if (instant || elapsed >= offset + caseDefinition.duration) {
    return {
      ...caseDefinition,
      state: caseDefinition.terminalState,
      elapsed: caseDefinition.duration,
    };
  }

  if (elapsed >= offset) {
    return {
      ...caseDefinition,
      state: 'running',
      elapsed: Math.max(0, elapsed - offset),
    };
  }

  return { ...caseDefinition, state: 'pending', elapsed: 0 };
}

export function resolveSuiteAt(
  suite: SuiteDefinition,
  startedAt: number,
  now: number,
  instant: boolean,
): RunSnapshot {
  const elapsed = Math.max(0, now - startedAt);
  let offset = 0;

  const cases = suite.cases.map((caseDefinition) => {
    if (suite.target === 'signals') {
      if (caseDefinition.terminalState === 'pass') {
        const resolved = resolveFiniteCase(
          caseDefinition,
          offset,
          elapsed,
          instant,
        );
        offset += caseDefinition.duration;
        return resolved;
      }

      if (caseDefinition.terminalState === 'running') {
        return {
          ...caseDefinition,
          state:
            instant || elapsed >= offset
              ? ('running' as const)
              : ('pending' as const),
          elapsed: instant
            ? caseDefinition.duration
            : Math.max(0, elapsed - offset),
        };
      }

      return { ...caseDefinition, state: 'pending' as const, elapsed: 0 };
    }

    const resolved = resolveFiniteCase(
      caseDefinition,
      offset,
      elapsed,
      instant,
    );
    offset += caseDefinition.duration;
    return resolved;
  });

  const completed = cases.filter((entry) => entry.state === 'pass').length;
  const settled =
    suite.target === 'signals'
      ? cases.some((entry) => entry.state === 'running')
      : completed === cases.length;
  const finiteDuration = suite.cases.reduce(
    (total, entry) => total + entry.duration,
    0,
  );

  return {
    suite,
    cases,
    completed,
    elapsed:
      suite.target === 'signals'
        ? instant
          ? cases.reduce((total, entry) => total + entry.elapsed, 0)
          : elapsed
        : instant
          ? finiteDuration
          : Math.min(elapsed, finiteDuration),
    settled,
  };
}
