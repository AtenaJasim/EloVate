import { Chess } from "chess.js";
import { PIECE_VALUES, RATING_THRESHOLDS } from "../constants/chessConfig";
import {
    formatPawnLoss,
    lineToPlayerValue,
    uciToMoveObject,
    uciToSan,
} from "./engineUtils";

function getMaterialTotals(game) {
    const totals = { w: 0, b: 0 };

    for (const row of game.board()) {
        for (const piece of row) {
            if (!piece) continue;
            totals[piece.color] += PIECE_VALUES[piece.type] ?? 0;
        }
    }

    return totals;
}

function getMaterialBalanceForPlayer(game, playerColor) {
    const totals = getMaterialTotals(game);
    return playerColor === "white"
        ? totals.w - totals.b
        : totals.b - totals.w;
}

function getMoveContext(positionBeforeMove, playerUciMove, playerColor) {
    const beforeGame = new Chess(positionBeforeMove);
    const balanceBefore = getMaterialBalanceForPlayer(beforeGame, playerColor);
    const legalMoves = beforeGame.moves({ verbose: true });
    const moveObject = uciToMoveObject(playerUciMove);

    if (!moveObject) {
        return {
            legalMoveCount: legalMoves.length,
            isCapture: false,
            isPromotion: false,
            movedPiece: null,
            isMaterialSacrifice: false,
        };
    }

    const playedMove = beforeGame.move(moveObject);

    if (!playedMove) {
        return {
            legalMoveCount: legalMoves.length,
            isCapture: false,
            isPromotion: false,
            movedPiece: null,
            isMaterialSacrifice: false,
        };
    }

    const balanceAfter = getMaterialBalanceForPlayer(beforeGame, playerColor);
    const isCapture =
        playedMove.flags.includes("c") || playedMove.flags.includes("e");

    return {
        legalMoveCount: legalMoves.length,
        isCapture,
        isPromotion: Boolean(playedMove.promotion),
        movedPiece: playedMove.piece,
        isMaterialSacrifice: balanceAfter < balanceBefore,
    };
}

