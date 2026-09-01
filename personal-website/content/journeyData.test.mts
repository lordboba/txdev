import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import { experiences } from './experienceData.ts';
import { projects } from './projectData.ts';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

async function loadJourneyData() {
  try {
    return await import('./journeyData.ts');
  } catch (error) {
    assert.fail(
      `content/journeyData.ts must be the canonical journey module: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

test('beat, node, and artifact ids are unique', async () => {
  const { journeyArtifacts, journeyBeats, journeyNodes } =
    await loadJourneyData();

  assert.equal(new Set(journeyBeats.map((beat) => beat.id)).size, 9);
  assert.equal(journeyBeats.length, 9);
  assert.equal(
    new Set(journeyNodes.map((node) => node.id)).size,
    journeyNodes.length,
  );
  assert.equal(
    new Set(journeyArtifacts.map((artifact) => artifact.id)).size,
    journeyArtifacts.length,
  );
});

test('nextId chain visits every beat exactly once and ends null', async () => {
  const { journeyBeats } = await loadJourneyData();

  const beatsById = new Map(journeyBeats.map((beat) => [beat.id, beat]));
  const visited = new Set<string>();
  let current = journeyBeats[0];

  for (;;) {
    assert.ok(!visited.has(current.id), `beat ${current.id} visited twice`);
    visited.add(current.id);
    if (current.nextId === null) break;

    const next = beatsById.get(current.nextId);
    assert.ok(next, `beat ${current.id} points at missing ${current.nextId}`);
    current = next;
  }

  assert.equal(visited.size, journeyBeats.length);
});

test('map ids, artifact links, and node graph are internally consistent', async () => {
  const { journeyArtifacts, journeyBeats, journeyMaps, journeyNodes } =
    await loadJourneyData();

  const mapIds = new Set(journeyMaps.map((map) => map.id));
  const artifactIds = new Set(journeyArtifacts.map((artifact) => artifact.id));
  const beatsById = new Map(journeyBeats.map((beat) => [beat.id, beat]));
  const nodesById = new Map(journeyNodes.map((node) => [node.id, node]));

  for (const beat of journeyBeats) {
    assert.ok(mapIds.has(beat.mapId), `beat ${beat.id} has bad map`);
    for (const artifactId of beat.artifactIds) {
      assert.ok(
        artifactIds.has(artifactId),
        `beat ${beat.id} references missing artifact ${artifactId}`,
      );
    }
  }

  for (const node of journeyNodes) {
    assert.ok(mapIds.has(node.mapId), `node ${node.id} has bad map`);
    assert.ok(node.x >= 0 && node.x <= 100, `node ${node.id} x out of range`);
    assert.ok(node.y >= 0 && node.y <= 100, `node ${node.id} y out of range`);

    if (node.kind === 'main') {
      const beat = beatsById.get(node.beatId);
      assert.ok(beat, `node ${node.id} references missing beat`);
      assert.equal(beat.mapId, node.mapId, `node ${node.id} map mismatch`);
    } else {
      assert.ok(
        artifactIds.has(node.artifactId),
        `node ${node.id} references missing artifact ${node.artifactId}`,
      );
    }

    assert.ok(node.adjacency.length > 0, `node ${node.id} has no neighbors`);
    for (const neighborId of node.adjacency) {
      const neighbor = nodesById.get(neighborId);
      assert.ok(neighbor, `node ${node.id} adjacency ${neighborId} missing`);
      assert.ok(
        neighbor.adjacency.includes(node.id),
        `adjacency ${node.id} <-> ${neighborId} is not symmetric`,
      );
    }
  }

  for (const map of journeyMaps) {
    const mapNodes = journeyNodes.filter((node) => node.mapId === map.id);
    const start = mapNodes.find((node) => node.kind === 'main');
    assert.ok(start, `map ${map.id} has no main node to start from`);

    const reachable = new Set([start.id]);
    const queue: (typeof journeyNodes)[number][] = [start];
    while (queue.length > 0) {
      const node = queue.shift();
      assert.ok(node);
      for (const neighborId of node.adjacency) {
        if (reachable.has(neighborId)) continue;
        const neighbor = nodesById.get(neighborId);
        assert.ok(neighbor);
        reachable.add(neighborId);
        queue.push(neighbor);
      }
    }

    for (const node of mapNodes) {
      assert.ok(
        reachable.has(node.id),
        `node ${node.id} is unreachable from ${start.id} on map ${map.id}`,
      );
    }
  }

  const mainBeatIds = journeyNodes.flatMap((node) =>
    node.kind === 'main' ? [node.beatId] : [],
  );
  for (const beat of journeyBeats) {
    assert.ok(
      mainBeatIds.includes(beat.id),
      `beat ${beat.id} has no main-path node`,
    );
  }
});

test('consecutive main nodes along the spine are mutually adjacent', async () => {
  const { journeyNodes, orderedBeatIds } = await loadJourneyData();

  const mainNodes = orderedBeatIds.map((beatId) => {
    const node = journeyNodes.find(
      (candidate) => candidate.kind === 'main' && candidate.beatId === beatId,
    );
    assert.ok(node, `beat ${beatId} has no main node`);
    return node;
  });

  for (let i = 0; i < mainNodes.length - 1; i += 1) {
    const here = mainNodes[i];
    const next = mainNodes[i + 1];
    assert.ok(
      here.adjacency.includes(next.id) && next.adjacency.includes(here.id),
      `spine break: ${here.id} and ${next.id} are not adjacent`,
    );
  }
});

test('canonical references resolve against experiences and projects', async () => {
  const { canonicalRefs } = await loadJourneyData();

  for (const { beatId, ref } of canonicalRefs) {
    if ('company' in ref) {
      const canonical = experiences.find(
        (experience) => experience.company === ref.company,
      );
      assert.ok(
        canonical,
        `missing canonical experience for ${ref.company} (beat ${beatId})`,
      );
    } else {
      const canonical = projects.find(
        (project) => project.title === ref.project,
      );
      assert.ok(
        canonical,
        `missing canonical project for ${ref.project} (beat ${beatId})`,
      );
    }
  }

  const referenced = canonicalRefs.map(({ ref }) =>
    'company' in ref ? ref.company : ref.project,
  );
  assert.ok(referenced.includes('SafetyKit'));
  assert.ok(referenced.includes('Ramp'));
  assert.ok(referenced.includes('Grow & Give'));
});

test('every artifact with an asset points at a real file under public/', async () => {
  const { journeyArtifacts } = await loadJourneyData();

  for (const artifact of journeyArtifacts) {
    if (artifact.asset === null) {
      assert.ok(
        artifact.sourceNote.length > 0,
        `artifact ${artifact.id} without asset needs a source note`,
      );
      continue;
    }

    assert.ok(
      artifact.asset.startsWith('/'),
      `artifact ${artifact.id} asset must be a public path`,
    );
    assert.ok(
      existsSync(path.join(publicDir, artifact.asset.slice(1))),
      `artifact ${artifact.id} asset ${artifact.asset} not found in public/`,
    );
  }
});

test('unresolved bracketed copy cannot be marked confirmed', async () => {
  const { journeyBeats } = await loadJourneyData();

  for (const beat of journeyBeats) {
    if (beat.story.some((line) => line.includes('['))) {
      assert.equal(
        beat.editorialStatus,
        'needs-tyler',
        `beat ${beat.id} has unresolved placeholders but is not needs-tyler`,
      );
    }
  }
});

test('editorial statuses match the workshop chapter badges', async () => {
  const { journeyBeats } = await loadJourneyData();

  assert.deepEqual(
    journeyBeats.map((beat) => [beat.id, beat.editorialStatus]),
    [
      ['00-wake', 'confirmed'],
      ['01-practices', 'confirmed'],
      ['02-del-norte', 'needs-tyler'],
      ['03-first-app', 'needs-tyler'],
      ['04-ucla', 'needs-tyler'],
      ['05-safetykit', 'confirmed'],
      ['06-codex', 'confirmed'],
      ['07-ramp', 'confirmed'],
      ['08-horizon', 'source-conflict'],
    ],
  );
});

test('wording rules hold for the published copy', async () => {
  const { journeyBeats, journeyWordingRules } = await loadJourneyData();

  const beatsById = new Map(journeyBeats.map((beat) => [beat.id, beat]));

  for (const rule of journeyWordingRules) {
    const beat = beatsById.get(rule.beatId);
    assert.ok(beat, `wording rule targets missing beat ${rule.beatId}`);

    const copy = `${beat.title}\n${beat.story.join('\n')}`.toLowerCase();
    for (const phrase of rule.forbidden) {
      assert.ok(
        !copy.includes(phrase.toLowerCase()),
        `beat ${rule.beatId} must not contain "${phrase}"`,
      );
    }
    for (const phrase of rule.required) {
      assert.ok(
        copy.includes(phrase.toLowerCase()),
        `beat ${rule.beatId} must contain "${phrase}"`,
      );
    }
  }

  const safetykit = beatsById.get('05-safetykit');
  const codex = beatsById.get('06-codex');
  const horizon = beatsById.get('08-horizon');
  assert.ok(safetykit && codex && horizon);
  assert.ok(!safetykit.story.join(' ').includes('first internship'));
  assert.ok(!horizon.story.join(' ').includes('Decagon'));
  assert.ok(!horizon.story.join(' ').includes('Snowflake'));
  assert.ok(!codex.story.join(' ').includes('OpenAI'));
  assert.ok(codex.story.join(' ').includes('Codex Ambassador'));
});

test('derived views are re-derivable from the canonical beat array', async () => {
  const {
    beatsByMap,
    canonicalRefs,
    journeyBeats,
    journeyMaps,
    orderedBeatIds,
  } = await loadJourneyData();

  const beatsById = new Map(journeyBeats.map((beat) => [beat.id, beat]));
  const expectedOrder: string[] = [];
  let current = journeyBeats[0];
  for (;;) {
    expectedOrder.push(current.id);
    if (current.nextId === null) break;
    const next = beatsById.get(current.nextId);
    assert.ok(next);
    current = next;
  }
  assert.deepEqual(orderedBeatIds, expectedOrder);

  const mapOrder: string[] = [];
  for (const beatId of expectedOrder) {
    const beat = beatsById.get(beatId);
    assert.ok(beat);
    if (!mapOrder.includes(beat.mapId)) mapOrder.push(beat.mapId);
  }
  assert.deepEqual(
    journeyMaps.map((map) => map.id),
    mapOrder,
  );
  for (const map of journeyMaps) {
    assert.ok(map.name.length > 0);
    assert.ok(map.placeLabel.length > 0);
  }

  for (const map of journeyMaps) {
    assert.deepEqual(
      beatsByMap[map.id],
      journeyBeats.filter((beat) => beat.mapId === map.id),
    );
  }
  assert.deepEqual(
    Object.keys(beatsByMap).toSorted(),
    journeyMaps.map((map) => map.id).toSorted(),
  );

  assert.deepEqual(
    canonicalRefs,
    journeyBeats.flatMap((beat) =>
      beat.refs.map((ref) => ({ beatId: beat.id, ref })),
    ),
  );
});
