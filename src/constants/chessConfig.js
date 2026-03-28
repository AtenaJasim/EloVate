export const DIFFICULTY_OPTIONS = [
    { label: "Easy", value: "easy", depth: 1, skillLevel: 1 },
    { label: "Medium", value: "medium", depth: 4, skillLevel: 8 },
    { label: "Hard", value: "hard", depth: 8, skillLevel: 15 },
];

export const BOT_SETTINGS_BY_DIFFICULTY = Object.fromEntries(
    DIFFICULTY_OPTIONS.map(({ value, ...settings }) => [value, settings])
);

export const ANALYSIS_DEPTH = 14;
export const ANALYSIS_MULTIPV = 3;

export const PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 0,
};

export const RATING_THRESHOLDS = {
    brilliantGap: 180,
    excellentLoss: 15,
    goodLoss: 45,
    inaccuracyLoss: 90,
    mistakeLoss: 250,
    missMinLoss: 100,
    missMaxLoss: 200,
    strongAdvantage: 120,
    stillPlayableFloor: -120,
};

export const DEFAULT_LAST_PLAYER_MOVE = "...";
export const DEFAULT_MOVE_RATING_LABEL = "No Rating Yet";
export const DEFAULT_MOVE_RATING_DESCRIPTION = "Make a move to get feedback.";
export const DEFAULT_SUGGESTED_BETTER_MOVE = "...";