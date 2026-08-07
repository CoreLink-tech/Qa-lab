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

function loadRules(rulesDir = path.join(__dirname, "..", "rules")) {

    return fs.readdirSync(rulesDir)
        .filter(file => file.endsWith(".js"))
        .map(file => {
            const rule = require(path.join(rulesDir, file));
            validateRule(rule, file);
            return rule;
        })
        .filter(rule => rule.enabled !== false);
}

// Built-in rules always run, plus any additional rule modules found in
// the given plugin directories -- plugins extend the rule set, they
// don't replace it. Each plugin directory follows the exact same
// contract as src/rules/ (same validateRule check applies), so a
// custom rule is indistinguishable from a built-in one once loaded.
function loadRulesWithPlugins(pluginDirs = []) {
    const builtIn = loadRules();
    const seenIds = new Set(builtIn.map(rule => rule.id));

    const pluginRules = [];

    for (const dir of pluginDirs) {
        let rulesFromDir;

        try {
            rulesFromDir = loadRules(dir);
        } catch (error) {
            throw new Error(`Failed to load plugin rules from "${dir}": ${error.message}`);
        }

        for (const rule of rulesFromDir) {
            if (seenIds.has(rule.id)) {
                console.error(
                    `Warning: plugin rule "${rule.id}" from "${dir}" has the same id as an ` +
                    `already-loaded rule and will be skipped. Rule ids must be unique.`
                );
                continue;
            }

            seenIds.add(rule.id);
            pluginRules.push(rule);
        }
    }

    return [...builtIn, ...pluginRules];
}

module.exports = {
    loadRules,
    loadRulesWithPlugins,
    validateRule
};
