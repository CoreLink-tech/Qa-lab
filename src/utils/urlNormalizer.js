function normalizeUrl(baseUrl, link) {
    try {
        const base = new URL(baseUrl);
        const url = new URL(link, baseUrl);

        if (url.hostname !== base.hostname) {
            return null;
        }

        return url.pathname + url.search;

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
