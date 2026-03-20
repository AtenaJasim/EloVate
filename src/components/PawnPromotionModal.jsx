export default function PawnPromotionModal({ color, onSelect }) {
    const pieces = [
        { value: "q", label: "Queen", symbol: color === "w" ? "♕" : "♛" },
        { value: "r", label: "Rook", symbol: color === "w" ? "♖" : "♜" },
        { value: "b", label: "Bishop", symbol: color === "w" ? "♗" : "♝" },
        { value: "n", label: "Knight", symbol: color === "w" ? "♘" : "♞" },
    ];

    return (
        <div className="settings-overlay">
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <h3 className="settings-title">Promote Pawn</h3>
                <div className="settings-section">
                    <span className="settings-label">Choose a piece</span>
                    <div className="promotion-options">
                        {pieces.map((p) => (
                            <button
                                key={p.value}
                                className="promotion-option-btn"
                                onClick={() => onSelect(p.value)}
                            >
                                <span className="promotion-symbol">{p.symbol}</span>
                                <span className="promotion-piece-label">{p.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}