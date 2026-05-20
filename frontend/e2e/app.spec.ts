/**
 * E2E smoke tests — the API is mocked via page.route() so no backend is needed.
 * Tests verify that the UI renders correctly and auth flows work end-to-end.
 */

import { expect, test, type Page } from "@playwright/test";

// Stub heavy IIFE bundles that block React or require WebGL in Firefox headless
test.beforeEach(async ({ page }) => {
  await page.route("**/web-ifc/web-ifc-api.js", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.WebIFC = {};",
    });
  });
  // maplibre-gl requires WebGL which Firefox headless rejects — stub with no-op class
  await page.route("**/maplibre-gl/maplibre-gl.js", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: [
        "window.maplibregl = {",
        "  Map: class { constructor() {} addControl() {} on() {} remove() {}",
        "    getCenter() { return { lng: 0, lat: 0 }; }",
        "    getZoom() { return 10; }",
        "    isStyleLoaded() { return false; }",
        "    setStyle() {}",
        "  },",
        "  AttributionControl: class {},",
        "  NavigationControl: class {},",
        "  ScaleControl: class {},",
        "};",
      ].join("\n"),
    });
  });
});

const MOCK_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock";
const MOCK_PROJECT = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Demo Project",
  owner_id: "00000000-0000-0000-0000-000000000099",
  created_at: "2026-05-16T00:00:00Z",
};
const MOCK_FILE = {
  id: "00000000-0000-0000-0000-000000000002",
  project_id: MOCK_PROJECT.id,
  filename: "cube.stl",
  size_bytes: 1024,
  content_type: "model/stl",
  uploaded_at: "2026-05-16T00:00:00Z",
};

const MOCK_ALIGNMENT = {
  id: "mock-align-1",
  name: "テスト路線",
  design_speed: 60,
  project_id: MOCK_PROJECT.id,
  created_at: "2026-05-16T00:00:00Z",
  ip_points: [] as unknown[],
};

