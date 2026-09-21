import { getPack } from "@/data/quizzes";
import { DEFAULT_PLAYLIST_ID, QUESTION_SECONDS } from "@/lib/constants";
import { getPlayQuestions } from "@/lib/levels/resolve";
import {
  findLevelForQuestion,
  listTinyLevels,
  resolvePlayLevels,
} from "@/lib/packs/levels";
import { assertNoQuizSecrets, toPublicLevel, toPublicQuestion } from "@/lib/public-quiz";
import { winnerIds } from "./engine";
import { getStore } from "./store";
import type { RoomSnapshot, RoomState } from "./types";

export function toSnapshot(state: RoomState, playerId?: string): RoomSnapshot {
  const pack = getPack(state.room.quizId);
  const playlistId = state.room.playlistId ?? DEFAULT_PLAYLIST_ID;
  const levelId = state.room.levelId ?? null;
  const questions = getPlayQuestions(
    state.room.quizId,
    state.room.variant,
    playlistId,
    levelId,
  );
  const realIndex = state.room.questionOrder[state.room.currentQuestionIndex];
  const current =
    state.room.status === "playing" ? questions[realIndex] : undefined;
  const currentId = current?.id;
  const yourAnswer =
    playerId && currentId
      ? (state.answers.find((a) => a.playerId === playerId && a.questionId === currentId)
          ?.choice ?? null)
      : null;
  const playLevels = resolvePlayLevels(state.room.quizId, playlistId, levelId);
  const currentLevel = currentId
    ? findLevelForQuestion(playLevels, state.room.variant, currentId)
    : playLevels[0];

  const snapshot: RoomSnapshot = {
    store: getStore().kind,
    room: {
      code: state.room.code,
      status: state.room.status,
      quizId: state.room.quizId,
      quizTitle: pack?.title ?? state.room.quizId,
      language: pack?.language ?? "pl",
      variant: state.room.variant,
      hostId: state.room.hostId,
      currentQuestionIndex: state.room.currentQuestionIndex,
      questionEndsAt: state.room.questionEndsAt,
      questionCount: questions.length,
      questionSeconds: QUESTION_SECONDS,
      playlistId,
      levelId,
      currentLevelId: currentLevel?.id ?? null,
    },
    levels: listTinyLevels(state.room.quizId).map((level) =>
      toPublicLevel(level, state.room.variant),
    ),
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      isHost: player.id === state.room.hostId,
      answeredCurrent: Boolean(
        currentId &&
          state.answers.some(
            (a) => a.playerId === player.id && a.questionId === currentId,
          ),
      ),
    })),
    currentQuestion: current ? toPublicQuestion(current) : null,
    yourAnswer,
    winnerIds: winnerIds(state),
  };
  assertNoQuizSecrets(snapshot.currentQuestion, "currentQuestion");
  assertNoQuizSecrets(snapshot.levels, "levels");
  return snapshot;
}
