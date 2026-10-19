export const DAILY_GOAL_KEY = "dailyGoal";
export const DAILY_GOAL_PROGRESS_KEY = "dailyGoalProgress";
export const DEFAULT_DAILY_GOAL = 10;
export const MIN_DAILY_GOAL = 1;
export const MAX_DAILY_GOAL = 50;

export interface DailyGoalProgress {
  date: string;
  completed: number;
}

export interface DailyGoalSettings extends DailyGoalProgress {
  goal: number;
}

export type DailyGoalStorage = Pick<chrome.storage.StorageArea, "get" | "set">;

interface StoredDailyGoal {
  [DAILY_GOAL_KEY]?: unknown;
  [DAILY_GOAL_PROGRESS_KEY]?: unknown;
}

function isGoal(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= MIN_DAILY_GOAL &&
    value <= MAX_DAILY_GOAL
  );
}

function localDateKey(now: number): string {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid current date.");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readProgress(value: unknown, date: string): DailyGoalProgress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { date, completed: 0 };
  }
  const progress = value as Partial<DailyGoalProgress>;
  if (
    progress.date !== date ||
    typeof progress.completed !== "number" ||
    !Number.isSafeInteger(progress.completed) ||
    progress.completed < 0
  ) {
    return { date, completed: 0 };
  }
  return { date, completed: progress.completed };
}

export async function getDailyGoalSettings(
  storage: DailyGoalStorage = chrome.storage.local,
  now = Date.now(),
): Promise<DailyGoalSettings> {
  const date = localDateKey(now);
  const stored = await storage.get<StoredDailyGoal>({
    [DAILY_GOAL_KEY]: DEFAULT_DAILY_GOAL,
    [DAILY_GOAL_PROGRESS_KEY]: { date, completed: 0 },
  });
  const progress = readProgress(stored[DAILY_GOAL_PROGRESS_KEY], date);
  return {
    goal: isGoal(stored[DAILY_GOAL_KEY]) ? stored[DAILY_GOAL_KEY] : DEFAULT_DAILY_GOAL,
    ...progress,
  };
}

export async function getDailyGoalProgress(
  storage: DailyGoalStorage = chrome.storage.local,
  now = Date.now(),
): Promise<DailyGoalProgress> {
  const { date, completed } = await getDailyGoalSettings(storage, now);
  return { date, completed };
}

export async function setDailyGoal(
  goal: number,
  storage: DailyGoalStorage = chrome.storage.local,
): Promise<void> {
  if (!isGoal(goal)) {
    return Promise.reject(new RangeError(`Daily goal must be an integer between ${MIN_DAILY_GOAL} and ${MAX_DAILY_GOAL}.`));
  }
  await storage.set({ [DAILY_GOAL_KEY]: goal });
}

/** Returns the next progress value so review schedule and goal count can share one storage write. */
export async function getProgressAfterReview(
  storage: DailyGoalStorage,
  now: number,
): Promise<DailyGoalProgress> {
  const date = localDateKey(now);
  const stored = await storage.get<StoredDailyGoal>({
    [DAILY_GOAL_PROGRESS_KEY]: { date, completed: 0 },
  });
  const progress = readProgress(stored[DAILY_GOAL_PROGRESS_KEY], date);
  return { date, completed: progress.completed + 1 };
}
