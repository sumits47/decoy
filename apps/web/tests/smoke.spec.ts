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

async function expectPlayerNameCount(page: Page, code: string, name: string, expectedCount: number) {
  const response = await page.request.get(`/api/lobbies/${code}`);
  expect(response.ok()).toBeTruthy();

  const data = (await response.json()) as {
    lobby: {
      players: Array<{ name: string }>;
    };
  };

  expect(data.lobby.players.filter((player) => player.name === name)).toHaveLength(expectedCount);
}

async function reloadIfFallback(page: Page) {
  if (!hasRealtime) {
    await page.reload();
  }
}

async function syncAllPages(pages: Page[]) {
  await Promise.all(pages.map((page) => page.reload()));
}

async function waitForLobbyPost(page: Page, pathFragment: string, action: () => Promise<void>) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(pathFragment) &&
        response.ok()
    ),
    action()
  ]);
}

async function submitRound(page: Page, text: string) {
  await expect(page.getByText('Submission phase')).toBeVisible();
  await page.locator('textarea').fill(text);
  await waitForLobbyPost(page, '/submit', async () => {
    await page.getByRole('button', { name: 'Submit my answer' }).click();
  });
  await expect
    .poll(async () => {
      const locked = await page.getByText('Your answer is locked in.').count();
      const voting = await page.getByText('Voting phase').count();
      return locked + voting;
    })
    .toBeGreaterThan(0);
}

async function voteFirstAvailable(page: Page) {
  await expect(page.getByText('Voting phase')).toBeVisible();
  await waitForLobbyPost(page, '/vote', async () => {
    await page.locator('button.vote-option:not([disabled])').first().click();
  });
  await expect
    .poll(async () => {
      const locked = await page.getByText('Your vote is locked in.').count();
      const reveal = await page.getByText('Reveal').count();
      return locked + reveal;
    })
    .toBeGreaterThan(0);
}

async function playFiveRoundGame(browser: Browser, code: string, hostName: string, hostPage: Page) {
  const playerTwoContext = await browser.newContext();
  const playerThreeContext = await browser.newContext();
  const playerTwoPage = await playerTwoContext.newPage();
  const playerThreePage = await playerThreeContext.newPage();

  await joinLobby(playerTwoPage, code, 'Riya');
  await joinLobby(playerThreePage, code, 'Ken');
  await reloadIfFallback(hostPage);

  await hostPage.getByTestId('change-deck').click();
  await expect(hostPage.getByTestId('deck-browser')).toBeVisible();
  await waitForLobbyPost(hostPage, '/settings', async () => {
    await hostPage.getByTestId('deck-card-relationship_party').click();
  });
  await hostPage.getByRole('link', { name: 'Back to lobby' }).click();
  await expectPlayerNameCount(hostPage, code, hostName, 1);
  await waitForLobbyPost(hostPage, '/settings', async () => {
    await hostPage.getByTestId('round-count-5').click();
  });
  await waitForLobbyPost(hostPage, '/start', async () => {
    await hostPage.getByTestId('start-game').click();
  });
  await expect(hostPage.getByText('Round 1 / 5')).toBeVisible();
  await syncAllPages([playerTwoPage, playerThreePage]);

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
    await syncAllPages(roundPages);

    await voteFirstAvailable(hostPage);
    await voteFirstAvailable(playerTwoPage);
    await voteFirstAvailable(playerThreePage);
    await syncAllPages(roundPages);

    await expect(hostPage.getByText('Reveal', { exact: true }).last()).toBeVisible();
    if (round < 5) {
      await waitForLobbyPost(hostPage, '/next-round', async () => {
        await hostPage.getByRole('button', { name: 'Next round' }).click();
      });
      await expect(hostPage.getByText(`Round ${round + 1} / 5`)).toBeVisible();
      await syncAllPages([playerTwoPage, playerThreePage]);
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

  const hostName = `Host ${Date.now()}`;
  const code = await createLobby(page, hostName);
  await expect(page.getByTestId('selected-deck-art')).toBeVisible();
  await expect(page.getByTestId('round-count-5')).toBeVisible();
  await expect(page.getByTestId('change-deck')).toBeVisible();
  await expectPlayerNameCount(page, code, hostName, 1);

  await playFiveRoundGame(browser, code, hostName, page);
});

test('retrying a join name does not create duplicate lobby seats', async ({ page }) => {
  test.skip(!hasDatabase, 'DATABASE_URL is required for lobby smoke tests.');

  const code = await createLobby(page, `Retry Host ${Date.now()}`);
  const firstJoin = await page.request.post(`/api/lobbies/${code}/join`, {
    data: { name: 'Riya' }
  });
  expect(firstJoin.ok()).toBeTruthy();

  const secondJoin = await page.request.post(`/api/lobbies/${code}/join`, {
    data: { name: 'Riya' }
  });
  expect(secondJoin.status()).toBe(409);
  await expectPlayerNameCount(page, code, 'Riya', 1);
});

test('deck settings sync across browsers over Ably without manual refresh', async ({ browser, page }) => {
  test.skip(!hasRealtime, 'DATABASE_URL and ABLY_API_KEY are required for realtime smoke tests.');

  const hostName = `Realtime ${Date.now()}`;
  const code = await createLobby(page, hostName);
  const watcherContext = await browser.newContext();
  const watcherPage = await watcherContext.newPage();

  await watcherPage.goto(`/lobby/${code}`);
  await expect(watcherPage.getByRole('heading', { name: 'Decoy lobby' })).toBeVisible();

  await page.getByTestId('change-deck').click();
  await waitForLobbyPost(page, '/settings', async () => {
    await page.getByTestId('deck-card-word_up').click();
  });
  await expect(page.getByTestId('selected-deck-art')).toHaveAttribute('alt', 'Word Up');
  await page.getByRole('link', { name: 'Back to lobby' }).click();
  await expectPlayerNameCount(page, code, hostName, 1);
  await waitForLobbyPost(page, '/settings', async () => {
    await page.getByTestId('round-count-10').click();
  });

  await expect(watcherPage.getByText('Word Up')).toBeVisible();
  await expect(watcherPage.getByTestId('deck-setup').getByText('10 rounds')).toBeVisible();

  await watcherContext.close();
});
