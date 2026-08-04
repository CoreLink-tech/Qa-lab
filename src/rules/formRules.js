const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

module.exports = {
    id: "FORMS",
    name: "Form Rules",
    category: Category.FORMS,
    description: "Checks for common HTML form usability and accessibility issues.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            const fields = page.forms?.fields || [];

            // Check for missing name attributes
            const missingNameFields = fields.filter(input => !input.name);

            if (missingNameFields.length > 0) {

                findings.push(
                    createFinding({
                        id: "FORM001",
                        title: "Input Fields Missing Name Attribute",
                        category: Category.FORMS,
                        severity: Severity.LOW,
                        page: page.url,
                        details: `${missingNameFields.length} input field(s) are missing a name attribute.`,
                        recommendation:
                            "Add a name attribute to form fields that are submitted using standard HTML forms.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input"
                    })
                );

            }

            // Check password autocomplete
            for (const input of fields) {

                if (
                    input.type === "password" &&
                    !input.autocomplete
                ) {

                    findings.push(
                        createFinding({
                            id: "FORM002",
                            title: "Password Field Missing Autocomplete",
                            category: Category.FORMS,
                            severity: Severity.LOW,
                            page: page.url,
                            details: "Password input is missing the autocomplete attribute.",
                            recommendation:
                                'Add autocomplete="current-password" or autocomplete="new-password".',
                            documentation:
                                "https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete"
                        })
                    );

                }

            }

        }

        return findings;
    }
};
