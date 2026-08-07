# QA Lab

> A modern website Quality Assurance platform for automated website auditing, analysis, and reporting.

QA Lab is a Node.js-powered website quality assurance engine that crawls websites, analyzes pages, detects quality issues, and generates detailed reports with actionable recommendations.

Whether you're a developer, QA engineer, freelancer, agency, or business owner, QA Lab helps identify issues before they affect your users.

---

# Features

## Website Crawling

- Multi-page website crawling
- Internal link discovery
- Configurable crawl depth
- Duplicate URL prevention
- Website structure analysis

---

## Website Analysis

QA Lab currently performs automated analysis across multiple quality categories.

### SEO

- Missing H1 headings
- Multiple H1 headings
- Missing meta descriptions
- SEO best-practice validation

### Accessibility

- Missing image alt attributes
- Accessibility best-practice checks

### Security

Checks important HTTP security headers including:

- Content Security Policy (CSP)
- Strict-Transport-Security
- X-Frame-Options
- X-Content-Type-Options

Also checks (always on, no extra requests):

- HTTPS enforcement, CSP strength, cookie flags, mixed content, server
  version disclosure
- Disclosed database/application errors (SQL syntax errors, stack traces)
  already present in a fetched page's HTML

Opt-in (`--check-exposed-paths`, makes extra requests against the target):

- Well-known sensitive files (`.env`, `.git/config`, backup files) that
  are publicly reachable
- Directory listings left enabled
- Default admin panel paths (informational only -- not a vulnerability by
  itself)
- Missing `security.txt`

This is purely passive: it only reads the response of a fixed list of
static URLs. It never sends payloads and never attempts to exploit
anything. Only run it against sites you own or are authorized to test.

### Performance

- Response time analysis
- Slow page detection
- Performance quality scoring

### Forms

- Missing input names
- Missing autocomplete attributes
- Form quality validation

### Links

- Link extraction
- Link validation
- Broken link detection

### Assets

- Asset inspection
- Website resource validation

### Functionality

- General website functionality checks

---

# Reports

QA Lab automatically generates both machine-readable and human-readable reports.

Supported report formats:

- JSON
- HTML

Each report includes:

- Overall Quality Score
- Letter Grade
- Severity Breakdown
- Detailed Findings
- Actionable Recommendations

---

# Scoring System

Every website receives:

- Overall Score
- Letter Grade
- Issue Summary

Issue severities include:

- Critical
- High
- Medium
- Low

---

# Project Structure

```text
src/
├── crawler.js
├── pageScanner.js
├── scanner.js
├── normalizer.js
├── websiteModel.js
├── ruleEngine.js
├── scoring.js
├── report.js
├── exporter.js
├── recommendations/
├── rules/
│   ├── accessibilityRules.js
│   ├── assetRules.js
│   ├── formRules.js
│   ├── functionalityRules.js
│   ├── linkRules.js
│   ├── performanceRules.js
│   ├── securityRules.js
│   └── seoRules.js
└── utils.js
```

---

# Installation

Clone the repository:

```bash
git clone https://github.com/CoreLink-tech/QA-Lab.git
```

Move into the project:

```bash
cd QA-Lab
```

Install dependencies:

```bash
npm install
```

---

# Usage

Run a website scan:

```bash
node src/index.js https://example.com
```

Generate a summary:

```bash
node src/index.js https://example.com --summary
```

Display detected issues:

```bash
node src/index.js https://example.com --issues
```

Reports are automatically generated inside:

```text
reports/
├── report.json
└── report.html
```

## Quality Gates (CI/CD)

QA Lab can fail its own exit code based on scan results, so it can act as a
build gate instead of just a report generator:

```bash
# Exit 1 if any finding is "high" severity or worse
node src/index.js https://example.com --fail-on=high

# Exit 1 if the overall score drops below 70
node src/index.js https://example.com --min-score=70

# Both conditions can be combined -- either one failing fails the gate
node src/index.js https://example.com --fail-on=critical --min-score=70
```

Reports are still written even when the gate fails, so a failed CI run has
something to inspect. See `.github/workflows/test.yml` for the workflow that
runs QA Lab's own test suite, and
`.github/workflows/qa-lab-quality-gate.yml.example` for a template you can
copy into another repo to scan and gate a site of your own.

---

# Architecture

QA Lab follows a modular architecture.

Each component has a single responsibility.

- Crawler
- Page Scanner
- Website Normalizer
- Website Model
- Rule Engine
- Recommendation Engine
- Scoring Engine
- Report Generator

This design keeps the project maintainable, scalable, and easy to extend.

---

# Current Status

QA Lab is under active development.

The core website analysis engine is functional and continues to receive improvements in rule coverage, reporting, scoring, and overall accuracy.

---

# Roadmap

Upcoming features include:

- Backend API
- User Authentication
- Dashboard
- Project Management
- Team Workspaces
- PR comment posting for CI quality gate results
- Plugin System
- Public API
- Continuous Website Monitoring
- Cloud Deployment
- Enterprise Reporting

---

# Vision

Our goal is to build a comprehensive website Quality Assurance platform that combines automated crawling, website analysis, accessibility validation, SEO auditing, performance testing, security analysis, and intelligent reporting into a single developer-friendly solution.

---

# Contributing

Contributions, ideas, feature requests, and bug reports are welcome.

If you'd like to contribute:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a Pull Request.

---

# License

This project is currently proprietary.

All rights reserved.

The source code may not be copied, modified, distributed, or used commercially without explicit permission from the project owner.

---

# Author

Developed by **CoreLink Technologies**.

Building next-generation tools for software quality assurance and developer productivity.
