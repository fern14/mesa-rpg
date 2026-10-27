import { test, expect, type Page } from '@playwright/test';

const password = 'SenhaTeste123!';
async function register(page: Page, email: string, name: string) {
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Seu nome', { exact: true }).fill(name);
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Confirmar senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Criar conta e continuar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
}
async function login(page: Page, email: string) {
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar na conta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
}
test('account, invitation, realtime mobile/desktop and master access on another device', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const email = `master-${Date.now()}@example.test`;
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/login-desktop.png', fullPage: true });
  await register(page, email, 'Mestre');
  await page.getByLabel('Nome da campanha', { exact: true }).fill('A ponte de Eldoria');
  await page.getByRole('button', { name: 'Começar aventura', exact: true }).click();
  await expect(page.getByText('A ponte de Eldoria', { exact: true }).last()).toBeVisible();
  const roomUrl = page.url();
  const code = (await page.locator('[data-testid="invite-code"]').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{8,24}$/);
  await page.getByRole('button', { name: 'Compartilhar convite', exact: true }).click();
  await expect(page.getByText('Convite copiado.', { exact: true })).toBeVisible();
  const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const player = await playerContext.newPage();
  await player.goto(`/?code=${code}`);
  await expect(player.getByText(/Você recebeu um convite/)).toBeVisible();
  await register(player, `player-${Date.now()}@example.test`, 'Ana');
  await expect(player.getByLabel('Código do convite', { exact: true })).toHaveValue(code);
  await player.getByRole('button', { name: 'Entrar na aventura', exact: true }).click();
  await player.getByRole('button', { name: 'Criar personagem', exact: true }).click();
  await player.getByLabel('Nome do personagem', { exact: true }).fill('Lyra');
  await player.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
  await expect(page.getByText('Lyra', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Vida', exact: true }).click();
  await page.getByLabel('Quantidade', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Confirmar alteração', exact: true }).click();
  await expect(player.getByText('Lyra: HP 20 → 17.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/mesa-desktop.png', fullPage: true });
  await player.screenshot({ path: 'artifacts/jogador-mobile.png', fullPage: true });
  await player.getByRole('button', { name: 'Dados', exact: true }).click();
  await player.getByLabel('O que está em jogo? (opcional)', { exact: true }).fill('Flecha da Lyra');
  await player.getByRole('button', { name: 'Rolar 1d20', exact: true }).click();
  await expect(page.getByText(/Flecha da Lyra: 1d20/)).toBeVisible();
  await page.getByRole('button', { name: 'Dados', exact: true }).click();
  await page.getByLabel('O que está em jogo? (opcional)', { exact: true }).fill('Ataque do mestre');
  await page.getByRole('button', { name: 'Rolar 1d20', exact: true }).click();
  await player.getByRole('button', { name: 'Registro', exact: true }).click();
  await expect(player.getByText(/Ataque do mestre: 1d20/)).toBeVisible();
  // A fresh browser has no local room history; its account catalog must find the room.
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const second = await secondContext.newPage();
  await second.goto('/');
  await login(second, email);
  await second.getByRole('button', { name: 'Abrir A ponte de Eldoria', exact: true }).click();
  await expect(
    second.getByRole('button', { name: 'Encerrar rodada 1', exact: true }),
  ).toBeVisible();
  await expect(second.getByText('Lyra', { exact: true })).toBeVisible();
  await second.reload();
  await expect(
    second.getByRole('button', { name: 'Encerrar rodada 1', exact: true }),
  ).toBeVisible();
  await second.getByRole('button', { name: 'Minha conta', exact: true }).click();
  await second.getByRole('button', { name: 'Enviar recuperação de senha', exact: true }).click();
  await expect(second.getByText(/receberá as instruções de recuperação/)).toBeVisible();
  await second.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Entrar na conta', exact: true })).toBeVisible();
  // Authentication alone gives no room access, even when the room URL is known.
  await register(second, `outsider-${Date.now()}@example.test`, 'Visitante');
  await expect(
    second.getByRole('button', { name: 'Abrir A ponte de Eldoria', exact: true }),
  ).toHaveCount(0);
  await second.goto(roomUrl);
  await expect(second.getByText(/Acesso negado/)).toBeVisible();
  await expect(second.getByText('Lyra', { exact: true })).toHaveCount(0);
  for (const current of [page, player, second])
    expect(
      await current.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  expect(errors).toEqual([]);
  await playerContext.close();
  await secondContext.close();
});