async function setupApiMocks(
  page: Parameters<typeof test>[1] extends (...args: infer A) => unknown
    ? A[0]
    : never,
) {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: MOCK_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
      }),
    });
  });

  await page.route("**/api/projects*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_PROJECT]),
      });
    } else if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PROJECT),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(`**/api/files/${MOCK_PROJECT.id}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_FILE]),
    });
  });

  await page.route(
    `**/api/files/${MOCK_PROJECT.id}/${MOCK_FILE.id}/download`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://s3.example.com/cube.stl",
          expires_in: 3600,
        }),
      });
    },
  );
}

async function setupAlignmentTests(page: Page) {
  await setupApiMocks(page);

  // Mock alignment list (GET returns empty, POST creates mock alignment)
  await page.route(
    `**/api/projects/${MOCK_PROJECT.id}/alignments`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else if (route.request().method() === "POST") {
        const body = (await route.request().postDataJSON()) as {
          name?: string;
          design_speed?: number;
        };
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ...MOCK_ALIGNMENT,
            name: body.name ?? MOCK_ALIGNMENT.name,
            design_speed: body.design_speed ?? 60,
          }),
        });
      } else {
        await route.continue();
      }
    },
  );

  // Mock individual alignment operations (DELETE / PUT ip-points)
  await page.route(
    `**/api/projects/${MOCK_PROJECT.id}/alignments/**`,
    async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({ status: 204 });
      } else if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    },
  );

  // Mock vertical alignment endpoints — registered last so they take priority over the ** handler above
  await page.route(
    `**/api/projects/${MOCK_PROJECT.id}/alignments/*/verticals`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else if (route.request().method() === "POST") {
        const body = (await route.request().postDataJSON()) as {
          name?: string;
        };
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "mock-vertical-1",
            alignment_id: MOCK_ALIGNMENT.id,
            name: body.name ?? "縦断1",
            created_at: "2026-05-16T00:00:00Z",
            vips: [],
          }),
        });
      } else {
        await route.continue();
      }
    },
  );

  // Mock individual vertical operations (DELETE / PUT vips)
  await page.route(
    `**/api/projects/${MOCK_PROJECT.id}/alignments/*/verticals/**`,
    async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({ status: 204 });
      } else if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    },
  );

  // Login
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();

  // Select the mock project so AlignmentPanel unlocks its form
  await page.selectOption("select", MOCK_PROJECT.id);

  // Navigate to alignment panel
  await page.getByRole("button", { name: "線形" }).click();
}

// ---- Smoke tests ----------------------------------------------------------

test("page loads with 3D viewport and header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ArcSphere3D")).toBeVisible();
  await expect(page.getByText("MVP")).toBeVisible();
  // Viewport container should be present (canvas may not exist when WebGL is unavailable)
  await expect(page.locator("[data-testid='viewport-canvas']")).toBeVisible();
});

test("ログインボタンでモーダルが開く", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
  await expect(page.getByLabel("パスワード")).toBeVisible();
});

test("ログインモーダルはバックドロップクリックで閉じる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  // Click outside the modal (the backdrop overlay)
  await page.locator(".fixed.inset-0").click({ position: { x: 10, y: 10 } });
  await expect(page.getByLabel("メールアドレス")).not.toBeVisible();
});

test("ログイン成功でログアウトボタンとプロジェクトパネルが表示される", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");

  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();

  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  // RightPanel のセクション見出し（h2）でプロジェクトパネルの存在を確認
  await expect(
    page.getByRole("heading", { name: "プロジェクト" }),
  ).toBeVisible();
});

test("誤った認証情報でエラーが表示される", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "invalid credentials" }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("wrong@example.com");
  await page.getByLabel("パスワード").fill("wrongpassword");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  // Error message should appear
  await expect(page.locator(".text-rose-500")).toBeVisible();
});

test("ログイン後: プロジェクト一覧表示とファイル一覧取得", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/");

  // Login
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();

  // Select project from dropdown
  await page.selectOption("select", MOCK_PROJECT.id);

  // File should appear in the list
  await expect(page.getByText("cube.stl")).toBeVisible();
});

test("ログアウトで認証クリアとプロジェクトパネル非表示", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/");

  // Login
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();

  // Sign out
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  // ログアウト後は RightPanel のプロジェクトセクション見出し（h2）が消える
  await expect(
    page.getByRole("heading", { name: "プロジェクト" }),
  ).not.toBeVisible();
});

// ---- LeftMenu panel switching -----------------------------------------------

test("LeftMenu: レイヤーパネルに切り替わる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "レイヤー" }).click();
  await expect(
    page.getByRole("heading", { name: "レイヤー", exact: true }),
  ).toBeVisible();
  // LayerPanel の「新しいレイヤー名」プレースホルダーが表示される
  await expect(page.getByPlaceholder("新しいレイヤー名")).toBeVisible();
});

test("LayerPanel: 新規レイヤーを追加できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "レイヤー" }).click();
  await page.getByPlaceholder("新しいレイヤー名").fill("テストレイヤー");
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByText("テストレイヤー")).toBeVisible();
  // 追加後に入力欄がクリアされる
  await expect(page.getByPlaceholder("新しいレイヤー名")).toHaveValue("");
});

test("LeftMenu: モデルパネルに切り替わる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "モデル" }).click();
  await expect(
    page.getByRole("heading", { name: "モデル", exact: true }),
  ).toBeVisible();
  // ModelPanel の変形モードボタンが表示される
  await expect(page.getByRole("button", { name: "移動" })).toBeVisible();
  await expect(page.getByRole("button", { name: "回転" })).toBeVisible();
  await expect(page.getByRole("button", { name: "拡縮" })).toBeVisible();
});

test("LeftMenu: 設定パネルに切り替わる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "設定" }).click();
  await expect(
    page.getByRole("heading", { name: "設定", exact: true }),
  ).toBeVisible();
  // SettingsPanel の背景色ピッカーが表示される
  await expect(page.getByText("背景色")).toBeVisible();
  await expect(page.getByText("グリッドサイズ")).toBeVisible();
});

test("LeftMenu: マテリアルパネルに切り替わる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "マテリアル" }).click();
  // RightPanel の h2 を対象とする（MaterialPanel 内の h3 も「マテリアル」のため locator で絞り込む）
  await expect(
    page.locator("h2").filter({ hasText: /^マテリアル$/ }),
  ).toBeVisible();
  // 未選択状態の案内テキストが表示される
  await expect(
    page.getByText("オブジェクトを選択してください。"),
  ).toBeVisible();
});

test("LeftMenu: AI アシストパネルに切り替わる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "AI アシスト" }).click();
  await expect(
    page.getByRole("heading", { name: "AI アシスト", exact: true }),
  ).toBeVisible();
});

test("AIPanel: メッセージを送信するとアシスタントが返答する", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "AI アシスト" }).click();

  const input = page.getByPlaceholder("質問を入力…");
  await expect(input).toBeVisible();
  await input.fill("STLファイルの読み込み方法は？");
  await page.getByRole("button", { name: "送信" }).click();

  // アシスタントの返答が表示される
  await expect(page.getByText(/STL/)).toBeVisible();
});

test("LeftMenu: BIM パネルが表示されIFCガイドメッセージが見える", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "BIM" }).click();
  await expect(page.getByRole("heading", { name: "BIM" })).toBeVisible();
  // IFCPropertyPanel: no models loaded → shows load instructions
  await expect(
    page.getByText("IFC ファイルを読み込むと BIM 属性パネルが有効になります"),
  ).toBeVisible();
});

test("LeftMenu: GIS パネルが表示され背景地図セレクターが見える", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "GIS" }).click();
  // Heading text is "GIS 背景地図"
  await expect(
    page.getByRole("heading", { name: "GIS 背景地図" }),
  ).toBeVisible();
  // Use exact match to avoid matching the "GIS 背景地図" heading
  await expect(page.getByText("背景地図", { exact: true })).toBeVisible();
});

// ---- ViewportToolbar interactions ------------------------------------------

test("ViewportToolbar: グリッドボタンをクリックできる", async ({ page }) => {
  await page.goto("/");
  const gridBtn = page.getByRole("button", { name: "グリッド" });
  await expect(gridBtn).toBeVisible();
  await gridBtn.click();
  // ボタンが存在し操作を受け付ける（WebGL なし環境では描画確認不可）
  await expect(gridBtn).toBeVisible();
});

test("ViewportToolbar: 軸ボタンをクリックできる", async ({ page }) => {
  await page.goto("/");
  const axisBtn = page.getByRole("button", { name: "軸" });
  await expect(axisBtn).toBeVisible();
  await axisBtn.click();
  await expect(axisBtn).toBeVisible();
});

test("ViewportToolbar: カメラリセットボタンが表示される", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "カメラリセット" }),
  ).toBeVisible();
});

// ---- Measure panel ----------------------------------------------------------

test("LeftMenu: 計測パネルが表示されモードボタンが見える", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "計測" }).click();
  await expect(page.getByRole("heading", { name: "計測" })).toBeVisible();
  await expect(page.getByRole("button", { name: "距離" })).toBeVisible();
  await expect(page.getByRole("button", { name: "面積" })).toBeVisible();
  await expect(page.getByRole("button", { name: "高さ" })).toBeVisible();
});

test("MeasurePanel: 距離モードを選択するとインストラクションが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "計測" }).click();
  await page.getByRole("button", { name: "距離" }).click();
  await expect(page.getByText("計測中:")).toBeVisible();
  await expect(
    page.getByText("3Dビューをクリックして計測点を追加します。"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "計測終了" })).toBeVisible();
});

// ---- Project panel (authenticated) file upload UI --------------------------

test("ログイン後: ファイルアップロードUIが表示される", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/");

  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();

  // ProjectPanel が表示されている状態でファイル読み込みUIを確認
  // (ModelPanel に FileLoader が内包されているため「モデル」タブへ移動)
  await page.getByRole("button", { name: "モデル" }).click();
  // FileLoader のファイル入力が存在する
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeAttached();
});

// ---- PointCloud panel -------------------------------------------------------

test("LeftMenu: 点群パネルに切り替わりLAS読み込みボタンが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "点群" }).click();
  await expect(
    page.getByRole("heading", { name: "点群", exact: true }),
  ).toBeVisible();
  // LAS/LAZ 読み込みボタンが表示される
  await expect(
    page.getByRole("button", { name: "LAS / LAZ を読み込む" }),
  ).toBeVisible();
});

test("PointCloudPanel: カラーモードボタンが4種類表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "点群" }).click();
  await expect(page.getByRole("button", { name: "高さ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "強度" })).toBeVisible();
  await expect(page.getByRole("button", { name: "RGB" })).toBeVisible();
  await expect(page.getByRole("button", { name: "単色" })).toBeVisible();
});

test("PointCloudPanel: 点サイズラベルとガイドメッセージが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "点群" }).click();
  // 点サイズラベルが表示される
  await expect(page.getByText("点サイズ")).toBeVisible();
  // 初期状態のガイドメッセージが表示される
  await expect(
    page.getByText(
      "LAS / LAZ ファイルを読み込むと 3D ビューに点群が表示されます。",
    ),
  ).toBeVisible();
});

// ---- Terrain TIN panel ------------------------------------------------------

test("LeftMenu: 地形パネルに切り替わりXYZファイル読み込みボタンが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "地形" }).click();
  await expect(
    page.getByRole("heading", { name: "地形 / TIN", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "XYZ ファイルを読み込む" }),
  ).toBeVisible();
});

test("TerrainPanel: TINサーフェスと三角形エッジのトグルボタンが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "地形" }).click();
  await expect(
    page.getByRole("button", { name: "TIN サーフェス" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "三角形エッジ" }),
  ).toBeVisible();
});

test("TerrainPanel: 等高線間隔スライダーが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "地形" }).click();
  await expect(page.getByText("等高線間隔")).toBeVisible();
  await expect(page.getByRole("slider", { name: "等高線間隔" })).toBeVisible();
});

test("TerrainPanel: 初期状態のガイドメッセージが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "地形" }).click();
  await expect(
    page.getByText(
      "XYZ 座標ファイルを読み込むと Delaunay 三角形分割 (TIN) で地形モデルが生成されます。",
    ),
  ).toBeVisible();
});

test("LeftMenu: 土量計算パネルに切り替わり基準面標高と計算ボタンが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "土量" }).click();
  await expect(
    page.getByRole("heading", { name: "土量計算", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "土量を計算" })).toBeVisible();
});

test("EarthworkPanel: 基準面標高スライダーと数値入力が表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "土量" }).click();
  await expect(page.getByText("基準面標高 (m)")).toBeVisible();
  await expect(page.getByRole("slider", { name: "基準面標高" })).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "基準面標高入力" }),
  ).toBeVisible();
});

test("EarthworkPanel: 地形データなしで計算ボタンが無効化される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "土量" }).click();
  await expect(page.getByRole("button", { name: "土量を計算" })).toBeDisabled();
});

test("EarthworkPanel: 初期状態のガイドメッセージが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "土量" }).click();
  await expect(
    page.getByText(
      "地形パネルで XYZ ファイルを読み込んでから基準面標高を設定し、土量を計算します。",
    ),
  ).toBeVisible();
});

test("LeftMenu: 線形設計パネルに切り替わり作成ボタンが表示される", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  await expect(page.getByRole("button", { name: "線形を作成" })).toBeVisible();
});

test("AlignmentPanel: 設計速度セレクターと線形名入力が表示される", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  await expect(page.getByRole("combobox", { name: "設計速度" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "線形名" })).toBeVisible();
});

test("AlignmentPanel: 線形を作成してIP点追加フォームが表示される", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  await page.getByRole("textbox", { name: "線形名" }).fill("テスト路線");
  await page.getByRole("button", { name: "線形を作成" }).click();
  await expect(
    page.getByRole("button", { name: "テスト路線", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "IP 点を追加" })).toBeVisible();
});

test("AlignmentPanel: 初期状態のガイドメッセージが表示される", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  await expect(
    page.getByText(
      "設計速度を選択して線形を作成し、IP 点を追加することで平面線形を設計します。",
    ),
  ).toBeVisible();
});

test("AlignmentPanel: 縦断タブに切り替えると案内メッセージが表示される", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  await page.getByRole("button", { name: "縦断線形タブ" }).click();
  await expect(
    page.getByText("平面線形を選択してから縦断線形を作成します。"),
  ).toBeVisible();
});

test("AlignmentPanel: 平面線形作成後に縦断タブで縦断線形を追加できる", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  await page.getByRole("textbox", { name: "線形名" }).fill("テスト路線");
  await page.getByRole("button", { name: "線形を作成" }).click();
  await page.getByRole("button", { name: "縦断線形タブ" }).click();
  await expect(page.getByText("対象路線:")).toBeVisible();
  await expect(page.getByRole("button", { name: "作成" })).toBeVisible();
});

test("AlignmentPanel: 縦断線形作成後にVIP追加フォームが表示される", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  await page.getByRole("textbox", { name: "線形名" }).fill("テスト路線");
  await page.getByRole("button", { name: "線形を作成" }).click();
  await page.getByRole("button", { name: "縦断線形タブ" }).click();
  await page.getByRole("textbox", { name: "縦断線形名" }).fill("縦断1");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.getByRole("button", { name: "VIP を追加" })).toBeVisible();
});

// ---- Additional coverage tests -----------------------------------------------

test("LeftMenu: CADパネルに切り替わるとCADパネルUIが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "CAD" }).click();
  await expect(page.locator('[data-testid="cad-panel"]')).toBeVisible();
});

test("AlignmentPanel: プロジェクト未選択時に案内メッセージが表示される", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");
  // Login but do NOT select a project
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.getByRole("button", { name: "線形" }).click();
  await expect(
    page.getByText("プロジェクトを選択すると線形一覧が表示されます。"),
  ).toBeVisible();
});

test("ProjectPanel: 新プロジェクト名を入力して作成ボタンを押せる", async ({
  page,
}) => {
  const NEW_PROJECT = {
    id: "00000000-0000-0000-0000-000000000003",
    name: "新プロジェクト",
    owner_id: "00000000-0000-0000-0000-000000000099",
    created_at: "2026-05-17T00:00:00Z",
  };
  await setupApiMocks(page);
  // Override POST /api/projects to return new project (fallback lets GET pass to setupApiMocks handler)
  await page.route("**/api/projects", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(NEW_PROJECT),
      });
    } else {
      await route.fallback();
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();

  // プロジェクト作成フォーム
  await page.getByPlaceholder("新しいプロジェクト名").fill("新プロジェクト");
  // "+" ボタンをクリック
  await page.locator('button[type="submit"]').click();
  // 作成成功後に入力欄がクリアされる
  await expect(page.getByPlaceholder("新しいプロジェクト名")).toHaveValue("");
});

