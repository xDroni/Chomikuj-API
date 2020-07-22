const fetch = require('node-fetch');

async function makeRequest (url, headers) {
    const res = await fetch(url, headers);
    return new Promise((resolve, reject) => {
        if(res.ok) resolve(res);
        else reject(res);
    })
}

function cookieArrayToString(cookieArray) {
    let cookieString = '';

    for (const entry of cookieArray) {
        const s = entry.split(';');
        const t = s[0].split('=');
        cookieString += t[0] + '=' + t[1] + '; ';
    }
    return cookieString;
}

module.exports = {
    makeRequest,
    cookieArrayToString
};