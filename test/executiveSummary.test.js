const test = require("node:test");
const assert = require("node:assert/strict");
const { generateExecutiveSummary } = require("../src/executiveSummary");

test("lists critical and high severity issues as top priority, in that order", () => {
    const summary = generateExecutiveSummary({
        url: "https://example.com",
        findings: [
            { title: "High Issue", category: "SEO", severity: "High", page: "https://example.com/" },
            { title: "Low Issue", category: "SEO", severity: "Low", page: "https://example.com/" },
            { title: "Critical Issue", category: "Security", severity: "Critical", page: "https://example.com/" }
        ]
    });
    const criticalIndex = summary.indexOf("Critical Issue");
    const highIndex = summary.indexOf("High Issue");
    assert.ok(criticalIndex > -1 && criticalIndex < highIndex);
    assert.ok(!summary.includes("Low Issue"));
});

test("caps top issues at 10 even with more critical/high findings", () => {
    const findings = Array.from({ length: 15 }, (_, i) => ({
        title: `Issue ${i}`, category: "SEO", severity: "High", page: "https://example.com/"
    }));
    const summary = generateExecutiveSummary({ url: "https://example.com", findings });
    const count = (summary.match(/Issue \d+/g) || []).length;
    assert.equal(count, 10);
});

test("says no critical/high issues when none exist, even if low-severity ones do", () => {
    const summary = generateExecutiveSummary({
        url: "https://example.com",
        findings: [{ title: "Minor", category: "SEO", severity: "Low", page: "https://example.com/" }]
    });
    assert.match(summary, /No critical or high-severity issues found\./);
});

test("summarizes issue counts by category, sorted by frequency", () => {
    const summary = generateExecutiveSummary({
        url: "https://example.com",
        findings: [
            { title: "A", category: "Security", severity: "Low", page: "x" },
            { title: "B", category: "Security", severity: "Low", page: "x" },
            { title: "C", category: "SEO", severity: "Low", page: "x" }
        ]
    });
    const securityIndex = summary.indexOf("Security: 2");
    const seoIndex = summary.indexOf("SEO: 1");
    assert.ok(securityIndex > -1 && securityIndex < seoIndex);
});

test("escapes scraped content the same way the markdown report does", () => {
    const summary = generateExecutiveSummary({
        url: "https://example.com",
        findings: [{ title: "<script>bad</script>", category: "SEO", severity: "Critical", page: "https://example.com/" }]
    });
    assert.ok(!summary.includes("<script>"));
});
