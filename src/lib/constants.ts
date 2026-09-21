export const QUESTION_SECONDS = 25;
export const QUESTION_MS = QUESTION_SECONDS * 1000;
export const MAX_PLAYERS = 2;
export const ROOM_CODE_LENGTH = 4;
export const ANSWER_GRACE_MS = 750;
export const POLL_MS = 450;
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
export const SESSION_STORAGE_KEY = "quizrival-session";
export const ALL_ANSWERED_HOLD_MS = 1200;
/** Create-room default stays the 8-question mega-level. Path nodes use `tiny` + `levelId`. */
export const DEFAULT_PLAYLIST_ID = "full" as const;
export const PATH_PROGRESS_KEY = "quizrival-path-progress";
export const HOMEWORK_NOTES_KEY = "quizrival-homework-notes";
export const TONIGHT_PACK_KEY = "quizrival-tonight-pack";
