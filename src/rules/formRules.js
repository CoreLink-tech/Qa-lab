function checkForms(websiteModel) {
    const issues = [];

    websiteModel.pages.forEach(page => {
        const fields = page.forms?.fields || [];

        // One issue per page for missing name attributes
        const missingNameFields = fields.filter(input => !input.name);

        if (missingNameFields.length > 0) {
            issues.push({
                type: "Form",
                title: "Input fields missing name attribute",
                severity: "Low",
                page: page.url,
                details: `${missingNameFields.length} input field(s) are missing a name attribute.`,
                recommendation:
                    "Add a name attribute to form fields that are submitted using standard HTML forms."
            });
        }

        // One issue per password field missing autocomplete
        fields.forEach(input => {
            if (
                input.type === "password" &&
                !input.autocomplete
            ) {
                issues.push({
                    type: "Form",
                    title: "Password field missing autocomplete",
                    severity: "Low",
                    page: page.url,
                    details: "Password input missing autocomplete attribute.",
                    recommendation:
                        'Add autocomplete="current-password" or autocomplete="new-password".'
                });
            }
        });

    });

    return issues;
}

module.exports = {
    checkForms
};
