const test = require("node:test");
const assert = require("node:assert/strict");
const { generateMarkdownReport, escapeMarkdown } = require("../src/markdownReport");

test("escapeMarkdown neutralizes angle brackets to prevent embedded HTML", () => {
    assert.equal(escapeMarkdown("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
});

test("escapeMarkdown escapes backticks to prevent breaking code spans", () => {
    assert.equal(escapeMarkdown("some `code` here"), "some \\`code\\` here");
});

test("escapeMarkdown handles null/undefined as empty string", () => {
    assert.equal(escapeMarkdown(null), "");
    assert.equal(escapeMarkdown(undefined), "");
});

test("generateMarkdownReport includes score, grade, and page/issue counts", () => {
    const md = generateMarkdownReport({
        url: "https://example.com",
        timestamp: "2026-01-01T00:00:00.000Z",
        score: { score: 82, grade: "B", severity: { critical: 0, high: 1, medium: 2, low: 3 } },
        summary: { pagesScanned: 5, issuesFound: 6 },
        findings: [],
        recommendations: []
    });
    assert.match(md, /Score:\*\* 82 \/ 100 \(Grade B\)/);
    assert.match(md, /Pages Scanned:\*\* 5/);
});

test("generateMarkdownReport groups findings by category", () => {
    const md = generateMarkdownReport({
        url: "https://example.com",
        findings: [
            { id: "A", title: "Issue A", category: "SEO", severity: "Low", page: "https://example.com/", details: "detail a" },
            { id: "B", title: "Issue B", category: "Security", severity: "High", page: "https://example.com/", details: "detail b" }
        ],
        recommendations: []
    });
    assert.match(md, /### SEO \(1\)/);
    assert.match(md, /### Security \(1\)/);
});

test("generateMarkdownReport escapes scraped content within a finding to prevent embedded HTML", () => {
    const md = generateMarkdownReport({
        url: "https://example.com",
        findings: [
            { id: "A", title: "<img src=x onerror=alert(1)>", category: "SEO", severity: "Low", page: "https://example.com/", details: "x" }
        ],
        recommendations: []
    });
    assert.ok(!md.includes("<img"));
    assert.ok(md.includes("&lt;img"));
});

test("generateMarkdownReport handles zero findings gracefully", () => {
    const md = generateMarkdownReport({ url: "https://example.com", findings: [], recommendations: [] });
    assert.match(md, /No issues found\./);
});
