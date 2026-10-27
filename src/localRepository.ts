import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  changeResource,
  emptyCharacter,
  poisonTick,
  requireHost,
  requireOpen,
  validateCharacter,
  integer,
  type Snapshot,
  type GameEvent,
  type Character,
  type DiceRoll,
  type Room,
} from './domain';
import type { Repository } from './repository';
const KEY = '@mesa/local-v1';
const uid = 'local-host';
export class LocalRepository implements Repository {
  mode = 'local' as const;
  uid = uid;
  private rooms: Record<string, Snapshot> = {};
  private listeners = new Map<string, Set<(snapshot: Snapshot) => void>>();
  private catalogListeners = new Set<(rooms: Room[]) => void>();
  subscribeRooms(listener: (rooms: Room[]) => void) {
    listener(Object.values(this.rooms).map((state) => state.room));
    this.catalogListeners.add(listener);
    return () => {
      this.catalogListeners.delete(listener);
    };
  }
  private emitRooms() {
    this.catalogListeners.forEach((listener) =>
      listener(Object.values(this.rooms).map((state) => state.room)),
    );
  }
  private queue: Promise<void> = Promise.resolve();
  async load() {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) this.rooms = JSON.parse(raw);
    return this;
  }
  private room(id: string) {
    const room = this.rooms[id];
    if (!room) throw new Error('Mesa não encontrada neste aparelho.');
    return room;
  }
  private async mutate(id: string, action: (state: Snapshot) => void, host = false, open = true) {
    const work = this.queue.then(async () => {
      const next: Snapshot = JSON.parse(JSON.stringify(this.room(id)));
      if (host) requireHost(next, this.uid);
      if (open) requireOpen(next);
      action(next);
      next.events = next.events.slice(0, 100);
      const rooms = { ...this.rooms, [id]: next };
      await AsyncStorage.setItem(KEY, JSON.stringify(rooms));
      this.rooms = rooms;
      this.emitRooms();
      this.listeners.get(id)?.forEach((listener) => listener(next));
    });
    this.queue = work.catch(() => {});
    return work;
  }
  private event(state: Snapshot, text: string, kind: GameEvent['kind'] = 'change') {
    state.events.unshift({
      id: `${Date.now()}-${Math.random()}`,
      actorId: uid,
      actor: state.members.find((member) => member.id === uid)?.name ?? 'Mestre',
      text,
      kind,
      createdAt: Date.now(),
    });
  }
  async createRoom(name: string, memberName: string) {
    const id = `local-${Date.now()}`;
    const code = Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, 'X');
    this.rooms[id] = {
      room: { id, name, hostId: uid, code, round: 1, closed: false },
      characters: [],
      members: [{ id: uid, name: memberName, inviteCode: code }],
      events: [],
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(this.rooms));
    this.emitRooms();
    return id;
  }
  async createDemo() {
    const id = await this.createRoom('As cinzas de Eldoria', 'Mestre');
    await this.mutate(id, (state) => {
      const lyra = {
        ...emptyCharacter('demo-lyra', 'Ana'),
        name: 'Lyra',
        description: 'Elfa · Patrulheira\nUma flecha certeira e um passado incerto.',
        hp: 24,
        maxHp: 32,
        mana: 8,
        maxMana: 12,
        approved: true,
        poison: { damage: 2, remaining: 3 },
      };
      const kael = {
        ...emptyCharacter('demo-kael', 'Pedro'),
        name: 'Kael',
        description: 'Humano · Arcanista\nGuardião dos segredos da torre.',
        hp: 18,
        maxHp: 20,
        mana: 16,
        maxMana: 24,
        approved: true,
      };
      state.characters = [lyra, kael];
      state.members.push(
        { id: lyra.ownerId, name: 'Ana', inviteCode: state.room.code },
        { id: kael.ownerId, name: 'Pedro', inviteCode: state.room.code },
      );
      this.event(state, 'A aventura começou. Lyra está envenenada: 2 de dano por 3 rodadas.');
    });
    return id;
  }
  async joinRoom(code: string, _name: string) {
    const found = Object.values(this.rooms).find(
      (state) => state.room.code === code.trim().toUpperCase(),
    );
    if (!found)
      throw new Error(
        'No modo local, o código só abre mesas deste aparelho. Configure o Firebase para jogar entre celulares.',
      );
    return found.room.id;
  }
  subscribe(id: string, listener: (snapshot: Snapshot) => void, onError: (error: Error) => void) {
    try {
      listener(this.room(id));
    } catch (error) {
      onError(error as Error);
    }
    const listeners = this.listeners.get(id) ?? new Set();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    return () => {
      listeners.delete(listener);
    };
  }
  saveCharacter(id: string, character: Character) {
    return this.mutate(id, (state) => {
      const existing = state.characters.find((item) => item.id === character.id);
      if (state.room.hostId !== uid && (character.ownerId !== uid || existing?.approved))
        throw new Error('A ficha está bloqueada para edição.');
      const next = validateCharacter(character);
      state.characters = [...state.characters.filter((item) => item.id !== next.id), next];
      this.event(state, `${next.name}: ficha ${existing ? 'atualizada' : 'criada'}.`);
    });
  }
  adjustResource(id: string, characterId: string, resource: 'hp' | 'mana', delta: number) {
    return this.mutate(
      id,
      (state) => {
        state.characters = state.characters.map((character) => {
          if (character.id !== characterId) return character;
          const next = changeResource(character, resource, delta);
          this.event(
            state,
            `${character.name}: ${resource === 'hp' ? 'HP' : 'mana'} ${character[resource]} → ${next[resource]}.`,
          );
          return next;
        });
      },
      true,
    );
  }
  setPoison(id: string, characterId: string, damage: number, rounds: number) {
    integer(damage, 1, 999);
    integer(rounds, 1, 99);
    return this.mutate(
      id,
      (state) => {
        state.characters = state.characters.map((character) =>
          character.id === characterId
            ? { ...character, poison: { damage, remaining: rounds } }
            : character,
        );
        this.event(
          state,
          `${state.characters.find((character) => character.id === characterId)?.name}: veneno aplicado, ${damage} de dano por ${rounds} rodadas.`,
        );
      },
      true,
    );
  }
  removePoison(id: string, characterId: string) {
    return this.mutate(
      id,
      (state) => {
        state.characters = state.characters.map((character) =>
          character.id === characterId ? { ...character, poison: null } : character,
        );
        this.event(
          state,
          `${state.characters.find((character) => character.id === characterId)?.name}: veneno removido.`,
        );
      },
      true,
    );
  }
  advanceRound(id: string, expectedRound: number) {
    return this.mutate(
      id,
      (state) => {
        if (state.room.round !== expectedRound) throw new Error('Essa rodada já foi encerrada.');
        state.characters = state.characters.map((character) => {
          const next = poisonTick(character);
          if (character.poison)
            this.event(
              state,
              `${character.name}: veneno, HP ${character.hp} → ${next.hp}${next.poison ? ` · ${next.poison.remaining} rodada(s) restante(s)` : ' · efeito encerrado'}.`,
            );
          return next;
        });
        state.room.round += 1;
        this.event(
          state,
          `Rodada ${expectedRound} encerrada. Rodada ${state.room.round} iniciada.`,
          'round',
        );
      },
      true,
    );
  }
  publishRoll(id: string, roll: DiceRoll, label: string) {
    return this.mutate(id, (state) =>
      this.event(
        state,
        `${label.trim() ? `${label.trim()}: ` : ''}${roll.expression} → [${roll.values.join(', ')}] = ${roll.total}`,
        'roll',
      ),
    );
  }
  closeRoom(id: string) {
    return this.mutate(
      id,
      (state) => {
        this.event(state, 'Campanha encerrada. Os registros continuam disponíveis para consulta.');
        state.room.closed = true;
      },
      true,
    );
  }
}
