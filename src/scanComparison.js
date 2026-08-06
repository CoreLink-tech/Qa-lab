// Findings don't have a persistent unique ID across separate scans (a
// rule's id, e.g. "SEO001", is shared by every instance of that check
// across every page). Combine id + page as a stable-enough identity
// for "is this the same issue instance as last time" comparison.
function findingKey(finding) {
    return `${finding.id}::${finding.page}`;
}

function compareScans(previousReportData, currentReportData) {
    const previousFindings = previousReportData?.findings || [];
    const currentFindings = currentReportData?.findings || [];

    const previousKeys = new Set(previousFindings.map(findingKey));
    const currentKeys = new Set(currentFindings.map(findingKey));

    const newIssues = currentFindings.filter(f => !previousKeys.has(findingKey(f)));
    const resolvedIssues = previousFindings.filter(f => !currentKeys.has(findingKey(f)));

    const previousScore = previousReportData?.score?.score ?? null;
    const currentScore = currentReportData?.score?.score ?? null;

    return {
        previousTimestamp: previousReportData?.timestamp ?? null,
        currentTimestamp: currentReportData?.timestamp ?? null,
        previousScore,
        currentScore,
        scoreDelta: (previousScore !== null && currentScore !== null) ? currentScore - previousScore : null,
        newIssues,
        resolvedIssues
    };
}

module.exports = { compareScans, findingKey };
