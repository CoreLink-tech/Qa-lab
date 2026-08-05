// Turns raw Set-Cookie header value(s) into structured cookie objects.
// Previously this parsing lived inline inside securityRules.js as regex
// checks against the raw header; moved here so it's a first-class part
// of the website model (Set-Cookie -> model.cookies) instead of logic
// a single rule happens to own.

function parseCookies(setCookieHeader) {
    if (!setCookieHeader) return [];

    const rawCookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

    return rawCookies.map(raw => {
        const parts = raw.split(";").map(p => p.trim());
        const [nameValue, ...attributes] = parts;
        const [name] = nameValue.split("=");

        const sameSiteAttr = attributes.find(a => /^samesite=/i.test(a));

        return {
            name: name || "",
            secure: attributes.some(a => /^secure$/i.test(a)),
            httpOnly: attributes.some(a => /^httponly$/i.test(a)),
            sameSite: sameSiteAttr ? sameSiteAttr.split("=")[1] : null
        };
    });
}

module.exports = { parseCookies };