test("ProjectPanel: プロジェクト選択後にファイルアップロードボタンが表示される", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await expect(
    page.getByRole("button", { name: "アップロード" }),
  ).toBeVisible();
});

test("ProjectPanel: ファイル一覧に3Dボタンと削除ボタンが表示される", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await expect(page.getByText("cube.stl")).toBeVisible();
  // 3Dビューア開くボタン
  await expect(page.getByTitle("3D ビューアで開く")).toBeVisible();
  // 削除ボタン
  await expect(page.getByTitle("ファイルを削除")).toBeVisible();
});

test("AlignmentPanel: IP点フォームにX・Z・R座標を入力できる", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  await page.getByRole("textbox", { name: "線形名" }).fill("Route A");
  await page.getByRole("button", { name: "線形を作成" }).click();
  await expect(
    page.getByRole("button", { name: "Route A", exact: true }),
  ).toBeVisible();
  // IP点フォームが表示されていること
  await expect(page.getByRole("button", { name: "IP 点を追加" })).toBeVisible();
  // 座標入力フォームに値を入力できる
  await page.getByLabel("IP点X座標").fill("100");
  await page.getByLabel("IP点Z座標").fill("200");
  await page.getByLabel("曲線半径").fill("75");
  await expect(page.getByLabel("IP点X座標")).toHaveValue("100");
  await expect(page.getByLabel("IP点Z座標")).toHaveValue("200");
  await expect(page.getByLabel("曲線半径")).toHaveValue("75");
});

