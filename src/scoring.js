const { aggregateFindings } = require("./findingAggregator");

// Base cost of a single, isolated occurrence of an issue -- unchanged
// from before this was rewritten, so a site with a handful of genuinely
// distinct problems still scores the same way it always has.
const SEVERITY_WEIGHT = {
    critical: 20,
    high: 10,
    medium: 5,
    low: 2
};

// How much extra an issue costs for being widespread rather than
// isolated (e.g. missing on 48/48 pages vs 1/48). Deliberately small and
// capped: breadth should move the score, but a single misconfigured
// header shouldn't be able to single-handedly floor the score just
// because the site has a lot of pages. See the rewrite note below for
// why this exists at all.
const BREADTH_FACTOR = 0.1;
const BREADTH_CAP_OCCURRENCES = 20;

// Findings are one-per-occurrence (one per page, per broken asset, etc.)
// by design -- that's the right granularity for rules to work at. This
// used to deduct per RAW finding, with no normalization: a header
// missing on 48 pages cost 48x what missing on 1 page cost, with no
// cap. In practice that meant almost any real site above a few dozen
// pages floored at 0/100 regardless of actual severity, which made the
// score meaningless as a signal at exactly the scale where a score
// matters most. Scoring now works off aggregateFindings() -- one
// deduction per unique issue TYPE, with a small, capped penalty added
// for how widespread it is, instead of a linear per-occurrence penalty
// with no cap.
function calculateScore(findings) {

    const aggregated = aggregateFindings(findings);

    let score = 100;

    const severity = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
    };

    for (const group of aggregated) {

        const level = group.severity.toLowerCase();

        if (severity[level] !== undefined) {
            severity[level]++;
        }

        const weight = SEVERITY_WEIGHT[level] || 0;
        const extraOccurrences = Math.min(group.occurrenceCount - 1, BREADTH_CAP_OCCURRENCES);

        score -= weight * (1 + extraOccurrences * BREADTH_FACTOR);
    }


    if (score < 0) {
        score = 0;
    }

    score = Math.round(score);


    let grade = "F";

    if (score >= 90) {
        grade = "A";
    } else if (score >= 80) {
        grade = "B";
    } else if (score >= 70) {
        grade = "C";
    } else if (score >= 60) {
        grade = "D";
    }


    return {
        score,
        grade,
        severity
    };

}


module.exports = {
    calculateScore
};

