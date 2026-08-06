function normalizeUrl(baseUrl, link) {
    try {
        const base = new URL(baseUrl);
        const url = new URL(link, baseUrl);

        if (url.hostname !== base.hostname) {
            return null;
        }

        // "/about" and "/about/" are almost always the same page. Strip a
        // trailing slash so they dedup as one, but never touch the root
        // path itself ("/" must stay "/", not become "").
        let path = url.pathname;
        if (path.length > 1 && path.endsWith("/")) {
            path = path.slice(0, -1);
        }

        return path + url.search;

    } catch (error) {
        return null;
    }
}

function removeDuplicates(links) {
    return [...new Set(links.filter(Boolean))];
}

module.exports = {
    normalizeUrl,
    removeDuplicates
};
