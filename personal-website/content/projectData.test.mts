import assert from 'node:assert/strict';
import test from 'node:test';

async function loadProjectData() {
  try {
    return await import('./projectData.ts');
  } catch (error) {
    assert.fail(
      `content/projectData.ts must be the canonical project module: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

test('featured and side projects are derived from one canonical catalog', async () => {
  const { featuredProjects, projects, sideProjects } = await loadProjectData();

  assert.equal(
    new Set(projects.map((project) => project.title)).size,
    projects.length,
  );
  assert.deepEqual(
    featuredProjects.map((project) => project.title),
    ['iCalarms', 'Personal Env', 'Med Negotiate', 'Charades 2026'],
  );

  for (const featured of featuredProjects) {
    const canonical = projects.find(
      (project) => project.title === featured.title,
    );

    assert.ok(canonical, `missing canonical project for ${featured.title}`);
    assert.ok(canonical.bench, `missing Bench data for ${featured.title}`);
    assert.equal(featured.role, canonical.bench.role);
    assert.equal(featured.description, canonical.bench.description);
    assert.equal(featured.accent, canonical.bench.accent);
    assert.equal(featured.image, canonical.image);
    assert.equal(featured.link, canonical.link);
  }

  assert.deepEqual(
    sideProjects.map((project) => project.title),
    projects
      .filter((project) => !project.bench)
      .map((project) => project.title),
  );
});
