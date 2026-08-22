const test = require("node:test");
const assert = require("node:assert/strict");
const { detectErrorDisclosure } = require("../../src/utils/errorDisclosureDetector");

test("detects a MySQL syntax error disclosed in page body", () => {
    const result = detectErrorDisclosure(
        "<html><body>Error: You have an error in your SQL syntax; check the manual</body></html>"
    );
    assert.ok(result);
    assert.equal(result.system, "MySQL");
});

test("detects a PHP fatal error/stack trace disclosed in page body", () => {
    const result = detectErrorDisclosure(
        "<html><body>Fatal error: Uncaught Error: Call to undefined function foo() in /var/www/app.php on line 42</body></html>"
    );
    assert.ok(result);
    assert.equal(result.system, "PHP");
});

test("detects a Python/Django traceback disclosed in page body", () => {
    const result = detectErrorDisclosure(
        "<pre>Traceback (most recent call last):\n  File \"views.py\", line 10</pre>"
    );
    assert.ok(result);
    assert.equal(result.system, "Python/Django");
});

test("does not flag ordinary page content that merely mentions errors", () => {
    const result = detectErrorDisclosure(
        "<html><body><p>If you see an error, please contact support. Warning: check your email for confirmation.</p></body></html>"
    );
    assert.equal(result, null);
});

test("returns null for empty or missing html", () => {
    assert.equal(detectErrorDisclosure(""), null);
    assert.equal(detectErrorDisclosure(undefined), null);
    assert.equal(detectErrorDisclosure(null), null);
});

test("truncates the matched text to 120 characters", () => {
    const result = detectErrorDisclosure("ORA-00001: unique constraint violated ".padEnd(300, "x"));
    assert.ok(result.match.length <= 120);
});