export function getRatingResult({
    positionBeforeMove,
    playerUciMove,
    preLines,
    preMoveSideToMove,
    bestBeforePlayer,
    afterBestLine,
    afterPlayerValue,
    playerColor,
}) {
    const bestLine = preLines[0] || null;
    const secondLine = preLines[1] || null;

    const bestUciMove = bestLine?.pv?.[0] || null;
    const secondBestPlayer = secondLine
        ? lineToPlayerValue(secondLine, preMoveSideToMove, playerColor)
        : null;

    const evalLoss = Math.max(0, bestBeforePlayer - afterPlayerValue);
    const isBestMove = playerUciMove === bestUciMove;
    const bestLinePlayerValue = bestLine
        ? lineToPlayerValue(bestLine, preMoveSideToMove, playerColor)
        : 0;
    const standoutGap =
        secondBestPlayer !== null ? bestLinePlayerValue - secondBestPlayer : 0;

    const isWinningMateLineForPlayer =
        bestLine?.scoreType === "mate" && bestLinePlayerValue > 0;

    const afterOpponentMate =
        afterBestLine?.scoreType === "mate" && afterPlayerValue < 0;

    const hadStrongChance =
        isWinningMateLineForPlayer ||
        bestBeforePlayer >= RATING_THRESHOLDS.strongAdvantage;

    const stillOkayAfterMove =
        afterPlayerValue >= RATING_THRESHOLDS.stillPlayableFloor;

    const moveContext = getMoveContext(
        positionBeforeMove,
        playerUciMove,
        playerColor
    );

    const isOnlyMove = moveContext.legalMoveCount <= 1;
    const qualifiesAsBrilliant =
        isBestMove &&
        !isWinningMateLineForPlayer &&
        !isOnlyMove &&
        moveContext.isMaterialSacrifice &&
        standoutGap >= RATING_THRESHOLDS.brilliantGap;

    if (afterOpponentMate) {
        return {
            label: "Blunder",
            description: "Blunder. This move allows a forced mate.",
            evalLoss,
            bestUciMove,
        };
    }

    if (isBestMove && isWinningMateLineForPlayer) {
        return {
            label: "Best Move",
            description: "Best Move. You found the forced mating line.",
            evalLoss,
            bestUciMove,
        };
    }

    if (qualifiesAsBrilliant) {
        return {
            label: "Brilliant",
            description:
                "Brilliant. You found the best move and it stands out as a strong sacrifice idea.",
            evalLoss,
            bestUciMove,
        };
    }

    if (isBestMove) {
        return {
            label: "Best Move",
            description: "Best Move. You found the engine's top move here.",
            evalLoss,
            bestUciMove,
        };
    }

    if (isWinningMateLineForPlayer) {
        if (stillOkayAfterMove) {
            return {
                label: "Miss",
                description: "Miss. You missed a forced mating line.",
                evalLoss,
                bestUciMove,
            };
        }

        return {
            label: "Blunder",
            description:
                "Blunder. You missed a forced mating line and gave away the attack.",
            evalLoss,
            bestUciMove,
        };
    }

    if (
        hadStrongChance &&
        evalLoss >= RATING_THRESHOLDS.missMinLoss &&
        evalLoss <= RATING_THRESHOLDS.missMaxLoss &&
        stillOkayAfterMove
    ) {
        return {
            label: "Miss",
            description:
                "Miss. There was a stronger chance here, and this move let some of it slip away.",
            evalLoss,
            bestUciMove,
        };
    }

    if (evalLoss <= RATING_THRESHOLDS.excellentLoss) {
        return {
            label: "Excellent",
            description:
                "Excellent. A very strong move, nearly as good as the best option.",
            evalLoss,
            bestUciMove,
        };
    }

    if (evalLoss <= RATING_THRESHOLDS.goodLoss) {
        return {
            label: "Good",
            description: stillOkayAfterMove
                ? "Good. A solid move, though the engine saw something a little stronger."
                : "Good. The move was reasonable, but the resulting position is difficult.",
            evalLoss,
            bestUciMove,
        };
    }

    if (evalLoss <= RATING_THRESHOLDS.inaccuracyLoss) {
        return {
            label: "Inaccuracy",
            description: `Inaccuracy. This move gave up about ${formatPawnLoss(
                evalLoss
            )} — not a blunder, but there was a better option.`,
            evalLoss,
            bestUciMove,
        };
    }

    if (evalLoss <= RATING_THRESHOLDS.mistakeLoss) {
        return {
            label: "Mistake",
            description: `Mistake. This move gave up about ${formatPawnLoss(
                evalLoss
            )} of value.`,
            evalLoss,
            bestUciMove,
        };
    }

    return {
        label: "Blunder",
        description: `Blunder. This move dropped about ${formatPawnLoss(
            evalLoss
        )} and seriously worsened the position.`,
        evalLoss,
        bestUciMove,
    };
}

export function getSuggestedMoveText({
    positionBeforeMove,
    playerUciMove,
    preLines,
    preMoveSideToMove,
    playerColor,
    ratingLabel,
    evalLoss,
}) {
    const bestLine = preLines[0] || null;
    const bestUciMove = bestLine?.pv?.[0] || null;

    if (!bestUciMove) {
        return "...";
    }

    if (bestUciMove === playerUciMove) {
        const bestLinePlayerValue = lineToPlayerValue(
            bestLine,
            preMoveSideToMove,
            playerColor
        );

        if (bestLine.scoreType === "mate" && bestLinePlayerValue > 0) {
            return "No better move. You found the mating line.";
        }

        return "No better move. You found the engine's top choice.";
    }

    const bestSan = uciToSan(positionBeforeMove, bestUciMove);
    const bestLinePlayerValue = lineToPlayerValue(
        bestLine,
        preMoveSideToMove,
        playerColor
    );

    if (bestLine.scoreType === "mate" && bestLinePlayerValue > 0) {
        return `${bestSan}. The engine preferred this move because it started a forced mate.`;
    }

    if (ratingLabel === "Miss") {
        return `${bestSan}. The engine preferred this move because it kept a much stronger chance in the position.`;
    }

    if (ratingLabel === "Blunder") {
        return `${bestSan}. The engine preferred this move because it avoided a major drop in the position.`;
    }

    if (ratingLabel === "Inaccuracy") {
        return `${bestSan}. The engine preferred this move and it kept your position about ${formatPawnLoss(
            evalLoss
        )} stronger.`;
    }

    return `${bestSan}. The engine preferred this move and it kept your position about ${formatPawnLoss(
        evalLoss
    )} stronger.`;
}