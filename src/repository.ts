import type { Character, DiceRoll, Snapshot } from './domain';
export interface Repository {
  mode: 'local' | 'firebase';
  uid: string;
  createRoom(name: string, memberName: string): Promise<string>;
  joinRoom(code: string, memberName: string): Promise<string>;
  subscribe(roomId: string, listener: (snapshot: Snapshot) => void, onError: (error: Error) => void): () => void;
  saveCharacter(roomId: string, character: Character): Promise<void>;
  adjustResource(roomId: string, characterId: string, resource: 'hp' | 'mana', delta: number): Promise<void>;
  setPoison(roomId: string, characterId: string, damage: number, rounds: number): Promise<void>;
  removePoison(roomId: string, characterId: string): Promise<void>;
  advanceRound(roomId: string, expectedRound: number): Promise<void>;
  publishRoll(roomId: string, roll: DiceRoll, label: string): Promise<void>;
  closeRoom(roomId: string): Promise<void>;
}
