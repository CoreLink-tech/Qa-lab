const { loadRules } = require("./core/ruleRegistry");

async function runRules(websiteModel, rules = loadRules()) {

    let issues = [];

    for (const rule of rules) {

        console.log(`Running ${rule.name}...`);

        try {
            // await works whether run() is sync or async, so rules
            // that need to do their own network calls (e.g. link
            // checking) don't need special-casing here.
            const findings = await rule.run(websiteModel);

            if (findings && findings.length) {
                issues.push(...findings);
            }

        } catch (error) {
            console.error(
                `Rule "${rule.id}" (${rule.name}) threw an error and was skipped: ${error.message}`
            );
        }
    }

    console.log("Finished rules.");

    return issues;
}

module.exports = {
    runRules
};
