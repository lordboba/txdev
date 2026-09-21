import assert from 'node:assert/strict';
import test from 'node:test';

async function loadExperienceData() {
  try {
    return await import('./experienceData.ts');
  } catch (error) {
    assert.fail(
      `content/experienceData.ts must be the canonical experience module: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

test('groups and Bench views are derived from canonical experience records', async () => {
  const { companyRun, companyTags, experienceGroups, experiences } =
    await loadExperienceData();

  assert.deepEqual(
    experienceGroups.flatMap((group) => group.items),
    experienceGroups.flatMap((group) =>
      experiences.filter((experience) => experience.status === group.status),
    ),
  );

  const benchRecords = experiences
    .flatMap((experience) =>
      experience.bench ? [{ experience, bench: experience.bench }] : [],
    )
    .toSorted((left, right) => left.bench.order - right.bench.order);

  assert.deepEqual(
    companyTags.map((tag) => tag.mark),
    benchRecords.map(({ bench }) => bench.mark),
  );
  assert.deepEqual(
    companyRun.map((entry) => entry.company),
    benchRecords
      .filter(({ bench }) => bench.run !== null)
      .map(({ bench }) => bench.mark),
  );

  for (const tag of companyTags) {
    const canonical = experiences.find(
      (experience) => experience.company === tag.org,
    );

    assert.ok(canonical, `missing canonical experience for ${tag.org}`);
    assert.equal(tag.role, canonical.role);
    assert.equal(tag.period, canonical.period);
    assert.equal(tag.summary, canonical.summary);
    assert.equal(tag.proof, canonical.proof);
    assert.deepEqual(tag.focus, canonical.focus);
  }
});