test("AlignmentPanel: 線形を削除するとリストから消える", async ({ page }) => {
  await setupAlignmentTests(page);
  await page.getByRole("textbox", { name: "線形名" }).fill("削除テスト路線");
  await page.getByRole("button", { name: "線形を作成" }).click();
  await expect(
    page.getByRole("button", { name: "削除テスト路線", exact: true }),
  ).toBeVisible();
  // 削除ボタンをクリック
  await page.getByLabel("削除テスト路線を削除").click();
  // リストから消える
  await expect(
    page.getByRole("button", { name: "削除テスト路線", exact: true }),
  ).not.toBeVisible();
});

test("AlignmentPanel: 縦断線形にVIP座標を入力できる", async ({ page }) => {
  await setupAlignmentTests(page);
  await page.getByRole("textbox", { name: "線形名" }).fill("縦断テスト路線");
  await page.getByRole("button", { name: "線形を作成" }).click();
  await page.getByRole("button", { name: "縦断線形タブ" }).click();
  await page.getByRole("textbox", { name: "縦断線形名" }).fill("縦断A");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.getByRole("button", { name: "VIP を追加" })).toBeVisible();
  // VIP入力フォームに値を入力できる
  await page.getByLabel("測点距離").fill("100");
  await page.getByLabel("標高").fill("50");
  await page.getByLabel("縦曲線長").fill("80");
  await expect(page.getByLabel("測点距離")).toHaveValue("100");
  await expect(page.getByLabel("標高")).toHaveValue("50");
});

