import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { authError, useAuth } from './auth';
import { Button, Card, Field, ui } from './ui';
export function AuthPanel({ account = false }: { account?: boolean }) {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(
    auth.user?.isAnonymous ? 'register' : 'login',
  );
  const [name, setName] = useState(auth.user?.displayName ?? '');
  const [email, setEmail] = useState(auth.user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(action = mode) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'register') {
        if (password !== confirm) throw new Error('As senhas precisam ser iguais.');
        await auth.register(name, email, password);
      } else if (action === 'login') await auth.login(email, password);
      else {
        await auth.resetPassword(email);
        setNotice(
          'Se houver uma conta para esse e-mail, você receberá as instruções de recuperação. Confira também o spam.',
        );
      }
      setPassword('');
      setConfirm('');
    } catch (error) {
      setError(authError(error));
    } finally {
      setBusy(false);
    }
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setConfirm('');
  }
  if (account && auth.user && !auth.user.isAnonymous)
    return (
      <Card>
        <Text style={ui.cardTitle}>{auth.user.displayName || 'Minha conta'}</Text>
        <Text selectable style={ui.muted}>
          {auth.user.email}
        </Text>
        <Text style={ui.muted}>
          Use o mesmo e-mail e senha em outros dispositivos para acessar suas mesas e personagens.
        </Text>
        <Button
          label="Enviar recuperação de senha"
          tone="secondary"
          disabled={busy}
          onPress={() => void submit('reset')}
        />
        {notice ? (
          <Text accessibilityRole="alert" style={ui.muted}>
            {notice}
          </Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={ui.error}>
            {error}
          </Text>
        ) : null}
      </Card>
    );
  return (
    <Card>
      <Text style={[ui.cardTitle, { fontSize: 25 }]}>
        {mode === 'login'
          ? 'Entre na sua aventura'
          : mode === 'register'
            ? auth.user?.isAnonymous
              ? 'Proteja sua aventura'
              : 'Crie sua conta'
            : 'Recuperar acesso'}
      </Text>
      <Text style={ui.muted}>
        {auth.user?.isAnonymous
          ? 'Criar uma conta vincula e-mail e senha à identidade deste aparelho, preservando suas mesas e fichas. Entrar em outra conta abre as mesas daquela conta.'
          : 'Sua conta acompanha você no computador, no Android e no iPhone pelo navegador. Para entrar em uma mesa, você ainda precisa do convite do mestre.'}
      </Text>
      {mode === 'register' && (
        <Field
          label="Seu nome"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          maxLength={40}
          editable={!busy}
        />
      )}
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        editable={!busy}
      />
      {mode !== 'reset' && (
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          editable={!busy}
        />
      )}
      {mode === 'register' && (
        <Field
          label="Confirmar senha"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          editable={!busy}
        />
      )}
      {error ? (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" style={ui.muted}>
          {notice}
        </Text>
      ) : null}
      <Button
        label={
          busy
            ? 'Aguarde…'
            : mode === 'login'
              ? 'Entrar na conta'
              : mode === 'register'
                ? 'Criar conta e continuar'
                : 'Enviar recuperação'
        }
        disabled={busy}
        onPress={() => void submit()}
      />
      <View style={ui.row}>
        <Button
          label={mode === 'register' ? 'Já tenho conta' : 'Criar conta'}
          tone="ghost"
          disabled={busy}
          onPress={() => changeMode(mode === 'register' ? 'login' : 'register')}
        />
        {mode === 'login' ? (
          <Button
            label="Esqueci minha senha"
            tone="ghost"
            disabled={busy}
            onPress={() => changeMode('reset')}
          />
        ) : (
          <Button
            label="Voltar para entrar"
            tone="ghost"
            disabled={busy}
            onPress={() => changeMode('login')}
          />
        )}
      </View>
    </Card>
  );
}
