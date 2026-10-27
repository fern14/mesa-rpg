import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeInviteUrl } from '../src/invites';

test('HTTPS invite preserves GitHub Pages path and replaces previous parameters', () => {
  assert.equal(
    makeInviteUrl('ABCD1234', 'https://fern14.github.io/mesa-rpg?room=old#x'),
    'https://fern14.github.io/mesa-rpg/?code=ABCD1234',
  );
});
test('invite rejects unsafe protocols, invalid codes and allows local browser tests', () => {
  for (const site of ['http://example.com', 'javascript:alert(1)', 'file:///app'])
    assert.throws(() => makeInviteUrl('ABCD1234', site));
  assert.throws(() => makeInviteUrl('BAD&code=other', 'https://example.com'));
  assert.equal(
    makeInviteUrl('ABCD1234', 'http://127.0.0.1:8083'),
    'http://127.0.0.1:8083/?code=ABCD1234',
  );
});
