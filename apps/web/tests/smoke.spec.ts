import { expect, test, type Browser, type Page } from '@playwright/test';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const hasRealtime = hasDatabase && Boolean(process.env.ABLY_API_KEY);

async function createLobby(page: Page, hostName: string) {
  await page.goto(`/create?host=${encodeURIComponent(hostName)}`);
  await expect(page.getByText(/Room code/i)).toBeVisible();
  await page.getByRole('link', { name: 'Open lobby' }).click();
  await expect(page.getByRole('heading', { name: 'Decoy lobby' })).toBeVisible();

  const code = page.url().split('/').at(-1);
  if (!code) {
    throw new Error('Lobby code was not present in the URL.');
  }

  return code;
}

async function joinLobby(page: Page, code: string, name: string) {
  await page.goto(`/join?code=${code}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Join lobby' }).click();
  await expect(page.getByRole('heading', { name: 'Decoy lobby' })).toBeVisible();
}

async function reloadIfFallback(page: Page) {
  if (!hasRealtime) {
    await page.reload();
  }
}

async function reloadAllIfFallback(pages: Page[]) {
  if (!hasRealtime) {
    await Promise.all(pages.map((page) => page.reload()));
  }
}

async function submitRound(page: Page, text: string) {
  await expect(page.getByText('Submission phase')).toBeVisible();
  await page.locator('textarea').fill(text);
  await page.getByRole('button', { name: 'Submit my answer' }).click();
  await expect(page.getByText('Your answer is locked in.')).toBeVisible();
}

async function voteFirstAvailable(page: Page) {
  await expect(page.getByText('Voting phase')).toBeVisible();
  await page.locator('button.vote-option:not([disabled])').first().click();
  await expect(page.getByText('Your vote is locked in.')).toBeVisible();
}

async function playFiveRoundGame(browser: Browser, code: string, hostPage: Page) {
  const playerTwoContext = await browser.newContext();
  const playerThreeContext = await browser.newContext();
  const playerTwoPage = await playerTwoContext.newPage();
  const playerThreePage = await playerThreeContext.newPage();

  await joinLobby(playerTwoPage, code, 'Riya');
  await joinLobby(playerThreePage, code, 'Ken');
  await reloadIfFallback(hostPage);

  await hostPage.getByTestId('change-deck').click();
  await expect(hostPage.getByTestId('deck-browser')).toBeVisible();
  await hostPage.getByTestId('deck-card-relationship_party').click();
  await hostPage.getByRole('link', { name: 'Back to lobby' }).click();
  await hostPage.getByTestId('round-count-5').click();
  await hostPage.getByTestId('start-game').click();
  await reloadAllIfFallback([hostPage, playerTwoPage, playerThreePage]);

  const seenPrompts = new Set<string>();
  const roundPages = [hostPage, playerTwoPage, playerThreePage];

  for (let round = 1; round <= 5; round += 1) {
    await expect(hostPage.getByText(`Round ${round} / 5`)).toBeVisible();
    const prompt = (await hostPage.locator('.prompt-copy').textContent())?.trim() ?? '';
    expect(prompt.length).toBeGreaterThan(0);
    expect(seenPrompts.has(prompt)).toBeFalsy();
    seenPrompts.add(prompt);

    await submitRound(hostPage, `host answer ${round}`);
    await submitRound(playerTwoPage, `riya answer ${round}`);
    await submitRound(playerThreePage, `ken answer ${round}`);
    await reloadAllIfFallback(roundPages);

    await voteFirstAvailable(hostPage);
    await voteFirstAvailable(playerTwoPage);
    await voteFirstAvailable(playerThreePage);
    await reloadAllIfFallback(roundPages);

    await expect(hostPage.getByText('Reveal')).toBeVisible();
    if (round < 5) {
      await hostPage.getByRole('button', { name: 'Next round' }).click();
      await reloadAllIfFallback(roundPages);
    } else {
      await expect(hostPage.getByText('Match complete')).toBeVisible();
    }
  }

  await playerTwoContext.close();
  await playerThreeContext.close();
}

test('home page loads without the old build badge section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'One fake answer. Everybody hunting for it.' })).toBeVisible();
  await expect(page.getByText('Included in this build')).toHaveCount(0);
});

test('host can configure deck setup, see deck artwork, and complete a five-round smoke game', async ({ browser, page }) => {
  test.skip(!hasDatabase, 'DATABASE_URL is required for lobby smoke tests.');

  const code = await createLobby(page, `Host ${Date.now()}`);
  await expect(page.getByTestId('selected-deck-art')).toBeVisible();
  await expect(page.getByTestId('round-count-5')).toBeVisible();
  await expect(page.getByTestId('change-deck')).toBeVisible();

  await playFiveRoundGame(browser, code, page);
});

test('deck settings sync across browsers over Ably without manual refresh', async ({ browser, page }) => {
  test.skip(!hasRealtime, 'DATABASE_URL and ABLY_API_KEY are required for realtime smoke tests.');

  const code = await createLobby(page, `Realtime ${Date.now()}`);
  const watcherContext = await browser.newContext();
  const watcherPage = await watcherContext.newPage();

  await watcherPage.goto(`/lobby/${code}`);
  await expect(watcherPage.getByRole('heading', { name: 'Decoy lobby' })).toBeVisible();

  await page.getByTestId('change-deck').click();
  await page.getByTestId('deck-card-word_up').click();
  await page.getByRole('link', { name: 'Back to lobby' }).click();
  await page.getByTestId('round-count-10').click();

  await expect(watcherPage.getByText('Word Up')).toBeVisible();
  await expect(watcherPage.getByText('10 rounds')).toBeVisible();

  await watcherContext.close();
});
