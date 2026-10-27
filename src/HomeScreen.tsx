import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Field, colors, ui } from './ui';
import { styles } from './appStyles';
import type { Room } from './domain';
import type { Repository } from './repository';
import { LocalRepository } from './localRepository';
import { authError } from './auth';
type Props = {
  repo: Repository;
  desktop: boolean;
  name: string;
  setName(value: string): void;
  mode: 'create' | 'join';
  setMode(mode: 'create' | 'join'): void;
  campaignName: string;
  setCampaignName(value: string): void;
  code: string;
  setCode(value: string): void;
  busy: boolean;
  onSubmit(): void;
  onEnter(id: string): void;
  onDemo(): void;
};
export function HomeScreen(props: Props) {
  const {
    repo,
    desktop,
    name,
    setName,
    mode,
    setMode,
    campaignName,
    setCampaignName,
    code,
    setCode,
    busy,
    onSubmit,
    onEnter,
    onDemo,
  } = props;
  const [catalog, setCatalog] = useState<{ uid: string; rooms: Room[] }>({ uid: '', rooms: [] });
  const [error, setError] = useState('');
  useEffect(
    () =>
      repo.subscribeRooms(
        (rooms) => setCatalog({ uid: repo.uid, rooms }),
        (error) => setError(authError(error)),
      ),
    [repo],
  );
  const rooms = catalog.uid === repo.uid ? catalog.rooms : [];
  return (
    <>
      <View style={desktop ? styles.homeColumns : styles.stack}>
        <View style={desktop ? styles.homePitch : styles.stack}>
          <Text style={styles.eyebrow}>MENOS PLANILHA. MAIS AVENTURA.</Text>
          <Text style={[styles.homeTitle, desktop && { fontSize: 58, lineHeight: 65 }]}>
            Sua mesa,{'\n'}
            <Text style={{ color: colors.gold }}>sempre reunida.</Text>
          </Text>
          <Text style={styles.intro}>
            Fichas, dados e histórias no mesmo lugar. Do computador ao celular, a aventura continua
            com o seu grupo.
          </Text>
          <View style={styles.featureRow}>
            <Text style={styles.featurePill}>Fichas compartilhadas</Text>
            <Text style={styles.featurePill}>Dados em tempo real</Text>
            <Text style={styles.featurePill}>Convites por código</Text>
          </View>
          {repo.mode === 'local' && (
            <Text style={styles.notice}>
              Demonstração local: os dados ficam apenas neste aparelho. Contas e mesas
              compartilhadas usam o Firebase.
            </Text>
          )}
        </View>
        <View style={desktop ? styles.homeForm : undefined}>
          <Card>
            <View style={ui.row}>
              <Button
                label="Criar uma mesa"
                tone={mode === 'create' ? 'primary' : 'ghost'}
                onPress={() => setMode('create')}
              />
              <Button
                label="Entrar na mesa"
                tone={mode === 'join' ? 'primary' : 'ghost'}
                onPress={() => setMode('join')}
              />
            </View>
            <Field
              label="Como podemos chamar você?"
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              maxLength={40}
            />
            {mode === 'create' ? (
              <Field
                label="Nome da campanha"
                value={campaignName}
                onChangeText={setCampaignName}
                placeholder="Ex.: As cinzas de Eldoria"
                maxLength={80}
              />
            ) : (
              <Field
                label="Código do convite"
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase().replace(/\s/g, ''))}
                placeholder="Cole o código enviado pelo mestre"
                autoCapitalize="characters"
                maxLength={24}
              />
            )}
            <Button
              label={
                busy ? 'Preparando…' : mode === 'create' ? 'Começar aventura' : 'Entrar na aventura'
              }
              icon="arrow-forward"
              disabled={busy}
              onPress={onSubmit}
            />
            <Text style={styles.fine}>
              O mestre compartilha o convite. Depois da primeira entrada, a mesa fica disponível na
              sua conta.
            </Text>
          </Card>
        </View>
      </View>
      <View style={ui.rowBetween}>
        <View>
          <Text style={styles.sectionTitle}>Minhas mesas</Text>
          <Text style={ui.muted}>Suas campanhas como mestre e jogador.</Text>
        </View>
        <Text style={styles.roleBadge}>{rooms.length} MESA(S)</Text>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      ) : null}
      {rooms.length ? (
        <View style={desktop ? styles.roomGrid : styles.stack}>
          {rooms.map((room) => (
            <View key={room.id} style={desktop ? styles.roomGridItem : undefined}>
              <Card>
                <View style={ui.rowBetween}>
                  <Text style={[ui.cardTitle, { flex: 1 }]}>{room.name}</Text>
                  <Text style={styles.roleBadge}>
                    {room.hostId === repo.uid ? 'MESTRE' : 'JOGADOR'}
                  </Text>
                </View>
                <Text style={ui.muted}>
                  {room.closed
                    ? 'Campanha encerrada · consulta disponível'
                    : `Rodada ${room.round} · campanha em andamento`}
                </Text>
                <Button
                  label={`Abrir ${room.name}`}
                  tone="secondary"
                  icon="arrow-forward"
                  disabled={busy}
                  onPress={() => onEnter(room.id)}
                />
              </Card>
            </View>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={ui.cardTitle}>Seu próximo capítulo começa aqui</Text>
          <Text style={ui.muted}>
            Crie uma mesa ou use o código enviado pelo mestre. Fazer login não dá acesso às mesas de
            outras pessoas.
          </Text>
        </Card>
      )}
      {repo instanceof LocalRepository && (
        <Button
          label="Explorar mesa de demonstração"
          icon="sparkles-outline"
          tone="ghost"
          disabled={busy}
          onPress={onDemo}
        />
      )}
    </>
  );
}
