export default function AnalysisPanel({
    lastPlayerMove,
    moveRatingLabel,
    moveRatingDescription,
    suggestedBetterMove,
}) {
    return (
        <div className="analysis-square">

            <div className="analysis-block">
                <span className="analysis-kicker">Move Played</span>
                <p className="analysis-main">{lastPlayerMove}</p>
            </div>

            <div className="analysis-block">
                <span className="analysis-kicker">Rating</span>
                <p className="analysis-main rating-accent">{moveRatingLabel}</p>
                <p className="analysis-subtext">{moveRatingDescription}</p>
            </div>

            <div className="analysis-block">
                <span className="analysis-kicker">Suggested Better Move</span>
                <p className="analysis-subtext">{suggestedBetterMove}</p>
            </div>
        </div>
    );
}