import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  getCachedProviders: vi.fn(),
  getProviderChartData: vi.fn(),
  getProviderLocalUsageSummary: vi.fn(),
  refreshProviders: vi.fn(),
  refreshProvidersIfStale: vi.fn(),
  getSettingsSnapshot: vi.fn(),
  updateSettings: vi.fn(),
  getLocaleStrings: vi.fn(),
  setUiLanguage: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  listen: vi.fn(),
}));

const windowMocks = vi.hoisted(() => ({
  getCurrentWindow: vi.fn(() => ({
    startDragging: vi.fn().mockResolvedValue(undefined),
  })),
}));

const coreMocks = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);
vi.mock("@tauri-apps/api/window", () => windowMocks);
vi.mock("@tauri-apps/api/core", () => coreMocks);

import FloatBar from "./FloatBar";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { buildBundle } from "../test/localeHarness";
import type {
  BootstrapState,
  ProviderUsageSnapshot,
  RateWindowSnapshot,
  SettingsSnapshot,
} from "../types/bridge";

type RateWindowOptions = {
  exhausted?: boolean;
  windowMinutes?: number | null;
  informational?: boolean;
  resetsAt?: string | null;
  resetDescription?: string | null;
  descriptionIsDetail?: boolean;
};

function rateWindow(
  used: number,
  opts: RateWindowOptions = {},
): RateWindowSnapshot {
  return {
    usedPercent: used,
    remainingPercent: 100 - used,
    windowMinutes: opts.windowMinutes ?? null,
    resetsAt: opts.resetsAt ?? null,
    resetDescription: opts.resetDescription ?? null,
    isExhausted: opts.exhausted ?? false,
    isInformational: opts.informational,
    descriptionIsDetail: opts.descriptionIsDetail,
    reservePercent: null,
    reserveDescription: null,
  };
}

function snapshot(
  id: string,
  display: string,
  used: number,
  opts: {
    exhausted?: boolean;
    error?: string | null;
    errorState?: ProviderUsageSnapshot["errorState"];
    windowMinutes?: number | null;
    resetsAt?: string | null;
    resetDescription?: string | null;
    descriptionIsDetail?: boolean;
    informational?: boolean;
    secondary?: {
      used: number;
      windowMinutes?: number | null;
      exhausted?: boolean;
      informational?: boolean;
      resetsAt?: string | null;
      resetDescription?: string | null;
    };
    selected?: {
      used: number;
      exhausted?: boolean;
      informational?: boolean;
      resetsAt?: string | null;
      resetDescription?: string | null;
    };
  } = {},
): ProviderUsageSnapshot {
  const primary = rateWindow(used, opts);
  const secondary = opts.secondary
    ? rateWindow(opts.secondary.used, opts.secondary)
    : null;
  const selectedMetric = opts.selected
    ? rateWindow(opts.selected.used, opts.selected)
    : primary.isInformational && secondary && !secondary.isInformational
      ? secondary
      : primary;

  return {
    providerId: id,
    displayName: display,
    primary,
    selectedMetric,
    secondary,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: null,
    accountEmail: null,
    sourceLabel: "auto",
    updatedAt: "2026-05-15T00:00:00Z",
    error: opts.error ?? null,
    errorState: opts.errorState ?? "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
  };
}

function settings(overrides: Partial<SettingsSnapshot> = {}): SettingsSnapshot {
  return {
    enabledProviders: ["claude", "codex", "gemini", "cursor"],
    refreshIntervalSecs: 300,
    adaptiveRefresh: false,
    refreshAllProvidersOnMenuOpen: false,
    lowPowerMode: false,
    startAtLogin: false,
    startMinimized: false,
    showNotifications: true,
    soundEnabled: true,
    notificationSoundTheme: "windows",
    notificationSoundPaths: {
      predictiveWarning: null,
      highUsage: null,
      criticalUsage: null,
      exhausted: null,
      statusIssue: null,
      sessionDepleted: null,
      sessionRestored: null,
    },
    highUsageThreshold: 70,
    criticalUsageThreshold: 90,
    predictivePaceWarningEnabled: false,
    credentialExpiryNotificationsEnabled: false,
    trayIconMode: "single",
    switcherShowsIcons: true,
    menuBarShowsHighestUsage: false,
    menuBarShowsPercent: false,
    menuBarColorPace: false,
    showAsUsed: true,
    showAllTokenAccountsInMenu: false,
    enableAnimations: true,
    resetTimeRelative: true,
    showResetWhenExhausted: false,
    menuBarDisplayMode: "detailed",
    overviewLayout: "detailed",
    hidePersonalInfo: false,
    updateChannel: "stable",
    autoDownloadUpdates: false,
    installUpdatesOnQuit: false,
    globalShortcut: "Ctrl+Shift+U",
    switcherShortcuts: {},
    codexCustomSessionsDirs: [],
    uiLanguage: "english",
    theme: "dark",
    windowScalePercent: 125,
    trayScalePercent: 100,
    trayPanelAlwaysOnTop: false,
    powertoysStatusPipeEnabled: false,
    claudeAvoidKeychainPrompts: false,
    codexSparkUsageVisible: true,
    disableKeychainAccess: false,
    providerMetrics: {},
    floatBarEnabled: true,
    floatBarOpacity: 80,
    floatBarScale: 100,
    floatBarOrientation: "horizontal",
    floatBarStyle: "floating",
    floatBarClickThrough: false,
    floatBarProviderIds: [],
    floatBarDarkText: false,
    floatBarShowResetInline: false,
    floatBarShowCost: false,
    claudeDailyRoutinesUsageVisible: true,
    claudeAllowReadingClaudeCodeCredentials: false,
    alibabaTokenPlanRegion: "cn",
    weeklyProgressWorkDays: null,
    costSummaryDisplayStyle: "compact",
    providerAccentColors: {},
    ...overrides,
  };
}

