import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ATTRIBUTE_LABELS, integer, type Character } from './domain';
export const colors = {
  bg: '#0d1612',
  card: '#17241d',
  border: '#2a3930',
  text: '#f3f0e6',
  muted: '#9aa99e',
  gold: '#dbbd82',
  green: '#78b891',
  blue: '#7eaacb',
  purple: '#c2a2e8',
  red: '#f19b94',
};
type Tone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'nav' | 'navActive';
export function Button({
  label,
  onPress,
  disabled,
  tone = 'primary',
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: Tone;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
}) {
  const nav = tone === 'nav' || tone === 'navActive';
  const color =
    tone === 'primary'
      ? colors.bg
      : tone === 'danger'
        ? colors.red
        : tone === 'nav'
          ? colors.muted
          : colors.gold;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled: !!disabled,
        ...(nav ? { selected: tone === 'navActive' } : {}),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        tone === 'primary' && s.primary,
        tone === 'secondary' && s.secondary,
        tone === 'danger' && s.danger,
        nav && s.navButton,
        tone === 'navActive' && { backgroundColor: '#26352a' },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.7 },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={nav ? 22 : 17} color={color} />}
      <Text style={[s.buttonText, { color }, nav && { fontSize: 10 }]}>{label}</Text>
    </Pressable>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string; style?: ViewStyle }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#6e8173"
        selectionColor={colors.gold}
        style={[s.input, props.multiline && { minHeight: 110, textAlignVertical: 'top' }]}
        {...props}
      />
    </View>
  );
}
export function Sheet({
  visible,
  title,
  onClose,
  error,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={s.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalAvoid}
        >
          <View style={s.sheet}>
            <View style={ui.rowBetween}>
              <Text style={[ui.cardTitle, { fontSize: 23, flex: 1 }]}>{title}</Text>
              <Button label="Fechar" icon="close-outline" tone="ghost" onPress={onClose} />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 18, paddingVertical: 10 }}
            >
              {error ? (
                <Text accessibilityRole="alert" style={ui.error}>
                  {error}
                </Text>
              ) : null}
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export function CharacterEditor({
  character,
  canEdit,
  host,
  busy,
  onSave,
}: {
  character: Character;
  canEdit: boolean;
  host: boolean;
  busy: boolean;
  onSave: (character: Character) => void;
}) {
  const [draft, setDraft] = useState(character);
  const [values, setValues] = useState({
    hp: String(character.hp),
    maxHp: String(character.maxHp),
    mana: String(character.mana),
    maxMana: String(character.maxMana),
    defense: String(character.defense),
    ...Object.fromEntries(
      Object.entries(character.attributes).map(([key, value]) => [key, String(value)]),
    ),
  } as Record<string, string>);
  const [error, setError] = useState('');
  function save(approve = draft.approved) {
    try {
      const parsed = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, integer(value, -99, 9999)]),
      );
      const { hp, maxHp, mana, maxMana, defense } = parsed;
      const attributes = Object.fromEntries(
        Object.keys(ATTRIBUTE_LABELS).map((key) => [key, parsed[key]]),
      ) as Character['attributes'];
      onSave({ ...draft, hp, maxHp, mana, maxMana, defense, attributes, approved: approve });
    } catch (error) {
      setError((error as Error).message);
    }
  }
  const numberField = (key: string, label: string) => (
    <Field
      key={key}
      style={{ flex: 1, minWidth: 120 }}
      label={label}
      value={values[key]}
      onChangeText={(value) => setValues((previous) => ({ ...previous, [key]: value }))}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      editable={canEdit && !busy}
    />
  );
  return (
    <>
      <Text style={ui.muted}>
        {character.ownerName} ·{' '}
        {draft.approved ? 'Ficha aprovada pelo mestre' : 'Preencha sua ficha para aprovação'}
      </Text>
      <Field
        label="Nome do personagem"
        value={draft.name}
        onChangeText={(name) => setDraft({ ...draft, name })}
        maxLength={60}
        editable={canEdit && !busy}
        placeholder="Como seu herói se chama?"
      />
      <View style={s.fieldGrid}>
        {numberField('hp', 'HP atual')}
        {numberField('maxHp', 'HP máximo')}
        {numberField('mana', 'Mana atual')}
        {numberField('maxMana', 'Mana máxima')}
      </View>
      <Text style={ui.cardTitle}>Atributos</Text>
      <View style={s.fieldGrid}>
        {Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => numberField(key, label))}
        {numberField('defense', 'Defesa')}
      </View>
      <Field
        label="Descrição, habilidades e equipamentos"
        value={draft.description}
        onChangeText={(description) => setDraft({ ...draft, description })}
        multiline
        maxLength={2000}
        editable={canEdit && !busy}
        placeholder="Conte um pouco sobre seu personagem…"
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {canEdit ? (
        <>
          <Button
            label={busy ? 'Salvando…' : 'Salvar ficha'}
            disabled={busy}
            onPress={() => save()}
          />
          {host && !draft.approved && (
            <Button
              label="Salvar e aprovar ficha"
              icon="checkmark-circle-outline"
              tone="secondary"
              disabled={busy}
              onPress={() => save(true)}
            />
          )}
        </>
      ) : (
        <Text style={ui.muted}>
          Esta ficha está disponível apenas para consulta. O mestre pode fazer os ajustes durante a
          partida.
        </Text>
      )}
    </>
  );
}
export function ResourceEditor({
  character,
  resource,
  busy,
  onSave,
}: {
  character: Character;
  resource: 'hp' | 'mana';
  busy: boolean;
  onSave: (delta: number) => void;
}) {
  const [amount, setAmount] = useState('1');
  const [sign, setSign] = useState(-1);
  const [error, setError] = useState('');
  return (
    <>
      <Text style={ui.muted}>
        {character.name} · {resource === 'hp' ? 'HP' : 'Mana'} atual: {character[resource]} /{' '}
        {resource === 'hp' ? character.maxHp : character.maxMana}
      </Text>
      <View style={ui.row}>
        <Button
          label={resource === 'hp' ? 'Aplicar dano' : 'Gastar mana'}
          tone={sign === -1 ? 'primary' : 'secondary'}
          onPress={() => setSign(-1)}
        />
        <Button
          label={resource === 'hp' ? 'Curar' : 'Recuperar'}
          tone={sign === 1 ? 'primary' : 'secondary'}
          onPress={() => setSign(1)}
        />
      </View>
      <Field
        label="Quantidade"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        maxLength={4}
      />
      <Text style={ui.muted}>O valor ficará entre zero e o máximo da ficha.</Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Button
        label="Confirmar alteração"
        disabled={busy}
        onPress={() => {
          try {
            onSave(sign * integer(amount, 1, 9999));
          } catch (error) {
            setError((error as Error).message);
          }
        }}
      />
    </>
  );
}
export function PoisonEditor({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (damage: number, rounds: number) => void;
}) {
  const [damage, setDamage] = useState('2');
  const [rounds, setRounds] = useState('3');
  const [error, setError] = useState('');
  return (
    <>
      <Text style={ui.muted}>
        O veneno causa dano ao final de cada rodada, quando o mestre confirma o avanço. Reaplicar
        substitui o efeito anterior, sem acumular.
      </Text>
      <Field
        label="Dano por rodada"
        value={damage}
        onChangeText={setDamage}
        keyboardType="numeric"
        maxLength={3}
      />
      <Field
        label="Duração em rodadas"
        value={rounds}
        onChangeText={setRounds}
        keyboardType="numeric"
        maxLength={2}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Button
        label="Aplicar veneno"
        icon="flask-outline"
        disabled={busy}
        onPress={() => {
          try {
            onSave(integer(damage, 1, 999), integer(rounds, 1, 99));
          } catch (error) {
            setError((error as Error).message);
          }
        }}
      />
    </>
  );
}
export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  error: { color: colors.red, fontSize: 13, lineHeight: 21 },
  errorBox: { padding: 14, backgroundColor: '#35221f', borderRadius: 12, gap: 8 },
});
const s = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontSize: 12, fontWeight: '700' },
  primary: { backgroundColor: colors.gold },
  secondary: { backgroundColor: '#22362a', borderWidth: 1, borderColor: '#344d3c' },
  danger: { backgroundColor: '#402724', borderWidth: 1, borderColor: '#76433d' },
  navButton: { flex: 1, flexDirection: 'column', gap: 5, maxWidth: 100, borderRadius: 12 },
  card: {
    backgroundColor: colors.card,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 18,
  },
  label: { color: '#c4cec5', fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#35483b',
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 46,
  },
  overlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalAvoid: { width: '100%', maxWidth: 620, alignSelf: 'center', maxHeight: '94%' },
  sheet: {
    backgroundColor: colors.card,
    padding: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '100%',
    gap: 8,
  },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
});
