# Mesa RPG

Aplicativo de RPG de mesa em TypeScript, React Native, Expo e Firebase. A mesma conta e o mesmo banco são usados no Android e na web, incluindo PC e iPhone pelo navegador.

Site: **https://fern14.github.io/mesa-rpg/**

## Jogar com amigos

1. Abra o site e escolha **Criar conta**. Cadastre nome, e-mail e senha (mínimo de 8 caracteres).
2. Preencha o nome da campanha e escolha **Começar aventura**. Quem cria a mesa é o mestre.
3. Use **Compartilhar convite**. Na web, o texto com link HTTPS e código é copiado para enviar aos amigos.
4. Seu amigo abre o link, entra ou cria uma conta e confirma **Entrar na aventura**. O convite permanece preenchido durante o login.
5. O jogador cria a ficha. O mestre pode aprovar a ficha, ajustar HP/mana e aplicar veneno. Rolagens do mestre e dos jogadores aparecem para todos da mesa em tempo real.
6. Em outro aparelho, use o **mesmo e-mail e senha**. A última mesa é retomada nesse aparelho; as outras ficam em **Trocar mesa → Minhas mesas**.

Fazer login não concede acesso a mesas de outras pessoas. Uma conta nova precisa do convite do mestre na primeira entrada. Depois, a participação fica vinculada à conta. O papel de mestre é por mesa; uma pessoa pode mestrar uma e jogar em outra.

No iPhone, abra o link no Safari. É possível usar **Compartilhar → Adicionar à Tela de Início** como atalho. O APK continua exclusivo do Android. O app precisa de internet para sincronizar e salvar ações da mesa.

## Recursos

- Login por e-mail/senha, recuperação de senha, sessão persistente e lista das mesas da conta.
- Convite HTTPS no formato `https://fern14.github.io/mesa-rpg/?code=CODIGO`; código manual e suporte ao esquema antigo `mesarpg://join?code=CODIGO`.
- Um personagem por participante em cada mesa. Nome, descrição, equipamentos, HP, mana, defesa, força, agilidade, resistência, inteligência e percepção.
- Jogador vê sua própria ficha e a edita até aprovação. Mestre vê e edita todas as fichas.
- Dano/cura e gasto/recuperação de mana com limites. Veneno com dano e duração em rodadas; reaplicar substitui o anterior. Remoção manual e expiração automática ao avançar rodadas.
- Dados d4, d6, d8, d10, d12, d20 e d100, quantidades e modificadores. O total com modificador é limitado ao máximo dos dados rolados: 1d20 até 20, 2d20 até 40. Rolagens geradas no cliente para um grupo de amigos que confia entre si.
- Histórico público dos últimos 50 registros no Firebase, com horário do servidor. Modo local mantém 100.
- Encerrar campanha bloqueia convites e alterações e mantém consulta.
- Layout no PC com navegação lateral, fichas em grade e histórico ao lado. Navegação inferior no celular.

As regras são genéricas, sem automatizar um sistema específico. HP em zero não declara morte nem aplica testes de resistência. Transações de HP/mana, veneno e rodada exigem conexão. Rascunhos abertos não atualizam quando outra pessoa edita a ficha: salve uma alteração por vez.

## Executar localmente

Use Node.js 24 e npm.

```powershell
npm ci
Copy-Item .env.example .env
# Preencha .env com os dados do seu app Web no Firebase.
npm run web
```

Para Android em desenvolvimento, use `npm start` com Expo Go compatível com o SDK 58, development build ou emulador. Sem as quatro variáveis Firebase o app oferece uma demonstração local, sem sincronização. Configuração parcial exibe erro. `EXPO_PUBLIC_DEMO_MODE=true` força a demonstração em testes.

## Firebase

O projeto atual é `mesa-rpg-25e09`, no plano Spark.

1. Em **Authentication → Método de login**, habilite **E-mail/senha**. Mantenha **Anônimo** para a compatibilidade com o APK inicial.
2. Crie o Cloud Firestore. A configuração de um app **Web** é usada tanto na web quanto no SDK JavaScript do Android.
3. Preencha as quatro variáveis `EXPO_PUBLIC_FIREBASE_*` em `.env` e `EXPO_PUBLIC_SITE_URL=https://fern14.github.io/mesa-rpg/`.
4. Publique as regras e o índice da lista de mesas:

```powershell
npx firebase login
npx firebase deploy --only "firestore:rules,firestore:indexes" --project mesa-rpg-25e09
```

O índice de grupo `members.id` precisa concluir a criação antes de a lista **Minhas mesas** funcionar. Não substitua as regras por acesso público. As variáveis Firebase são identificadores públicos incorporados ao app; a segurança depende do Authentication e das regras. Não inclua chaves de conta de serviço ou senhas no código.

Se configurar retornos personalizados para ações de e-mail no futuro, adicione `fern14.github.io` em **Authentication → Configurações → Domínios autorizados**. A recuperação atual usa a página padrão do Firebase.

### Preservar mesas do APK inicial

O APK 0.1.0 usa uma identidade anônima do aparelho. O site em outro aparelho não consegue recuperá-la apenas pelo código da mesa.

