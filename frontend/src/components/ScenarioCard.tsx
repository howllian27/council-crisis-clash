interface ScenarioCardProps {
  scenario: Scenario;
  onVote: (vote: "yes" | "no") => void;
  hasVoted: boolean;
  currentVote?: "yes" | "no";
  outcome?: string;
  resource_changes?: Record<string, number>;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  onVote,
  hasVoted,
  currentVote,
  outcome,
  resource_changes,
}) => {
  return (
    <div className="scenario-card">
      <h2>{scenario.title}</h2>
      <p>{scenario.description}</p>

      {outcome && (
        <div className="outcome-section">
          <h3>Outcome</h3>
          <p>{outcome}</p>

          {resource_changes && (
            <div className="resource-changes">
              <h4>Resource Changes</h4>
              <ul>
                {Object.entries(resource_changes).map(([resource, change]) => (
                  <li key={resource}>
                    {resource}: {change > 0 ? "+" : ""}
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!hasVoted && !outcome && (
        <div className="voting-buttons">
          <button onClick={() => onVote("yes")}>Yes</button>
          <button onClick={() => onVote("no")}>No</button>
        </div>
      )}

      {hasVoted && !outcome && <p>You voted: {currentVote}</p>}
    </div>
  );
};

export default ScenarioCard;
