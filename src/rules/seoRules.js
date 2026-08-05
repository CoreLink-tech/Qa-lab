const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

const TITLE_MIN_LENGTH = 10;
const TITLE_MAX_LENGTH = 60;
const DESCRIPTION_MIN_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 160;

module.exports = {
    id: "SEO",
    name: "SEO Rules",
    category: Category.SEO,
    description: "Checks heading structure, titles, meta descriptions, canonical tags, Open Graph tags, and cross-page duplication.",
    enabled: true,

    run(websiteModel) {

        const issues = [];
        const titleMap = new Map();
        const descriptionMap = new Map();

        websiteModel.pages.forEach(page => {

            const h1Count = page.headings?.h1 || 0;

            if (h1Count === 0) {
                issues.push(createFinding({
                    id: "SEO001",
                    title: "Missing H1 Heading",
                    category: Category.SEO,
                    severity: Severity.LOW,
                    page: page.url,
                    details: "Page does not contain an H1 heading.",
                    recommendation: "Add one descriptive H1 heading to the page."
                }));
            }

            if (h1Count > 1) {
                issues.push(createFinding({
                    id: "SEO002",
                    title: "Multiple H1 Headings",
                    category: Category.SEO,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: `Page contains ${h1Count} H1 headings.`,
                    recommendation: "Use only one H1 heading per page."
                }));
            }

            const title = (page.title || "").trim();

            if (!title) {
                issues.push(createFinding({
                    id: "SEO003",
                    title: "Missing Page Title",
                    category: Category.SEO,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: "Page does not have a <title> tag, or it is empty.",
                    recommendation: "Add a unique, descriptive <title> tag between 10 and 60 characters."
                }));
            } else if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
                issues.push(createFinding({
                    id: "SEO004",
                    title: "Title Length Outside Recommended Range",
                    category: Category.SEO,
                    severity: Severity.LOW,
                    page: page.url,
                    details: `Title is ${title.length} characters (recommended ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH}).`,
                    recommendation: "Adjust the title length to fit within typical search result display limits."
                }));
            }

            const description = (page.meta?.description || "").trim();

            if (!description) {
                issues.push(createFinding({
                    id: "SEO005",
                    title: "Missing Meta Description",
                    category: Category.SEO,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: "Page does not have a meta description.",
                    recommendation: "Add a unique meta description between 50 and 160 characters."
                }));
            } else if (description.length < DESCRIPTION_MIN_LENGTH || description.length > DESCRIPTION_MAX_LENGTH) {
                issues.push(createFinding({
                    id: "SEO006",
                    title: "Meta Description Length Outside Recommended Range",
                    category: Category.SEO,
                    severity: Severity.LOW,
                    page: page.url,
                    details: `Meta description is ${description.length} characters (recommended ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH}).`,
                    recommendation: "Adjust the meta description length so it displays fully in search results."
                }));
            }

            if (!page.meta?.canonical) {
                issues.push(createFinding({
                    id: "SEO007",
                    title: "Missing Canonical Tag",
                    category: Category.SEO,
                    severity: Severity.LOW,
                    page: page.url,
                    details: "Page does not specify a canonical URL.",
                    recommendation: "Add a <link rel=\"canonical\"> tag to prevent duplicate content issues."
                }));
            }

            if (!page.meta?.ogTitle && !page.meta?.ogDescription) {
                issues.push(createFinding({
                    id: "SEO008",
                    title: "Missing Open Graph Tags",
                    category: Category.SEO,
                    severity: Severity.INFO,
                    page: page.url,
                    details: "Page does not have og:title or og:description meta tags.",
                    recommendation: "Add Open Graph tags to control how the page appears when shared on social media."
                }));
            }

            // page.links is already restricted to same-host paths -- external
            // links are filtered out during crawling, so any entry here IS
            // an internal link. A successfully-loaded page with none is a
            // real internal-linking gap.
            if (page.status === 200 && (page.links?.length || 0) === 0) {
                issues.push(createFinding({
                    id: "SEO011",
                    title: "No Internal Links Found",
                    category: Category.SEO,
                    severity: Severity.INFO,
                    page: page.url,
                    details: "Page does not link to any other page on the site.",
                    recommendation: "Add internal links to help users and search engines discover related pages."
                }));
            }

            if (title) {
                if (!titleMap.has(title)) titleMap.set(title, []);
                titleMap.get(title).push(page.url);
            }

            if (description) {
                if (!descriptionMap.has(description)) descriptionMap.set(description, []);
                descriptionMap.get(description).push(page.url);
            }
        });

        // Site-wide checks: same title/description reused across multiple pages.
        for (const [title, urls] of titleMap.entries()) {
            if (urls.length > 1) {
                issues.push(createFinding({
                    id: "SEO009",
                    title: "Duplicate Page Title",
                    category: Category.SEO,
                    severity: Severity.MEDIUM,
                    page: urls[0],
                    details: `Title "${title}" is used on ${urls.length} pages: ${urls.join(", ")}`,
                    recommendation: "Give each page a unique, descriptive title."
                }));
            }
        }

        for (const [description, urls] of descriptionMap.entries()) {
            if (urls.length > 1) {
                issues.push(createFinding({
                    id: "SEO010",
                    title: "Duplicate Meta Description",
                    category: Category.SEO,
                    severity: Severity.LOW,
                    page: urls[0],
                    details: `Meta description is reused on ${urls.length} pages: ${urls.join(", ")}`,
                    recommendation: "Write a unique meta description for each page."
                }));
            }
        }

        return issues;
    }
};
