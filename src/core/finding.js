function createFinding({
    id,
    title,
    category,
    severity = "Info",
    confidence = 100,
    page = "",
    details = "",
    recommendation = "",
    documentation = "",
    evidence = null,
    metadata = {}
}) {
    if (!id) throw new Error("Finding ID is required.");
    if (!title) throw new Error("Finding title is required.");
    if (!category) throw new Error("Finding category is required.");

    return {
        id,
        title,
        category,
        severity,
        confidence,
        page,
        details,
        recommendation,
        documentation,
        evidence,
        metadata,
        timestamp: new Date().toISOString()
    };
}

module.exports = createFinding;
