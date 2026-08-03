function generateHTMLReport(data) {

    const score = data.score?.score || 0;
    const grade = data.score?.grade || "-";

    const severity = data.score?.severity || {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
    };

    const findings = data.findings || [];

    const rows = findings.map(issue => `
<tr>
<td>${issue.type || "-"}</td>
<td>${issue.severity || "-"}</td>
<td>${issue.page || "-"}</td>
<td>${issue.details || "-"}</td>
</tr>
`).join("");

    return `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>QA Lab Audit Report</title>

<style>

body{
    font-family:Arial,Helvetica,sans-serif;
    background:#f5f7fb;
    margin:40px;
}

.container{
    max-width:1200px;
    margin:auto;
    background:white;
    padding:30px;
    border-radius:10px;
    box-shadow:0 2px 10px rgba(0,0,0,.1);
}

h1{
    margin-top:0;
}

.score{
    font-size:60px;
    font-weight:bold;
    color:#1f2937;
}

.grade{
    font-size:22px;
    margin-bottom:20px;
}

.summary{
    display:flex;
    gap:15px;
    flex-wrap:wrap;
    margin:25px 0;
}

.card{
    background:#f3f4f6;
    padding:15px;
    border-radius:8px;
    min-width:140px;
    text-align:center;
}

.card h3{
    margin:0;
    font-size:16px;
}

.card p{
    font-size:28px;
    margin:10px 0 0;
}

table{
    width:100%;
    border-collapse:collapse;
    margin-top:20px;
}

th{
    background:#111827;
    color:white;
    padding:12px;
}

td{
    padding:12px;
    border:1px solid #ddd;
}

tr:nth-child(even){
    background:#f9fafb;
}

</style>

</head>

<body>

<div class="container">

<h1>QA Lab Audit Report</h1>

<p><strong>Website:</strong> ${data.url}</p>

<p><strong>Generated:</strong> ${new Date(data.timestamp).toLocaleString()}</p>

<div class="score">${score}/100</div>

<div class="grade">
Grade: <strong>${grade}</strong>
</div>

<h2>Severity Summary</h2>

<div class="summary">

<div class="card">
<h3>Critical</h3>
<p>${severity.critical}</p>
</div>

<div class="card">
<h3>High</h3>
<p>${severity.high}</p>
</div>

<div class="card">
<h3>Medium</h3>
<p>${severity.medium}</p>
</div>

<div class="card">
<h3>Low</h3>
<p>${severity.low}</p>
</div>

</div>

<h2>Findings (${findings.length})</h2>

<table>

<tr>
<th>Issue</th>
<th>Severity</th>
<th>Page</th>
<th>Details</th>
</tr>

${rows}

</table>

</div>

</body>

</html>

`;

}

module.exports = generateHTMLReport;
