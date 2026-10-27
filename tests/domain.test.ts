import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changeResource,
  emptyCharacter,
  integer,
  poisonTick,
  rollDice,
  validateCharacter,
} from '../src/domain';
test('damage cannot reduce HP below zero and healing cannot exceed maximum', () => {
  const character = emptyCharacter('one', 'Ana');
  assert.equal(changeResource(character, 'hp', -99).hp, 0);
  assert.equal(changeResource({ ...character, hp: 2 }, 'hp', 99).hp, 20);
  assert.equal(changeResource({ ...character, mana: 0 }, 'mana', 99).mana, 10);
  assert.equal(character.hp, 20);
});
test('poison applies for exactly three rounds and then expires', () => {
  let character = { ...emptyCharacter('one', 'Ana'), hp: 18, poison: { damage: 2, remaining: 3 } };
  const first = poisonTick(character);
  assert.equal(first.hp, 16);
  assert.equal(first.poison?.remaining, 2);
  const second = poisonTick(first);
  assert.equal(second.hp, 14);
  const third = poisonTick(second);
  assert.equal(third.hp, 12);
  assert.equal(third.poison, null);
  assert.deepEqual(poisonTick(third), third);
});
test('poison expires normally even when HP has reached zero', () => {
  const next = poisonTick({
    ...emptyCharacter('one', 'Ana'),
    hp: 1,
    poison: { damage: 3, remaining: 1 },
  });
  assert.equal(next.hp, 0);
  assert.equal(next.poison, null);
});
test('dice honor boundaries, quantity, and negative modifiers', () => {
  assert.deepEqual(rollDice(20, 2, -3, () => 0).values, [1, 1]);
  assert.equal(rollDice(20, 2, -3, () => 0).total, -1);
  assert.equal(rollDice(100, 1, 2, () => 0.999999).total, 100);
  for (const args of [
    [3, 1, 0],
    [20, 0, 0],
    [20, 21, 0],
    [20, 1.5, 0],
  ])
    assert.throws(() => rollDice(args[0], args[1], args[2]));
});

test('positive modifiers cannot exceed the maximum of the dice rolled', () => {
  const example = rollDice(20, 1, 19, () => 0.2);
  assert.deepEqual(example.values, [5]);
  assert.equal(example.total, 20);
  assert.equal(example.expression, '1d20 + 19');
  assert.equal(rollDice(20, 1, 3, () => 0.2).total, 8);
  assert.equal(rollDice(20, 1, 15, () => 0.2).total, 20);
  for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
    assert.equal(rollDice(sides, 1, 999, () => 0.999999).total, sides);
    assert.equal(rollDice(sides, 2, 999, () => 0.999999).total, 2 * sides);
    assert.equal(rollDice(sides, 2, 0, () => 0.999999).total, 2 * sides);
  }
});
test('empty inputs and invalid sheets are rejected before persistence', () => {
  for (const value of ['', ' ', 'abc', '1.5', Infinity, NaN])
    assert.throws(() => integer(value, 0, 10));
  const valid = { ...emptyCharacter('one', 'Ana'), name: ' Lyra ' };
  assert.equal(validateCharacter(valid).name, 'Lyra');
  assert.throws(() => validateCharacter({ ...valid, hp: 21 }));
  assert.throws(() => validateCharacter({ ...valid, maxMana: -1 }));
  assert.throws(() => validateCharacter({ ...valid, name: '' }));
});
