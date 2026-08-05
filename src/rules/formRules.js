const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

const EMAIL_NAME_PATTERN = /email/i;

module.exports = {
    id: "FORMS",
    name: "Form Rules",
    category: Category.FORMS,
    description: "Checks common HTML form usability, security, and accessibility issues: names, autocomplete, password strength, email typing, form method, CSRF tokens, and file upload restrictions.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            const fields = page.forms?.fields || [];
            const formsList = page.forms?.list || [];

            const missingNameFields = fields.filter(input => !input.name);

            if (missingNameFields.length > 0) {
                findings.push(createFinding({
                    id: "FORM001",
                    title: "Input Fields Missing Name Attribute",
                    category: Category.FORMS,
                    severity: Severity.LOW,
                    page: page.url,
                    details: `${missingNameFields.length} input field(s) are missing a name attribute.`,
                    recommendation: "Add a name attribute to form fields that are submitted using standard HTML forms.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input"
                }));
            }

            for (const input of fields) {

                if (input.type === "password" && !input.autocomplete) {
                    findings.push(createFinding({
                        id: "FORM002",
                        title: "Password Field Missing Autocomplete",
                        category: Category.FORMS,
                        severity: Severity.LOW,
                        page: page.url,
                        details: "Password input is missing the autocomplete attribute.",
                        recommendation: 'Add autocomplete="current-password" or autocomplete="new-password".',
                        documentation: "https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete"
                    }));
                }

                if (input.type === "password" && !input.minlength && !input.pattern) {
                    findings.push(createFinding({
                        id: "FORM003",
                        title: "Password Field Has No Enforced Strength Requirement",
                        category: Category.FORMS,
                        severity: Severity.LOW,
                        page: page.url,
                        confidence: 70,
                        details: "Password input has no minlength or pattern attribute enforcing minimum complexity.",
                        recommendation: "Add a minlength attribute (and ideally a pattern) to encourage stronger passwords client-side, in addition to server-side validation.",
                        documentation: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/password"
                    }));
                }

                if (
                    input.type !== "email" &&
                    input.name &&
                    EMAIL_NAME_PATTERN.test(input.name)
                ) {
                    findings.push(createFinding({
                        id: "FORM004",
                        title: "Likely Email Field Not Using type=\"email\"",
                        category: Category.FORMS,
                        severity: Severity.LOW,
                        page: page.url,
                        confidence: 60,
                        details: `Field named "${input.name}" appears to collect an email address but uses type="${input.type}".`,
                        recommendation: 'Use type="email" so browsers provide built-in format validation and the correct mobile keyboard.',
                        documentation: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email"
                    }));
                }

                if (input.type === "file" && !input.accept) {
                    findings.push(createFinding({
                        id: "FORM007",
                        title: "File Upload Missing Accept Attribute",
                        category: Category.FORMS,
                        severity: Severity.LOW,
                        page: page.url,
                        details: "File input does not restrict accepted file types via the accept attribute.",
                        recommendation: "Add an accept attribute (e.g. accept=\"image/*\") to guide users and reduce invalid uploads. Always validate file type server-side too.",
                        documentation: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file"
                    }));
                }
            }

            for (const form of formsList) {

                const hasPasswordField = form.fields.some(f => f.type === "password");

                if (hasPasswordField && form.method === "get") {
                    findings.push(createFinding({
                        id: "FORM005",
                        title: "Sensitive Form Uses GET Method",
                        category: Category.FORMS,
                        severity: Severity.HIGH,
                        page: page.url,
                        details: "A form containing a password field submits via GET, which exposes the password in the URL, browser history, and server logs.",
                        recommendation: 'Change the form\'s method to "post".',
                        documentation: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#method"
                    }));
                }

                if (form.method === "post" && !form.hasCSRFToken) {
                    findings.push(createFinding({
                        id: "FORM006",
                        title: "POST Form Missing Apparent CSRF Token",
                        category: Category.FORMS,
                        severity: Severity.INFO,
                        page: page.url,
                        confidence: 50,
                        details: "No hidden field matching common CSRF token naming conventions (csrf, _token, authenticity_token) was found on this POST form.",
                        recommendation: "Verify CSRF protection is in place. This is a naming-convention heuristic; some frameworks protect forms without an HTML-visible token (e.g. via headers or cookies), so confirm manually before treating this as confirmed.",
                        documentation: "https://owasp.org/www-community/attacks/csrf"
                    }));
                }
            }
        }

        return findings;
    }
};