Para conservar o mestre/personagem original, atualize o APK **no mesmo aparelho**, mantendo o pacote `com.mesarpg.app`, a assinatura e os dados do aplicativo. A versão nova identifica a sessão antiga e mostra **Proteja sua aventura**. Escolha **Criar conta e continuar** com um e-mail ainda não cadastrado: isso vincula a identidade existente, sem trocar o UID. Depois use essa conta no site.

Não desinstale nem limpe os dados antes da vinculação. **Já tenho conta** entra na identidade daquela conta; não mescla mesas de duas contas. A migração foi testada nos emuladores; a atualização real do APK deve ser conferida no aparelho.

## Publicar no GitHub Pages

O workflow em `.github/workflows/pages.yml` compila a web e publica a cada envio para `main`. Ele usa o GitHub Actions; não executa builds EAS nem usa a cota de APKs do Expo.

### Primeira configuração

1. Crie o repositório público `fern14/mesa-rpg`.
2. Em **Settings → Secrets and variables → Actions → Variables**, cadastre quatro **Repository variables**, usando os valores do seu `.env`:

| Nome                               | Origem                      |
| ---------------------------------- | --------------------------- |
| `EXPO_PUBLIC_FIREBASE_API_KEY`     | `firebaseConfig.apiKey`     |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `firebaseConfig.authDomain` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID`  | `firebaseConfig.projectId`  |
| `EXPO_PUBLIC_FIREBASE_APP_ID`      | `firebaseConfig.appId`      |

3. Envie o código para `main`, se ainda não estiver no GitHub. Para um clone já vinculado:

```powershell
git add .
git commit -m "Atualizar Mesa RPG"
git push origin main
```

4. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.
5. Abra **Actions → Publicar Mesa RPG → Run workflow**, selecione `main` e execute. Aguarde os jobs **build** e **deploy** ficarem verdes.
6. Acesse **https://fern14.github.io/mesa-rpg/**. Não é necessário enviar `dist`, `node_modules`, APKs ou `.env` ao repositório.

O workflow obtém o domínio e o caminho `/mesa-rpg` do próprio GitHub Pages. Os convites abrem a raiz com `?code=`, para permitir atualizar a página sem perder a sala. O build gera `.nojekyll` e uma página 404 de fallback para rotas antigas.

### Atualizações futuras

Depois de alterar e testar o código, faça commit e push em `main`. O site será atualizado automaticamente. Seus amigos atualizam a página. Mudanças de regras/índices precisam também de `firebase deploy`; não são publicadas pelo workflow web. Mudanças do APK precisam de um novo APK: esta versão não configura EAS Update.

Para conferir o build publicado localmente:

```powershell
npm run build:web
npm run preview:web
# Abra http://127.0.0.1:4173/mesa-rpg/
```

O build público exige configuração Firebase completa, URL HTTPS e recusa modo demonstração/emuladores para evitar publicar uma versão sem sincronização.

## Gerar um novo APK

O projeto já está vinculado à conta Expo `davidscrem111`. O perfil `preview` gera APK de distribuição interna. A versão do código atual é 0.2.0, com `android.versionCode=2`.

Confirme que o ambiente **preview** do EAS contém as quatro variáveis Firebase e `EXPO_PUBLIC_SITE_URL=https://fern14.github.io/mesa-rpg/`. Depois:

```powershell
npx eas-cli@latest login
npm run build:apk
```

Use a mesma assinatura e instale sobre o APK anterior. Não configure host de emulador nesse build. Compilações em nuvem seguem a cota da conta Expo. `npm run build:android:bundle` valida o JavaScript Android e **não** gera APK. Guarde o keystore e suas credenciais fora do repositório.

## Verificar

```powershell
npm run typecheck
npm run lint
npm test
npm run test:ui
npm run test:rules
npm run build:web
npm run test:pages
npm run build:android:bundle
```

`test:ui` usa demonstração local isolada. `test:rules` inicia Authentication e Firestore emulados no projeto fictício `demo-mesa-rpg`, testa as regras e a vinculação do convidado e executa o fluxo web entre navegadores separados. Não cria contas nem mesas no Firebase real. Requer Java 21+ e Chromium do Playwright (`npx playwright install chromium`). O script aceita um Java portátil em `.tools/java21`, ou o Java do PATH. `test:pages` verifica o build estático no caminho do GitHub Pages, convites, atualização da página e larguras de tela de 320 a 1440 pixels.

## Limpeza e próximas melhorias

Encerrar campanha **não** libera armazenamento. A exclusão completa ainda é manual pelo console Firestore, incluindo subcoleções e o convite correspondente em `invites`. Excluir consome a cota de exclusões e não devolve leituras/gravações anteriores. O MVP não usa Cloud Functions nem upload de imagens.

Melhorias futuras: exclusão pelo app, exportação de fichas, iniciativa/turnos individuais, ajustes ao sistema de RPG escolhido e identidade visual definitiva.

Há alertas de dependências upstream nas ferramentas Expo/Firebase CLI. Evite `npm audit fix --force`, que sugere versões incompatíveis com este projeto. `@grpc/grpc-js` usa uma atualização compatível por `overrides`, verificada pelos testes de integração.

Referências: [Expo Web e GitHub Pages](https://docs.expo.dev/guides/publishing-websites/), [workflow do Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [vincular conta Firebase](https://firebase.google.com/docs/auth/web/account-linking), [cotas Firestore](https://firebase.google.com/docs/firestore/quotas).
