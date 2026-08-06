const Severity = require("./constants/severity");

// Severity -> rank, higher is worse. Mirrors constants/severity.js but as an
// ordered scale, since severity.js itself is just a set of labels with no
// ordering defined.
const SEVERITY_RANK = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
};

function normalizeSeverityInput(value) {
    return String(value || "").trim().toLowerCase();
}

function isValidSeverity(value) {
    return Object.prototype.hasOwnProperty.call(SEVERITY_RANK, normalizeSeverityInput(value));
}

// score: the object calculateScore() returns -- { score, grade, severity }.
// options.failOnSeverity: lowest severity level that should fail the gate
//   (e.g. "high" fails on any high or critical finding). Optional.
// options.minScore: fail if score.score is below this number. Optional.
//
// Returns { passed, reasons } rather than throwing/exiting -- keeps this
// module pure and testable; the caller (index.js) decides what to do with
// a failed gate (print + process.exit).
function evaluateQualityGate(score, options = {}) {
    const { failOnSeverity, minScore } = options;
    const reasons = [];

    if (failOnSeverity) {
        const threshold = SEVERITY_RANK[normalizeSeverityInput(failOnSeverity)];
        const counts = score.severity || {};

        let atOrAboveThreshold = 0;
        for (const [level, rank] of Object.entries(SEVERITY_RANK)) {
            if (rank >= threshold) {
                atOrAboveThreshold += counts[level] || 0;
            }
        }

        if (atOrAboveThreshold > 0) {
            reasons.push(
                `${atOrAboveThreshold} finding(s) at or above "${failOnSeverity}" severity ` +
                `(--fail-on=${failOnSeverity})`
            );
        }
    }

    if (typeof minScore === "number" && !Number.isNaN(minScore)) {
        if (score.score < minScore) {
            reasons.push(`score ${score.score} is below minimum ${minScore} (--min-score=${minScore})`);
        }
    }

    return {
        passed: reasons.length === 0,
        reasons
    };
}

module.exports = {
    evaluateQualityGate,
    isValidSeverity,
    SEVERITY_RANK
};
