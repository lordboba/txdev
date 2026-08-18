import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isExtensionlessRelative =
      /^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier);

    return nextResolve(
      isExtensionlessRelative ? `${specifier}.ts` : specifier,
      context,
    );
  },
});

const { companyRun, experiments, featuredProjects, gitEras, personalNotes } =
  await import('../conceptData.ts');
const { compileSuite, deterministicDuration, resolveSuiteAt } = await import(
  './runEngine.ts'
);

test('case durations are deterministic and stay within the mechanical run window', () => {
  const names = [
    ...personalNotes,
    ...featuredProjects.map((project) => project.title),
    ...experiments.map((experiment) => experiment.title),
    ...gitEras.map((era) => era.commit),
  ];

  for (const name of names) {
    const first = deterministicDuration(name);
    assert.equal(first, deterministicDuration(name));
    assert.ok(first >= 650);
    assert.ok(first <= 900);
  }
});

test('every compiled duration is hashed from its final case name', () => {
  for (const view of ['profile', 'work', 'signals', 'history']) {
    const suite = compileSuite(view);

    for (const caseDefinition of suite.cases) {
      assert.equal(
        caseDefinition.duration,
        deterministicDuration(caseDefinition.name),
      );
    }
  }
});

test('profile compiles personal facts as cases and company history as configuration', () => {
  const suite = compileSuite('profile');

  assert.equal(suite.id, 'identity.suite');
  assert.deepEqual(
    suite.cases.map((caseDefinition) => caseDefinition.evidence),
    personalNotes,
  );
  assert.deepEqual(suite.environment, companyRun);
});

test('work cases preserve every real project artifact', () => {
  const suite = compileSuite('work');

  assert.equal(suite.id, 'shipped.suite');
  assert.equal(suite.cases.length, featuredProjects.length);

  suite.cases.forEach((caseDefinition, index) => {
    const project = featuredProjects[index];
    assert.deepEqual(caseDefinition.artifact, {
      image: project.image,
      label: project.accent,
      url: project.link,
    });
    assert.equal(caseDefinition.evidence, project.description);
  });
});

test('signals preserve source labels and keep every active experiment running', () => {
  const suite = compileSuite('signals');

  assert.equal(suite.id, 'inflight.suite');
  assert.deepEqual(
    suite.cases.map((caseDefinition) => caseDefinition.terminalState),
    experiments.map(() => 'running'),
  );
  assert.deepEqual(
    suite.cases.map((caseDefinition) => caseDefinition.assertion),
    experiments.map((experiment) => experiment.status),
  );
  assert.deepEqual(
    suite.cases.map((caseDefinition) => caseDefinition.evidence),
    experiments.map((experiment) => experiment.description),
  );
});

test('history remains chronological and preserves commit-backed palette evidence', () => {
  const suite = compileSuite('history');

  assert.equal(suite.id, 'regression.suite');
  assert.deepEqual(
    suite.cases.map((caseDefinition) => caseDefinition.commit),
    gitEras.map((era) => era.commit),
  );
  assert.deepEqual(
    suite.cases.map((caseDefinition) => caseDefinition.swatches),
    gitEras.map((era) => era.palette.split(' / ')),
  );
});

test('normal execution streams one case at a time before settling', () => {
  const suite = compileSuite('work');
  const start = 1_000;
  const initial = resolveSuiteAt(suite, start, start, false);
  const finished = resolveSuiteAt(suite, start, start + 10_000, false);

  assert.equal(initial.cases[0].state, 'running');
  assert.ok(initial.cases.slice(1).every((entry) => entry.state === 'pending'));
  assert.ok(finished.cases.every((entry) => entry.state === 'pass'));
  assert.equal(finished.completed, suite.cases.length);
});

test('reduced motion resolves finite suites but keeps active experiments running', () => {
  const work = resolveSuiteAt(compileSuite('work'), 0, 0, true);
  const signals = resolveSuiteAt(compileSuite('signals'), 0, 0, true);

  assert.ok(work.cases.every((entry) => entry.state === 'pass'));
  assert.ok(signals.cases.every((entry) => entry.state === 'running'));
  assert.ok(signals.cases.every((entry) => entry.elapsed === entry.duration));
  assert.equal(
    signals.elapsed,
    signals.cases.reduce((total, entry) => total + entry.duration, 0),
  );
});

test('active experiments keep the suite wall time running', () => {
  const signals = compileSuite('signals');
  const snapshot = resolveSuiteAt(signals, 500, 100_500, false);

  assert.equal(snapshot.elapsed, 100_000);
  assert.ok(snapshot.cases.every((entry) => entry.state === 'running'));
  assert.ok(
    snapshot.cases.every(
      (entry, index) => entry.elapsed > signals.cases[index].duration,
    ),
  );
});
