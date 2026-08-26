// Every rule emits one finding object per occurrence -- one per page for
// per-page rules, one per broken asset, one per duplicate-title cluster,
// and so on. That's the right granularity for rules to work at (a rule
// checking a page shouldn't need to know or care what other pages found),
// but it's the wrong granularity to hand a user: a header missing on 48
// pages is one issue, not 48 identical rows.
//
// This groups raw findings by `id` (e.g. "SEC005") into one entry per
// unique issue type. `id` alone is the right key -- a given id's title/
// category/severity/recommendation are fixed by the rule that creates it,
// so grouping by id can't accidentally merge two different issues under
// one severity, and doesn't need a second key.
//
// Both scoring.js and every report writer consume this instead of the
// raw findings array.

const MAX_EXAMPLES = 5;

function aggregateFindings(findings) {
    const groups = new Map();

    for (const finding of findings) {
        if (!groups.has(finding.id)) {
            groups.set(finding.id, {
                id: finding.id,
                title: finding.title,
                category: finding.category,
                severity: finding.severity,
                recommendation: finding.recommendation,
                documentation: finding.documentation,
                occurrences: []
            });
        }
        groups.get(finding.id).occurrences.push(finding);
    }

    return Array.from(groups.values()).map(group => {
        // page is "" by default (see core/finding.js), not every finding
        // necessarily has a meaningful one -- filter those out rather than
        // counting an empty string as an affected page.
        const affectedPages = [...new Set(
            group.occurrences.map(o => o.page).filter(Boolean)
        )];

        return {
            id: group.id,
            title: group.title,
            category: group.category,
            severity: group.severity,
            recommendation: group.recommendation,
            documentation: group.documentation,
            occurrenceCount: group.occurrences.length,
            affectedPageCount: affectedPages.length,
            affectedPages,
            // A representative sample, not every occurrence -- a rule that
            // fires on 2000 pages shouldn't produce a report section with
            // 2000 near-identical lines. affectedPages (above) still has
            // every distinct URL if a consumer needs the full list.
            examples: group.occurrences.slice(0, MAX_EXAMPLES).map(o => ({
                page: o.page,
                details: o.details
            }))
        };
    });
}

module.exports = { aggregateFindings };
