const fs = require("fs");
const path = require("path");

function validateRule(rule, file) {
    const missing = ["id", "name", "category", "run"].filter(
        key => rule[key] === undefined
    );

    if (missing.length) {
        throw new Error(
            `Invalid rule module "${file}": missing required field(s) ${missing.join(", ")}.`
        );
    }

    if (typeof rule.run !== "function") {
        throw new Error(`Invalid rule module "${file}": "run" must be a function.`);
    }
}

function loadRules() {
    const rulesDir = path.join(__dirname, "..", "rules");

    return fs.readdirSync(rulesDir)
        .filter(file => file.endsWith(".js"))
        .map(file => {
            const rule = require(path.join(rulesDir, file));
            validateRule(rule, file);
            return rule;
        })
        .filter(rule => rule.enabled !== false);
}

module.exports = {
    loadRules
};
