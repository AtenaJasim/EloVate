import { useState } from "react";

const DIFFICULTIES = [
    { label: "Easy", value: "easy", depth: 3 },
    { label: "Medium", value: "medium", depth: 8 },
    { label: "Hard", value: "hard", depth: 15 },
];

export default function ControlPanel({
    onNewGame,
    onUndo,
    onSettingsChange,
    difficulty,
    playerColor,
    canUndo,
}) {
    const [imageFailed, setImageFailed] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [pendingDifficulty, setPendingDifficulty] = useState(difficulty);
    const [pendingColor, setPendingColor] = useState(playerColor);

    function openSettings() {
        setPendingDifficulty(difficulty);
        setPendingColor(playerColor);
        setSettingsOpen(true);
    }

    function applySettings() {
        onSettingsChange({ difficulty: pendingDifficulty, playerColor: pendingColor });
        setSettingsOpen(false);
    }

    function cancelSettings() {
        setSettingsOpen(false);
    }

    return (
        <div className="tutor-panel">
            <div className="tutor-card">
                <div className="tutor-image-box">
                    <div className="tutor-image-wrap">
                        <img
                            src="/tutor.png"
                            alt="AI chess tutor"
                            className="tutor-image"
                            onError={() => setImageFailed(true)}
                        />
                    </div>
                </div>
                <div className="tutor-text">
                    <h1 className="tutor-title">EloVate</h1>
                    <p className="tutor-subtitle">An AI Chess Tutor</p>
                </div>
            </div>

            {/* Nav Bar */}
            <div className="control-navbar">
                {/* Settings Button */}
                <button
                    className="nav-icon-btn"
                    onClick={openSettings}
                    title="Settings"
                    aria-label="Open settings"
                >
                    <img src="/settings.png" alt="Settings" className="nav-icon-img" />
                </button>

                {/* Undo Button */}
                <button
                    className={`nav-icon-btn ${!canUndo ? "nav-icon-btn--disabled" : ""}`}
                    onClick={canUndo ? onUndo : undefined}
                    title={canUndo ? "Undo last move" : "Nothing to undo"}
                    aria-label="Undo last move"
                    disabled={!canUndo}
                >
                    <img src="/undo.png" alt="Undo" className="nav-icon-img" />
                </button>

                {/* New Game Button */}
                <button className="new-game-button" onClick={onNewGame}>
                    New Game
                </button>
            </div>

            {/* Settings Modal */}
            {settingsOpen && (
                <div className="settings-overlay" onClick={cancelSettings}>
                    <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="settings-title">Game Settings</h3>

                        <div className="settings-section">
                            <label className="settings-label">Difficulty</label>
                            <div className="settings-options">
                                {DIFFICULTIES.map((d) => (
                                    <button
                                        key={d.value}
                                        className={`settings-option-btn ${pendingDifficulty === d.value ? "settings-option-btn--active" : ""}`}
                                        onClick={() => setPendingDifficulty(d.value)}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="settings-section">
                            <label className="settings-label">Play As</label>
                            <div className="settings-options">
                                <button
                                    className={`settings-option-btn ${pendingColor === "white" ? "settings-option-btn--active" : ""}`}
                                    onClick={() => setPendingColor("white")}
                                >
                                    ♙ White
                                </button>
                                <button
                                    className={`settings-option-btn ${pendingColor === "black" ? "settings-option-btn--active" : ""}`}
                                    onClick={() => setPendingColor("black")}
                                >
                                    ♟ Black
                                </button>
                            </div>
                        </div>

                        <div className="settings-actions">
                            <button className="settings-cancel-btn" onClick={cancelSettings}>
                                Cancel
                            </button>
                            <button className="settings-apply-btn" onClick={applySettings}>
                                Apply &amp; New Game
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}