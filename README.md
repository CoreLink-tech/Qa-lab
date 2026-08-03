# QA-Lab

QA-Lab is an open-source website quality analysis engine that helps developers identify performance, SEO, accessibility, security, and usability issues through automated scanning and professional reporting.

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
- Quality scoring# QA-Lab

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
```

Go into the project directory:

```bash
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

View all detected issues:

```bash
node src/index.js https://example.com --issues
```

Display the help menu:

```bash
node src/index.js --help
```


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
- Response time measurement

### SEO
- Missing H1 detection
- Multiple H1 detection

### Accessibility
- Missing image alt attributes

### Forms
- Missing input name attributes
- Missing password autocomplete attributes

### Links
- Broken link detection

### Security
- Security header analysis
---

## Roadmap

### Version 1.1
- Improved scoring algorithm
- Better issue severity classification
- Issue confidence levels
- Duplicate issue detection
- Summary-only CLI mode

### Version 1.2
- Lighthouse-style performance metrics
- Mobile responsiveness checks
- Metadata analysis
- Sitemap validation
- robots.txt validation

### Version 2.0
- PDF report generation
- Screenshot capture
- AI-powered recommendations
- Historical scan comparison
- CI/CD integration
- REST API
---

## Tech Stack

- Node.js
- JavaScript
- Cheerio
- Axios

## Contributing

Contributions are welcome. If you have ideas for improvements or discover bugs, feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License.

## Support

If you find QA-Lab useful:

- ⭐ Star this repository
- 🐞 Report bugs through GitHub Issues
- 💡 Suggest new features
- 🍴 Fork the project and contribute

---

Built with ❤️ by **CoreLink Technologies**
