import { findLevelForQuestion, getPlaylist, listTinyLevels } from "@/data/levels";
import { getPack } from "@/data/quizzes";
import type { PublicLevel } from "@/data/types";
import { DEFAULT_PLAYLIST_ID, QUESTION_SECONDS } from "@/lib/constants";
import { getPlayQuestions } from "@/lib/levels/resolve";
import { toPublicQuestion } from "@/lib/public-quiz";
import { winnerIds } from "./engine";
import { getStore } from "./store";
import type { RoomSnapshot, RoomState } from "./types";

export function toSnapshot(state: RoomState, playerId?: string): RoomSnapshot {
  const pack = getPack(state.room.quizId);
  const playlistId = state.room.playlistId ?? DEFAULT_PLAYLIST_ID;
  const questions = getPlayQuestions(state.room.quizId, state.room.variant, playlistId);
  const realIndex = state.room.questionOrder[state.room.currentQuestionIndex];
  const current =
    state.room.status === "playing" ? questions[realIndex] : undefined;
  const currentId = current?.id;
  const yourAnswer =
    playerId && currentId
      ? (state.answers.find((a) => a.playerId === playerId && a.questionId === currentId)
          ?.choice ?? null)
      : null;
  const playlist = getPlaylist(state.room.quizId, playlistId);
  const currentLevel = currentId
    ? findLevelForQuestion(playlist, state.room.variant, currentId)
    : playlist[0];

  return {
    store: getStore().kind,
    room: {
      code: state.room.code,
      status: state.room.status,
      quizId: state.room.quizId,
      quizTitle: pack?.title ?? state.room.quizId,
      variant: state.room.variant,
      hostId: state.room.hostId,
      currentQuestionIndex: state.room.currentQuestionIndex,
      questionEndsAt: state.room.questionEndsAt,
      questionCount: questions.length,
      questionSeconds: QUESTION_SECONDS,
      playlistId,
      currentLevelId: currentLevel?.id ?? null,
    },
    levels: toPublicLevels(state.room.quizId, state.room.variant, playlistId),
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
}

function toPublicLevels(
  packId: string,
  variant: RoomState["room"]["variant"],
  playlistId: RoomState["room"]["playlistId"],
): PublicLevel[] {
  const active = getPlaylist(packId, playlistId);
  const upcoming = playlistId === "full" ? listTinyLevels(packId) : [];
  const seen = new Set(active.map((level) => level.id));
  return [...active, ...upcoming.filter((level) => !seen.has(level.id))].map((level) => ({
    id: level.id,
    title: level.title,
    theme: level.theme,
    questionCount: level.questionIds[variant]?.length ?? 0,
    mega: level.mega,
  }));
}
