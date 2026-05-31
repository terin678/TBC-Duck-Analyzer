require('dotenv').config();
const axios = require('axios');
const clientId = process.env.WCL_CLIENT_ID;
const clientSecret = process.env.WCL_CLIENT_SECRET;

async function test() {
    const responseToken = await axios.post(
        "https://www.warcraftlogs.com/oauth/token",
        `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const token = responseToken.data.access_token;

    const query = JSON.stringify({
        query: `{reportData {report(code: "HPwQkDCzha97FT1Z") { 
            events(startTime: 0, endTime: 999999999999, killType: All, filterExpression: "ability.id = 27072") { data nextPageTimestamp }
        }}}`
    });

    const res = await axios.post("https://www.warcraftlogs.com/api/v2/client", query, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
    if (res.data.errors) console.log("Errors:", res.data.errors);
    else console.log("With killType: All length:", res.data.data.reportData.report.events.data.length);
}
test();
