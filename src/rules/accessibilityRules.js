const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

const NON_LABELABLE_TYPES = ["hidden", "submit", "button", "reset", "image"];

function headingLevel(tag) {
    return parseInt(tag.replace("h", ""), 10);
}

module.exports = {
    id: "ACCESSIBILITY",
    name: "Accessibility Rules",
    category: Category.ACCESSIBILITY,
    description: "Checks for common accessibility issues: missing alt text, skipped heading levels, unlabeled form fields, and missing language attributes.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            const missingAlt = page.images?.missingAlt || 0;

            if (missingAlt > 0) {
                findings.push(createFinding({
                    id: "ACC001",
                    title: "Images Missing Alt Attributes",
                    category: Category.ACCESSIBILITY,
                    severity: Severity.LOW,
                    page: page.url,
                    details: `${missingAlt} image(s) do not have alt attributes.`,
                    recommendation: "Provide meaningful alt text for every informative image. Use an empty alt attribute (alt=\"\") only for decorative images.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt"
                }));
            }

            const sequence = page.headingSequence || [];
            let skippedLevel = null;

            for (let i = 1; i < sequence.length; i++) {
                const prevLevel = headingLevel(sequence[i - 1]);
                const currLevel = headingLevel(sequence[i]);

                if (currLevel - prevLevel > 1) {
                    skippedLevel = { from: sequence[i - 1], to: sequence[i] };
                    break;
                }
            }

            if (skippedLevel) {
                findings.push(createFinding({
                    id: "ACC002",
                    title: "Heading Level Skipped",
                    category: Category.ACCESSIBILITY,
                    severity: Severity.LOW,
                    page: page.url,
                    details: `Heading structure jumps from ${skippedLevel.from} to ${skippedLevel.to} without the levels in between.`,
                    recommendation: "Don't skip heading levels. Screen reader users rely on heading order to understand page structure.",
                    documentation: "https://www.w3.org/WAI/tutorials/page-structure/headings/"
                }));
            }

            const labelFors = new Set(page.labelFors || []);

            const unlabeledFields = (page.forms?.fields || []).filter(field => {
                if (NON_LABELABLE_TYPES.includes(field.type)) return false;
                if (field.ariaLabel || field.ariaLabelledby) return false;
                if (field.id && labelFors.has(field.id)) return false;
                return true;
            });

            if (unlabeledFields.length > 0) {
                findings.push(createFinding({
                    id: "ACC003",
                    title: "Form Field Missing Accessible Label",
                    category: Category.ACCESSIBILITY,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: `${unlabeledFields.length} form field(s) have no associated <label>, aria-label, or aria-labelledby.`,
                    recommendation: "Associate every form field with a <label for=\"...\">, or add an aria-label/aria-labelledby attribute.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_WCAG/Perceivable/Labeling_content"
                }));
            }

            if (!page.lang) {
                findings.push(createFinding({
                    id: "ACC004",
                    title: "Missing Language Attribute",
                    category: Category.ACCESSIBILITY,
                    severity: Severity.LOW,
                    page: page.url,
                    details: "The <html> element does not have a lang attribute.",
                    recommendation: "Add a lang attribute to the <html> tag (e.g. <html lang=\"en\">) so screen readers use the correct pronunciation.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang"
                }));
            }
        }

        return findings;
    }
};
