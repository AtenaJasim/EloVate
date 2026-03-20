import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
    ANALYSIS_DEPTH,
    ANALYSIS_MULTIPV,
    BOT_SETTINGS_BY_DIFFICULTY,
    DEFAULT_LAST_PLAYER_MOVE,
    DEFAULT_MOVE_RATING_DESCRIPTION,
    DEFAULT_MOVE_RATING_LABEL,
    DEFAULT_SUGGESTED_BETTER_MOVE,
} from "../constants/chessConfig";
import {
    lineToPlayerValue,
    parseInfoLine,
    uciToMoveObject,
} from "../utils/engineUtils";
import {
    getRatingResult,
    getSuggestedMoveText,
} from "../utils/moveRating";

function createEmptyPlayerAnalysis(fen = "", sideToMove = "w") {
    return {
        lines: [],
        bestPlayerValue: 0,
        fen,
        sideToMove,
    };
}

function createEmptyPendingState(searchId = 0) {
    return {
        searchId,
        mode: null,
        fen: "",
        depth: 0,
        multiPv: 1,
        linesByPv: {},
        latestDepth: 0,
    };
}

export function useChessGame() {
    const [game, setGame] = useState(() => new Chess());
    const [engineReady, setEngineReady] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [lastPlayerMove, setLastPlayerMove] = useState(
        DEFAULT_LAST_PLAYER_MOVE
    );
    const [moveRatingLabel, setMoveRatingLabel] = useState(
        DEFAULT_MOVE_RATING_LABEL
    );
    const [moveRatingDescription, setMoveRatingDescription] = useState(
        DEFAULT_MOVE_RATING_DESCRIPTION
    );
    const [suggestedBetterMove, setSuggestedBetterMove] = useState(
        DEFAULT_SUGGESTED_BETTER_MOVE
    );
    const [difficulty, setDifficulty] = useState("medium");
    const [playerColor, setPlayerColor] = useState("white");
    const [undoStack, setUndoStack] = useState([]);

    const difficultyRef = useRef("medium");
    const playerColorRef = useRef("white");
    const engineRef = useRef(null);
    const gameRef = useRef(game);
    const didInitRef = useRef(false);
    const searchIdRef = useRef(0);
    const playerAnalysisRef = useRef(
        createEmptyPlayerAnalysis(game.fen(), game.turn())
    );
    const lastPlayerMoveMetaRef = useRef(null);
    const pendingRef = useRef(createEmptyPendingState());
    const cancelBarrierRef = useRef({
        active: false,
        nextAction: null,
    });

    useEffect(() => {
        gameRef.current = game;
    }, [game]);

    function resetMoveFeedback() {
        setLastPlayerMove(DEFAULT_LAST_PLAYER_MOVE);
        setMoveRatingLabel(DEFAULT_MOVE_RATING_LABEL);
        setMoveRatingDescription(DEFAULT_MOVE_RATING_DESCRIPTION);
        setSuggestedBetterMove(DEFAULT_SUGGESTED_BETTER_MOVE);
    }

    function applyGameOverFeedback(completedGame) {
        if (completedGame.isCheckmate()) {
            setMoveRatingLabel("Checkmate");
            setMoveRatingDescription("That move ended the game with checkmate.");
            setSuggestedBetterMove("Game over");
            return;
        }

        if (completedGame.isStalemate()) {
            setMoveRatingLabel("Stalemate");
            setMoveRatingDescription(
                "No legal moves remain and the king is not in check."
            );
            setSuggestedBetterMove("Tie");
            return;
        }

        if (completedGame.isInsufficientMaterial()) {
            setMoveRatingLabel("Draw");
            setMoveRatingDescription(
                "The game is drawn because neither side has enough material to mate."
            );
            setSuggestedBetterMove("Tie");
            return;
        }

        if (completedGame.isThreefoldRepetition()) {
            setMoveRatingLabel("Draw");
            setMoveRatingDescription(
                "The same position was repeated three times."
            );
            setSuggestedBetterMove("Tie");
            return;
        }

        if (completedGame.isDraw()) {
            setMoveRatingLabel("Draw");
            setMoveRatingDescription("The game ended in a draw.");
            setSuggestedBetterMove("Tie");
        }
    }

    function getBotSettings() {
        return (
            BOT_SETTINGS_BY_DIFFICULTY[difficultyRef.current] ??
            BOT_SETTINGS_BY_DIFFICULTY.medium
        );
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

        const skillLevel =
            mode === "computer-move" ? getBotSettings().skillLevel : 20;

        setIsThinking(true);
        engineRef.current.postMessage(
            `setoption name Skill Level value ${skillLevel}`
        );
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

        pendingRef.current = createEmptyPendingState(pendingRef.current.searchId);
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

    function startNewGame(color) {
        const newGame = new Chess();
        gameRef.current = newGame;
        setGame(newGame);
        resetMoveFeedback();
        setUndoStack([]);

        playerAnalysisRef.current = createEmptyPlayerAnalysis(
            newGame.fen(),
            newGame.turn()
        );

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

                pendingRef.current = createEmptyPendingState(currentPending.searchId);

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

                    if (!meta) {
                        setIsThinking(false);
                        return;
                    }

                    const gameAfterPlayer = new Chess(meta.positionAfterMove);

                    if (!lines.length) {
                        if (gameAfterPlayer.isGameOver()) {
                            applyGameOverFeedback(gameAfterPlayer);
                        }

                        setIsThinking(false);
                        return;
                    }

                    const afterSideToMove = gameAfterPlayer.turn();
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

                    if (!gameAfterPlayer.isGameOver()) {
                        requestComputerMove(meta.positionAfterMove);
                    } else {
                        applyGameOverFeedback(gameAfterPlayer);
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
                        applyGameOverFeedback(gameCopy);
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

    function handlePlayerMove(sourceSquare, targetSquare, promotionPiece) {
        if (!engineReady || isThinking) return false;
        if (game.turn() !== playerTurnColor) return false;
        if (!playerAnalysisRef.current.lines.length) return false;

        const positionBeforeMove = game.fen();
        const gameCopy = new Chess(positionBeforeMove);

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

        if (gameCopy.isGameOver()) {
            applyGameOverFeedback(gameCopy);
            setIsThinking(false);
            return true;
        }

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
        resetMoveFeedback();
        lastPlayerMoveMetaRef.current = null;

        playerAnalysisRef.current = createEmptyPlayerAnalysis(
            previousFen,
            restoredGame.turn()
        );

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

    function handleNewGame() {
        startNewGame(playerColorRef.current);
    }

    const canUndo = undoStack.length > 0 && !isThinking;

    return {
        game,
        difficulty,
        playerColor,
        lastPlayerMove,
        moveRatingLabel,
        moveRatingDescription,
        suggestedBetterMove,
        canUndo,
        handlePlayerMove,
        handleUndo,
        handleNewGame,
        handleSettingsChange,
    };
}