function bootstrap(settingsOverrides: Partial<SettingsSnapshot> = {}): BootstrapState {
  return {
    contractVersion: "v1",
    providers: [],
    settings: settings(settingsOverrides),
  };
}

function renderFloatBar(state: BootstrapState) {
  return render(
    <LocaleProvider>
      <FloatBar state={state} />
    </LocaleProvider>,
  );
}

describe("FloatBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMocks.refreshProviders.mockResolvedValue(undefined);
    tauriMocks.refreshProvidersIfStale.mockResolvedValue(undefined);
    tauriMocks.getProviderLocalUsageSummary.mockResolvedValue(null);
    tauriMocks.getLocaleStrings.mockResolvedValue(
      buildBundle({
        ResetsInHoursMinutes: "Resets in {}h {}m",
        ResetsInDaysHours: "Resets in {}d {}h",
        ResetsInHoursOnly: "Resets in {}h",
        ProviderTextNoActiveSession: "No active 5h session",
        ProviderTextApiRate: "{} API-rate",
        ProviderTextNoBudgetSet: "No budget set",
        TrayResetsDueNow: "Resetting",
        PanelToday: "Today",
        PanelUsedSuffix: "used",
        OverviewSpendEstimate: "Estimate",
        ProviderIssueAuthRequired: "Sign-in required",
        ProviderIssueSessionExpired: "Session expired",
        ProviderIssueLocalRuntimeOffline: "Local runtime offline",
        ProviderIssueUnknown: "Usage unavailable",
        CostPeriodShortMonthToDate: "MTD",
        CostPeriodShortDays: "{}d",
        FloatBarNoProviders: "No providers",
        FloatBarRemainingSuffix: "remaining",
      }),
    );
    eventMocks.listen.mockResolvedValue(() => {});
  });

  it("stacks Claude above Codex as quota cards and renders others as pills", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 90),
      snapshot("claude", "Claude", 20, {
        windowMinutes: 300,
        secondary: { used: 40, windowMinutes: 7 * 24 * 60 },
      }),
      snapshot("codex", "Codex", 75),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ enabledProviders: ["claude", "codex", "gemini"] }),
    );

    const { container } = renderFloatBar(
      bootstrap({ enabledProviders: ["claude", "codex", "gemini"] }),
    );
    await waitFor(() => {
      expect(container.querySelectorAll(".floatbar__codex-card").length).toBe(2);
      expect(container.querySelectorAll(".floatbar__pill").length).toBe(1);
    });

    const stack = container.querySelector(".floatbar__quota-stack");
    const cards = Array.from(
      stack?.querySelectorAll(".floatbar__codex-card") ?? [],
    );
    expect(cards[0].classList.contains("floatbar__codex-card--claude")).toBe(true);
    expect(cards[1].classList.contains("floatbar__codex-card--codex")).toBe(true);
    // Claude shows both the 5h session and the weekly window.
    expect(cards[0].querySelectorAll(".floatbar__codex-row")).toHaveLength(2);
    expect(cards[0].textContent).toContain("80% left");
    expect(cards[0].textContent).toContain("60% left");

    // Highest used (gemini, 90%) still shows first, then the quota stack.
    const entries = Array.from(
      container.querySelectorAll(".floatbar__quota-stack, .floatbar__pill"),
    );
    expect(entries[0].classList.contains("floatbar__pill")).toBe(true);
    expect(entries[1]).toBe(stack);
    expect(entries.every((el) => !el.hasAttribute("title"))).toBe(true);
  });

  it("names the provider on an unavailable quota card", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("claude", "Claude", 0, { error: "fetch failed", errorState: "unknown" }),
      snapshot("codex", "Codex", 10),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      const card = container.querySelector(".floatbar__codex-card--error");
      expect(card?.classList.contains("floatbar__codex-card--claude")).toBe(true);
      expect(card?.textContent).toContain("Claude unavailable");
    });
  });

  it("shows Codex remaining capacity with live reset times and no row labels", async () => {
    const now = new Date("2026-05-15T00:00:00Z").getTime();
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      tauriMocks.getCachedProviders.mockResolvedValue([
        snapshot("codex", "Codex", 38, {
          windowMinutes: 300,
          resetsAt: new Date(now + (2 * 60 + 14) * 60_000).toISOString(),
          secondary: {
            used: 59,
            windowMinutes: 10080,
            resetsAt: new Date(now + (3 * 24 + 8) * 60 * 60_000).toISOString(),
          },
        }),
      ]);
      tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

      const { container } = renderFloatBar(bootstrap());
      await waitFor(() => {
        const card = container.querySelector(".floatbar__codex-card");
        expect(card).not.toBeNull();
        const text = card?.textContent ?? "";
        expect(text).toContain("62% left");
        expect(text).toContain("2h 14m");
        expect(text).toContain("41% left");
        expect(text).toContain("3d 8h");
        expect(text).not.toContain("resets in");
        expect(text).not.toContain("5h");
        expect(text).not.toContain("Weekly");
        const meters = card?.querySelectorAll(".floatbar__codex-meter") ?? [];
        expect(meters.length).toBe(2);
        expect(meters[0].classList.contains("floatbar__codex-meter--top")).toBe(
          true,
        );
        expect(
          meters[1].classList.contains("floatbar__codex-meter--bottom"),
        ).toBe(true);
        expect(
          meters[0]
            .querySelector<HTMLElement>(".floatbar__codex-meter-fill")
            ?.style.width,
        ).toBe("62%");
        expect(
          meters[1]
            .querySelector<HTMLElement>(".floatbar__codex-meter-fill")
            ?.style.width,
        ).toBe("41%");
        const expectedMarkers =
          card?.querySelectorAll<HTMLElement>(".floatbar__codex-expected") ??
          [];
        expect(expectedMarkers.length).toBe(2);
        expect(
          expectedMarkers[0].classList.contains(
            "floatbar__codex-expected--top",
          ),
        ).toBe(true);
        expect(
          expectedMarkers[1].classList.contains(
            "floatbar__codex-expected--bottom",
          ),
        ).toBe(true);
        const expectedWidths = Array.from(expectedMarkers).map((marker) =>
          parseFloat(
            marker.querySelector<HTMLElement>(
              ".floatbar__codex-expected-fill",
            )?.style.width ?? "",
          ),
        );
        expect(expectedWidths[0]).toBeCloseTo((134 / 300) * 100, 5);
        expect(expectedWidths[1]).toBeCloseTo((80 / 168) * 100, 5);
      });
    } finally {
      dateNow.mockRestore();
    }
  });

  it("collapses Codex to one row when only the weekly limit is active", async () => {
    const now = new Date("2026-07-14T00:00:00Z").getTime();
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      tauriMocks.getCachedProviders.mockResolvedValue([
        snapshot("codex", "Codex", 29, {
          windowMinutes: 10080,
          resetsAt: new Date(now + (4 * 24 + 23) * 60 * 60_000).toISOString(),
          secondary: { used: 0 },
        }),
      ]);
      tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

      const { container } = renderFloatBar(bootstrap());
      await waitFor(() => {
        const card = container.querySelector(".floatbar__codex-card");
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain("71% left");
        expect(card?.textContent).toContain("4d 23h");
        expect(card?.textContent).not.toContain("100% left");
        expect(card?.classList.contains("floatbar__codex-card--single")).toBe(true);
        expect(card?.querySelectorAll(".floatbar__codex-row")).toHaveLength(1);
        expect(card?.querySelectorAll(".floatbar__codex-meter")).toHaveLength(1);
        expect(card?.querySelector(".floatbar__codex-meter--top")).not.toBeNull();
        expect(card?.querySelector(".floatbar__codex-meter--bottom")).toBeNull();
      });
    } finally {
      dateNow.mockRestore();
    }
  });

  it("hides the idle session placeholder and shows only the weekly row", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("codex", "Codex", 0, {
        informational: true,
        resetDescription: "No active 5h session",
        secondary: { used: 0, windowMinutes: 10080 },
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      const card = container.querySelector(".floatbar__codex-card");
      expect(card?.classList.contains("floatbar__codex-card--single")).toBe(true);
      expect(card?.querySelectorAll(".floatbar__codex-row")).toHaveLength(1);
      expect(card?.querySelectorAll(".floatbar__codex-meter")).toHaveLength(1);
      expect(card?.textContent).not.toContain("No active");
    });
  });

  it("keeps Codex meter rows state-neutral near the usage limit", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("codex", "Codex", 95, {
        secondary: { used: 100, exhausted: true },
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      const rows = container.querySelectorAll(".floatbar__codex-row");
      expect(rows.length).toBe(2);
      expect(
        Array.from(rows).every(
          (row) =>
            !row.classList.contains("floatbar__codex-row--warn") &&
            !row.classList.contains("floatbar__codex-row--crit"),
        ),
      ).toBe(true);
    });
  });

  it("aligns Codex meter heights to physical pixels", async () => {
    const previousDpr = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1.25,
    });
    try {
      tauriMocks.getCachedProviders.mockResolvedValue([
        snapshot("codex", "Codex", 31),
      ]);
      tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

      const { container } = renderFloatBar(bootstrap());
      await waitFor(() => {
        const bar = container.querySelector<HTMLElement>(".floatbar");
        expect(bar?.style.getPropertyValue("--codex-meter-height")).toBe("4px");
        expect(bar?.style.getPropertyValue("--codex-expected-height")).toBe("4px");
      });
    } finally {
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        value: previousDpr,
      });
    }
  });

  it("does not expose native hover tooltips on pills or quota cards", async () => {
    const resetsAt = new Date(Date.now() + 3 * 60 * 60_000 + 42 * 60_000).toISOString();
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("claude", "Claude", 20, { resetsAt }),
      snapshot("codex", "Codex", 40),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());

    await waitFor(() => {
      const entries = container.querySelectorAll(
        ".floatbar__pill, .floatbar__codex-card",
      );
      expect(entries.length).toBe(2);
      entries.forEach((entry) => {
        expect(entry.hasAttribute("title")).toBe(false);
      });
    });
  });


  it("renders a pill per enabled provider, sorted by usage descending", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 20),
      snapshot("cursor", "Cursor", 75),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ floatBarShowCost: true }),
    );

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      const pills = container.querySelectorAll(".floatbar__pill");
      expect(pills.length).toBe(2);
    });

    const titles = Array.from(container.querySelectorAll(".floatbar__pill")).map(
      (el) => el.getAttribute("aria-label") ?? "",
    );
    // Highest used (codex, 75%) shows first; display follows showAsUsed.
    expect(titles[0]).toMatch(/Cursor: 75% used/);
    expect(titles[1]).toMatch(/Gemini: 20% used/);
  });

  it("uses the selected session window when a weekly window is available", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 20, { secondary: { used: 90 } }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ providerMetrics: { claude: "session" } }),
    );

    const { container } = renderFloatBar(
      bootstrap({ providerMetrics: { claude: "session" } }),
    );
    await waitFor(() => {
      expect(container.querySelector(".floatbar__pill")?.getAttribute("aria-label")).toContain(
        "Gemini: 20% used",
      );
    });
  });

  it("uses the selected weekly window in the floating bar", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("cursor", "Cursor", 0, {
        informational: true,
        secondary: { used: 37 },
        selected: { used: 37 },
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ providerMetrics: { codex: "weekly" } }),
    );

    const { container } = renderFloatBar(
      bootstrap({ providerMetrics: { codex: "weekly" } }),
    );
    await waitFor(() => {
      expect(container.querySelector(".floatbar__pill")?.getAttribute("aria-label")).toContain(
        "Cursor: 37% used",
      );
    });
  });

  it("uses a real secondary window when the primary window is informational", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 10, {
        informational: true,
        secondary: {
          used: 80,
          resetsAt: null,
          resetDescription: "Resets in 2 hours",
        },
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ floatBarShowResetInline: true }),
    );

    const { container } = renderFloatBar(bootstrap({ floatBarShowResetInline: true }));
    await waitFor(() => {
      const pill = container.querySelector(".floatbar__pill");
      expect(pill?.getAttribute("aria-label")).toContain("Gemini: 80% used\nResets in 2h");
      expect(pill?.classList.contains("floatbar__pill--warn")).toBe(true);
      expect(container.querySelector(".floatbar__reset")?.textContent).toContain("2h");
    });
  });

  it("never shows a detail-backed description as reset text", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 13, {
        resetDescription: "34.07 EUR / 255.00 EUR · 220.93 EUR remaining",
        descriptionIsDetail: true,
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ floatBarShowResetInline: true }),
    );

    const { container } = renderFloatBar(bootstrap({ floatBarShowResetInline: true }));
    await waitFor(() => {
      const pill = container.querySelector(".floatbar__pill");
      expect(pill?.getAttribute("aria-label")).toBe(
        "Gemini: 13% used\n34.07 EUR / 255.00 EUR · 220.93 EUR remaining",
      );
      expect(container.querySelector(".floatbar__reset")).toBeNull();
    });
  });

  it("keeps an informational primary window when no secondary window is available", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 0, {
        informational: true,
        resetDescription: "No active 5h session",
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      expect(container.querySelector(".floatbar__pill")?.getAttribute("aria-label")).toBe(
        "Gemini: No active 5h session",
      );
    });
  });

  it("keeps an informational primary window when the secondary window is informational", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 0, {
        informational: true,
        resetDescription: "No active 5h session",
        secondary: { used: 90, informational: true, resetDescription: "Weekly unavailable" },
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      expect(container.querySelector(".floatbar__pill")?.getAttribute("aria-label")).toBe(
        "Gemini: No active 5h session",
      );
    });
  });

  it("shows an informational metric's text instead of a percentage or reset wording", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("litellm", "LiteLLM", 0, {
        informational: true,
        resetDescription: "No budget set",
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ enabledProviders: ["litellm"], floatBarShowResetInline: true }),
    );

    const { container } = renderFloatBar(
      bootstrap({ enabledProviders: ["litellm"], floatBarShowResetInline: true }),
    );
    await waitFor(() => {
      expect(container.querySelector(".floatbar__pill")).not.toBeNull();
    });
    const pill = container.querySelector(".floatbar__pill");
    expect(pill?.getAttribute("aria-label")).toBe("LiteLLM: No budget set");
    expect(pill?.querySelector(".floatbar__pct")?.textContent).toBe("No budget set");
    expect(pill?.textContent).not.toMatch(/%|Resets/);
    expect(pill?.querySelector(".floatbar__reset")).toBeNull();
    expect(pill?.classList.contains("floatbar__pill--ok")).toBe(true);
  });

  it("keeps the neutral tone for an informational metric in remaining mode", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("cursor", "Cursor", 100, {
        informational: true,
        resetDescription: "$12.40 API-rate",
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ enabledProviders: ["cursor"], showAsUsed: false }),
    );

    const { container } = renderFloatBar(
      bootstrap({ enabledProviders: ["cursor"], showAsUsed: false }),
    );
    await waitFor(() => {
      expect(container.querySelector(".floatbar__pill")).not.toBeNull();
    });
    const pill = container.querySelector(".floatbar__pill");
    expect(pill?.getAttribute("aria-label")).toBe("Cursor: $12.40 API-rate");
    expect(pill?.classList.contains("floatbar__pill--ok")).toBe(true);
  });

  it("uses an em dash for an informational metric without text and keeps a timestamp reset", async () => {
    const resetsAt = new Date(Date.now() + (2 * 60 + 5) * 60_000).toISOString();
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 0, { informational: true, resetsAt }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      expect(container.querySelector(".floatbar__pill")?.getAttribute("aria-label")).toMatch(
        /^Gemini: —\nResets in 2h \d+m$/,
      );
    });
    expect(container.querySelector(".floatbar__pct")?.textContent).toBe("—");
  });

  it("sorts providers by their selected rate window", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 90, {
        secondary: { used: 20 },
        selected: { used: 20 },
      }),
      snapshot("cursor", "Cursor", 50),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ providerMetrics: { claude: "weekly" } }),
    );

    const { container } = renderFloatBar(
      bootstrap({ providerMetrics: { claude: "weekly" } }),
    );
    await waitFor(() => {
      const titles = Array.from(container.querySelectorAll(".floatbar__pill")).map(
        (pill) => pill.getAttribute("aria-label"),
      );
      expect(titles).toEqual(["Cursor: 50% used", "Gemini: 20% used"]);
    });
  });

  it("loads local cost summaries without using the foreground chart endpoint", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("cursor", "Cursor", 75),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());
    tauriMocks.getProviderLocalUsageSummary.mockResolvedValue({
      todayCost: 1.25,
      thirtyDayCost: 12.5,
      thirtyDayTokens: 1000,
      periodCost: 12.5,
      periodTokens: 1000,
      reportingPeriod: "rolling:30",
      latestTokens: 200,
      topModel: "gpt-5",
      estimateNote: "Estimated from local logs",
      tokenCostUpdatedAtMs: 1234,
    });

    renderFloatBar(bootstrap({ floatBarShowCost: true }));

    await waitFor(() => {
      expect(tauriMocks.getProviderLocalUsageSummary).toHaveBeenCalledWith("cursor");
    });
    expect(tauriMocks.getProviderChartData).not.toHaveBeenCalled();
  });

  it("marks displayed local cost as an estimate", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([snapshot("cursor", "Cursor", 75)]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings({ floatBarShowCost: true }));
    tauriMocks.getProviderLocalUsageSummary.mockResolvedValue({
      todayCost: 1.25,
      thirtyDayCost: 12.5,
      thirtyDayTokens: 1000,
      periodCost: 12.5,
      periodTokens: 1000,
      reportingPeriod: "rolling:30",
      latestTokens: 200,
      topModel: "gpt-5",
      estimateNote: "Estimated from local logs",
      tokenCostUpdatedAtMs: 1234,
    });

    const { container } = renderFloatBar(bootstrap({ floatBarShowCost: true }));

    await waitFor(() => {
      expect(container.querySelector(".floatbar__cost-estimate")?.textContent).toBe(
        "Estimate",
      );
    });
    expect(container.querySelector(".floatbar__cost-pill")?.getAttribute("aria-label")).toContain(
      "(Estimate)",
    );
  });

  it("shows the selected History window cost with its short label", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([snapshot("codex", "Codex", 75)]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ floatBarShowCost: true, costReportingPeriod: "month-to-date" }),
    );
    tauriMocks.getProviderLocalUsageSummary.mockResolvedValue({
      todayCost: 1.25,
      // Fixed 30-day compat field stays different from the selected window.
      thirtyDayCost: 12.5,
      thirtyDayTokens: 1000,
      periodCost: 4.75,
      periodTokens: 300,
      reportingPeriod: "month-to-date",
      latestTokens: 200,
      topModel: "gpt-5",
      estimateNote: "Estimated from local logs",
      tokenCostUpdatedAtMs: 1234,
    });

    const { container } = renderFloatBar(
      bootstrap({ floatBarShowCost: true, costReportingPeriod: "month-to-date" }),
    );

    await waitFor(() => {
      const items = Array.from(container.querySelectorAll(".floatbar__cost-item")).map(
        (item) => item.textContent,
      );
      expect(items).toEqual(["Today$1.25", "MTD$4.75"]);
    });
    expect(container.textContent).not.toContain("$12.50");
  });

  it("does not scan local costs by default", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("cursor", "Cursor", 75),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    renderFloatBar(bootstrap());

    await waitFor(() => {
      expect(tauriMocks.getCachedProviders).toHaveBeenCalled();
    });
    expect(tauriMocks.getProviderLocalUsageSummary).not.toHaveBeenCalled();
    expect(document.querySelector(".floatbar__cost-pill")).toBeNull();
  });

  it("uses a safe state label instead of a raw provider error", async () => {
    const raw = "legacy telemetry failed for https://private.example.test; cookie=super-secret";
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 12, { error: raw, errorState: "unknown" }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings({ enabledProviders: ["gemini"] }));

    const { container } = renderFloatBar(bootstrap({ enabledProviders: ["gemini"] }));

    await waitFor(() => {
      const pill = container.querySelector(".floatbar__pill");
      expect(pill?.textContent).toContain("!");
      expect(pill?.querySelector(".floatbar__pct")?.getAttribute("aria-label")).toBe("Usage unavailable");
      expect(pill?.getAttribute("aria-label")).toBe("Gemini: Usage unavailable");
      expect(pill?.textContent).not.toContain("super-secret");
      expect(pill?.getAttribute("aria-label")).not.toContain("private.example.test");
    });
  });

  it("renders the sign-in label when the backend classifies needsAuthentication", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("copilot", "GitHub Copilot", 12, {
        error: "GitHub Copilot token not found. Sign in with GitHub.",
        errorState: "needsAuthentication",
      }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings({ enabledProviders: ["copilot"] }));

    const { container } = renderFloatBar(bootstrap({ enabledProviders: ["copilot"] }));

    await waitFor(() => {
      const pill = container.querySelector(".floatbar__pill");
      expect(pill?.textContent).toContain("!");
      expect(pill?.querySelector(".floatbar__pct")?.getAttribute("aria-label")).toBe("Sign-in required");
      expect(pill?.textContent).not.toContain("12%");
      expect(pill?.getAttribute("aria-label")).toBe("GitHub Copilot: Sign-in required");
    });
  });

  it("can show remaining percentages when configured", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 20),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings({ showAsUsed: false }));

    const { container } = renderFloatBar(bootstrap({ showAsUsed: false }));

    await waitFor(() => {
      const title = container
        .querySelector(".floatbar__pill")
        ?.getAttribute("aria-label");
      expect(title).toContain("Gemini: 80% remaining");
    });
  });

  it("preserves the previous percentage space when a session expires", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([snapshot("gemini", "Gemini", 100)]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings({ enabledProviders: ["gemini"] }));
    const { container } = renderFloatBar(bootstrap({ enabledProviders: ["gemini"] }));
    await waitFor(() => expect(container.querySelector(".floatbar__pct")?.textContent).toBe("100%"));
    const updated = eventMocks.listen.mock.calls.find(([name]) => name === "provider-updated")?.[1];
    await act(async () => {
      updated({ payload: snapshot("gemini", "Gemini", 0, { errorState: "expiredSession", error: "expired" }) });
    });
    await waitFor(() => {
      const pct = container.querySelector(".floatbar__pct");
      const placeholder = pct?.querySelector<HTMLElement>("span[aria-hidden]");
      expect(placeholder?.textContent).toBe("100%");
      expect(placeholder?.style.visibility).toBe("hidden");
      expect(pct?.getAttribute("aria-label")).toBe("Session expired");
      expect(pct?.querySelector(".floatbar__warning")?.textContent).toBe("!");
    });
  });

  it("keeps a percentage-sized placeholder after informational text", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 0, { informational: true, resetDescription: "Unlimited plan" }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings({ enabledProviders: ["gemini"] }));
    const { container } = renderFloatBar(bootstrap({ enabledProviders: ["gemini"] }));
    await waitFor(() => expect(container.querySelector(".floatbar__pct")?.textContent).toBe("Unlimited plan"));
    const updated = eventMocks.listen.mock.calls.find(([name]) => name === "provider-updated")?.[1];
    await act(async () => {
      updated({ payload: snapshot("gemini", "Gemini", 0, { errorState: "expiredSession", error: "expired" }) });
    });
    await waitFor(() => {
      const pct = container.querySelector(".floatbar__pct");
      expect(pct?.getAttribute("aria-label")).toBe("Session expired");
      expect(pct?.querySelector<HTMLElement>("span[aria-hidden]")?.textContent).toBe("0%");
    });
  });

  it("applies warning tone when remaining drops below the high threshold", async () => {
    // highUsageThreshold = 70 → high-remaining cutoff = 30%.
    // claude at 80% used → 20% remaining → critical (also below crit cutoff 10).
    // Use 75% used → 25% remaining → warn (between 10 and 30).
    tauriMocks.getCachedProviders.mockResolvedValue([snapshot("gemini", "Gemini", 75)]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      expect(container.querySelector(".floatbar__pill--warn")).not.toBeNull();
    });
  });

  it("applies critical tone when the provider is exhausted", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 100, { exhausted: true }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      expect(container.querySelector(".floatbar__pill--crit")).not.toBeNull();
    });
  });

  it("filters to the floatBarProviderIds allowlist when non-empty", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 30),
      snapshot("cursor", "Cursor", 50),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ floatBarProviderIds: ["cursor"] }),
    );

    const { container } = renderFloatBar(
      bootstrap({ floatBarProviderIds: ["cursor"] }),
    );
    await waitFor(() => {
      const pills = container.querySelectorAll(".floatbar__pill");
      expect(pills.length).toBe(1);
      expect(pills[0].getAttribute("aria-label")).toMatch(/Cursor/);
    });
  });

  it("does not show stale cached providers when all providers are disabled", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 30),
      snapshot("cursor", "Cursor", 50),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ enabledProviders: [] }),
    );

    const { container } = renderFloatBar(bootstrap({ enabledProviders: [] }));
    await waitFor(() => {
      expect(container.querySelectorAll(".floatbar__pill").length).toBe(0);
      expect(container.querySelector(".floatbar__empty")).not.toBeNull();
    });
  });

  it("shows an empty state when no providers match", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());
    await waitFor(() => {
      expect(container.querySelector(".floatbar__empty")).not.toBeNull();
    });
  });

  it("applies the light-background class and CSS opacity", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ floatBarDarkText: true, floatBarOpacity: 45 }),
    );

    const { container } = renderFloatBar(
      bootstrap({ floatBarDarkText: true, floatBarOpacity: 45 }),
    );

    await waitFor(() => {
      const bar = container.querySelector<HTMLElement>(".floatbar");
      expect(bar).not.toBeNull();
      expect(bar?.classList.contains("floatbar--light-bg")).toBe(true);
      expect(bar?.style.opacity).toBe("0.45");
    });
  });

  it("applies the configured scale as a CSS variable", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings({ floatBarScale: 150 }));

    const { container } = renderFloatBar(bootstrap({ floatBarScale: 150 }));

    await waitFor(() => {
      const bar = container.querySelector<HTMLElement>(".floatbar");
      expect(bar).not.toBeNull();
      expect(bar?.style.getPropertyValue("--floatbar-scale")).toBe("1.5");
    });
  });

  it("resizes the native window in physical pixels at the WebView DPI", async () => {
    tauriMocks.getCachedProviders.mockResolvedValue([]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());
    const originalDevicePixelRatio = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1.5,
    });
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        top: 0,
        right: 100,
        bottom: 20,
        left: 0,
        toJSON: () => ({}),
      });

    try {
      renderFloatBar(bootstrap());

      await waitFor(() => {
        expect(coreMocks.invoke).toHaveBeenCalledWith("resize_float_bar", {
          width: 162,
          height: 42,
        });
      });
    } finally {
      rectSpy.mockRestore();
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        value: originalDevicePixelRatio,
      });
    }
  });

  it("uses the localized reset formatter in pill tooltips", async () => {
    const resetsAt = new Date(Date.now() + 3 * 60 * 60_000 + 42 * 60_000).toISOString();
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 20, { resetsAt }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());

    const { container } = renderFloatBar(bootstrap());

    await waitFor(() => {
      const title = container
        .querySelector(".floatbar__pill")
        ?.getAttribute("aria-label");
      expect(title).toContain("Gemini: 20% used");
      expect(title).toMatch(/Resets in 3h 4[12]m/);
      expect(title).not.toContain("Resets in due now");
    });
  });

  it("can render a next reset icon and time in provider pills", async () => {
    const resetsAt = new Date(Date.now() + 2 * 60 * 60_000 + 5 * 60_000).toISOString();
    tauriMocks.getCachedProviders.mockResolvedValue([
      snapshot("gemini", "Gemini", 20, { resetsAt }),
    ]);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(
      settings({ floatBarShowResetInline: true }),
    );

    const { container } = renderFloatBar(
      bootstrap({ floatBarShowResetInline: true }),
    );

    await waitFor(() => {
      const reset = container.querySelector(".floatbar__reset");
      expect(reset).not.toBeNull();
      expect(reset?.getAttribute("aria-label")).toMatch(/Resets in 2h [45]m/);
      expect(reset?.textContent).toMatch(/2h [45]m/);
      expect(reset?.textContent).not.toContain("Resets in");
    });
  });

  it("compacts localized reset text from the timestamp", async () => {
    const now = Date.parse("2024-06-01T00:00:00Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const fullResetText = "4 小时 59 分钟后重置";
      tauriMocks.getLocaleStrings.mockResolvedValue(
        buildBundle(
          {
            ResetsInHoursMinutes: "{} 小时 {} 分钟后重置",
            TrayResetsDueNow: "现在重置",
          },
          "chinese",
        ),
      );
      tauriMocks.getCachedProviders.mockResolvedValue([
        snapshot("gemini", "Gemini", 20, {
          resetsAt: "2024-06-01T04:59:00Z",
        }),
      ]);
      tauriMocks.getSettingsSnapshot.mockResolvedValue(
        settings({ floatBarShowResetInline: true }),
      );

      const { container } = renderFloatBar(
        bootstrap({ floatBarShowResetInline: true }),
      );

      await waitFor(() => {
        const reset = container.querySelector(".floatbar__reset");
        expect(reset?.querySelector(".floatbar__reset-time")).toHaveTextContent(
          "4h 59m",
        );
        expect(container.querySelector(".floatbar__pill")?.getAttribute("aria-label")).toContain(
          fullResetText,
        );
        expect(reset?.getAttribute("aria-label")).toBe(fullResetText);
        expect(reset?.getAttribute("aria-label")).toBe(fullResetText);
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("compacts localized due-now reset text to now", async () => {
    const now = Date.parse("2024-06-01T00:00:00Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const fullResetText = "重置时间已到";
      tauriMocks.getLocaleStrings.mockResolvedValue(
        buildBundle(
          {
            TrayResetsDueNow: fullResetText,
          },
          "chinese",
        ),
      );
      tauriMocks.getCachedProviders.mockResolvedValue([
        snapshot("gemini", "Gemini", 20, {
          resetsAt: "2024-05-31T23:59:00Z",
        }),
      ]);
      tauriMocks.getSettingsSnapshot.mockResolvedValue(
        settings({ floatBarShowResetInline: true }),
      );

      const { container } = renderFloatBar(
        bootstrap({ floatBarShowResetInline: true }),
      );

      await waitFor(() => {
        const reset = container.querySelector(".floatbar__reset");
        expect(reset?.querySelector(".floatbar__reset-time")).toHaveTextContent(
          "now",
        );
        expect(container.querySelector(".floatbar__pill")?.getAttribute("aria-label")).toContain(
          fullResetText,
        );
        expect(reset?.getAttribute("aria-label")).toBe(fullResetText);
        expect(reset?.getAttribute("aria-label")).toBe(fullResetText);
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("keeps a future sub-minute reset out of the now state", async () => {
    const now = Date.parse("2024-06-01T00:00:00Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      tauriMocks.getLocaleStrings.mockResolvedValue(buildBundle({}, "chinese"));
      tauriMocks.getCachedProviders.mockResolvedValue([
        snapshot("gemini", "Gemini", 20, {
          resetsAt: "2024-06-01T00:00:30Z",
        }),
      ]);
      tauriMocks.getSettingsSnapshot.mockResolvedValue(
        settings({ floatBarShowResetInline: true }),
      );

      const { container } = renderFloatBar(
        bootstrap({ floatBarShowResetInline: true }),
      );

      await waitFor(() => {
        expect(container.querySelector(".floatbar__reset-time")).toHaveTextContent(
          "1m",
        );
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("compacts localized day and hour reset text", async () => {
    const now = Date.parse("2024-06-01T00:00:00Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const fullResetText = "1 天 2 小时后重置";
      tauriMocks.getLocaleStrings.mockResolvedValue(
        buildBundle(
          {
            ResetsInDaysHours: "{} 天 {} 小时后重置",
          },
          "chinese",
        ),
      );
      tauriMocks.getCachedProviders.mockResolvedValue([
        snapshot("gemini", "Gemini", 20, {
          resetsAt: "2024-06-02T02:07:00Z",
        }),
      ]);
      tauriMocks.getSettingsSnapshot.mockResolvedValue(
        settings({ floatBarShowResetInline: true }),
      );

      const { container } = renderFloatBar(
        bootstrap({ floatBarShowResetInline: true }),
      );

      await waitFor(() => {
        const reset = container.querySelector(".floatbar__reset");
        expect(reset?.querySelector(".floatbar__reset-time")).toHaveTextContent(
          "1d 2h",
        );
        expect(container.querySelector(".floatbar__pill")?.getAttribute("aria-label")).toContain(
          fullResetText,
        );
        expect(reset?.getAttribute("aria-label")).toBe(fullResetText);
        expect(reset?.getAttribute("aria-label")).toBe(fullResetText);
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("polls refreshProvidersIfStale on the configured interval", async () => {
    vi.useFakeTimers();
    try {
      tauriMocks.getCachedProviders.mockResolvedValue([]);
      tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());
      // 60s minimum is enforced in FloatBar.tsx; use the floor here.
      await act(async () => {
        renderFloatBar(bootstrap({ refreshIntervalSecs: 60 }));
      });

      // Initial tick fires synchronously on mount; useProviders is passive here
      // so the floatbar does not double-request stale refreshes at startup.
      await vi.waitFor(() => {
        expect(tauriMocks.refreshProvidersIfStale).toHaveBeenCalledTimes(1);
      });
      const initialCalls = tauriMocks.refreshProvidersIfStale.mock.calls.length;

      // Advance the timer past the 60-second interval — the floatbar tick
      // should fire again.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(tauriMocks.refreshProvidersIfStale.mock.calls.length).toBeGreaterThan(
        initialCalls,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
