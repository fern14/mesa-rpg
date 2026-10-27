import React from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, colors, ui } from './ui';
import { styles } from './appStyles';
import { Empty, EventList, Stat } from './gameComponents';
import type { Character, Snapshot } from './domain';
export function RoomDashboard({
  state,
  host,
  local,
  desktop,
  busy,
  renderCharacter,
  onNew,
  onInvite,
  onCopy,
  onRound,
  onClose,
  onTab,
}: {
  state: Snapshot;
  host: boolean;
  local: boolean;
  desktop: boolean;
  busy: boolean;
  renderCharacter(character: Character): React.ReactNode;
  onNew(): void;
  onInvite(): void;
  onCopy(): void;
  onRound(): void;
  onClose(): void;
  onTab(tab: 'Fichas' | 'Registro'): void;
}) {
  const { room, characters, members } = state;
  return (
    <>
      <View style={styles.stats}>
        <Stat value={String(room.round).padStart(2, '0')} label="RODADA" icon="hourglass-outline" />
        <Stat
          value={String(members.length).padStart(2, '0')}
          label="NA MESA"
          icon="people-outline"
        />
        <Stat
          value={String(characters.filter((character) => character.poison).length).padStart(2, '0')}
          label={host ? 'COM VENENO' : 'SEUS EFEITOS'}
          icon="flask-outline"
        />
      </View>
      <View style={desktop ? styles.dashboardColumns : styles.stack}>
        <View style={desktop ? styles.primaryColumn : styles.stack}>
          <View style={ui.rowBetween}>
            <Text style={styles.sectionTitle}>{host ? 'Seu grupo' : 'Seu personagem'}</Text>
            <Button label="Ver fichas" tone="ghost" onPress={() => onTab('Fichas')} />
          </View>
          {characters.length ? (
            <View style={desktop ? styles.characterGrid : styles.stack}>
              {characters.map((character) => (
                <View key={character.id} style={desktop ? styles.characterGridItem : undefined}>
                  {renderCharacter(character)}
                </View>
              ))}
            </View>
          ) : (
            <Empty
              icon="people-outline"
              title="Toda aventura começa com alguém"
              text={
                host
                  ? 'Convide seus jogadores ou crie seu próprio personagem.'
                  : 'Preencha sua ficha para entrar na história.'
              }
              action={
                <Button
                  label="Criar personagem"
                  icon="add-outline"
                  disabled={busy || room.closed}
                  onPress={onNew}
                />
              }
            />
          )}
          {host && !room.closed && (
            <Button
              label={`Encerrar rodada ${room.round}`}
              icon="play-forward-outline"
              disabled={busy}
              onPress={onRound}
            />
          )}
        </View>
        <View style={desktop ? styles.secondaryColumn : styles.stack}>
          {host && !room.closed && (
            <Card>
              <View style={ui.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.cardTitle}>Reúna seu grupo</Text>
                  <Text style={ui.muted}>Envie o link ou o código do convite.</Text>
                </View>
                <Ionicons name="link-outline" size={24} color={colors.gold} />
              </View>
              <View style={styles.codeBox}>
                <Text testID="invite-code" selectable style={styles.code}>
                  {room.code}
                </Text>
                <Button
                  label="Copiar"
                  icon="copy-outline"
                  tone="ghost"
                  disabled={busy}
                  onPress={onCopy}
                />
              </View>
              <Button
                label="Compartilhar convite"
                tone="secondary"
                icon="share-social-outline"
                disabled={busy}
                onPress={onInvite}
              />
              <Text style={styles.fine}>
                {local
                  ? 'Convites entre aparelhos precisam do Firebase.'
                  : 'Quem receber o link precisa entrar na conta para participar.'}
              </Text>
            </Card>
          )}
          <View style={ui.rowBetween}>
            <Text style={styles.sectionTitle}>Aconteceu na mesa</Text>
            <Button label="Ver tudo" tone="ghost" onPress={() => onTab('Registro')} />
          </View>
          <EventList state={state} count={4} />
          {host && !room.closed && (
            <Button
              label="Encerrar campanha"
              tone="ghost"
              icon="archive-outline"
              disabled={busy}
              onPress={onClose}
            />
          )}
        </View>
      </View>
    </>
  );
}
