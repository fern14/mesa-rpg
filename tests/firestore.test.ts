import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { FirebaseRepository } from '../src/firebaseRepository';
import { emptyCharacter, rollDice } from '../src/domain';
let env: RulesTestEnvironment;
const database = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mesa-rpg',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
test('account catalog lists only own memberships, including existing guest campaigns', async () => {
  const { roomId } = await setup();
  const own = query(collectionGroup(database('player'), 'members'), where('id', '==', 'player'));
  const memberships = await assertSucceeds(getDocs(own));
  assert.equal(memberships.size, 1);
  assert.equal(memberships.docs[0].ref.parent.parent?.id, roomId);
  await assertFails(getDocs(collectionGroup(database('outsider'), 'members')));
  await assertFails(
    getDocs(query(collectionGroup(database('outsider'), 'members'), where('id', '==', 'master'))),
  );
  await assertSucceeds(
    getDocs(query(collectionGroup(database('outsider'), 'members'), where('id', '==', 'outsider'))),
  );
});
test('linking guest to password preserves UID and master access on another device', async () => {
  const first = initializeApp({ apiKey: 'fake-api-key', projectId: 'demo-mesa-rpg' }, 'guest-link');
  const second = initializeApp(
    { apiKey: 'fake-api-key', projectId: 'demo-mesa-rpg' },
    'second-device',
  );
  try {
    const firstAuth = getAuth(first);
    const secondAuth = getAuth(second);
    connectAuthEmulator(firstAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectAuthEmulator(secondAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const guest = await signInAnonymously(firstAuth);
    const uid = guest.user.uid;
    const repo = new FirebaseRepository(database(uid), uid);
    const id = await repo.createRoom('Mesa do convidado', 'Mestre');
    const address = `linked-${Date.now()}@example.test`;
    const password = 'SenhaTeste123!';
    const linked = await linkWithCredential(
      guest.user,
      EmailAuthProvider.credential(address, password),
    );
    assert.equal(linked.user.uid, uid);
    assert.equal(linked.user.isAnonymous, false);
    const login = await signInWithEmailAndPassword(secondAuth, address, password);
    assert.equal(login.user.uid, uid);
    const otherDevice = new FirebaseRepository(database(login.user.uid), login.user.uid);
    await otherDevice.advanceRound(id, 1);
    assert.equal((await getDoc(doc(database(uid), 'rooms', id))).data()?.round, 2);
  } finally {
    await deleteApp(first);
    await deleteApp(second);
  }
});
beforeEach(async () => {
  await env.clearFirestore();
});
after(async () => {
  await env?.cleanup();
});
async function setup() {
  const master = new FirebaseRepository(database('master'), 'master');
  const roomId = await master.createRoom('Aventura de teste', 'Mestre');
  const room = (await getDoc(doc(database('master'), 'rooms', roomId))).data()!;
  const player = new FirebaseRepository(database('player'), 'player');
  await player.joinRoom(room.code, 'Ana');
  const character = { ...emptyCharacter('player', 'Ana'), name: 'Lyra', hp: 18 };
  await player.saveCharacter(roomId, character);
  return { master, player, roomId, room, character };
}
test('real repository creates a room, joins through invite, and saves a player sheet', async () => {
  const { roomId, character } = await setup();
  const result = await getDoc(doc(database('master'), 'rooms', roomId, 'characters', 'player'));
  assert.equal(result.data()?.name, character.name);
  await assertSucceeds(
    getDocs(
      query(
        collection(database('player'), 'rooms', roomId, 'characters'),
        where('ownerId', '==', 'player'),
      ),
    ),
  );
  await assertFails(getDocs(collection(database('player'), 'rooms', roomId, 'characters')));
  await assertFails(getDoc(doc(database('outsider'), 'rooms', roomId)));
});
test('master edits approved sheet, player cannot change it or advance rounds', async () => {
  const { master, player, roomId, character } = await setup();
  await master.saveCharacter(roomId, { ...character, approved: true });
  await assertFails(
    updateDoc(doc(database('player'), 'rooms', roomId, 'characters', 'player'), { hp: 1 }),
  );
  await assert.rejects(player.saveCharacter(roomId, { ...character, hp: 1 }));
  await assert.rejects(player.advanceRound(roomId, 1));
  await assertFails(updateDoc(doc(database('player'), 'rooms', roomId), { round: 2 }));
  await master.adjustResource(roomId, 'player', 'hp', -7);
  assert.equal(
    (await getDoc(doc(database('player'), 'rooms', roomId, 'characters', 'player'))).data()?.hp,
    11,
  );
});
test('poison consumes one round exactly once, even with concurrent advancement', async () => {
  const { master, roomId } = await setup();
  await master.setPoison(roomId, 'player', 2, 3);
  const results = await Promise.allSettled([
    master.advanceRound(roomId, 1),
    master.advanceRound(roomId, 1),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  let character = (
    await getDoc(doc(database('master'), 'rooms', roomId, 'characters', 'player'))
  ).data()!;
  assert.equal(character.hp, 16);
  assert.equal(character.poison.remaining, 2);
  await master.advanceRound(roomId, 2);
  await master.advanceRound(roomId, 3);
  character = (
    await getDoc(doc(database('master'), 'rooms', roomId, 'characters', 'player'))
  ).data()!;
  assert.equal(character.hp, 12);
  assert.equal(character.poison, null);
});
test('master and player publish public rolls; events cannot be overwritten or impersonated', async () => {
  const { master, player, roomId } = await setup();
  await master.publishRoll(
    roomId,
    rollDice(20, 1, 4, () => 0.5),
    'Ataque',
  );
  await player.publishRoll(
    roomId,
    rollDice(6, 2, 0, () => 0),
    'Dano',
  );
  const events = await getDocs(collection(database('player'), 'rooms', roomId, 'events'));
  assert.equal(events.docs.filter((item) => item.data().kind === 'roll').length, 2);
  await assertFails(updateDoc(events.docs[0].ref, { text: 'Resultado alterado' }));
  await assertFails(
    setDoc(doc(database('player'), 'rooms', roomId, 'events', 'forged'), {
      id: 'forged',
      actorId: 'master',
      actor: 'Mestre',
      kind: 'roll',
      text: '20',
      createdAt: serverTimestamp(),
    }),
  );
});
test('invalid values, unauthorized identity changes, and cross-room reads are denied', async () => {
  const { master, roomId, character } = await setup();
  const ref = doc(database('master'), 'rooms', roomId, 'characters', 'player');
  await assertFails(updateDoc(ref, { hp: 99999 }));
  await assertFails(updateDoc(ref, { poison: { damage: -1, remaining: 3 } }));
  await assertFails(updateDoc(ref, { ownerId: 'someone-else' }));
  await master.saveCharacter(roomId, { ...emptyCharacter('master', 'Mestre'), name: 'NPC' });
  await assertFails(getDoc(doc(database('player'), 'rooms', roomId, 'characters', 'master')));
  await assertFails(
    setDoc(doc(database('outsider'), 'rooms', roomId, 'members', 'outsider'), {
      id: 'outsider',
      name: 'Intruso',
      inviteCode: 'INVALID',
    }),
  );
  assert.equal(character.hp, 18);
});
test('closing a campaign blocks invitations and mutations while preserving reads', async () => {
  const { master, player, roomId, room } = await setup();
  await master.closeRoom(roomId);
  await assert.rejects(master.adjustResource(roomId, 'player', 'hp', -1));
  await assert.rejects(player.publishRoll(roomId, rollDice(20, 1, 0), ''));
  await assertFails(
    updateDoc(doc(database('master'), 'rooms', roomId, 'characters', 'player'), { hp: 0 }),
  );
  await assert.rejects(
    new FirebaseRepository(database('late'), 'late').joinRoom(room.code, 'Novo'),
  );
  await assertSucceeds(getDoc(doc(database('player'), 'rooms', roomId, 'characters', 'player')));
});

test('realtime subscription delivers player rolls to the master', async () => {
  const { master, player, roomId } = await setup();
  let unsubscribe = () => {};
  let timeout: ReturnType<typeof setTimeout>;
  const received = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('O mestre não recebeu a rolagem em tempo real.')),
      10000,
    );
    unsubscribe = master.subscribe(
      roomId,
      (snapshot) => {
        if (
          snapshot.events.some(
            (event) =>
              event.actorId === 'player' &&
              event.kind === 'roll' &&
              event.text.includes('Teste ao vivo'),
          )
        ) {
          assert.equal(snapshot.characters[0]?.name, 'Lyra');
          resolve();
        }
      },
      reject,
    );
  });
  try {
    await player.publishRoll(
      roomId,
      rollDice(20, 1, 2, () => 0.5),
      'Teste ao vivo',
    );
    await received;
  } finally {
    clearTimeout(timeout!);
    unsubscribe();
  }
});