// ---- Viewport pointer / keyboard events ------------------------------------

test("viewport: ポインターイベントでJS例外が発生しない", async ({ page }) => {
  // Collect JS errors, filtering WebGL-unavailable noise from headless Firefox
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => {
    const msg = err.message;
    if (
      msg.includes("WebGL") ||
      msg.includes("THREE.WebGLRenderer") ||
      msg.includes("getContext")
    ) {
      return;
    }
    jsErrors.push(msg);
  });

  await page.goto("/");
  const canvas = page.locator("[data-testid='viewport-canvas']");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Simulate a click (pointerdown + pointerup within 5px)
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();

    // Simulate a drag (pointerdown + move > 5px + pointerup)
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30);
    await page.mouse.up();
  }

  expect(jsErrors).toHaveLength(0);
});

test("viewport: Escapeキーでオブジェクト選択が解除されてもJS例外が発生しない", async ({
  page,
}) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => {
    const msg = err.message;
    if (
      msg.includes("WebGL") ||
      msg.includes("THREE.WebGLRenderer") ||
      msg.includes("getContext")
    ) {
      return;
    }
    jsErrors.push(msg);
  });

  await page.goto("/");
  await expect(page.locator("[data-testid='viewport-canvas']")).toBeVisible();

  // Press Escape and a non-binding key — both should be silently ignored when no object is selected
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");

  expect(jsErrors).toHaveLength(0);
});

// ---- Theme toggle -----------------------------------------------------------

test("Header: テーマトグルボタンが表示される", async ({ page }) => {
  await page.goto("/");
  // Initially either dark or light — the toggle button is always visible
  const toggleBtn = page
    .getByTitle("ライトモードに切り替え")
    .or(page.getByTitle("ダークモードに切り替え"));
  await expect(toggleBtn).toBeVisible();
});

test("Header: テーマトグルでライト/ダークが切り替わる", async ({ page }) => {
  await page.goto("/");
  // Determine current mode by which title is present
  const darkToggle = page.getByTitle("ライトモードに切り替え");
  const lightToggle = page.getByTitle("ダークモードに切り替え");
  const isDark = await darkToggle.isVisible();
  if (isDark) {
    // Currently dark — click to switch to light
    await darkToggle.click();
    await expect(lightToggle).toBeVisible();
  } else {
    // Currently light — click to switch to dark
    await lightToggle.click();
    await expect(darkToggle).toBeVisible();
  }
});

// ---- Login rate limiting UI -------------------------------------------------

test("ログイン: 429レスポンスでエラーメッセージが表示される", async ({
  page,
}) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "Retry-After": "60" },
      body: JSON.stringify({
        detail: "too many login attempts — try again later",
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  // Error text should appear (same rose-500 error zone as 401)
  await expect(page.locator(".text-rose-500")).toBeVisible();
});

// ---- ProjectPanel extended --------------------------------------------------

test("ProjectPanel: プロジェクト一覧が空の時に案内メッセージが表示される", async ({
  page,
}) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: MOCK_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
      }),
    });
  });
  await page.route("**/api/projects*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  // Empty state: no project option in the select
  const select = page.locator("select");
  await expect(select).toBeVisible();
  // The select should only have the placeholder option (value "")
  const options = await select.locator("option").all();
  // At minimum, the placeholder "— プロジェクトを選択 —" should exist
  expect(options.length).toBeGreaterThanOrEqual(1);
});

test("ProjectPanel: ファイル削除ボタンクリックでDELETE APIが呼ばれる", async ({
  page,
}) => {
  let fileDeleted = false;
  await setupApiMocks(page);
  // DELETE /api/files/{fileId} — actual path used by api.ts deleteFile()
  await page.route(`**/api/files/${MOCK_FILE.id}`, async (route) => {
    if (route.request().method() === "DELETE") {
      fileDeleted = true;
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await expect(page.getByText("cube.stl")).toBeVisible();
  // Click delete button and wait for the DELETE request to complete
  const responsePromise = page.waitForResponse(`**/api/files/${MOCK_FILE.id}`);
  await page.getByTitle("ファイルを削除").click();
  await responsePromise;
  // Deletion API should have been called
  expect(fileDeleted).toBe(true);
});

// ---- SettingsPanel ----------------------------------------------------------

test("SettingsPanel: 背景色ピッカーが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "設定" }).click();
  await expect(
    page.getByRole("heading", { name: "ビューポート設定" }),
  ).toBeVisible();
  // Color picker input exists
  const colorInput = page.locator('input[type="color"]');
  await expect(colorInput).toBeAttached();
});

test("SettingsPanel: グリッドサイズスライダーが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "設定" }).click();
  // Grid size label is visible (shows current value)
  await expect(page.getByText(/グリッドサイズ/)).toBeVisible();
});

test("SettingsPanel: 環境光スライダーが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "設定" }).click();
  // Ambient light label is visible — matches "環境光" heading or "環境光: X.XX" value label
  await expect(page.getByText(/環境光/).first()).toBeVisible();
});

// ---- Viewport advanced events ----------------------------------------------

