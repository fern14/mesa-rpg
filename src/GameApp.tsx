import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth, authError } from './auth';
import { AuthPanel } from './AuthPanel';
import { HomeScreen } from './HomeScreen';
import { RoomDashboard } from './RoomDashboard';
import { makeInviteUrl, publicSiteUrl } from './invites';
import { LocalRepository } from './localRepository';
import { emptyCharacter, type Character, type Snapshot } from './domain';
import type { Repository } from './repository';
import { Button, Sheet, CharacterEditor, PoisonEditor, ResourceEditor, colors, ui } from './ui';
import { CharacterCard, DicePanel, Empty, EventList } from './gameComponents';
import { styles } from './appStyles';
type Tab = 'Mesa' | 'Fichas' | 'Dados' | 'Registro';
type Panel =
  | { kind: 'character'; character: Character }
  | { kind: 'resource'; character: Character; resource: 'hp' | 'mana' }
  | { kind: 'poison'; character: Character }
  | { kind: 'round'; round: number }
  | { kind: 'close' }
  | { kind: 'account' }
  | null;
const TAB_ICONS: Record<Tab, React.ComponentProps<typeof Ionicons>['name']> = {
  Mesa: 'compass-outline',
  Fichas: 'people-outline',
  Dados: 'dice-outline',
  Registro: 'reader-outline',
};
const lastKey = (repo: Repository) => `@mesa/last-${repo.mode}-${repo.uid}`;
function friendly(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied')
    return 'Acesso negado. Confira as regras do Firestore e se você participa desta mesa.';
  if (code?.startsWith('auth/')) return authError(error);
  if (code === 'unavailable') return 'Sem conexão com o Firebase. Reconecte e tente novamente.';
  return error instanceof Error ? error.message : 'Não foi possível concluir a ação.';
}
export function GameApp() {
  const auth = useAuth();
  const repo = auth.repo;
  const { width } = useWindowDimensions();
  const desktop = width >= 1100;
  const params = useLocalSearchParams<{ room?: string; tab?: string; code?: string }>();
  const roomId = params.code ? null : params.room || null;
  const setRoomId = useCallback(
    (room: string | null) => router.setParams({ room: room ?? '', code: '' }),
    [],
  );
  const [snapshot, setSnapshot] = useState<{ uid: string; data: Snapshot } | null>(null);
  const state =
    snapshot?.uid === repo?.uid && snapshot?.data.room.id === roomId ? snapshot.data : null;
  const tab: Tab =
    params.tab && Object.prototype.hasOwnProperty.call(TAB_ICONS, params.tab)
      ? (params.tab as Tab)
      : 'Mesa';
  const setTab = useCallback((next: Tab) => router.setParams({ tab: next }), []);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pendingInvite = useRef(Boolean(params.code || params.room));
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [inputCode, setInputCode] = useState('');
  const code = params.code ? params.code.toUpperCase() : inputCode;
  const setCode = (value: string) => {
    setInputCode(value);
    if (params.code) router.setParams({ code: '' });
  };
  const [selectedMode, setSelectedMode] = useState<'create' | 'join'>('create');
  const homeMode = params.code ? 'join' : selectedMode;
  const setHomeMode = (mode: 'create' | 'join') => {
    setSelectedMode(mode);
    if (params.code) {
      setInputCode(params.code.toUpperCase());
      router.setParams({ code: '', room: '' });
    }
  };
  useEffect(() => {
    if (!repo) return;
    let active = true;
    Promise.all([AsyncStorage.getItem(lastKey(repo)), AsyncStorage.getItem('@mesa/name')])
      .then(([last, savedName]) => {
        if (!active) return;
        if (!pendingInvite.current) setRoomId(last);
        setName(auth.user?.displayName || savedName || '');
      })
      .catch((error) => {
        if (active) setError(friendly(error));
      });
    return () => {
      active = false;
    };
  }, [repo, auth.user?.displayName, setRoomId]);
  useEffect(() => {
    if (!repo || !roomId) return;
    return repo.subscribe(
      roomId,
      (data) => setSnapshot({ uid: repo.uid, data }),
      (error) => setError(friendly(error)),
    );
  }, [repo, roomId]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [tab, state?.room.id]);
  async function run(action: () => Promise<void>, rethrow = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(friendly(error));
      if (rethrow) throw error;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function enter(id: string) {
    if (!repo) return;
    await AsyncStorage.setItem(lastKey(repo), id);
    pendingInvite.current = false;
    setRoomId(id);
    setTab('Mesa');
  }
  async function createOrJoin() {
    if (!repo) return;
    const memberName = name.trim();
    if (!memberName || memberName.length > 40)
      throw new Error('Informe seu nome, com até 40 caracteres.');
    if (homeMode === 'create' && (!campaignName.trim() || campaignName.trim().length > 80))
      throw new Error('Informe o nome da campanha, com até 80 caracteres.');
    if (homeMode === 'join' && !/^[A-Z0-9]{8,24}$/.test(code.trim().toUpperCase()))
      throw new Error('Confira o código do convite.');
    await AsyncStorage.setItem('@mesa/name', memberName);
    await enter(
      homeMode === 'create'
        ? await repo.createRoom(campaignName.trim(), memberName)
        : await repo.joinRoom(code, memberName),
    );
  }
  if (auth.loading || auth.error)
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.loading}>
          <Ionicons name="dice-outline" size={52} color={colors.gold} />
          <Text style={styles.brand}>Mesa</Text>
          {auth.error ? (
            <Text style={ui.error}>{auth.error}</Text>
          ) : (
            <>
              <ActivityIndicator color={colors.gold} />
              <Text style={ui.muted}>Preparando sua próxima aventura…</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  if (!repo || auth.user?.isAnonymous)
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.content, desktop && styles.desktopContent]}>
            <View style={desktop ? styles.homeColumns : styles.stack}>
              <View style={desktop ? styles.homePitch : styles.stack}>
                <Text style={styles.brand}>Mesa.</Text>
                <Text style={styles.eyebrow}>SUA HISTÓRIA, EM QUALQUER TELA</Text>
                <Text style={styles.homeTitle}>
                  A aventura{'\n'}
                  <Text style={{ color: colors.gold }}>acompanha você.</Text>
                </Text>
                <Text style={styles.intro}>
                  Entre com sua conta para mestrar ou jogar no computador e no celular. Seu lugar na
                  mesa continua reservado.
                </Text>
                {code ? (
                  <Text style={styles.notice}>
                    Você recebeu um convite. Entre ou crie uma conta para continuar; o código será
                    mantido.
                  </Text>
                ) : null}
              </View>
              <View style={desktop ? styles.homeForm : undefined}>
                <AuthPanel />
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  const host = state?.room.hostId === repo.uid;
  const me = state?.members.find((member) => member.id === repo.uid);
  const closed = state?.room.closed ?? false;
  const characters = state?.characters ?? [];
  const poisoned = characters.filter((character) => character.poison);
  const modalTitle =
    panel?.kind === 'account'
      ? 'Minha conta'
      : panel?.kind === 'character'
        ? 'Ficha do personagem'
        : panel?.kind === 'resource'
          ? `Ajustar ${panel.resource === 'hp' ? 'vida' : 'mana'}`
          : panel?.kind === 'poison'
            ? 'Aplicar veneno'
            : panel?.kind === 'round'
              ? 'Encerrar rodada?'
              : 'Encerrar campanha?';
  const newCharacter = () =>
    setPanel({ kind: 'character', character: emptyCharacter(repo.uid, me?.name ?? name) });
  const characterCard = (character: Character, detailed = false) => (
    <CharacterCard
      key={character.id}
      character={character}
      detailed={detailed}
      host={host}
      disabled={busy || closed}
      onEdit={() => setPanel({ kind: 'character', character })}
      onResource={(resource) => setPanel({ kind: 'resource', character, resource })}
      onPoison={() => setPanel({ kind: 'poison', character })}
      onRemovePoison={() => void run(() => repo.removePoison(roomId!, character.id))}
    />
  );
  async function shareInvite() {
    if (!state) return;
    const link = makeInviteUrl(state.room.code, publicSiteUrl());
    const message = `Vamos jogar ${state.room.name}?\n${link}\nCódigo da mesa: ${state.room.code}\nEntre na sua conta e use o convite do mestre para participar.`;
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(message);
      setNotice('Convite copiado.');
    } else await Share.share({ message });
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={ui.row}>
            <View style={styles.logo}>
              <Ionicons name="dice-outline" size={25} color={colors.gold} />
            </View>
            <View>
              <Text style={styles.brand}>
                Mesa<Text style={{ color: colors.gold }}>.</Text>
              </Text>
              <Text style={styles.brandSub}>SUA PRÓXIMA AVENTURA</Text>
            </View>
          </View>
          <View style={ui.row}>
            {auth.user && (
              <Button
                label="Minha conta"
                icon="person-circle-outline"
                tone="ghost"
                onPress={() => setPanel({ kind: 'account' })}
              />
            )}
            <View style={styles.mode}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: repo.mode === 'firebase' ? colors.green : colors.gold },
                ]}
              />
              <Text style={styles.modeText}>{repo.mode === 'firebase' ? 'Firebase' : 'Local'}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.workspace}>
        {desktop && roomId && state && (
          <View style={styles.sidebar}>
            <Text style={styles.eyebrow}>SUA MESA</Text>
            <Text style={ui.cardTitle}>{state.room.name}</Text>
            {(Object.keys(TAB_ICONS) as Tab[]).map((item) => (
              <Button
                key={item}
                label={item}
                icon={TAB_ICONS[item]}
                tone={item === tab ? 'navActive' : 'nav'}
                style={styles.sidebarButton}
                onPress={() => setTab(item)}
              />
            ))}
            <Button
              label="Minhas mesas"
              icon="grid-outline"
              tone="secondary"
              onPress={() => {
                setRoomId(null);
                setPanel(null);
              }}
            />
            <Text style={styles.fine}>Uma aventura. Todas as telas.</Text>
          </View>
        )}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.content, desktop && styles.desktopContent]}>
            {error ? (
              <View accessibilityRole="alert" style={ui.errorBox}>
                <Text style={ui.error}>{error}</Text>
                <Button label="Fechar aviso" onPress={() => setError('')} tone="ghost" />
              </View>
            ) : null}
            {notice ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {notice}
              </Text>
            ) : null}
            {!roomId ? (
              <HomeScreen
                repo={repo}
                desktop={desktop}
                name={name}
                setName={setName}
                mode={homeMode}
                setMode={setHomeMode}
                campaignName={campaignName}
                setCampaignName={setCampaignName}
                code={code}
                setCode={setCode}
                busy={busy}
                onSubmit={() => void run(createOrJoin)}
                onEnter={(id) => void run(() => enter(id))}
                onDemo={() =>
                  void run(async () => {
                    if (repo instanceof LocalRepository) await enter(await repo.createDemo());
                  })
                }
              />
            ) : !state ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.gold} />
                <Text style={ui.muted}>Reunindo o grupo…</Text>
                <Button label="Voltar ao início" tone="ghost" onPress={() => setRoomId(null)} />
              </View>
            ) : (
              <>
                <View style={styles.campaignTop}>
                  <Text style={styles.eyebrow}>
                    {closed ? 'CAMPANHA ENCERRADA' : 'A AVENTURA CONTINUA'}
                  </Text>
                  <Button
                    label="Trocar mesa"
                    tone="ghost"
                    onPress={() => {
                      setRoomId(null);
                      setPanel(null);
                      setTab('Mesa');
                    }}
                  />
                </View>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{state.room.name}</Text>
                  <Text style={styles.roleBadge}>{host ? 'MESTRE' : 'JOGADOR'}</Text>
                </View>
                <Text style={styles.subtitle}>
                  {host
                    ? 'O próximo capítulo está nas suas mãos.'
                    : `Bem-vindo à aventura${me ? `, ${me.name}` : ''}.`}
                </Text>
                {closed && (
                  <Text style={styles.notice}>
                    Esta campanha está disponível apenas para consulta.
                  </Text>
                )}
                {repo.mode === 'local' && (
                  <Text style={styles.fine}>MESA LOCAL · Dados salvos apenas neste aparelho.</Text>
                )}
                {tab === 'Mesa' && (
                  <RoomDashboard
                    state={state}
                    host={host}
                    local={repo.mode === 'local'}
                    desktop={desktop}
                    busy={busy}
                    renderCharacter={characterCard}
                    onNew={newCharacter}
                    onInvite={() => void run(shareInvite)}
                    onCopy={() =>
                      void run(async () => {
                        await Clipboard.setStringAsync(state.room.code);
                        setNotice('Código copiado.');
                      })
                    }
                    onRound={() => setPanel({ kind: 'round', round: state.room.round })}
                    onClose={() => setPanel({ kind: 'close' })}
                    onTab={setTab}
                  />
                )}
                {tab === 'Fichas' && (
                  <>
                    <View style={ui.rowBetween}>
                      <Text style={styles.sectionTitle}>
                        {host ? 'Fichas da mesa' : 'Minha ficha'}
                      </Text>
                      {!characters.some((character) => character.ownerId === repo.uid) && (
                        <Button
                          label="Criar ficha"
                          icon="add-outline"
                          disabled={busy || closed}
                          onPress={newCharacter}
                        />
                      )}
                    </View>
                    {characters.length ? (
                      <View style={desktop ? styles.characterGrid : styles.stack}>
                        {characters.map((character) => (
                          <View
                            key={character.id}
                            style={desktop ? styles.characterGridItem : undefined}
                          >
                            {characterCard(character, true)}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Empty
                        icon="document-text-outline"
                        title="Uma história esperando por você"
                        text="Crie uma ficha com atributos, vida e mana. O mestre poderá aprová-la para a partida."
                      />
                    )}
                  </>
                )}
                {tab === 'Dados' && (
                  <View style={desktop ? styles.dashboardColumns : styles.stack}>
                    <View style={desktop ? styles.primaryColumn : styles.stack}>
                      <DicePanel
                        disabled={busy || closed}
                        onRoll={(roll, label) =>
                          run(() => repo.publishRoll(roomId, roll, label), true)
                        }
                      />
                    </View>
                    {desktop && (
                      <View style={styles.secondaryColumn}>
                        <Text style={styles.sectionTitle}>Rolagens e acontecimentos</Text>
                        <EventList state={state} count={6} />
                      </View>
                    )}
                  </View>
                )}
                {tab === 'Registro' && (
                  <>
                    <Text style={styles.sectionTitle}>Diário da aventura</Text>
                    <Text style={ui.muted}>
                      Rolagens públicas e alterações da mesa. Exibindo os registros mais recentes.
                    </Text>
                    <EventList state={state} />
                  </>
                )}
              </>
            )}
            <Text style={styles.footer}>MESA · HISTÓRIAS QUE A GENTE CONSTRÓI JUNTO</Text>
          </View>
        </ScrollView>
      </View>
      {!desktop && roomId && state && (
        <View style={styles.nav}>
          <View style={styles.navInner}>
            {(Object.keys(TAB_ICONS) as Tab[]).map((item) => (
              <Button
                key={item}
                label={item}
                icon={TAB_ICONS[item]}
                tone={item === tab ? 'navActive' : 'nav'}
                onPress={() => setTab(item)}
              />
            ))}
          </View>
        </View>
      )}
      <Sheet
        visible={panel !== null}
        title={modalTitle}
        onClose={() => {
          if (!busy) {
            setPanel(null);
            setError('');
          }
        }}
        error={error}
      >
        {panel?.kind === 'account' && (
          <>
            <AuthPanel account />
            <Button
              label="Sair da conta"
              tone="danger"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  setRoomId(null);
                  await auth.logout();
                  setPanel(null);
                })
              }
            />
          </>
        )}
        {panel?.kind === 'character' && (
          <CharacterEditor
            key={panel.character.id}
            character={panel.character}
            canEdit={!closed && (host || !panel.character.approved)}
            host={host}
            busy={busy}
            onSave={(character) =>
              void run(async () => {
                await repo.saveCharacter(roomId!, character);
                setPanel(null);
                setNotice('Ficha salva.');
              })
            }
          />
        )}
        {panel?.kind === 'resource' && (
          <ResourceEditor
            character={panel.character}
            resource={panel.resource}
            busy={busy}
            onSave={(delta) =>
              void run(async () => {
                await repo.adjustResource(roomId!, panel.character.id, panel.resource, delta);
                setPanel(null);
              })
            }
          />
        )}
        {panel?.kind === 'poison' && (
          <PoisonEditor
            busy={busy}
            onSave={(damage, rounds) =>
              void run(async () => {
                await repo.setPoison(roomId!, panel.character.id, damage, rounds);
                setPanel(null);
              })
            }
          />
        )}
        {panel?.kind === 'round' && state && (
          <>
            <Text style={ui.muted}>
              A rodada {panel.round} será encerrada. Cada veneno ativo será aplicado uma vez.
            </Text>
            {poisoned.length ? (
              poisoned.map((character) => (
                <Text key={character.id} style={styles.effectLine}>
                  {character.name}: −{Math.min(character.hp, character.poison!.damage)} HP ·{' '}
                  {character.poison!.remaining} rodada(s) restante(s)
                </Text>
              ))
            ) : (
              <Text style={ui.muted}>Nenhum personagem está envenenado.</Text>
            )}
            <Button
              label={busy ? 'Aplicando…' : 'Confirmar e avançar'}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await repo.advanceRound(roomId!, panel.round);
                  setPanel(null);
                })
              }
            />
          </>
        )}
        {panel?.kind === 'close' && (
          <>
            <Text style={ui.muted}>
              As fichas e o histórico continuarão salvos para consulta. Novas rolagens, convites e
              alterações serão bloqueados. Esta ação não pode ser desfeita nesta versão.
            </Text>
            <Button
              label="Encerrar campanha"
              tone="danger"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await repo.closeRoom(roomId!);
                  setPanel(null);
                })
              }
            />
          </>
        )}
      </Sheet>
    </SafeAreaView>
  );
}
