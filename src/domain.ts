export type Attributes = { strength: number; agility: number; endurance: number; intelligence: number; perception: number };
export type Poison = { damage: number; remaining: number };
export type Character = {
  id: string; ownerId: string; ownerName: string; name: string; description: string;
  hp: number; maxHp: number; mana: number; maxMana: number; defense: number;
  attributes: Attributes; poison: Poison | null; approved: boolean;
};
export type Room = { id: string; name: string; hostId: string; code: string; round: number; closed: boolean };
export type Member = { id: string; name: string; inviteCode: string };
export type GameEvent = { id: string; actorId: string; actor: string; kind: 'roll' | 'change' | 'round'; text: string; createdAt: number };
export type Snapshot = { room: Room; characters: Character[]; members: Member[]; events: GameEvent[] };
export const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  strength: 'Força', agility: 'Agilidade', endurance: 'Resistência', intelligence: 'Inteligência', perception: 'Percepção',
};
export const emptyCharacter = (uid: string, ownerName: string): Character => ({
  id: uid, ownerId: uid, ownerName, name: '', description: '', hp: 20, maxHp: 20, mana: 10,
  maxMana: 10, defense: 10, attributes: { strength: 1, agility: 1, endurance: 1, intelligence: 1, perception: 1 },
  poison: null, approved: false,
});
export function integer(value: unknown, min: number, max: number): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`Informe um número inteiro entre ${min} e ${max}.`);
  return number;
}
export function validateCharacter(character: Character): Character {
  if (!character.name.trim() || character.name.trim().length > 60) throw new Error('O personagem precisa de um nome de até 60 caracteres.');
  integer(character.maxHp, 1, 9999); integer(character.hp, 0, character.maxHp);
  integer(character.maxMana, 0, 9999); integer(character.mana, 0, character.maxMana);
  integer(character.defense, 0, 999);
  for (const value of Object.values(character.attributes)) integer(value, -99, 999);
  if (character.description.length > 2000) throw new Error('Use até 2.000 caracteres nas anotações.');
  return { ...character, name: character.name.trim() };
}
export function changeResource(character: Character, resource: 'hp' | 'mana', delta: number): Character {
  integer(delta, -9999, 9999);
  return { ...character, [resource]: Math.max(0, Math.min(character[resource] + delta, resource === 'hp' ? character.maxHp : character.maxMana)) };
}
export function poisonTick(character: Character): Character {
  if (!character.poison) return character;
  const { damage, remaining } = character.poison;
  return { ...changeResource(character, 'hp', -damage), poison: remaining > 1 ? { damage, remaining: remaining - 1 } : null };
}
export type DiceRoll = { sides: number; quantity: number; modifier: number; values: number[]; total: number; expression: string };
export function rollDice(sides: number, quantity: number, modifier: number, random: () => number = Math.random): DiceRoll {
  if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) throw new Error('Dado inválido.');
  integer(quantity, 1, 20); integer(modifier, -999, 999);
  const values = Array.from({ length: quantity }, () => Math.floor(random() * sides) + 1);
  return { sides, quantity, modifier, values, total: values.reduce((sum, n) => sum + n, modifier), expression: `${quantity}d${sides}${modifier ? ` ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}` : ''}` };
}
export function requireHost(snapshot: Snapshot, uid: string) {
  if (snapshot.room.hostId !== uid) throw new Error('Esta ação é exclusiva do mestre.');
}
export function requireOpen(snapshot: Snapshot) {
  if (snapshot.room.closed) throw new Error('Esta campanha está encerrada e disponível apenas para consulta.');
}
