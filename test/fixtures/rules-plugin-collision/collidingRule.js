// Deliberately reuses a real built-in rule id to test collision handling.
module.exports = {
    id: "SEO",
    name: "Colliding Plugin Rule",
    category: "Custom",
    enabled: true,
    run: () => []
};
