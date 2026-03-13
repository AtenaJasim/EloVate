import { Chess } from "chess.js";

export function parseInfoLine(line) {
    if (!line.startsWith("info") || !line.includes(" pv ")) return null;

    const pvIndex = line.indexOf(" pv ");
    const header = line.slice(0, pvIndex);
    const pv = line
        .slice(pvIndex + 4)
        .trim()
        .split(" ")
        .filter(Boolean);

    const depthMatch = header.match(/ depth (\d+)/);
    const multipvMatch = header.match(/ multipv (\d+)/);
    const cpMatch = header.match(/ score cp (-?\d+)/);
    const mateMatch = header.match(/ score mate (-?\d+)/);

    const isLowerBound = /\blowerbound\b/.test(header);
    const isUpperBound = /\bupperbound\b/.test(header);

    return {
        depth: depthMatch ? Number(depthMatch[1]) : 0,
        multipv: multipvMatch ? Number(multipvMatch[1]) : 1,
        scoreType: mateMatch ? "mate" : "cp",
        score: mateMatch ? Number(mateMatch[1]) : cpMatch ? Number(cpMatch[1]) : 0,
        isBounded: isLowerBound || isUpperBound,
        pv,
    };
}

export function uciToMoveObject(uciMove) {
    if (!uciMove || uciMove.length < 4) return null;

    const move = {
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
    };

    if (uciMove.length > 4) {
        move.promotion = uciMove[4];
    }

    return move;
}

export function uciToSan(fen, uciMove) {
    if (!uciMove) return "...";

    const tempGame = new Chess(fen);
    const moveObject = uciToMoveObject(uciMove);

    if (!moveObject) return uciMove;

    const result = tempGame.move(moveObject);
    return result ? result.san : uciMove;
}

export function normalizeEngineScore(scoreType, score) {
    if (scoreType === "mate") {
        const direction = score > 0 ? 1 : -1;
        return direction * (1_000_000 - Math.abs(score) * 10);
    }

    return score;
}

export function scoreToWhiteValue(scoreType, score, sideToMove) {
    const rawValue = normalizeEngineScore(scoreType, score);
    return sideToMove === "w" ? rawValue : -rawValue;
}

export function scoreToPlayerValue(scoreType, score, sideToMove, playerColor) {
    const whiteValue = scoreToWhiteValue(scoreType, score, sideToMove);
    return playerColor === "white" ? whiteValue : -whiteValue;
}

export function lineToPlayerValue(line, sideToMove, playerColor) {
    if (!line) return 0;

    return scoreToPlayerValue(line.scoreType, line.score, sideToMove, playerColor);
}

export function formatPawnLoss(cpLoss) {
    const pawns = (Math.max(0, cpLoss) / 100).toFixed(1);
    return `${pawns} pawns`;
}