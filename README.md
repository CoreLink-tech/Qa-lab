# QA-Lab

A lightweight command-line Quality Assurance (QA) tool for automatically scanning websites and generating actionable reports.

QA-Lab crawls websites, analyzes pages, applies QA rules, calculates an overall quality score, and generates both HTML and JSON reports.

---

## Features

- Website crawling
- Multi-page scanning
- Performance analysis
- SEO checks
- Accessibility checks
- Form validation
- Security checks
- Link validation
- HTML report generation
- JSON report generation
- Quality scoring
- CLI interface
- Issue categorization
- Severity classification

---

## Installation

Clone the repository:

```bash
git clone https://github.com/CoreLink-tech/Qa-lab.git
cd Qa-lab
```

Install dependencies:

```bash
npm install
```

---

## Usage

Scan a website:

```bash
node src/index.js https://example.com
```

Show all issues:

```bash
node src/index.js https://example.com --issues
```

Show help:

```bash
node src/index.js --help
```

---

## Example Output

```
========== QA SUMMARY ==========

Website       : https://example.com
Score         : 85/100
Grade         : B

Pages Scanned : 32
Issues Found  : 7

Severity

Critical : 0
High     : 1
Medium   : 2
Low      : 4
```

---

## Reports

QA-Lab generates:

- HTML Report
- JSON Report

Reports are saved inside:

```
reports/
```

---

## Current QA Checks

### Performance

- Slow page detection

### SEO

- Missing H1
- Multiple H1 detection

### Accessibility

- Missing image alt attributes

### Forms

- Missing name attributes
- Password autocomplete validation

### Security

- Security header checks

### Links

- Broken link detection

---

## Roadmap

- Better scoring algorithm
- Duplicate issue grouping
- PDF reports
- CSV export
- Screenshot capture
- Lighthouse integration
- API testing
- Authentication testing
- Visual regression testing
- CI/CD integration

---

## Tech Stack

- Node.js
- JavaScript
- Cheerio
- Axios

---

## License

MIT

---

## Author

Developed by **CoreLink Technologies**# Qa-lab
