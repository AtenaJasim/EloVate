import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import ChessBoardPanel from "./components/ChessBoardPanel";
import ControlPanel from "./components/ControlPanel";
import AnalysisPanel from "./components/AnalysisPanel";

const BOT_SETTINGS_BY_DIFFICULTY = {
  easy: { depth: 5, skillLevel: 3 },
  medium: { depth: 10, skillLevel: 12 },
  hard: { depth: 18, skillLevel: 20 },
};

const ANALYSIS_DEPTH = 14;
const ANALYSIS_MULTIPV = 3;

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const RATING_THRESHOLDS = {
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

function parseInfoLine(line) {
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

function uciToMoveObject(uciMove) {
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

function uciToSan(fen, uciMove) {
  if (!uciMove) return "...";

  const tempGame = new Chess(fen);
  const moveObject = uciToMoveObject(uciMove);

  if (!moveObject) return uciMove;

  const result = tempGame.move(moveObject);
  return result ? result.san : uciMove;
}

function normalizeEngineScore(scoreType, score) {
  if (scoreType === "mate") {
    const direction = score > 0 ? 1 : -1;
    return direction * (1_000_000 - Math.abs(score) * 10);
  }

  return score;
}

function scoreToWhiteValue(scoreType, score, sideToMove) {
  const rawValue = normalizeEngineScore(scoreType, score);
  return sideToMove === "w" ? rawValue : -rawValue;
}

function scoreToPlayerValue(scoreType, score, sideToMove, playerColor) {
  const whiteValue = scoreToWhiteValue(scoreType, score, sideToMove);
  return playerColor === "white" ? whiteValue : -whiteValue;
}

function lineToPlayerValue(line, sideToMove, playerColor) {
  if (!line) return 0;

  return scoreToPlayerValue(line.scoreType, line.score, sideToMove, playerColor);
}

function formatPawnLoss(cpLoss) {
  const pawns = (Math.max(0, cpLoss) / 100).toFixed(1);
  return `${pawns} pawns`;
}

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

function getRatingResult({
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

function getSuggestedMoveText({
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

export default function App() {
  const [game, setGame] = useState(new Chess());
  const [engineReady, setEngineReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const [lastPlayerMove, setLastPlayerMove] = useState("...");
  const [moveRatingLabel, setMoveRatingLabel] = useState("No Rating Yet");
  const [moveRatingDescription, setMoveRatingDescription] = useState(
    "Make a move to get feedback."
  );
  const [suggestedBetterMove, setSuggestedBetterMove] = useState("...");

  const [difficulty, setDifficulty] = useState("medium");
  const [playerColor, setPlayerColor] = useState("white");
  const difficultyRef = useRef("medium");
  const playerColorRef = useRef("white");

  const [undoStack, setUndoStack] = useState([]);

  const engineRef = useRef(null);
  const gameRef = useRef(game);

  const didInitRef = useRef(false);
  const searchIdRef = useRef(0);

  const playerAnalysisRef = useRef({
    lines: [],
    bestPlayerValue: 0,
    fen: "",
    sideToMove: "w",
  });

  const lastPlayerMoveMetaRef = useRef(null);

  const pendingRef = useRef({
    searchId: 0,
    mode: null,
    fen: "",
    depth: 0,
    multiPv: 1,
    linesByPv: {},
    latestDepth: 0,
  });

  const cancelBarrierRef = useRef({
    active: false,
    nextAction: null,
  });

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  function getBotSettings() {
    return BOT_SETTINGS_BY_DIFFICULTY[difficultyRef.current] ?? BOT_SETTINGS_BY_DIFFICULTY.medium;
  }

  function getSearchConfig(mode) {
    if (mode === "computer-move") {
      const { depth } = getBotSettings();
      return { depth, multiPv: 1 };
    }
    if (mode === "rate-player-move") {
      return { depth: ANALYSIS_DEPTH, multiPv: 1 };
    }
    return { depth: ANALYSIS_DEPTH, multiPv: ANALYSIS_MULTIPV };
  }

  function startEngineSearch({ fen, mode, depth, multiPv }) {
    if (!engineRef.current) return;

    const searchId = ++searchIdRef.current;

    pendingRef.current = {
      searchId,
      mode,
      fen,
      depth,
      multiPv,
      linesByPv: {},
      latestDepth: 0,
    };

    // Apply skill level: reduced for computer-move, full strength for analysis
    const skillLevel =
      mode === "computer-move" ? getBotSettings().skillLevel : 20;

    setIsThinking(true);
    engineRef.current.postMessage(`setoption name Skill Level value ${skillLevel}`);
    engineRef.current.postMessage(`setoption name MultiPV value ${multiPv}`);
    engineRef.current.postMessage(`position fen ${fen}`);
    engineRef.current.postMessage(`go depth ${depth}`);
  }

  function cancelCurrentSearchAndRun(nextAction) {
    if (!engineRef.current) return;

    if (!pendingRef.current.mode && !cancelBarrierRef.current.active) {
      nextAction();
      return;
    }

    cancelBarrierRef.current = {
      active: true,
      nextAction,
    };

    pendingRef.current = {
      searchId: pendingRef.current.searchId,
      mode: null,
      fen: "",
      depth: 0,
      multiPv: 1,
      linesByPv: {},
      latestDepth: 0,
    };

    engineRef.current.postMessage("stop");
    engineRef.current.postMessage("isready");
  }

  function requestEngineSearch(fen, mode) {
    const { depth, multiPv } = getSearchConfig(mode);

    const nextAction = () =>
      startEngineSearch({
        fen,
        mode,
        depth,
        multiPv,
      });

    if (cancelBarrierRef.current.active) {
      cancelBarrierRef.current.nextAction = nextAction;
      return;
    }

    if (pendingRef.current.mode) {
      cancelCurrentSearchAndRun(nextAction);
      return;
    }

    nextAction();
  }

  function analyzePlayerTurn(fen) {
    requestEngineSearch(fen, "player-analysis");
  }

  function ratePlayerMove(fen) {
    requestEngineSearch(fen, "rate-player-move");
  }

  function requestComputerMove(fen) {
    requestEngineSearch(fen, "computer-move");
  }

  useEffect(() => {
    const engine = new Worker("/engine/stockfish-18-lite-single.js");
    engineRef.current = engine;

    engine.onmessage = (event) => {
      const text = event.data;
      if (typeof text !== "string") return;

      if (text === "uciok") {
        engine.postMessage("isready");
        return;
      }

      if (text === "readyok") {
        if (!didInitRef.current) {
          didInitRef.current = true;
          setEngineReady(true);
          analyzePlayerTurn(gameRef.current.fen());
          return;
        }

        if (cancelBarrierRef.current.active) {
          const nextAction = cancelBarrierRef.current.nextAction;
          cancelBarrierRef.current = {
            active: false,
            nextAction: null,
          };

          if (nextAction) {
            nextAction();
          } else {
            setIsThinking(false);
          }
        }

        return;
      }

      if (cancelBarrierRef.current.active) {
        return;
      }

      if (text.startsWith("info") && text.includes(" pv ")) {
        const parsed = parseInfoLine(text);
        if (!parsed || parsed.isBounded) return;
        if (!pendingRef.current.mode) return;

        if (parsed.depth > pendingRef.current.latestDepth) {
          pendingRef.current.latestDepth = parsed.depth;
          pendingRef.current.linesByPv = {
            [parsed.multipv]: parsed,
          };
          return;
        }

        if (parsed.depth === pendingRef.current.latestDepth) {
          pendingRef.current.linesByPv[parsed.multipv] = parsed;
        }

        return;
      }

      if (text.startsWith("bestmove")) {
        const currentPending = pendingRef.current;
        const mode = currentPending.mode;
        const bestMove = text.split(" ")[1];
        const lines = Object.values(currentPending.linesByPv).sort(
          (a, b) => a.multipv - b.multipv
        );

        pendingRef.current = {
          searchId: currentPending.searchId,
          mode: null,
          fen: "",
          depth: 0,
          multiPv: 1,
          linesByPv: {},
          latestDepth: 0,
        };

        if (!mode) {
          setIsThinking(false);
          return;
        }

        if (mode === "player-analysis") {
          if (!lines.length) {
            setIsThinking(false);
            return;
          }

          const analysisGame = new Chess(currentPending.fen);
          const sideToMove = analysisGame.turn();

          playerAnalysisRef.current = {
            lines,
            bestPlayerValue: lineToPlayerValue(
              lines[0],
              sideToMove,
              playerColorRef.current
            ),
            fen: currentPending.fen,
            sideToMove,
          };

          setIsThinking(false);

          if (
            playerColorRef.current === "black" &&
            analysisGame.turn() === "w" &&
            analysisGame.history().length === 0
          ) {
            requestComputerMove(currentPending.fen);
          }

          return;
        }

        if (mode === "rate-player-move") {
          const meta = lastPlayerMoveMetaRef.current;

          if (!meta || !lines.length) {
            setIsThinking(false);
            return;
          }

          const afterSideToMove = new Chess(meta.positionAfterMove).turn();
          const afterBestLine = lines[0];
          const afterPlayerValue = lineToPlayerValue(
            afterBestLine,
            afterSideToMove,
            meta.playerColor
          );

          const ratingResult = getRatingResult({
            positionBeforeMove: meta.positionBeforeMove,
            playerUciMove: meta.playerUciMove,
            preLines: meta.preLines,
            preMoveSideToMove: meta.preMoveSideToMove,
            bestBeforePlayer: meta.bestBeforePlayer,
            afterBestLine,
            afterPlayerValue,
            playerColor: meta.playerColor,
          });

          setMoveRatingLabel(ratingResult.label);
          setMoveRatingDescription(ratingResult.description);
          setSuggestedBetterMove(
            getSuggestedMoveText({
              positionBeforeMove: meta.positionBeforeMove,
              playerUciMove: meta.playerUciMove,
              preLines: meta.preLines,
              preMoveSideToMove: meta.preMoveSideToMove,
              playerColor: meta.playerColor,
              ratingLabel: ratingResult.label,
              evalLoss: ratingResult.evalLoss,
            })
          );

          const gameAfterPlayer = new Chess(meta.positionAfterMove);

          if (!gameAfterPlayer.isGameOver()) {
            requestComputerMove(meta.positionAfterMove);
          } else {
            setIsThinking(false);
          }

          return;
        }

        if (mode === "computer-move") {
          if (!bestMove || bestMove === "(none)") {
            setIsThinking(false);
            return;
          }

          const gameCopy = new Chess(gameRef.current.fen());
          const moveObject = uciToMoveObject(bestMove);

          if (!moveObject) {
            setIsThinking(false);
            return;
          }

          const moveResult = gameCopy.move(moveObject);

          if (!moveResult) {
            setIsThinking(false);
            return;
          }

          gameRef.current = gameCopy;
          setGame(gameCopy);

          if (!gameCopy.isGameOver()) {
            analyzePlayerTurn(gameCopy.fen());
          } else {
            setIsThinking(false);
          }
        }
      }
    };

    engine.postMessage("uci");

    return () => {
      engine.terminate();
    };
  }, []);

  const playerTurnColor = playerColor === "white" ? "w" : "b";

  function handlePlayerMove(sourceSquare, targetSquare, piece) {
    if (!engineReady || isThinking) return false;
    if (game.turn() !== playerTurnColor) return false;
    if (!playerAnalysisRef.current.lines.length) return false;

    const positionBeforeMove = game.fen();
    const gameCopy = new Chess(positionBeforeMove);

    const isPawnPromotion =
      (piece === "wP" && sourceSquare[1] === "7" && targetSquare[1] === "8") ||
      (piece === "bP" && sourceSquare[1] === "2" && targetSquare[1] === "1");

    const promotionPiece = isPawnPromotion ? "q" : undefined;

    const moveResult = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: promotionPiece,
    });

    if (!moveResult) return false;

    setUndoStack((prev) => [...prev, positionBeforeMove]);

    const playerUciMove = `${moveResult.from}${moveResult.to}${moveResult.promotion || ""}`;

    lastPlayerMoveMetaRef.current = {
      positionBeforeMove,
      positionAfterMove: gameCopy.fen(),
      playerUciMove,
      playerSan: moveResult.san,
      preLines: playerAnalysisRef.current.lines,
      preMoveSideToMove: playerAnalysisRef.current.sideToMove,
      bestBeforePlayer: playerAnalysisRef.current.bestPlayerValue,
      playerColor: playerColorRef.current,
    };

    setLastPlayerMove(moveResult.san);
    setMoveRatingLabel("Analyzing...");
    setMoveRatingDescription("Checking your move against the engine.");
    setSuggestedBetterMove("Analyzing...");

    gameRef.current = gameCopy;
    setGame(gameCopy);

    ratePlayerMove(gameCopy.fen());
    return true;
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    if (isThinking) return;

    const previousFen = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    const restoredGame = new Chess(previousFen);

    gameRef.current = restoredGame;
    setGame(restoredGame);

    setLastPlayerMove("...");
    setMoveRatingLabel("No Rating Yet");
    setMoveRatingDescription("Make a move to get feedback.");
    setSuggestedBetterMove("...");

    lastPlayerMoveMetaRef.current = null;
    playerAnalysisRef.current = {
      lines: [],
      bestPlayerValue: 0,
      fen: previousFen,
      sideToMove: restoredGame.turn(),
    };

    if (engineReady) {
      analyzePlayerTurn(previousFen);
    }
  }

  function handleSettingsChange({ difficulty: newDiff, playerColor: newColor }) {
    setDifficulty(newDiff);
    setPlayerColor(newColor);
    difficultyRef.current = newDiff;
    playerColorRef.current = newColor;
    startNewGame(newColor);
  }

  function startNewGame(color) {
    const newGame = new Chess();

    gameRef.current = newGame;
    setGame(newGame);
    setLastPlayerMove("...");
    setMoveRatingLabel("No Rating Yet");
    setMoveRatingDescription("Make a move to get feedback.");
    setSuggestedBetterMove("...");

    setUndoStack([]);

    playerAnalysisRef.current = {
      lines: [],
      bestPlayerValue: 0,
      fen: newGame.fen(),
      sideToMove: newGame.turn(),
    };

    lastPlayerMoveMetaRef.current = null;

    if (engineReady) {
      engineRef.current?.postMessage("ucinewgame");

      if ((color ?? playerColorRef.current) === "black") {
        requestComputerMove(newGame.fen());
      } else {
        analyzePlayerTurn(newGame.fen());
      }
    }
  }

  function handleNewGame() {
    startNewGame(playerColorRef.current);
  }

  const canUndo = undoStack.length > 0 && !isThinking;

  return (
    <div className="app-shell">
      <section className="left-column">
        <div className="controls-wrap">
          <ControlPanel
            onNewGame={handleNewGame}
            onUndo={handleUndo}
            onSettingsChange={handleSettingsChange}
            difficulty={difficulty}
            playerColor={playerColor}
            canUndo={canUndo}
          />
        </div>

        <div className="analysis-wrap">
          <AnalysisPanel
            lastPlayerMove={lastPlayerMove}
            moveRatingLabel={moveRatingLabel}
            moveRatingDescription={moveRatingDescription}
            suggestedBetterMove={suggestedBetterMove}
          />
        </div>
      </section>

      <section className="board-column">
        <ChessBoardPanel fen={game.fen()} onPieceDrop={handlePlayerMove} />
      </section>
    </div>
  );
}