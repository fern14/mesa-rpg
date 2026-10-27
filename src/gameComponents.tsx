import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';
import {
  ATTRIBUTE_LABELS,
  integer,
  rollDice,
  type Character,
  type DiceRoll,
  type Snapshot,
} from './domain';
import { Button, Card, Field, colors, ui } from './ui';
import { styles } from './appStyles';
type Icon = React.ComponentProps<typeof Ionicons>['name'];
export function Stat({ value, label, icon }: { value: string; label: string; icon: Icon }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.gold} />
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
export function CharacterCard({
  character: c,
  host,
  disabled,
  detailed,
  onEdit,
  onResource,
  onPoison,
  onRemovePoison,
}: {
  character: Character;
  host: boolean;
  disabled: boolean;
  detailed?: boolean;
  onEdit: () => void;
  onResource: (resource: 'hp' | 'mana') => void;
  onPoison: () => void;
  onRemovePoison: () => void;
}) {
  return (
    <Card>
      <View style={ui.rowBetween}>
        <View style={[ui.row, { flex: 1 }]}>
          <View style={[styles.avatar, c.poison ? { borderColor: colors.purple } : undefined]}>
            <Text style={styles.avatarText}>{c.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ui.cardTitle}>{c.name}</Text>
            <Text style={ui.muted}>
              {c.ownerName} · {c.approved ? 'Ficha aprovada' : 'Aguardando aprovação'}
            </Text>
          </View>
        </View>
        <Button
          label={host || !c.approved ? 'Editar' : 'Ver'}
          icon="create-outline"
          tone="ghost"
          onPress={onEdit}
        />
      </View>
      <ResourceBar label="VIDA" value={c.hp} max={c.maxHp} color={colors.green} />
      <ResourceBar label="MANA" value={c.mana} max={c.maxMana} color={colors.blue} />
      {c.poison && (
        <View style={styles.poisonBadge}>
          <Ionicons name="flask-outline" size={16} color={colors.purple} />
          <Text style={styles.poisonText}>
            Envenenado · {c.poison.damage} dano / rodada · {c.poison.remaining} restante(s)
          </Text>
        </View>
      )}
      {detailed && (
        <>
          <View style={styles.attributes}>
            {(Object.keys(ATTRIBUTE_LABELS) as (keyof Character['attributes'])[]).map((key) => (
              <View key={key} style={styles.attribute}>
                <Text style={styles.attributeValue}>{c.attributes[key]}</Text>
                <Text style={styles.attributeLabel}>{ATTRIBUTE_LABELS[key]}</Text>
              </View>
            ))}
          </View>
          <Text style={ui.muted}>Defesa: {c.defense}</Text>
          {c.description ? <Text style={styles.notes}>{c.description}</Text> : null}
        </>
      )}
      {host && (
        <View style={styles.actions}>
          <Button
            label="Vida"
            icon="heart-outline"
            tone="secondary"
            disabled={disabled}
            onPress={() => onResource('hp')}
          />
          <Button
            label="Mana"
            icon="water-outline"
            tone="secondary"
            disabled={disabled}
            onPress={() => onResource('mana')}
          />
          <Button
            label={c.poison ? 'Curar veneno' : 'Veneno'}
            icon="flask-outline"
            tone="secondary"
            disabled={disabled}
            onPress={c.poison ? onRemovePoison : onPoison}
          />
        </View>
      )}
    </Card>
  );
}
function ResourceBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <View style={ui.rowBetween}>
        <Text style={styles.resourceLabel}>{label}</Text>
        <Text style={styles.resourceValue}>
          {value}
          <Text style={ui.muted}> / {max}</Text>
        </Text>
      </View>
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: color, width: `${max ? Math.min(100, (value / max) * 100) : 0}%` },
          ]}
        />
      </View>
    </View>
  );
}
export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: Icon;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <View style={styles.empty}>
        <Ionicons name={icon} size={35} color={colors.gold} />
        <Text style={ui.cardTitle}>{title}</Text>
        <Text style={[ui.muted, { textAlign: 'center' }]}>{text}</Text>
        {action}
      </View>
    </Card>
  );
}
export function EventList({ state, count = 50 }: { state: Snapshot; count?: number }) {
  return state.events.length ? (
    <Card>
      {state.events.slice(0, count).map((event) => (
        <View key={event.id} style={styles.event}>
          <View style={styles.eventIcon}>
            <Ionicons
              name={
                event.kind === 'roll'
                  ? 'dice-outline'
                  : event.kind === 'round'
                    ? 'hourglass-outline'
                    : 'sparkles-outline'
              }
              size={20}
              color={colors.gold}
            />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={ui.rowBetween}>
              <Text style={styles.eventAuthor}>
                {event.actor}
                {event.actorId === state.room.hostId ? ' · Mestre' : ''}
              </Text>
              <Text style={styles.fine}>
                {new Date(event.createdAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.eventText}>{event.text}</Text>
          </View>
        </View>
      ))}
    </Card>
  ) : (
    <Empty
      icon="reader-outline"
      title="O primeiro capítulo ainda está em branco"
      text="As rolagens e ações da mesa aparecerão aqui."
    />
  );
}
export function DicePanel({
  disabled,
  onRoll,
}: {
  disabled: boolean;
  onRoll: (roll: DiceRoll, label: string) => Promise<void>;
}) {
  const [sides, setSides] = useState(20);
  const [quantity, setQuantity] = useState('1');
  const [modifier, setModifier] = useState('0');
  const [label, setLabel] = useState('');
  const [result, setResult] = useState<DiceRoll | null>(null);
  const [error, setError] = useState('');
  const [rolling, setRolling] = useState(false);
  async function roll() {
    if (rolling || disabled) return;
    setError('');
    setRolling(true);
    try {
      const next = rollDice(
        sides,
        integer(quantity, 1, 20),
        integer(modifier, -999, 999),
        () => Crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
      );
      await onRoll(next, label);
      setResult(next);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setRolling(false);
    }
  }
  return (
    <>
      <Text style={styles.sectionTitle}>Deixe o destino decidir</Text>
      <Text style={ui.muted}>
        Mestre e jogadores rolam aqui. O resultado é público para toda a mesa.
      </Text>
      <Card>
        <View style={styles.diceDisplay}>
          <Ionicons name="dice-outline" size={74} color={colors.gold} />
          <Text accessibilityLiveRegion="polite" style={styles.diceTotal}>
            {result ? result.total : `d${sides}`}
          </Text>
          <Text style={ui.muted}>
            {result
              ? `${result.expression} · dados: ${result.values.join(', ')}`
              : 'Toda grande história começa com uma rolagem.'}
          </Text>
        </View>
        <View style={styles.diceChoices}>
          {[4, 6, 8, 10, 12, 20, 100].map((die) => (
            <Button
              key={die}
              label={`d${die}`}
              tone={sides === die ? 'primary' : 'secondary'}
              onPress={() => setSides(die)}
              disabled={rolling || disabled}
            />
          ))}
        </View>
        <View style={ui.row}>
          <Field
            style={{ flex: 1 }}
            label="Quantidade"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            maxLength={2}
          />
          <Field
            style={{ flex: 1 }}
            label="Modificador"
            value={modifier}
            onChangeText={setModifier}
            keyboardType="numbers-and-punctuation"
            maxLength={4}
          />
        </View>
        <Field
          label="O que está em jogo? (opcional)"
          value={label}
          onChangeText={setLabel}
          placeholder="Ex.: Teste de agilidade"
          maxLength={80}
        />
        {error ? <Text style={ui.error}>{error}</Text> : null}
        <Button
          label={rolling ? 'Publicando resultado…' : `Rolar ${quantity || '1'}d${sides}`}
          icon="dice-outline"
          disabled={disabled || rolling}
          onPress={() => void roll()}
        />
        <Text style={styles.fine}>
          O resultado só é confirmado após ser salvo no registro da mesa.
        </Text>
      </Card>
    </>
  );
}
