import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { FirebaseRepository, getFirebaseRuntime, type FirebaseRuntime } from './firebaseRepository';
import { LocalRepository } from './localRepository';
import type { Repository } from './repository';
type Session = {
  loading: boolean;
  error: string;
  repo: Repository | null;
  user: User | null;
  runtime: FirebaseRuntime | null;
};
type AuthContextValue = Session & {
  register(name: string, email: string, password: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/operation-not-allowed': 'Habilite E-mail/senha em Authentication no console Firebase.',
    'auth/admin-restricted-operation':
      'Habilite E-mail/senha em Authentication no console Firebase.',
    'auth/email-already-in-use':
      'Este e-mail já está cadastrado. Entre com a conta existente. Para preservar as mesas de convidado, use outro e-mail ou mantenha esta sessão até resolvermos a vinculação.',
    'auth/credential-already-in-use':
      'Este e-mail pertence a outra conta. Use um e-mail ainda não cadastrado para preservar sua identidade de convidado.',
    'auth/invalid-email': 'Confira o endereço de e-mail.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/weak-password': 'Escolha uma senha mais forte, seguindo a política do projeto Firebase.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.',
    'auth/network-request-failed': 'Sem conexão. Confira sua internet e tente novamente.',
    'auth/requires-recent-login': 'Entre novamente na sua conta para continuar.',
  };
  return (
    (code && messages[code]) ||
    (error instanceof Error ? error.message : 'Não foi possível concluir a ação.')
  );
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({
    loading: true,
    error: '',
    repo: null,
    user: null,
    runtime: null,
  });
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    (async () => {
      const runtime = await getFirebaseRuntime();
      if (!active) return;
      if (!runtime) {
        const repo = await new LocalRepository().load();
        if (active) setSession({ loading: false, error: '', repo, user: null, runtime: null });
        return;
      }
      unsubscribe = onAuthStateChanged(
        runtime.auth,
        (user) => {
          if (active)
            setSession((previous) => ({
              loading: false,
              error: '',
              runtime,
              user,
              repo: user
                ? previous.repo?.uid === user.uid
                  ? previous.repo
                  : new FirebaseRepository(runtime.db, user.uid)
                : null,
            }));
        },
        (error) => {
          if (active)
            setSession({
              loading: false,
              error: authError(error),
              runtime,
              user: null,
              repo: null,
            });
        },
      );
    })().catch((error) => {
      if (active)
        setSession({
          loading: false,
          error: authError(error),
          runtime: null,
          user: null,
          repo: null,
        });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const requireRuntime = () => {
    if (!session.runtime) throw new Error('O Firebase não está configurado.');
    return session.runtime;
  };
  const emailValue = (email: string) => {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Informe um e-mail válido.');
    return value;
  };
  const value: AuthContextValue = {
    ...session,
    async register(name, email, password) {
      if (name.trim().length < 2 || name.trim().length > 40)
        throw new Error('Use um nome de 2 a 40 caracteres.');
      if (password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres.');
      const { auth } = requireRuntime();
      const address = emailValue(email);
      const current = auth.currentUser;
      const credential = current?.isAnonymous
        ? await linkWithCredential(current, EmailAuthProvider.credential(address, password))
        : await createUserWithEmailAndPassword(auth, address, password);
      await updateProfile(credential.user, { displayName: name.trim() });
      setSession((previous) => ({ ...previous, user: credential.user }));
    },
    async login(email, password) {
      if (!password) throw new Error('Informe sua senha.');
      await signInWithEmailAndPassword(requireRuntime().auth, emailValue(email), password);
    },
    async resetPassword(email) {
      await sendPasswordResetEmail(requireRuntime().auth, emailValue(email));
    },
    async logout() {
      await signOut(requireRuntime().auth);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider não encontrado.');
  return value;
}