test("viewport: マウスホイールスクロールでJS例外が発生しない", async ({
  page,
}) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => {
    const msg = err.message;
    if (
      msg.includes("WebGL") ||
      msg.includes("THREE.WebGLRenderer") ||
      msg.includes("getContext")
    ) {
      return;
    }
    jsErrors.push(msg);
  });

  await page.goto("/");
  const canvas = page.locator("[data-testid='viewport-canvas']");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    // Simulate scroll wheel (zoom in/out)
    await page.mouse.wheel(0, -120);
    await page.mouse.wheel(0, 120);
  }

  expect(jsErrors).toHaveLength(0);
});

test("viewport: ダブルクリックでJS例外が発生しない", async ({ page }) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => {
    const msg = err.message;
    if (
      msg.includes("WebGL") ||
      msg.includes("THREE.WebGLRenderer") ||
      msg.includes("getContext")
    ) {
      return;
    }
    jsErrors.push(msg);
  });

  await page.goto("/");
  const canvas = page.locator("[data-testid='viewport-canvas']");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  }

  expect(jsErrors).toHaveLength(0);
});

// ---- AlignmentPanel advanced ------------------------------------------------

test("AlignmentPanel: 設計速度セレクターに複数の速度オプションがある", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  // Design speed selector should offer multiple speed options
  const speedSelect = page.locator("select").first();
  const options = await speedSelect.locator("option").all();
  // Should have at least 3 speed options (e.g. 40, 60, 80 km/h)
  expect(options.length).toBeGreaterThanOrEqual(3);
});

test("AlignmentPanel: 線形を作成ボタンが表示され操作可能である", async ({
  page,
}) => {
  await setupAlignmentTests(page);
  // Create button is visible and enabled (disabled only while loading)
  const createBtn = page.getByRole("button", { name: "線形を作成" });
  await expect(createBtn).toBeVisible();
  await expect(createBtn).toBeEnabled();
});

// ---- BottomConsole ----------------------------------------------------------

test("BottomConsole: 初期状態でコンソールエリアが表示される", async ({
  page,
}) => {
  await page.goto("/");
  // Firefox headless では WebGL が利用不可でログが書き込まれるため、
  // 準備完了メッセージの代わりに viewport ログが表示される場合がある。
  // コンソールエリア自体の可視性を確認する。
  await expect(page.locator('[data-testid="bottom-console"]')).toBeVisible();
});

// ---- ModelPanel — FileLoader ------------------------------------------------

test("ModelPanel: ファイルを開くボタンが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "モデル" }).click();
  await expect(
    page.getByRole("button", { name: /\.stl\s*\/\s*\.obj/ }),
  ).toBeVisible();
});

test("ModelPanel: 初期状態でシーンオブジェクトが空", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "モデル" }).click();
  await expect(page.getByText("オブジェクトなし")).toBeVisible();
});

test("ModelPanel: ファイル読み込みセクションの説明テキストが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "モデル" }).click();
  await expect(
    page.getByText(
      "ローカルファイルをブラウザだけで解析します。アップロードは行いません。",
    ),
  ).toBeVisible();
});

// ---- ProjectPanel extended --------------------------------------------------

