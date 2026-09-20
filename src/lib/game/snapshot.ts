import { getPack, getQuestions } from "@/data/quizzes";
import { QUESTION_SECONDS } from "@/lib/constants";
import { toPublicQuestion } from "@/lib/public-quiz";
import { winnerIds } from "./engine";
import { getStore } from "./store";
import type { RoomSnapshot, RoomState } from "./types";

export function toSnapshot(state: RoomState, playerId?: string): RoomSnapshot {
  const pack = getPack(state.room.quizId);
  const questions = getQuestions(state.room.quizId, state.room.variant) ?? [];
  const realIndex = state.room.questionOrder[state.room.currentQuestionIndex];
  const current =
    state.room.status === "playing" ? questions[realIndex] : undefined;
  const currentId = current?.id;
  const yourAnswer =
    playerId && currentId
      ? (state.answers.find((a) => a.playerId === playerId && a.questionId === currentId)
          ?.choice ?? null)
      : null;

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
    },
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
