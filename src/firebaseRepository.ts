import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, type Auth } from 'firebase/auth';
import { initializeSession } from './firebaseSession';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  collectionGroup,
  where,
  limit,
  serverTimestamp,
  connectFirestoreEmulator,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import {
  changeResource,
  poisonTick,
  validateCharacter,
  integer,
  type Character,
  type DiceRoll,
  type GameEvent,
  type Member,
  type Room,
  type Snapshot,
} from './domain';
import type { Repository } from './repository';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export type FirebaseRuntime = { auth: Auth; db: Firestore };
let runtimePromise: Promise<FirebaseRuntime | null> | undefined;
export function getFirebaseRuntime(): Promise<FirebaseRuntime | null> {
  return (runtimePromise ??= initializeFirebaseRuntime());
}
async function initializeFirebaseRuntime(): Promise<FirebaseRuntime | null> {
  if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true') return null;
  const present = Object.values(config).filter(Boolean).length;
  if (!present) return null;
  if (present !== 4)
    throw new Error(
      'Configuração Firebase incompleta. Preencha as quatro variáveis do arquivo .env.example.',
    );
  const app = initializeApp(config);
  const auth = initializeSession(app);
  const db = getFirestore(app);
  const emulator = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulator, 8080);
  }
  await auth.authStateReady();
  return { auth, db };
}
export class FirebaseRepository implements Repository {
  mode = 'firebase' as const;
  constructor(
    private db: Firestore,
    public uid: string,
  ) {}
  subscribeRooms(listener: (rooms: Room[]) => void, onError: (error: Error) => void) {
    const rooms = new Map<string, Room>();
    const watchers = new Map<string, () => void>();
    const emit = () =>
      listener([...rooms.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    const stop = onSnapshot(
      query(collectionGroup(this.db, 'members'), where('id', '==', this.uid)),
      (memberships) => {
        const ids = new Set(memberships.docs.map((item) => item.ref.parent.parent!.id));
        for (const [id, unsubscribe] of watchers)
          if (!ids.has(id)) {
            unsubscribe();
            watchers.delete(id);
            rooms.delete(id);
          }
        for (const id of ids)
          if (!watchers.has(id)) {
            watchers.set(
              id,
              onSnapshot(
                this.roomRef(id),
                (snapshot) => {
                  if (snapshot.exists()) rooms.set(id, snapshot.data() as Room);
                  else rooms.delete(id);
                  emit();
                },
                onError,
              ),
            );
          }
        emit();
      },
      onError,
    );
    return () => {
      stop();
      watchers.forEach((unsubscribe) => unsubscribe());
    };
  }
  private roomRef(id: string) {
    return doc(this.db, 'rooms', id);
  }
  private characterRef(id: string, characterId: string) {
    return doc(this.db, 'rooms', id, 'characters', characterId);
  }
  private async context(tx: Transaction, id: string, host = false) {
    const roomDoc = await tx.get(this.roomRef(id));
    if (!roomDoc.exists()) throw new Error('Mesa não encontrada.');
    const room = roomDoc.data() as Room;
    if (room.closed) throw new Error('Esta campanha está encerrada.');
    if (host && room.hostId !== this.uid) throw new Error('Esta ação é exclusiva do mestre.');
    const memberDoc = await tx.get(doc(this.db, 'rooms', id, 'members', this.uid));
    if (!memberDoc.exists()) throw new Error('Você não participa desta mesa.');
    return { room, member: memberDoc.data() as Member };
  }
  private event(
    tx: Transaction,
    id: string,
    member: Member,
    text: string,
    kind: GameEvent['kind'] = 'change',
  ) {
    const ref = doc(collection(this.db, 'rooms', id, 'events'));
    tx.set(ref, {
      id: ref.id,
      actorId: this.uid,
      actor: member.name,
      text,
      kind,
      createdAt: serverTimestamp(),
    });
  }
  async createRoom(name: string, memberName: string) {
    const ref = doc(collection(this.db, 'rooms'));
    const code = doc(collection(this.db, 'invites')).id.toUpperCase();
    await runTransaction(this.db, async (tx) => {
      const inviteRef = doc(this.db, 'invites', code);
      if ((await tx.get(inviteRef)).exists()) throw new Error('Tente criar a mesa novamente.');
      tx.set(ref, {
        id: ref.id,
        name,
        hostId: this.uid,
        code,
        round: 1,
        closed: false,
      } satisfies Room);
      tx.set(inviteRef, { roomId: ref.id, hostId: this.uid, active: true });
      tx.set(doc(this.db, 'rooms', ref.id, 'members', this.uid), {
        id: this.uid,
        name: memberName,
        inviteCode: code,
      } satisfies Member);
    });
    return ref.id;
  }
  async joinRoom(code: string, name: string) {
    const inviteCode = code.trim().toUpperCase();
    const invite = await getDoc(doc(this.db, 'invites', inviteCode));
    if (!invite.exists() || !invite.data().active)
      throw new Error('Convite inválido ou encerrado. Confira o código.');
    const id = invite.data().roomId as string;
    await runTransaction(this.db, async (tx) => {
      const ref = doc(this.db, 'rooms', id, 'members', this.uid);
      const current = await tx.get(ref);
      if (!current.exists()) tx.set(ref, { id: this.uid, name, inviteCode } satisfies Member);
    });
    return id;
  }
  subscribe(id: string, listener: (snapshot: Snapshot) => void, onError: (error: Error) => void) {
    let state: Snapshot | null = null;
    let stopped = false;
    const unsubscribes: (() => void)[] = [];
    const emit = () => {
      if (state && !stopped) listener({ ...state });
    };
    unsubscribes.push(
      onSnapshot(
        this.roomRef(id),
        (roomDoc) => {
          if (!roomDoc.exists()) {
            onError(new Error('Esta mesa foi removida.'));
            return;
          }
          const room = roomDoc.data() as Room;
          if (state) {
            state = { ...state, room };
            emit();
            return;
          }
          state = { room, members: [], characters: [], events: [] };
          emit();
          const charactersRef = collection(this.db, 'rooms', id, 'characters');
          const charactersQuery =
            room.hostId === this.uid
              ? query(charactersRef)
              : query(charactersRef, where('ownerId', '==', this.uid));
          unsubscribes.push(
            onSnapshot(
              charactersQuery,
              (result) => {
                if (state) {
                  state = {
                    ...state,
                    characters: result.docs.map((item) => item.data() as Character),
                  };
                  emit();
                }
              },
              onError,
            ),
          );
          unsubscribes.push(
            onSnapshot(
              collection(this.db, 'rooms', id, 'members'),
              (result) => {
                if (state) {
                  state = { ...state, members: result.docs.map((item) => item.data() as Member) };
                  emit();
                }
              },
              onError,
            ),
          );
          unsubscribes.push(
            onSnapshot(
              query(
                collection(this.db, 'rooms', id, 'events'),
                orderBy('createdAt', 'desc'),
                limit(50),
              ),
              (result) => {
                if (state) {
                  state = {
                    ...state,
                    events: result.docs.map((item) => {
                      const data = item.data();
                      return {
                        ...data,
                        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
                      } as GameEvent;
                    }),
                  };
                  emit();
                }
              },
              onError,
            ),
          );
        },
        onError,
      ),
    );
    return () => {
      stopped = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }
  async saveCharacter(id: string, character: Character) {
    const next = validateCharacter(character);
    await runTransaction(this.db, async (tx) => {
      const { room, member } = await this.context(tx, id);
      const ref = this.characterRef(id, next.id);
      const current = await tx.get(ref);
      if (
        room.hostId !== this.uid &&
        (next.ownerId !== this.uid || current.data()?.approved || next.approved)
      )
        throw new Error('A ficha foi aprovada e só pode ser editada pelo mestre.');
      if (current.exists() && current.data().ownerId !== next.ownerId)
        throw new Error('O dono da ficha não pode ser alterado.');
      tx.set(ref, next);
      this.event(
        tx,
        id,
        member,
        `${next.name}: ficha ${current.exists() ? 'atualizada' : 'criada'}.`,
      );
    });
  }
  private async updateCharacter(
    id: string,
    characterId: string,
    update: (character: Character) => Character,
    describe: (before: Character, after: Character) => string,
  ) {
    await runTransaction(this.db, async (tx) => {
      const { member } = await this.context(tx, id, true);
      const ref = this.characterRef(id, characterId);
      const current = await tx.get(ref);
      if (!current.exists()) throw new Error('Personagem não encontrado.');
      const before = current.data() as Character;
      const after = update(before);
      tx.set(ref, after);
      this.event(tx, id, member, describe(before, after));
    });
  }
  adjustResource(id: string, characterId: string, resource: 'hp' | 'mana', delta: number) {
    return this.updateCharacter(
      id,
      characterId,
      (character) => changeResource(character, resource, delta),
      (before, after) =>
        `${before.name}: ${resource === 'hp' ? 'HP' : 'mana'} ${before[resource]} → ${after[resource]}.`,
    );
  }
  setPoison(id: string, characterId: string, damage: number, rounds: number) {
    integer(damage, 1, 999);
    integer(rounds, 1, 99);
    return this.updateCharacter(
      id,
      characterId,
      (character) => ({ ...character, poison: { damage, remaining: rounds } }),
      (character) => `${character.name}: veneno aplicado, ${damage} de dano por ${rounds} rodadas.`,
    );
  }
  removePoison(id: string, characterId: string) {
    return this.updateCharacter(
      id,
      characterId,
      (character) => ({ ...character, poison: null }),
      (character) => `${character.name}: veneno removido.`,
    );
  }
  async advanceRound(id: string, expectedRound: number) {
    const poisoned = await getDocs(collection(this.db, 'rooms', id, 'characters'));
    await runTransaction(this.db, async (tx) => {
      const { room, member } = await this.context(tx, id, true);
      if (room.round !== expectedRound) throw new Error('Essa rodada já foi encerrada.');
      const characters = await Promise.all(poisoned.docs.map((item) => tx.get(item.ref)));
      for (const item of characters) {
        if (!item.exists()) continue;
        const before = item.data() as Character;
        if (!before.poison) continue;
        const after = poisonTick(before);
        tx.set(item.ref, after);
        this.event(
          tx,
          id,
          member,
          `${before.name}: veneno, HP ${before.hp} → ${after.hp}${after.poison ? ` · ${after.poison.remaining} rodada(s) restante(s)` : ' · efeito encerrado'}.`,
        );
      }
      tx.update(this.roomRef(id), { round: expectedRound + 1 });
      this.event(
        tx,
        id,
        member,
        `Rodada ${expectedRound} encerrada. Rodada ${expectedRound + 1} iniciada.`,
        'round',
      );
    });
  }
  async publishRoll(id: string, roll: DiceRoll, label: string) {
    await runTransaction(this.db, async (tx) => {
      const { member } = await this.context(tx, id);
      this.event(
        tx,
        id,
        member,
        `${label.trim() ? `${label.trim()}: ` : ''}${roll.expression} → [${roll.values.join(', ')}] = ${roll.total}`,
        'roll',
      );
    });
  }
  async closeRoom(id: string) {
    await runTransaction(this.db, async (tx) => {
      const { room, member } = await this.context(tx, id, true);
      tx.update(this.roomRef(id), { closed: true });
      tx.update(doc(this.db, 'invites', room.code), { active: false });
      this.event(
        tx,
        id,
        member,
        'Campanha encerrada. Os registros continuam disponíveis para consulta.',
      );
    });
  }
}
