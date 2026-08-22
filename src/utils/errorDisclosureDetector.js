// Purely passive: these are matched against HTML the crawl already fetched,
// no extra requests. Each pattern is specific enough that a normal page
// (not actually erroring) shouldn't trigger it -- generic words like
// "error" or "warning" are deliberately excluded to avoid false positives
// on ordinary content (form validation messages, blog posts about errors,
// etc). One match per page is enough to flag it; we don't need to find
// every occurrence.
//
// Extracted out of securityRules.js so it can run during normalization,
// while the raw HTML string is already in scope -- see normalizer.js.
// This lets the pipeline drop the raw HTML afterward instead of carrying
// it through rule execution just for this one check.
const ERROR_DISCLOSURE_SIGNATURES = [
    { system: "MySQL", pattern: /you have an error in your sql syntax|mysql_fetch_(array|assoc|row)\(\)|mysqli?_query\(\)/i },
    { system: "PostgreSQL", pattern: /pg_query\(\)|PostgreSQL query failed|ERROR:\s+syntax error at or near/i },
    { system: "Oracle DB", pattern: /ORA-\d{5}/ },
    { system: "SQL Server", pattern: /Unclosed quotation mark after the character string|Microsoft OLE DB Provider for (SQL Server|ODBC Drivers)|System\.Data\.SqlClient\.SqlException/i },
    { system: "SQLite", pattern: /SQLITE_ERROR|sqlite3\.OperationalError/i },
    { system: "PHP", pattern: /Fatal error:.*on line \d+|Warning: .*\bin\b.*\bon line \d+|Uncaught (Error|Exception):/ },
    { system: "Node.js/Express", pattern: /at\s+[\w$.]+\s+\(\/[^)]+\.js:\d+:\d+\)[\s\S]{0,200}at\s+[\w$.]+\s+\(\/[^)]+\.js:\d+:\d+\)/ },
    { system: "Java", pattern: /java\.lang\.(NullPointerException|ClassNotFoundException|RuntimeException)|at [\w.]+\([\w.]+\.java:\d+\)/ },
    { system: "Ruby on Rails", pattern: /ActiveRecord::(StatementInvalid|RecordNotFound)|app\/controllers\/[\w_]+\.rb:\d+/ },
    { system: "Python/Django", pattern: /Traceback \(most recent call last\)|django\.db\.utils\.\w+Error/ }
];

function detectErrorDisclosure(html) {
    if (!html) return null;

    for (const { system, pattern } of ERROR_DISCLOSURE_SIGNATURES) {
        const match = html.match(pattern);
        if (match) {
            return { system, match: match[0].slice(0, 120) };
        }
    }

    return null;
}

module.exports = { detectErrorDisclosure };
