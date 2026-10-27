import { test, expect } from '@playwright/test';
test('demo: damage, poison, public roll, persistence and read-only campaign', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('sempre reunida.')).toBeVisible();
  await page.screenshot({ path: 'artifacts/inicio-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Explorar mesa de demonstração' }).click();
  await expect(page.getByText('As cinzas de Eldoria', { exact: true })).toBeVisible();
  await expect(page.getByText('Lyra', { exact: true })).toBeVisible();
  await page.getByText('As cinzas de Eldoria', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/mesa-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Vida', exact: true }).first().click();
  await page.getByLabel('Quantidade', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(page.getByText('Lyra: HP 24 → 17.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar rodada 1', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar e avançar' }).click();
  await expect(
    page.getByText('Envenenado · 2 dano / rodada · 2 restante(s)', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Lyra: veneno, HP 17 → 15/)).toBeVisible();
  await page.getByRole('button', { name: 'Dados', exact: true }).click();
  await page.getByRole('button', { name: 'd6', exact: true }).click();
  await page.getByLabel('Quantidade', { exact: true }).fill('2');
  await page.getByLabel('Modificador', { exact: true }).fill('-3');
  await page
    .getByLabel('O que está em jogo? (opcional)', { exact: true })
    .fill('Teste de agilidade');
  await page.getByRole('button', { name: 'Rolar 2d6', exact: true }).click();
  await page.getByRole('button', { name: 'Registro', exact: true }).click();
  await expect(page.getByText(/Teste de agilidade: 2d6 − 3 →/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('As cinzas de Eldoria', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mesa', exact: true }).click();
  await expect(
    page.getByText('Envenenado · 2 dano / rodada · 2 restante(s)', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Encerrar campanha', exact: true }).click();
  await page.getByRole('button', { name: 'Encerrar campanha', exact: true }).last().click();
  await expect(page.getByText('Esta campanha está disponível apenas para consulta.')).toBeVisible();
  await page.getByRole('button', { name: 'Dados', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rolar 1d20', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('invitation link opens the join form with its code', async ({ page }) => {
  await page.goto('/join?code=ABCDEFGH');
  await expect(page.getByLabel('Código do convite', { exact: true })).toHaveValue('ABCDEFGH');
  await page.getByLabel('Como podemos chamar você?').fill('Ana');
  await page.getByRole('button', { name: 'Entrar na aventura', exact: true }).click();
  await expect(
    page.getByText(/No modo local, o código só abre mesas deste aparelho/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Criar uma mesa', exact: true }).click();
  await expect(page.getByLabel('Nome da campanha', { exact: true })).toBeVisible();
});
test('create campaign and approve a valid character; invalid HP is rejected', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Como podemos chamar você?').fill('Rafael');
  await page.getByLabel('Nome da campanha', { exact: true }).fill('A queda da torre');
  await page.getByRole('button', { name: 'Começar aventura', exact: true }).click();
  await expect(page.getByText('A queda da torre', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Criar personagem', exact: true }).click();
  await page.getByLabel('Nome do personagem', { exact: true }).fill('Auron');
  await page.getByLabel('HP atual', { exact: true }).fill('99');
  await page.getByRole('button', { name: 'Salvar e aprovar ficha', exact: true }).click();
  await expect(page.getByText('Informe um número inteiro entre 0 e 20.').last()).toBeVisible();
  await page.getByLabel('HP atual', { exact: true }).fill('20');
  await page.getByLabel('Força', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Salvar e aprovar ficha', exact: true }).click();
  await expect(page.getByText('Auron', { exact: true })).toBeVisible();
  await expect(page.getByText('Rafael · Ficha aprovada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mana', exact: true }).click();
  await page.getByLabel('Quantidade', { exact: true }).fill('99');
  await page.getByRole('button', { name: 'Confirmar alteração', exact: true }).click();
  await expect(page.getByText('Auron: mana 10 → 0.', { exact: true })).toBeVisible();
});
