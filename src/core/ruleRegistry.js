const fs = require("fs");
const path = require("path");

function loadRules() {
    const rulesDir = path.join(__dirname, "..", "rules");

    return fs.readdirSync(rulesDir)
        .filter(file => file.endsWith(".js"))
        .map(file => require(path.join(rulesDir, file)));
}

module.exports = {
    loadRules
};
