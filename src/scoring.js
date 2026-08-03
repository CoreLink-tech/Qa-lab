function calculateScore(findings) {

    let score = 100;

    const severity = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
    };


    for (const finding of findings) {

        const level = finding.severity.toLowerCase();

        if (severity[level] !== undefined) {
            severity[level]++;
        }

        switch (level) {

            case "critical":
                score -= 20;
                break;

            case "high":
                score -= 10;
                break;

            case "medium":
                score -= 5;
                break;

            case "low":
                score -= 2;
                break;

        }

    }


    if (score < 0) {
        score = 0;
    }


    let grade = "F";

    if (score >= 90) {
        grade = "A";
    } else if (score >= 80) {
        grade = "B";
    } else if (score >= 70) {
        grade = "C";
    } else if (score >= 60) {
        grade = "D";
    }


    return {
        score,
        grade,
        severity
    };

}


module.exports = {
    calculateScore
};