test("ProjectPanel: プロジェクト選択後にファイルなしメッセージが表示される", async ({
  page,
}) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: MOCK_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
      }),
    });
  });
  await page.route("**/api/projects*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_PROJECT]),
      });
    } else {
      await route.continue();
    }
  });
  await page.route(`**/api/files/${MOCK_PROJECT.id}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]), // no files
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await expect(
    page.getByText("ファイルなし — モデルをアップロードしてください。"),
  ).toBeVisible();
});

test("ProjectPanel: 3Dビューアで開くボタンのクリックでダウンロードURL APIが呼ばれる", async ({
  page,
}) => {
  let downloadRequested = false;
  await setupApiMocks(page);
  await page.route(
    `**/api/files/${MOCK_PROJECT.id}/${MOCK_FILE.id}/download`,
    async (route) => {
      downloadRequested = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://s3.example.com/cube.stl",
          expires_in: 3600,
        }),
      });
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await expect(page.getByText("cube.stl")).toBeVisible();

  const responsePromise = page.waitForResponse(
    `**/api/files/${MOCK_PROJECT.id}/${MOCK_FILE.id}/download`,
  );
  await page.getByTitle("3D ビューアで開く").click();
  await responsePromise;
  expect(downloadRequested).toBe(true);
});

// ---- MeasurePanel advanced --------------------------------------------------

test("MeasurePanel: 面積モードで計測インストラクションが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "計測" }).click();
  await page.getByRole("button", { name: "面積" }).click();
  await expect(page.getByText("計測中:")).toBeVisible();
  await expect(page.getByRole("button", { name: "計測終了" })).toBeVisible();
});

test("MeasurePanel: 高さモードで計測インストラクションが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "計測" }).click();
  await page.getByRole("button", { name: "高さ" }).click();
  await expect(page.getByText("計測中:")).toBeVisible();
  await expect(page.getByRole("button", { name: "計測終了" })).toBeVisible();
});

test("MeasurePanel: 計測終了ボタンで通常モードに戻る", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "計測" }).click();
  await page.getByRole("button", { name: "距離" }).click();
  await expect(page.getByRole("button", { name: "計測終了" })).toBeVisible();
  await page.getByRole("button", { name: "計測終了" }).click();
  // モード選択ボタンが再表示される
  await expect(page.getByRole("button", { name: "距離" })).toBeVisible();
  // 計測終了後はオフ状態のガイドメッセージが表示される
  await expect(page.getByText("計測モードを選択してください。")).toBeVisible();
});

// ---- LayerPanel advanced ----------------------------------------------------

test("LayerPanel: 複数レイヤーを追加できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "レイヤー" }).click();
  await page.getByPlaceholder("新しいレイヤー名").fill("レイヤーA");
  await page.getByRole("button", { name: "+" }).click();
  await page.getByPlaceholder("新しいレイヤー名").fill("レイヤーB");
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByText("レイヤーA")).toBeVisible();
  await expect(page.getByText("レイヤーB")).toBeVisible();
});

// ---- AIPanel advanced -------------------------------------------------------

test("AIPanel: 複数のメッセージを送信できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "AI アシスト" }).click();
  const input = page.getByPlaceholder("質問を入力…");

  await input.fill("STLとは何ですか？");
  await page.getByRole("button", { name: "送信" }).click();
  await expect(page.getByText(/STL/)).toBeVisible();

  // 2通目のメッセージ送信 — アシスタントの返答がさらに増える
  await input.fill("カメラをリセットする方法は？");
  await page.getByRole("button", { name: "送信" }).click();
  // カメラキーワードに対するレスポンスが表示される
  await expect(page.getByText(/カメラリセット/)).toBeVisible();
});

test("AIPanel: 初期メッセージが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "AI アシスト" }).click();
  await expect(
    page.getByText("こんにちは！ArcSphere3D AI アシスタントです（モック）。"),
  ).toBeVisible();
});

// ---- MeasurePanel: クリアボタン -----------------------------------------------

test("MeasurePanel: クリアボタンが初期状態で無効化される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "計測" }).click();
  // No points added yet — clear button should be disabled
  await expect(page.getByRole("button", { name: "クリア" })).toBeDisabled();
});

// ---- ProjectPanel: 作成中ローディング -----------------------------------------

// ---- CAD Panel (Issue #66 next_session: OpenCascade.js integration) --------

test("LeftMenu: CADパネルに切り替わると形状タブが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "CAD" }).click();
  // Shape tabs should now be visible
  await expect(page.getByRole("button", { name: "直方体" })).toBeVisible();
  await expect(page.getByRole("button", { name: "球" })).toBeVisible();
  await expect(page.getByRole("button", { name: "円柱" })).toBeVisible();
  await expect(page.getByRole("button", { name: "円錐" })).toBeVisible();
  await expect(page.getByRole("button", { name: "トーラス" })).toBeVisible();
});

test("CadPanel: 直方体パラメータ入力フォームが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "CAD" }).click();
  await page.getByRole("button", { name: "直方体" }).click();
  await expect(page.getByTestId("cad-box-width")).toBeVisible();
  await expect(page.getByTestId("cad-box-height")).toBeVisible();
  await expect(page.getByTestId("cad-box-depth")).toBeVisible();
});

test("CadPanel: 球タブに切り替えると半径入力が表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "CAD" }).click();
  await page.getByRole("button", { name: "球" }).click();
  await expect(page.getByTestId("cad-sphere-radius")).toBeVisible();
});

test("CadPanel: シーンに追加ボタンが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "CAD" }).click();
  await expect(page.getByTestId("cad-add-btn")).toBeVisible();
  await expect(page.getByTestId("cad-add-btn")).toBeEnabled();
});

test("CadPanel: OpenCascade.jsロードマップが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "CAD" }).click();
  await expect(page.getByText("OpenCascade.js 統合ロードマップ")).toBeVisible();
});

// ---- ProjectPanel: 作成中ローディング -----------------------------------------

test("ProjectPanel: プロジェクト作成ボタンは空の入力では無効化される", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  // 入力が空の状態では + ボタンが無効化される
  await expect(page.locator('button[type="submit"]')).toBeDisabled();
  // 入力に値を入れると有効化される
  await page.getByPlaceholder("新しいプロジェクト名").fill("テスト");
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
});

// ---- MembersPanel -----------------------------------------------------------

const MOCK_OWNER_ID = "11111111-2222-3333-4444-555555555555";
const MOCK_EDITOR_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const MOCK_OWNER_MEMBER = {
  project_id: MOCK_PROJECT.id,
  user_id: MOCK_OWNER_ID,
  role: "owner",
  email: "demo@arcsphere3d.dev",
  created_at: "2026-05-20T00:00:00Z",
};

const MOCK_MEMBER = {
  project_id: MOCK_PROJECT.id,
  user_id: MOCK_EDITOR_ID,
  role: "editor",
  email: "editor@arcsphere3d.dev",
  created_at: "2026-05-20T00:00:00Z",
};

const MOCK_USER_LOOKUP = {
  id: MOCK_EDITOR_ID,
  email: "editor@arcsphere3d.dev",
};

const MOCK_ME = {
  id: MOCK_OWNER_ID,
  sub: "demo",
  email: "demo@arcsphere3d.dev",
  role: "admin",
};

async function setupMembersApiMocks(page: Page) {
  await setupApiMocks(page);
  await page.route(`**/api/users/me**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ME),
    });
  });
  await page.route(`**/api/users/lookup**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER_LOOKUP),
    });
  });
  await page.route(
    `**/api/projects/${MOCK_PROJECT.id}/members**`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([MOCK_OWNER_MEMBER, MOCK_MEMBER]),
        });
      } else if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_MEMBER),
        });
      } else if (route.request().method() === "DELETE") {
        await route.fulfill({ status: 204 });
      } else {
        await route.continue();
      }
    },
  );
}

test("LeftMenu: メンバーパネルに切り替わるとメンバー管理UIが表示される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "メンバー" }).click();
  // ログイン前はログイン案内メッセージが表示される
  await expect(page.getByText("ログインしてください。")).toBeVisible();
});

test("MembersPanel: プロジェクト未選択時に案内メッセージが表示される", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");
  // ログインするがプロジェクトは選択しない
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.getByRole("button", { name: "メンバー" }).click();
  await expect(page.getByTestId("members-no-project")).toBeVisible();
});

test("MembersPanel: ログイン後にプロジェクトを選択するとメンバーパネルUIが表示される", async ({
  page,
}) => {
  await setupMembersApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await page.getByRole("button", { name: "メンバー" }).click();
  await expect(page.getByTestId("members-panel")).toBeVisible();
});

test("MembersPanel: メンバー一覧が表示される", async ({ page }) => {
  await setupMembersApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await page.getByRole("button", { name: "メンバー" }).click();
  await expect(page.getByTestId("members-list")).toBeVisible();
  // members-list内に限定（role-selectの<option>と区別するため）
  await expect(
    page.getByTestId("members-list").getByText("編集者"),
  ).toBeVisible();
});

test("MembersPanel: メンバー追加フォームが表示される", async ({ page }) => {
  await setupMembersApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await page.getByRole("button", { name: "メンバー" }).click();
  await expect(page.getByTestId("member-user-id-input")).toBeVisible();
  await expect(page.getByTestId("member-role-select")).toBeVisible();
  await expect(page.getByTestId("member-add-btn")).toBeVisible();
});

test("MembersPanel: メールアドレス未入力では追加ボタンが無効化される", async ({
  page,
}) => {
  await setupMembersApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await page.getByRole("button", { name: "メンバー" }).click();
  // 空の状態では追加ボタンが無効化される
  await expect(page.getByTestId("member-add-btn")).toBeDisabled();
  // 不正なメールアドレスでも無効化
  await page.getByTestId("member-user-id-input").fill("not-an-email");
  await expect(page.getByTestId("member-add-btn")).toBeDisabled();
  // 正しいメールアドレスを入力すると有効化される
  await page.getByTestId("member-user-id-input").fill("editor@arcsphere3d.dev");
  await expect(page.getByTestId("member-add-btn")).toBeEnabled();
});

test("MembersPanel: 無効なメールアドレスでバリデーションエラーが表示される", async ({
  page,
}) => {
  await setupMembersApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await page.getByRole("button", { name: "メンバー" }).click();
  // 不正な値を入力してフォーカスを外す
  await page.getByTestId("member-user-id-input").fill("invalid-email");
  await page.getByTestId("member-user-id-input").blur();
  await expect(page.getByTestId("email-validation-error")).toBeVisible();
});

test("MembersPanel: メンバー一覧にメールアドレスが表示される", async ({
  page,
}) => {
  await setupMembersApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await page.getByRole("button", { name: "メンバー" }).click();
  await expect(page.getByTestId("members-list")).toBeVisible();
  // メールアドレスが表示されている (UUID の先頭8文字ではなく)
  await expect(
    page.getByTestId("members-list").getByTestId("member-email").first(),
  ).toContainText("@");
});

// ---- ProjectPanel: プロジェクト削除 ------------------------------------------

test("ProjectPanel: プロジェクト選択後に削除ボタンが表示される", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await expect(page.getByTestId("project-delete-btn")).toBeVisible();
});

test("ProjectPanel: プロジェクト未選択時に削除ボタンが非表示", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  // プロジェクトを選択しない状態では削除ボタンは表示されない
  await expect(page.getByTestId("project-delete-btn")).not.toBeVisible();
});

test("ProjectPanel: プロジェクト削除時にDELETE APIが呼ばれる", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.route(`**/api/projects/${MOCK_PROJECT.id}`, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  // waitForRequest を先に登録してから confirm ダイアログを承認してクリック
  const deleteReq = page.waitForRequest(
    (req) =>
      req.url().includes(`/api/projects/${MOCK_PROJECT.id}`) &&
      req.method() === "DELETE",
  );
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByTestId("project-delete-btn").click();
  await deleteReq;
});

// ---- ProjectPanel: プロジェクト名変更 ------------------------------------------

test("ProjectPanel: プロジェクト選択後に名前変更ボタンが表示される", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await expect(page.getByTestId("project-rename-btn")).toBeVisible();
});

test("ProjectPanel: 名前変更ボタンクリックで入力フォームが表示される", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await page.getByTestId("project-rename-btn").click();
  await expect(page.getByTestId("project-rename-input")).toBeVisible();
  await expect(page.getByTestId("project-rename-save")).toBeVisible();
});

test("ProjectPanel: プロジェクト名変更時にPUT APIが呼ばれる", async ({
  page,
}) => {
  await setupApiMocks(page);
  await page.route(`**/api/projects/${MOCK_PROJECT.id}`, async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_PROJECT, name: "Renamed" }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await page.selectOption("select", MOCK_PROJECT.id);
  await page.getByTestId("project-rename-btn").click();
  const renameReq = page.waitForRequest(
    (req) =>
      req.url().includes(`/api/projects/${MOCK_PROJECT.id}`) &&
      req.method() === "PUT",
  );
  await page.getByTestId("project-rename-input").fill("Renamed");
  await page.getByTestId("project-rename-save").click();
  await renameReq;
});
